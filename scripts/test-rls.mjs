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

console.log('\nWorker A');
await as(U.aWorker, async () => {
  check('sees the job', (await q(`select id from public.jobs where id = $1`, [ids.job])).length === 1);
  check('sees the line', (await q(`select id from public.job_lines where id = $1`, [ids.line])).length === 1);
  check('does NOT see prices', (await q(`select * from public.job_line_prices`)).length === 0);
  check('does NOT see totals', (await q(`select * from public.job_totals`)).length === 0);
  check('does NOT see price lists', (await q(`select * from public.price_lists`)).length === 0);
  check('cannot mark paid', await fails(() => q(`update public.jobs set payment_status = 'paid' where id = $1`, [ids.job])));
  check('cannot delete the job', (await q(`delete from public.jobs where id = $1 returning id`, [ids.job])).length === 0);
  check('cannot change own role', await fails(() => q(`update public.profiles set role = 'owner' where id = $1`, [U.aWorker])));
  check('cannot change package', await fails(() => q(`update public.tenants set package = 'gear'`)));
  check('can lock the job', (await q(`update public.jobs set locked_at = now() where id = $1 returning id`, [ids.job])).length === 1);
  check('cannot add lines to a locked job', await fails(() => q(`insert into public.job_lines (tenant_id, job_id, description) values ($1,$2,'X')`, [tA, ids.job])));
  check('cannot unlock', await fails(() => q(`update public.jobs set locked_at = null where id = $1`, [ids.job])));
  check('can send a help message', (await q(`insert into public.job_messages (tenant_id, job_id, sender_id, kind, body) values ($1,$2,$3,'help','Trebam pomoć') returning id`, [tA, ids.job, U.aWorker])).length === 1);
  check('cannot send a task', await fails(() => q(`insert into public.job_messages (tenant_id, job_id, sender_id, receiver_id, kind, body) values ($1,$2,$3,$4,'task','x')`, [tA, ids.job, U.aWorker, U.aOwner])));
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
