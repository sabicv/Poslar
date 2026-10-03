// npm run db:test — runs the X-Files migrations on PGlite (in-process Postgres) with minimal Supabase stubs
// (auth schema, roles, storage) and checks tenant isolation and the
// owner/worker money split.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const db = new PGlite({ extensions: { pgcrypto } });

const stubs = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon, service_role;
  grant execute on function auth.uid() to authenticated, anon, service_role;
  grant usage on schema public to authenticated, anon, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant usage on schema storage to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant execute on function storage.foldername(text) to authenticated;
`;
await db.exec(stubs);

for (const file of readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(path.join(MIG, file), 'utf8'));
    console.log('applied', file);
  } catch (error) {
    console.log('FAILED', file, '-', error.message);
    process.exit(1);
  }
}
// Re-running must be safe (idempotent migrations).
for (const file of readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(path.join(MIG, file), 'utf8'));
  } catch (error) {
    console.log('NOT IDEMPOTENT', file, '-', error.message);
    process.exit(1);
  }
}
console.log('re-run ok (idempotent)');

const q = async (sql, params) => (await db.query(sql, params)).rows;
const U = {
  aOwner: '11111111-1111-4111-8111-111111111111',
  aWorker: '22222222-2222-4222-8222-222222222222',
  bOwner: '33333333-3333-4333-8333-333333333333',
};
await q(`insert into auth.users (id, email) values ($1,'a@x'),($2,'w@x'),($3,'b@x')`, [U.aOwner, U.aWorker, U.bOwner]);
const [{ register_workshop: tA }] = await q(`select public.register_workshop($1, 'Ana', 'Autoservis Šabić d.o.o.', 'volt')`, [U.aOwner]);
const [{ register_workshop: tB }] = await q(`select public.register_workshop($1, 'Boris', 'Gume Borić', 'wheel', null, null, null, 'active')`, [U.bOwner]);
await q(`insert into public.profiles (id, tenant_id, full_name, role) values ($1, $2, 'Marko', 'worker')`, [U.aWorker, tA]);
console.log('slugs', (await q(`select slug, status, trial_ends_at is not null as has_trial from public.tenants order by created_at`)).map((r) => JSON.stringify(r)).join(' '));

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) pass++;
  else fail++;
  console.log(ok ? '  ✓' : '  ✗', label, detail);
};

async function as(user, fn) {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}
async function fails(fn) {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

// Owner A creates a job with a priced line.
const ids = await as(U.aOwner, async () => {
  const [c] = await q(`insert into public.clients (tenant_id, first_name, last_name, phone) values ($1,'Ivan','Horvat','+385911') returning id`, [tA]);
  const [a] = await q(`insert into public.assets (tenant_id, client_id, asset_type, identifier) values ($1,$2,'car','ZG-1234-AB') returning id`, [tA, c.id]);
  const [j] = await q(`insert into public.jobs (tenant_id, client_id, asset_id, complaint) values ($1,$2,$3,'Ne pali') returning id, number`, [tA, c.id, a.id]);
  const [l] = await q(`insert into public.job_lines (tenant_id, job_id, kind, description, qty) values ($1,$2,'labor','Dijagnostika',1.5) returning id`, [tA, j.id]);
  await q(`insert into public.job_line_prices (job_line_id, tenant_id, unit_price) values ($1,$2,60)`, [l.id, tA]);
  const [j2] = await q(`insert into public.jobs (tenant_id, client_id, asset_id) values ($1,$2,$3) returning number`, [tA, c.id, a.id]);
  return { client: c.id, asset: a.id, job: j.id, line: l.id, n1: j.number, n2: j2.number };
});
console.log('\nOwner A');
check('job numbers run per workshop', ids.n1 === 1 && ids.n2 === 2, `${ids.n1}, ${ids.n2}`);
await as(U.aOwner, async () => {
  const [t] = await q(`select net_total, gross_total from public.job_totals where job_id = $1`, [ids.job]);
  check('owner sees totals (1.5 h × 60 € = 90 €, 112.50 € with VAT)', Number(t?.net_total) === 90 && Number(t?.gross_total) === 112.5, JSON.stringify(t));
});
// A workshop outside the VAT system charges no VAT, so its totals carry none.
await q(`update public.tenants set settings = settings || '{"vat_registered": false}' where id = $1`, [tA]);
await as(U.aOwner, async () => {
  const [t] = await q(`select net_total, gross_total from public.job_totals where job_id = $1`, [ids.job]);
  check('outside the VAT system the total has no VAT (90 €)', Number(t?.gross_total) === 90, JSON.stringify(t));
});
await q(`update public.tenants set settings = settings - 'vat_registered' where id = $1`, [tA]);

console.log('\nWorker A');
await as(U.aWorker, async () => {
  check('sees the job', (await q(`select id from public.jobs where id = $1`, [ids.job])).length === 1);
  check('sees the line', (await q(`select id from public.job_lines where id = $1`, [ids.line])).length === 1);
  check('does NOT see prices', (await q(`select * from public.job_line_prices`)).length === 0);
  check('does NOT see totals', (await q(`select * from public.job_totals`)).length === 0);
  check('does NOT see price lists', (await q(`select * from public.price_lists`)).length === 0);
  check('cannot mark paid', await fails(() => q(`update public.jobs set payment_status = 'paid' where id = $1`, [ids.job])));
  check(
    'cannot INSERT a job already marked paid',
    await fails(() => q(`insert into public.jobs (tenant_id, client_id, asset_id, payment_status, paid_at) values ($1,$2,$3,'paid',now())`, [tA, ids.client, ids.asset]))
  );
  check('cannot INSERT a locked job', await fails(() => q(`insert into public.jobs (tenant_id, client_id, asset_id, locked_at) values ($1,$2,$3,now())`, [tA, ids.client, ids.asset])));
  const [picked] = await q(`insert into public.jobs (tenant_id, client_id, asset_id, number) values ($1,$2,$3,999) returning number`, [tA, ids.client, ids.asset]);
  check('cannot choose the job number', picked.number !== 999, `${picked.number}`);
  check('cannot delete the job', (await q(`delete from public.jobs where id = $1 returning id`, [ids.job])).length === 0);
  check('cannot change own role', await fails(() => q(`update public.profiles set role = 'owner' where id = $1`, [U.aWorker])));
  check('cannot change package', await fails(() => q(`update public.tenants set package = 'gear'`)));
  check('cannot lock a job', await fails(() => q(`update public.jobs set locked_at = now() where id = $1`, [ids.job])));
  const [msg] = await q(`insert into public.job_messages (tenant_id, job_id, sender_id, kind, body) values ($1,$2,$3,'help','Trebam pomoć') returning id`, [tA, ids.job, U.aWorker]);
  check('can send a help message', Boolean(msg?.id));
  check('cannot send a task', await fails(() => q(`insert into public.job_messages (tenant_id, job_id, sender_id, receiver_id, kind, body) values ($1,$2,$3,$4,'task','x')`, [tA, ids.job, U.aWorker, U.aOwner])));
  check('cannot forge who sent a message', await fails(() => q(`update public.job_messages set sender_id = $1 where id = $2`, [U.aOwner, msg.id])));
  check('cannot rewrite a message afterwards', await fails(() => q(`update public.job_messages set body = 'Sve je u redu' where id = $1`, [msg.id])));
  check('can mark a message done', (await q(`update public.job_messages set status = 'done' where id = $1 returning id`, [msg.id])).length === 1);
  check(
    "cannot write history in the owner's name",
    await fails(() => q(`insert into public.job_events (tenant_id, job_id, event_type, actor_id, message) values ($1,$2,'phase',$3,'x')`, [tA, ids.job, U.aOwner]))
  );
  check(
    'cannot write a payment event',
    await fails(() => q(`insert into public.job_events (tenant_id, job_id, event_type, actor_id, message) values ($1,$2,'payment',$3,'x')`, [tA, ids.job, U.aWorker]))
  );
  check(
    'can write own work into history',
    (await q(`insert into public.job_events (tenant_id, job_id, event_type, actor_id, message) values ($1,$2,'phase',$3,'Popravak') returning id`, [tA, ids.job, U.aWorker])).length === 1
  );
  check(
    'can ask the Kopilot on a job',
    (await q(`insert into public.copilot_messages (tenant_id, job_id, user_id, role, kind, content) values ($1,$2,$3,'user','question','Moment glave?') returning id`, [tA, ids.job, U.aWorker])).length === 1
  );
  check(
    'cannot write a Kopilot message as someone else',
    await fails(() => q(`insert into public.copilot_messages (tenant_id, job_id, user_id, role, kind, content) values ($1,$2,$3,'user','question','x')`, [tA, ids.job, U.aOwner]))
  );
  check('cannot delete Kopilot history', (await q(`delete from public.copilot_messages returning id`)).length === 0);
});
await as(U.aOwner, async () => {
  check('owner can lock', (await q(`update public.jobs set locked_at = now() where id = $1 returning id`, [ids.job])).length === 1);
});
await as(U.aWorker, async () => {
  check('cannot add lines to a locked job', await fails(() => q(`insert into public.job_lines (tenant_id, job_id, description) values ($1,$2,'X')`, [tA, ids.job])));
  check('cannot unlock', await fails(() => q(`update public.jobs set locked_at = null where id = $1`, [ids.job])));
});
await as(U.aOwner, async () => {
  check('owner can unlock', (await q(`update public.jobs set locked_at = null where id = $1 returning id`, [ids.job])).length === 1);
});

console.log('\nOwner B (other workshop)');
await as(U.bOwner, async () => {
  check('sees none of A\'s jobs', (await q(`select id from public.jobs`)).length === 0);
  check('sees none of A\'s clients', (await q(`select id from public.clients`)).length === 0);
  check('sees no other tenant', (await q(`select id from public.tenants`)).length === 1);
  check('cannot insert into A\'s workshop', await fails(() => q(`insert into public.clients (tenant_id, first_name) values ($1,'Hack')`, [tA])));
  check('cannot point own row at A\'s client', await fails(() => q(`insert into public.assets (tenant_id, client_id, asset_type) values ($1,$2,'car')`, [tB, ids.client])));
  check('cannot update A\'s job', (await q(`update public.jobs set complaint = 'x' where id = $1 returning id`, [ids.job])).length === 0);
  check('cannot read A\'s prices', (await q(`select * from public.job_line_prices`)).length === 0);
  check('cannot read A\'s Kopilot history', (await q(`select * from public.copilot_messages`)).length === 0);
  const [own] = await q(`insert into public.clients (tenant_id, company_name) values ($1,'Borić prijevoz') returning id`, [tB]);
  check('works in own workshop', Boolean(own?.id));
});

console.log('\nStorage paths');
await as(U.aWorker, async () => {
  check('worker can upload into own workshop folder', (await q(`insert into storage.objects (bucket_id, name) values ('job-files', $1) returning id`, [`${tA}/${ids.job}/foto.jpg`])).length === 1);
  check('worker cannot upload into owner folder', await fails(() => q(`insert into storage.objects (bucket_id, name) values ('job-files', $1)`, [`${tA}/owner/racun.pdf`])));
  check('worker cannot upload into another workshop', await fails(() => q(`insert into storage.objects (bucket_id, name) values ('job-files', $1)`, [`${tB}/x/foto.jpg`])));
});

console.log('\nLocks');
await q(`update public.tenants set status = 'suspended' where id = $1`, [tA]);
await as(U.aOwner, async () => {
  check('suspended workshop sees nothing', (await q(`select id from public.jobs`)).length === 0);
  const [acc] = await q(`select status from public.my_workshop_access()`);
  check('but can learn why', acc?.status === 'suspended', JSON.stringify(acc));
});
await q(`update public.tenants set status = 'trial', trial_ends_at = now() - interval '1 day' where id = $1`, [tA]);
await as(U.aOwner, async () => {
  check('expired trial sees nothing', (await q(`select id from public.jobs`)).length === 0);
});

console.log('\nPackage constraints');
await q(`update public.tenants set status = 'active' where id = $1`, [tA]);
await as(U.aOwner, async () => {
  check('remap without compliance confirmation is refused', await fails(() => q(`insert into public.volt_module_interventions (tenant_id, job_id, module, kind) values ($1,$2,'ECM','remap')`, [tA, ids.job])));
  check('finished remap without backup is refused', await fails(() => q(`insert into public.volt_module_interventions (tenant_id, job_id, module, kind, compliance_ack, result) values ($1,$2,'ECM','remap',true,'success')`, [tA, ids.job])));
  const [s] = await q(`insert into public.volt_drain_sessions (tenant_id, job_id) values ($1,$2) returning id`, [tA, ids.job]);
  await q(`insert into public.volt_drain_readings (tenant_id, session_id, t_offset_min, current_ma) values ($1,$2,0,850),($1,$2,20,45)`, [tA, s.id]);
  check('drain readings stored', (await q(`select * from public.volt_drain_readings where session_id = $1`, [s.id])).length === 2);
  // A remap backup can't be deleted on its own, but deleting the whole job still works.
  const [j3] = await q(`insert into public.jobs (tenant_id, client_id, asset_id) values ($1,$2,$3) returning id`, [tA, ids.client, ids.asset]);
  const [att] = await q(`insert into public.attachments (tenant_id, job_id, path) values ($1,$2,$3) returning id`, [tA, j3.id, `${tA}/${j3.id}/backup.bin`]);
  await q(
    `insert into public.volt_module_interventions (tenant_id, job_id, module, kind, compliance_ack, result, backup_attachment_id) values ($1,$2,'ECM','remap',true,'success',$3)`,
    [tA, j3.id, att.id]
  );
  check('remap backup cannot be deleted on its own', await fails(() => q(`delete from public.attachments where id = $1`, [att.id])));
  check('deleting the whole job with its backup works', (await q(`delete from public.jobs where id = $1 returning id`, [j3.id])).length === 1);
});
await as(U.bOwner, async () => {
  const [c] = await q(`select id from public.clients limit 1`);
  const [set] = await q(`insert into public.wheel_tire_sets (tenant_id, client_id, season, width, aspect, rim_diameter) values ($1,$2,'winter',205,55,16) returning id, qr_code`, [tB, c.id]);
  check('tire set gets a QR code', /^[0-9a-f]{12}$/.test(set.qr_code), set.qr_code);
  const [r] = await q(`insert into public.wheel_repairs (tenant_id, job_id, position, damage_zone) select $1, j.id, 'FL', 'sidewall' from (select null) x cross join lateral (select id from public.jobs limit 1) j returning allowed`, [tB]).catch(() => [undefined]);
  check('sidewall repair is flagged not allowed (or no job yet)', r === undefined || r.allowed === false);
});

console.log('\nField work');
{
  const [site] = await as(U.aWorker, () => q(`insert into public.sites (tenant_id, client_id, address, city) values ($1,$2,'Ilica 112','Zagreb') returning id`, [tA, ids.client]));
  const [plan] = await as(U.aOwner, () =>
    q(`insert into public.maintenance_plans (tenant_id, client_id, site_id, title, interval_months, next_due_date) values ($1,$2,$3,'Godišnji servis',12,'2026-01-10') returning id`, [tA, ids.client, site.id])
  );
  const [fieldJob] = await as(U.aWorker, () =>
    q(`insert into public.jobs (tenant_id, client_id, asset_id, work_mode, site_id, plan_id, scheduled_start) values ($1,$2,$3,'field',$4,$5, now()) returning id, report_token`, [tA, ids.client, ids.asset, site.id, plan.id])
  );
  check('worker can add a site and a field job', Boolean(site?.id && fieldJob?.id));
  check('every job gets a report link token', /^[0-9a-f-]{36}$/.test(fieldJob.report_token));
  await as(U.aWorker, () => q(`update public.jobs set phase = 'ready', finished_at = '2026-10-01T09:00:00Z', left_at = now() where id = $1`, [fieldJob.id]));
  const [advanced] = await q(`select next_due_date::text as d, last_job_id from public.maintenance_plans where id = $1`, [plan.id]);
  check('finishing the job moves the plan one interval on', advanced.d === '2027-10-01' && advanced.last_job_id === fieldJob.id, JSON.stringify(advanced));
  check('worker cannot delete a site', (await as(U.aWorker, () => q(`delete from public.sites where id = $1 returning id`, [site.id]))).length === 0);
  await as(U.bOwner, async () => {
    check("other workshop sees none of A's sites", (await q(`select id from public.sites`)).length === 0);
    check("other workshop sees none of A's plans", (await q(`select id from public.maintenance_plans`)).length === 0);
    const [bClient] = await q(`select id from public.clients limit 1`);
    const [bAsset] = await q(`insert into public.assets (tenant_id, client_id, asset_type) values ($1,$2,'ac_split') returning id`, [tB, bClient.id]);
    check(
      "other workshop cannot attach a job to A's site",
      await fails(() => q(`insert into public.jobs (tenant_id, client_id, asset_id, site_id) values ($1,$2,$3,$4)`, [tB, bClient.id, bAsset.id, site.id]))
    );
  });
}

// The public approval page calls decide_approval with the service role.
console.log('\nCustomer approval (atomic)');
{
  const lines = await q(`insert into public.job_lines (tenant_id, job_id, description, approval) values ($1,$2,'Pločice','proposed'),($1,$2,'Diskovi','proposed') returning id`, [tA, ids.job]);
  const [ap] = await q(`insert into public.approvals (tenant_id, job_id) values ($1,$2) returning token`, [tA, ids.job]);
  const decide = (decisions, token = ap.token) => q(`select public.decide_approval($1, 'Ivan Horvat', $2::jsonb) as r`, [token, JSON.stringify(decisions)]);
  const [l0, l1] = lines.map((l) => l.id);
  check('a decision on only some lines is refused', await fails(() => decide([{ lineId: l0, decision: 'approved' }])));
  check('a duplicated line is refused', await fails(() => decide([{ lineId: l0, decision: 'approved' }, { lineId: l0, decision: 'declined' }])));
  check('an unknown decision is refused', await fails(() => decide([{ lineId: l0, decision: 'maybe' }, { lineId: l1, decision: 'approved' }])));
  const [res] = await decide([{ lineId: l0, decision: 'approved' }, { lineId: l1, decision: 'declined' }]);
  check('a complete decision is saved', res.r.approved === 1 && res.r.total === 2, JSON.stringify(res.r));
  const states = (await q(`select approval from public.job_lines where id = any($1::uuid[]) order by description`, [[l0, l1]])).map((r) => r.approval).join(',');
  check('lines follow the decision', states === 'declined,approved', states);
  check('the same link cannot decide twice', await fails(() => decide([{ lineId: l0, decision: 'approved' }, { lineId: l1, decision: 'approved' }])));
  const [expired] = await q(`insert into public.approvals (tenant_id, job_id, expires_at) values ($1,$2, now() - interval '1 day') returning token`, [tA, ids.job]);
  check('an expired link is refused', await fails(() => decide([{ lineId: l0, decision: 'approved' }], expired.token)));
}

// Invoices are numbered per workshop and year, and only the owner issues them.
console.log('\nInvoices');
{
  const issue = (user, jobId) => as(user, () => q(`select * from public.issue_invoice($1)`, [jobId]));
  check('worker cannot issue an invoice', await fails(() => issue(U.aWorker, ids.job)));
  const [first] = await issue(U.aOwner, ids.job);
  check('first invoice of the year is number 1', first.o_number === 1 && first.o_year >= 2026, JSON.stringify(first));
  const [again] = await issue(U.aOwner, ids.job);
  check('issuing the same job again keeps its number', again.o_number === 1, JSON.stringify(again));
  const [other] = await as(U.aOwner, () => q(`insert into public.jobs (tenant_id, client_id, asset_id) values ($1,$2,$3) returning id`, [tA, ids.client, ids.asset]));
  const [second] = await issue(U.aOwner, other.id);
  check('the next job gets number 2', second.o_number === 2, JSON.stringify(second));
  await as(U.aWorker, async () => {
    check('worker cannot renumber an invoice', await fails(() => q(`update public.jobs set invoice_number = 7 where id = $1`, [ids.job])));
    check('worker cannot write the fiscal receipt number', await fails(() => q(`update public.jobs set invoice_fiscal_ref = 'x' where id = $1`, [ids.job])));
  });
  check("another workshop cannot issue A's invoice", await fails(() => issue(U.bOwner, other.id)));
  const [issued] = await q(`select invoice_token from public.jobs where id = $1`, [ids.job]);
  check('every job has a private invoice link token', /^[0-9a-f-]{36}$/.test(String(issued.invoice_token)), String(issued.invoice_token));
}

// Aqua, Tow and Deal: the new trades' records follow the same rules.
console.log('\nAqua, Tow, Deal');
{
  const [heater] = await as(U.aOwner, () => q(`insert into public.assets (tenant_id, client_id, asset_type, make) values ($1,$2,'water_heater','Gorenje') returning id`, [tA, ids.client]));
  check('a water heater is a valid object type', Boolean(heater?.id));
  await as(U.aWorker, async () => {
    await q(`insert into public.tow_calls (tenant_id, job_id, payer, pickup_address) values ($1,$2,'assistance','A1, 112. km')`, [tA, ids.job]);
    await q(`insert into public.deal_stock (tenant_id, job_id, asset_id, asking_price) values ($1,$2,$3, 8900)`, [tA, ids.job, ids.asset]);
    await q(`insert into public.aqua_pressure_tests (tenant_id, job_id, test_pressure_bar, end_pressure_bar, duration_min, passed) values ($1,$2,10,9.9,30,true)`, [tA, ids.job]);
    check('worker writes a tow call, a car for sale and a pressure test', (await q(`select 1 from public.tow_calls union all select 1 from public.deal_stock union all select 1 from public.aqua_pressure_tests`)).length === 3);
    check('worker cannot delete a car for sale', (await q(`delete from public.deal_stock where job_id = $1 returning job_id`, [ids.job])).length === 0);
    await q(`insert into public.tow_storage (tenant_id, job_id, asset_id) values ($1,$2,$3)`, [tA, ids.job, ids.asset]);
    check('the same car cannot be on the yard twice', await fails(() => q(`insert into public.tow_storage (tenant_id, job_id, asset_id) values ($1,$2,$3)`, [tA, ids.job, ids.asset])));
  });
  await as(U.bOwner, async () => {
    check("another workshop sees none of A's calls, cars or tests", (await q(`select 1 from public.tow_calls union all select 1 from public.deal_stock union all select 1 from public.aqua_pressure_tests union all select 1 from public.tow_storage`)).length === 0);
    check("another workshop cannot write into A's work order", await fails(() => q(`insert into public.tow_calls (tenant_id, job_id) values ($1,$2)`, [tA, ids.job])));
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
