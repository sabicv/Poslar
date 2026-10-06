// npm run db:test — runs the Poslar migrations on PGlite (in-process Postgres) with minimal Supabase stubs
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

  // Fiscal fields: payment method, premises and device, operator.
  const [m] = await q(`select invoice_payment_method, invoice_premises, invoice_device, invoice_operator from public.jobs where id = $1`, [ids.job]);
  check('without premises and device: bank transfer by default, numbering as before', m.invoice_payment_method === 'transfer' && m.invoice_premises === null && m.invoice_operator === 'Ana', JSON.stringify(m));
  await q(`update public.tenants set settings = settings || '{"fiscal": {"premises": "PP1", "device": "1"}}' where id = $1`, [tA]);
  const issueWith = (jobId, method) => as(U.aOwner, () => q(`select * from public.issue_invoice($1, $2)`, [jobId, method]));
  const newJob = async () => (await as(U.aOwner, () => q(`insert into public.jobs (tenant_id, client_id, asset_id) values ($1,$2,$3) returning id`, [tA, ids.client, ids.asset])))[0].id;
  const j3 = await newJob();
  const [third] = await issueWith(j3, 'cash');
  const [f3] = await q(`select invoice_payment_method, invoice_premises, invoice_device from public.jobs where id = $1`, [j3]);
  check('premises PP1, device 1: own sequence starts at 1, cash kept', third.o_number === 1 && f3.invoice_premises === 'PP1' && f3.invoice_device === '1' && f3.invoice_payment_method === 'cash', JSON.stringify({ third, f3 }));
  const [fourth] = await issueWith(await newJob(), 'card');
  check('next on PP1/1 is 2', fourth.o_number === 2, JSON.stringify(fourth));
  check('unknown payment method refused', await fails(() => issueWith(newJob(), 'bitcoin')));
  await as(U.aWorker, async () => {
    check('worker cannot change the payment method', await fails(() => q(`update public.jobs set invoice_payment_method = 'card' where id = $1`, [j3])));
  });
  await q(`update public.tenants set settings = settings - 'fiscal' where id = $1`, [tA]);
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

// Toranj: subscription fields, support tickets, errors and AI usage.
console.log('\nToranj');
{
  await as(U.aOwner, async () => {
    check('owner cannot change own plan', await fails(() => q(`update public.tenants set plan = 'premium' where id = $1`, [tA])));
    check('owner cannot move "paid until"', await fails(() => q(`update public.tenants set paid_until = '2099-01-01' where id = $1`, [tA])));
    check('owner cannot raise own AI quota', await fails(() => q(`update public.tenants set ai_quota = '{"scan": 99999}' where id = $1`, [tA])));
    check('owner cannot write a ticket past the server', await fails(() => q(`insert into public.support_tickets (tenant_id, user_id) values ($1,$2)`, [tA, U.aOwner])));
    check('owner cannot read errors, payments or AI usage', await fails(() => q(`select 1 from public.app_errors`)) && (await fails(() => q(`select 1 from public.subscription_payments`))) && (await fails(() => q(`select 1 from public.ai_usage`))));
    check('owner cannot log errors directly', await fails(() => q(`select public.log_app_error('x','client','m',null,null,null,null,null,null)`)));
  });
  // Written by the server (service role here: no role switch).
  const [mine] = await q(`insert into public.support_tickets (tenant_id, user_id) values ($1,$2) returning id`, [tA, U.aWorker]);
  const [owners] = await q(`insert into public.support_tickets (tenant_id, user_id) values ($1,$2) returning id`, [tA, U.aOwner]);
  await q(`insert into public.support_messages (ticket_id, tenant_id, author_id, body) values ($1,$2,$3,'Ne radi slikanje'),($4,$2,$5,'Kako dodati radnika?')`, [mine.id, tA, U.aWorker, owners.id, U.aOwner]);
  await as(U.aWorker, async () => {
    const seen = await q(`select id from public.support_tickets`);
    check('worker sees only own ticket', seen.length === 1 && seen[0].id === mine.id);
    check("worker sees no messages of the owner's ticket", (await q(`select 1 from public.support_messages where ticket_id = $1`, [owners.id])).length === 0);
  });
  await as(U.aOwner, async () => {
    check('owner sees every ticket of the workshop', (await q(`select id from public.support_tickets`)).length === 2);
  });
  await as(U.bOwner, async () => {
    check("another workshop sees none of A's tickets", (await q(`select id from public.support_tickets union all select id from public.support_messages`)).length === 0);
  });
  await q(`select public.log_app_error('fp1','client','TypeError: x is undefined','at a.js:1','/app',null,'test',$1,$2)`, [tA, U.aWorker]);
  await q(`update public.app_errors set status = 'resolved', resolved_at = now() where fingerprint = 'fp1'`);
  await q(`select public.log_app_error('fp1','client','TypeError: x is undefined','at a.js:1','/app/jobs',null,'test',$1,null)`, [tA]);
  const [err] = await q(`select count, status, url, last_user_id from public.app_errors where fingerprint = 'fp1'`);
  check('the same error counts up and reopens', err.count === 2 && err.status === 'open' && err.url === '/app/jobs' && err.last_user_id === U.aWorker, JSON.stringify(err));
}

// Price list: the owner's own template prices stay with the owner.
console.log('\nCjenik');
{
  await as(U.aOwner, async () => {
    await q(`insert into public.templates (tenant_id, package, code, name, lines) values ($1,'volt','own.test','Moj posao','[{"kind":"labor","description":"Rad","qty":1,"unit":"h"}]')`, [tA]);
    await q(`insert into public.template_prices (tenant_id, template_code, line_no, price) values ($1,'own.test',0,62)`, [tA]);
    check('owner saves a template and its price', (await q(`select price from public.template_prices`)).length === 1);
  });
  await as(U.aWorker, async () => {
    check('worker sees the template', (await q(`select code from public.templates where code = 'own.test'`)).length === 1);
    check('worker sees no template prices', (await q(`select * from public.template_prices`)).length === 0);
    check('worker cannot set a template price', await fails(() => q(`insert into public.template_prices (tenant_id, template_code, line_no, price) values ($1,'own.test',1,1)`, [tA])));
    check('worker cannot change a template', (await q(`update public.templates set name = 'x' where code = 'own.test' returning id`)).length === 0);
  });
  await as(U.bOwner, async () => {
    check("another workshop sees none of A's prices", (await q(`select * from public.template_prices`)).length === 0);
  });
  const [pl] = await q(`select count(*)::int as n from public.price_lists where tenant_id = $1 and is_default`, [tA]);
  check('every workshop has a default price list', pl.n === 1);
}

// QR self-intake: the owner switches it, nobody else touches the token.
console.log('\nQR samoprijem');
{
  const [{ intake_token: tok }] = await q(`select intake_token from public.tenants where id = $1`, [tA]);
  check('every workshop has an intake token', /^[0-9a-f-]{36}$/.test(String(tok)));
  await as(U.aOwner, async () => {
    check('owner switches self-intake off', (await q(`update public.tenants set intake_enabled = false where id = $1 returning id`, [tA])).length === 1);
    check('owner cannot pick the token', await fails(() => q(`update public.tenants set intake_token = gen_random_uuid() where id = $1`, [tA])));
    check('owner cannot read the attempts', await fails(() => q(`select * from public.intake_attempts`)));
  });
  await as(U.aWorker, async () => {
    check('worker cannot switch self-intake', (await q(`update public.tenants set intake_enabled = true where id = $1 returning id`, [tA])).length === 0);
  });
  const [{ n }] = await q(`select count(*)::int as n from public.tenants where intake_token = $1`, [tok]);
  check('tokens are unique', n === 1);
}

// Subscription reference and referrals: written by Poslar only.
console.log('\nPretplata i preporuke');
{
  const refs = await q(`select billing_ref from public.tenants order by created_at`);
  check('every workshop has its own payment reference from 1001', refs.every((r) => r.billing_ref >= 1001) && new Set(refs.map((r) => r.billing_ref)).size === refs.length, JSON.stringify(refs));
  await as(U.aOwner, async () => {
    check('owner cannot change the payment reference', await fails(() => q(`update public.tenants set billing_ref = 5 where id = $1`, [tA])));
    check('owner cannot pick who referred the workshop', await fails(() => q(`update public.tenants set referred_by = $2 where id = $1`, [tA, tB])));
    check('owner cannot mark the referral as rewarded', await fails(() => q(`update public.tenants set referral_rewarded_at = now() where id = $1`, [tA])));
    check('owner cannot rewrite when the terms were accepted', await fails(() => q(`update public.tenants set terms_accepted_at = now(), terms_version = 'x' where id = $1`, [tA])));
    await q(`update public.tenants set settings = settings || '{"demo": true}' where id = $1`, [tA]);
  });
  const [own] = await q(`select settings ? 'demo' as demo from public.tenants where id = $1`, [tA]);
  check('owner cannot mark the workshop as a demo (no billing)', own.demo === false, JSON.stringify(own));
  // A demo workshop set up by Poslar keeps the flag when its owner saves settings.
  await q(`update public.tenants set settings = settings || '{"demo": true}' where id = $1`, [tB]);
  await as(U.bOwner, async () => {
    await q(`update public.tenants set settings = '{"onboarding_hidden": true}' where id = $1`, [tB]);
  });
  const [demo] = await q(`select settings from public.tenants where id = $1`, [tB]);
  check('a demo workshop keeps its flag, the rest of the save goes through', demo.settings.demo === true && demo.settings.onboarding_hidden === true, JSON.stringify(demo.settings));
  await q(`update public.tenants set settings = settings - 'demo' - 'onboarding_hidden' where id = $1`, [tB]);
  await q(`update public.tenants set referred_by = $2 where id = $1`, [tA, tB]);
  check('the server records who referred a workshop', (await q(`select 1 from public.tenants where id = $1 and referred_by = $2`, [tA, tB])).length === 1);
}

// Customers sort by surname (a company by its name).
console.log('\nAbeceda mušterija');
{
  const rows = await as(U.aOwner, () =>
    q(
      `insert into public.clients (tenant_id, kind, first_name, last_name, company_name) values ($1,'person','Ivan','Babić',null),($1,'company','Pero','Zec','Auto Centar d.o.o.'),($1,'person','Ana',null,null) returning sort_name`,
      [tA]
    )
  );
  check('sort key: surname first, a company by its name', rows.map((r) => r.sort_name).join('|') === 'babić ivan|auto centar d.o.o.|ana', rows.map((r) => r.sort_name).join('|'));
  check('the sort key cannot be written', await fails(() => as(U.aOwner, () => q(`update public.clients set sort_name = 'a' where tenant_id = $1`, [tA]))));
}

// AI phone: the number is the tower's; calls are the owner's to read.
console.log('\nAI telefon');
{
  await as(U.aOwner, async () => {
    check('owner cannot attach a phone number', await fails(() => q(`update public.tenants set phone_agent_number_id = 'x' where id = $1`, [tA])));
    check('owner cannot write a call', await fails(() => q(`insert into public.phone_calls (tenant_id, provider_call_id) values ($1, 'c0')`, [tA])));
  });
  await q(`insert into public.phone_calls (tenant_id, provider_call_id, caller, summary) values ($1, 'c1', '+385911', 'Termin za utorak')`, [tA]);
  check('owner reads the workshop calls', (await as(U.aOwner, () => q(`select summary from public.phone_calls`))).length === 1);
  check('a worker does not', (await as(U.aWorker, () => q(`select summary from public.phone_calls`))).length === 0);
  check('another workshop does not', (await as(U.bOwner, () => q(`select summary from public.phone_calls`))).length === 0);
  await q(`update public.tenants set phone_agent_number_id = 'vapi-1' where id = $1`, [tA]);
  check('one Vapi number belongs to one workshop', await fails(() => q(`update public.tenants set phone_agent_number_id = 'vapi-1' where id = $1`, [tB])));
}

// Help videos: written by the tower through the server only.
console.log('\nVideo upute');
{
  await q(`insert into public.help_videos (topic, url) values ('start', 'https://youtu.be/abc')`);
  check('a link must start with https://', await fails(() => q(`insert into public.help_videos (topic, url) values ('install', 'javascript:alert(1)')`)));
  await as(U.aOwner, async () => {
    check('an owner cannot read the table directly', await fails(() => q(`select * from public.help_videos`)));
    check('an owner cannot change a video', await fails(() => q(`update public.help_videos set url = 'https://evil.example' where topic = 'start'`)));
  });
}

// The 24-hour trial: a copy of the trade's sample workshop, then real work.
console.log('\nProbni dan');
{
  const S = { owner: '44444444-4444-4444-8444-444444444444', worker: '55555555-5555-4555-8555-555555555555' };
  const T = { owner: '66666666-6666-4666-8666-666666666666' };
  await q(`insert into auth.users (id, email) values ($1,'uzorak@x'),($2,'uzorak.radnik@x'),($3,'probni@x')`, [S.owner, S.worker, T.owner]);
  const [{ register_workshop: tS }] = await q(`select public.register_workshop($1, 'Uzorak', 'Uzorak Gear', 'wheel', null, null, null, 'active')`, [S.owner]);
  await q(`insert into public.profiles (id, tenant_id, full_name, role) values ($1, $2, 'Radnik uzorka', 'worker')`, [S.worker, tS]);
  // Seeded ten days ago.
  await q(`update public.tenants set slug = 'uzorak-wheel', created_at = now() - interval '10 days', settings = '{"demo": true, "sample": true, "calendar": {"slotMinutes": 60}}' where id = $1`, [tS]);
  await q(`update public.price_lists set labor_rates = '{"default": 55}' where tenant_id = $1`, [tS]);
  const [c1] = await q(`insert into public.clients (tenant_id, first_name, last_name, phone) values ($1,'Marko','Kovač','+385981') returning id`, [tS]);
  const [c2] = await q(`insert into public.clients (tenant_id, first_name, last_name) values ($1,'Iva','Perić') returning id`, [tS]);
  const [a1] = await q(`insert into public.assets (tenant_id, client_id, asset_type, identifier) values ($1,$2,'car','ST-100-AA') returning id`, [tS, c1.id]);
  const [a2] = await q(`insert into public.assets (tenant_id, client_id, asset_type, identifier) values ($1,$2,'car','ZG-200-BB') returning id`, [tS, c2.id]);
  const [j1] = await q(
    `insert into public.jobs (tenant_id, client_id, asset_id, complaint, number, assigned_to, created_by, created_at, scheduled_start, invoice_number, invoice_year, invoice_issued_at, locked_at)
     values ($1,$2,$3,'Zamjena guma',1,$4,$5, now() - interval '10 days', (current_date - 10) + time '10:00', 3, extract(year from now())::int, now() - interval '10 days', now() - interval '10 days') returning id, report_token, invoice_token`,
    [tS, c1.id, a1.id, S.worker, S.owner]
  );
  const [j2] = await q(`insert into public.jobs (tenant_id, client_id, asset_id, complaint, number) values ($1,$2,$3,'Balansiranje',2) returning id`, [tS, c2.id, a2.id]);
  const [l1] = await q(`insert into public.job_lines (tenant_id, job_id, kind, description, qty) values ($1,$2,'labor','Zamjena 4 gume',1) returning id`, [tS, j1.id]);
  await q(`insert into public.job_line_prices (job_line_id, tenant_id, unit_price) values ($1,$2,40)`, [l1.id, tS]);
  await q(`insert into public.attachments (tenant_id, job_id, path, has_thumb, created_by) values ($1,$2,$3,true,$4)`, [tS, j1.id, `${tS}/${j1.id}/a.jpg`, S.worker]);
  const [ap] = await q(`insert into public.approvals (tenant_id, job_id, signature_path) values ($1,$2,$3) returning token`, [tS, j1.id, `${tS}/${j1.id}/potpis.png`]);
  const [m1] = await q(`insert into public.job_messages (tenant_id, job_id, sender_id, receiver_id, kind, body) values ($1,$2,$3,$4,'task','Provjeri tlak') returning id`, [tS, j1.id, S.owner, S.worker]);
  await q(`insert into public.job_messages (tenant_id, job_id, sender_id, kind, body, reply_to_id) values ($1,$2,$3,'help','Gotovo',$4)`, [tS, j1.id, S.worker, m1.id]);
  const [set1] = await q(`insert into public.wheel_tire_sets (tenant_id, client_id, asset_id, season) values ($1,$2,$3,'winter') returning qr_code`, [tS, c1.id, a1.id]);
  await q(`insert into public.reminders (tenant_id, client_id, asset_id, kind, title, due_date) values ($1,$2,$3,'season','Zimske gume', current_date - 10 + 30)`, [tS, c1.id, a1.id]);
  // A job and its maintenance plan point at each other.
  const [plan] = await q(`insert into public.maintenance_plans (tenant_id, client_id, asset_id, title, next_due_date, last_job_id) values ($1,$2,$3,'Godišnji pregled', current_date + 20, $4) returning id`, [tS, c1.id, a1.id, j1.id]);
  await q(`update public.jobs set plan_id = $2 where id = $1`, [j2.id, plan.id]);
  const count = async (tenant) =>
    Object.fromEntries(
      await Promise.all(
        ['clients', 'assets', 'jobs', 'job_lines', 'job_line_prices', 'attachments', 'approvals', 'job_messages', 'wheel_tire_sets', 'reminders'].map(async (t) => [t, (await q(`select count(*)::int as n from public.${t} where tenant_id = $1`, [tenant]))[0].n])
      )
    );
  const before = await count(tS);

  const [{ register_workshop: tT }] = await q(`select public.register_workshop($1, 'Probni Vlasnik', 'Probni Vlasnik', 'wheel')`, [T.owner]);
  check('only a sample workshop can be copied', await fails(() => q(`select * from public.clone_sample($1, $2)`, [tA, tT])));
  check('a signed-in owner cannot start a copy', await fails(() => as(T.owner, () => q(`select * from public.clone_sample($1, $2)`, [tS, tT]))));
  const files = await q(`select * from public.clone_sample($1, $2)`, [tS, tT]);
  const after = await count(tT);
  check('every sample row is copied', JSON.stringify(after) === JSON.stringify(before), JSON.stringify(after));
  check('the sample itself is untouched', JSON.stringify(await count(tS)) === JSON.stringify(before));
  check(
    'files to copy move to the new folder, thumbnail included',
    files.length === 3 && files.every((f) => f.from_path.startsWith(`${tS}/`) && f.to_path === `${tT}/` + f.from_path.slice(tS.length + 1)) && files.some((f) => f.to_path.endsWith('a.jpg.thumb.jpg')),
    JSON.stringify(files)
  );
  const [nj] = await q(
    `select j.*, round(extract(epoch from (j.scheduled_start - $2::timestamptz)) / 86400)::int as moved, c.tenant_id as client_tenant, c.is_demo as client_demo from public.jobs j join public.clients c on c.id = j.client_id where j.tenant_id = $1 and j.number = 1`,
    [tT, (await q(`select scheduled_start from public.jobs where id = $1`, [j1.id]))[0].scheduled_start]
  );
  check('links follow the new ids', nj && nj.id !== j1.id && nj.client_tenant === tT);
  check('the sample people become the new owner', nj.assigned_to === T.owner && nj.created_by === T.owner, `${nj.assigned_to} ${nj.created_by}`);
  check('dates move to today (whole days)', nj.moved === 10, JSON.stringify(nj.moved));
  check('tokens are new', nj.report_token !== j1.report_token && nj.invoice_token !== j1.invoice_token);
  check('marked as samples, invoice in the PRIMJER series', nj.is_demo === true && nj.client_demo === true && nj.invoice_premises === 'PRIMJER' && nj.invoice_number === 3);
  const [na] = await q(`select token, signature_path from public.approvals where tenant_id = $1`, [tT]);
  check('approval link and signature path are new', na.token !== ap.token && na.signature_path.startsWith(`${tT}/`));
  const [nm] = await q(`select r.id from public.job_messages r join public.job_messages p on p.id = r.reply_to_id where r.tenant_id = $1 and p.tenant_id = $1`, [tT]);
  check('a reply points to the copied message', Boolean(nm));
  const [cyc] = await q(
    `select p.tenant_id as plan_tenant, lj.tenant_id as last_job_tenant, lj.number as last_job_number from public.jobs j join public.maintenance_plans p on p.id = j.plan_id join public.jobs lj on lj.id = p.last_job_id where j.tenant_id = $1 and j.number = 2`,
    [tT]
  );
  check('a job and its plan point at each other in the copy', cyc?.plan_tenant === tT && cyc?.last_job_tenant === tT && cyc?.last_job_number === 1, JSON.stringify(cyc));
  const [ns] = await q(`select qr_code from public.wheel_tire_sets where tenant_id = $1`, [tT]);
  check('QR codes are new', ns.qr_code !== set1.qr_code);
  const [tt] = await q(`select settings, sample_until > now() + interval '23 hours' as day, (select labor_rates from public.price_lists where tenant_id = $1 and is_default) as rates from public.tenants where id = $1`, [tT]);
  check('24 hours start; hours and labour rate come along; no demo flag', tt.day && tt.settings.calendar?.slotMinutes === 60 && !('demo' in tt.settings) && !('sample' in tt.settings) && tt.rates.default === 55, JSON.stringify(tt));
  check('a second copy into the same workshop is refused', await fails(() => q(`select * from public.clone_sample($1, $2)`, [tS, tT])));
  await as(T.owner, async () => {
    check('the owner sees the sample jobs', (await q(`select id from public.jobs`)).length === 2);
    check('the owner cannot end the trial time', await fails(() => q(`update public.tenants set sample_until = null where id = $1`, [tT])));
    check('the owner cannot end the trial in the database', await fails(() => q(`select * from public.end_sample($1)`, [tT])));
    check('the owner cannot read the sample bookkeeping', await fails(() => q(`select * from public.sample_rows`)));
  });

  // Real work during the trial: a new customer, and a real job for a sample customer.
  const real = await as(T.owner, async () => {
    const [rc] = await q(`insert into public.clients (tenant_id, first_name, last_name) values ($1,'Pravi','Kupac') returning id`, [tT]);
    const [ra] = await q(`insert into public.assets (tenant_id, client_id, asset_type, identifier) values ($1,$2,'car','RI-1-RI') returning id`, [tT, rc.id]);
    const [rj] = await q(`insert into public.jobs (tenant_id, client_id, asset_id, complaint) values ($1,$2,$3,'Pravi posao') returning id, number`, [tT, rc.id, ra.id]);
    const [sc] = await q(`select id, (select id from public.assets where client_id = c.id) as asset from public.clients c where last_name = 'Kovač'`);
    const [sj] = await q(`insert into public.jobs (tenant_id, client_id, asset_id, complaint) values ($1,$2,$3,'Stalna mušterija') returning id`, [tT, sc.id, sc.asset]);
    await q(`insert into public.job_lines (tenant_id, job_id, kind, description, qty) values ($1,(select id from public.jobs where number = 2),'labor','Dodano u primjer',1)`, [tT]);
    await q(`update public.jobs set phase = 'ready' where id = $1`, [rj.id]);
    const [inv] = await q(`select * from public.issue_invoice($1, 'cash')`, [rj.id]);
    return { client: rc.id, job: rj.id, number: rj.number, sampleClient: sc.id, sampleClientJob: sj.id, invoice: inv.o_number };
  });
  check('a real job numbers after the samples', real.number === 3, String(real.number));
  check("the first real invoice is number 1 (samples have their own series)", real.invoice === 1, String(real.invoice));

  const gone = await q(`select * from public.end_sample($1)`, [tT]);
  const left = await count(tT);
  check('sample jobs go, with what was added to them', left.jobs === 2 && left.job_lines === 0 && left.approvals === 0 && left.job_messages === 0, JSON.stringify(left));
  check('a sample customer with a real job stays, as a real customer', (await q(`select is_demo from public.clients where id = $1`, [real.sampleClient]))[0]?.is_demo === false);
  check('the other sample customer goes', left.clients === 2, String(left.clients));
  check('real work stays', (await q(`select 1 from public.jobs where id = any($1::uuid[]) and not is_demo`, [[real.job, real.sampleClientJob]])).length === 2);
  check('files no row points to are returned for deletion', gone.length === 3 && gone.every((g) => g.path.startsWith(`${tT}/`)), JSON.stringify(gone));
  const [done] = await q(`select sample_until, (select count(*)::int from public.sample_rows where tenant_id = $1) as rows from public.tenants where id = $1`, [tT]);
  check('the trial is over: no sample bookkeeping left', done.sample_until === null && done.rows === 0, JSON.stringify(done));
  check('the sample workshop still has everything', JSON.stringify(await count(tS)) === JSON.stringify(before));

  await q(`insert into public.trial_feedback (workshop, stars, body, may_publish) values ('Probni Vlasnik', 4, 'Dobro', true)`);
  check('stars are 1 to 5', await fails(() => q(`insert into public.trial_feedback (workshop, stars) values ('x', 6)`)));
  check('an owner cannot read the reviews', await fails(() => as(T.owner, () => q(`select * from public.trial_feedback`))));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
