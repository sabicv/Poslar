// npm run db:seed — creates one demo workshop per package (Volt, Gear,
// Body, Wheel, Fleet, Machine, Moto, Marine, Air, Aqua, Tow, Deal, Detail, Electric,
// Appliance, Locksmith, Pool, Clean), each with an owner and a worker account,
// customers, vehicles/machines/boats, work orders in every phase with
// priced lines, inspections, condition reports, package records (tyre
// hotel, DTC findings, paint recipes, field jobs, seasonal protocols) and
// generated placeholder photos with thumbnails.
//
// Safe to re-run: every demo-* workshop and its files are deleted first;
// the @demo.poslar.eu accounts are kept and reset, so a tester stays
// signed in. Needs the service role key.
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Upišite NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY u .env.local.');
  process.exit(1);
}
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo2026!';
const DOMAIN = 'demo.poslar.eu';
const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
async function q(builder) {
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return data;
}

function at(daysAgo, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function allUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

// Only the demo workshops this script made (exact slug + demo flag),
// never a real workshop whose name happens to start with "Demo".
const ALL_PACKAGES = ['volt', 'gear', 'body', 'wheel', 'fleet', 'machine', 'moto', 'marine', 'air', 'aqua', 'tow', 'deal', 'detail', 'electric', 'appliance', 'locksmith', 'pool', 'clean'];
// `npm run db:seed -- --uzorak` makes the sample workshops instead: the
// same data under uzorak-<package>, with logins nobody can use. A new
// workshop's 24-hour trial is a copy of its trade's sample (clone_sample,
// 0025), so testers never leave their marks in it.
const SAMPLE = process.argv.includes('--uzorak');
const PREFIX = SAMPLE ? 'uzorak' : 'demo';
const DEMO_SLUGS = ALL_PACKAGES.map((p) => `${PREFIX}-${p}`);
// `npm run db:seed -- aqua tow` redoes only those; the others keep
// whatever a tester has entered in them.
const ONLY = process.argv.slice(2).filter((a) => ALL_PACKAGES.includes(a));
const RESEED = ONLY.length ? ONLY.map((p) => `${PREFIX}-${p}`) : DEMO_SLUGS;
const login = (role, pkg) => `${SAMPLE ? 'uzorak.' : ''}${role}.${pkg}@${DOMAIN}`;

async function cleanup() {
  const tenants = await q(sb.from('tenants').select('id').in('slug', RESEED).eq('settings->>demo', 'true'));
  const ids = tenants.map((t) => t.id);
  if (ids.length) {
    const files = await q(sb.from('attachments').select('path, has_thumb').in('tenant_id', ids));
    const paths = files.flatMap((f) => (f.has_thumb ? [f.path, `${f.path}.thumb.jpg`] : [f.path]));
    for (let i = 0; i < paths.length; i += 100) await sb.storage.from('job-files').remove(paths.slice(i, i + 100));
  }
  // The demo accounts themselves stay (same id, so whoever is testing stays
  // signed in through a reset), and so do the samples' accounts; only
  // strays in the demo domain go.
  const keep = new Set([`demo@${DOMAIN}`, ...ALL_PACKAGES.flatMap((p) => ['', 'uzorak.'].flatMap((s) => [`${s}vlasnik.${p}@${DOMAIN}`, `${s}radnik.${p}@${DOMAIN}`]))]);
  for (const user of (await allUsers()).filter((u) => u.email?.endsWith(`@${DOMAIN}`) && !keep.has(u.email))) await sb.auth.admin.deleteUser(user.id);
  // Profiles go with their workshop (on delete cascade).
  if (ids.length) await q(sb.from('tenants').delete().in('id', ids));
  console.log(`Obrisano ${ids.length} starih demo radionica.`);
}

// app_metadata.demo lets the app switch between demo accounts (demo
// centre); only the service role can set it. An existing account is
// reused and reset (password, name, flag) instead of recreated.
let existingUsers = null;
async function createUser(email, fullName) {
  existingUsers ??= new Map((await allUsers()).map((u) => [u.email?.toLowerCase(), u]));
  const known = existingUsers.get(email.toLowerCase());
  // A sample's people never sign in: an unknown password and a ban.
  if (SAMPLE) {
    const attrs = { email_confirm: true, password: randomUUID() + randomUUID(), ban_duration: '876000h', user_metadata: { full_name: fullName }, app_metadata: { sample: true } };
    const { data, error } = known ? await sb.auth.admin.updateUserById(known.id, attrs) : await sb.auth.admin.createUser({ email, ...attrs });
    if (error) throw new Error(`${email}: ${error.message}`);
    return data.user;
  }
  const attrs = { email_confirm: true, user_metadata: { full_name: fullName }, app_metadata: { demo: true } };
  if (!known) {
    const { data, error } = await sb.auth.admin.createUser({ email, password: PASSWORD, ...attrs });
    if (error) throw new Error(`${email}: ${error.message}`);
    return data.user;
  }
  // Setting a password signs the account out everywhere, so it is only
  // reset when the demo password no longer works (changed in Tim → Lozinka).
  const probe = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: loginError } = await probe.auth.signInWithPassword({ email, password: PASSWORD });
  const { data, error } = await sb.auth.admin.updateUserById(known.id, loginError ? { ...attrs, password: PASSWORD } : attrs);
  if (error) throw new Error(`${email}: ${error.message}`);
  return data.user;
}

async function workshop({ pkg, name, city, address, phone, owner, worker }) {
  const ownerUser = await createUser(login('vlasnik', pkg), owner);
  const tenantId = await q(
    sb.rpc('register_workshop', {
      p_user_id: ownerUser.id,
      p_full_name: owner,
      p_workshop_name: name,
      p_package: pkg,
      p_phone: phone,
      p_city: city,
      p_status: 'active',
      p_trial_days: 30,
    })
  );
  // A demo OIB and IBAN (the standard HR example account) so the invoice looks complete.
  await q(
    sb
      .from('tenants')
      .update({ slug: `${PREFIX}-${pkg}`, address, email: `info@${pkg}.${DOMAIN}`, oib: '58234167900', settings: { demo: true, ...(SAMPLE ? { sample: true } : {}), iban: 'HR1210010051863000160', vat_registered: true } })
      .eq('id', tenantId)
  );
  const workerUser = await createUser(login('radnik', pkg), worker);
  await q(sb.from('profiles').insert({ id: workerUser.id, tenant_id: tenantId, full_name: worker, role: 'worker' }));
  return { id: tenantId, pkg, owner: ownerUser.id, worker: workerUser.id, ownerName: owner, workerName: worker };
}

async function client(T, c) {
  const [row] = await q(
    sb
      .from('clients')
      .insert({
        tenant_id: T.id,
        is_demo: true,
        kind: c.company ? 'company' : 'person',
        company_name: c.company ?? null,
        first_name: c.first ?? null,
        last_name: c.last ?? null,
        phone: c.phone ?? null,
        email: c.email ?? null,
        city: c.city ?? null,
        oib: c.oib ?? null,
      })
      .select('id')
  );
  return row.id;
}

async function asset(T, clientId, a) {
  const [row] = await q(
    sb
      .from('assets')
      .insert({
        tenant_id: T.id,
        client_id: clientId,
        is_demo: true,
        asset_type: a.type ?? 'car',
        identifier: a.id ?? null,
        make: a.make ?? null,
        model: a.model ?? null,
        year: a.year ?? null,
        vin: a.vin ?? null,
        fuel: a.fuel ?? null,
        engine_code: a.engine ?? null,
        paint_code: a.paint ?? null,
        internal_number: a.internal ?? null,
        parent_asset_id: a.parent ?? null,
        meter_primary_unit: a.unit ?? 'km',
        axle_config: a.axles ?? null,
        gvw_t: a.gvw ?? null,
        site_id: a.site ?? null,
      })
      .select('id')
  );
  return row.id;
}

const PHASE_HR = {
  intake: 'Prijem',
  diagnosis: 'Dijagnostika',
  awaiting_approval: 'Čeka odobrenje',
  awaiting_parts: 'Čeka dijelove',
  in_progress: 'Popravak u tijeku',
  quality_check: 'Kontrola',
  ready: 'Gotovo',
  collected: 'Preuzeto',
};

// A work order with lines (l.price → owner-only price row) and history.
async function job(T, o) {
  const d = o.d ?? 1;
  const created = at(d, 8, 15 + (d % 40));
  const done = o.phase === 'ready' || o.phase === 'collected';
  const finished = done ? at(Math.max(0, d - 1), 15, 30) : null;
  const collected = o.phase === 'collected' ? at(Math.max(0, d - 2), 16, 45) : null;
  const [row] = await q(
    sb
      .from('jobs')
      .insert({
        tenant_id: T.id,
        client_id: o.client,
        asset_id: o.asset,
        phase: o.phase,
        complaint: o.complaint ?? null,
        diagnosis_notes: o.diagnosis ?? null,
        work_summary: o.summary ?? null,
        meter_in: o.meter ?? null,
        meter_out: done ? o.meter ?? null : null,
        meter_unit: o.unit ?? 'km',
        is_urgent: Boolean(o.urgent),
        promised_at: o.promised ?? null,
        bay: o.bay ?? null,
        source: o.source ?? 'workshop',
        assigned_to: o.assigned === 'owner' ? T.owner : o.assigned === false ? null : T.worker,
        payment_status: o.paid ? 'paid' : 'unpaid',
        paid_at: o.paid ? collected ?? finished : null,
        finished_at: finished,
        collected_at: collected,
        created_by: T.owner,
        created_at: created,
        updated_at: collected ?? finished ?? at(Math.max(0, d - 1), 12),
        // Field work and anything else a package needs on the job row.
        ...(o.extra ?? {}),
        is_demo: true,
      })
      .select('id, number')
  );

  row.lines = [];
  if (o.lines?.length) {
    const inserted = await q(
      sb
        .from('job_lines')
        .insert(
          o.lines.map((l, i) => ({
            tenant_id: T.id,
            job_id: row.id,
            sort: i + 1,
            kind: l.kind ?? 'labor',
            description: l.d,
            code: l.code ?? null,
            qty: l.qty ?? 1,
            unit: l.unit ?? ((l.kind ?? 'labor') === 'labor' ? 'h' : 'kom'),
            approval: l.approval ?? 'approved',
            priority: l.priority ?? null,
            source: l.source ?? 'manual',
            technician_id: (l.approval ?? 'approved') === 'approved' ? T.worker : null,
            time_spent_h: (l.kind ?? 'labor') === 'labor' && done ? l.qty ?? 1 : null,
          }))
        )
        .select('id, sort')
    );
    inserted.sort((a, b) => a.sort - b.sort);
    row.lines = inserted.map((r) => r.id);
    const prices = inserted
      .map((r) => ({ r, l: o.lines[r.sort - 1] }))
      .filter(({ l }) => l.price !== undefined)
      .map(({ r, l }) => ({ job_line_id: r.id, tenant_id: T.id, unit_price: l.price, purchase_price: l.buy ?? null, discount_pct: l.discount ?? 0 }));
    if (prices.length) await q(sb.from('job_line_prices').insert(prices));
  }

  const events = [{ event_type: 'created', message: `Nalog ${row.number} otvoren · ${T.ownerName}`, created_at: created, actor_id: T.owner }];
  if (o.phase !== 'intake') events.push({ event_type: 'phase', message: `${PHASE_HR[o.phase]} · ${T.workerName}`, created_at: finished ?? at(Math.max(0, d - 1), 10), actor_id: T.worker });
  if (collected) events.push({ event_type: 'phase', message: `Preuzeto · ${T.ownerName}`, created_at: collected, actor_id: T.owner });
  if (o.paid) events.push({ event_type: 'payment', message: 'Označeno plaćeno', created_at: collected ?? finished, actor_id: T.owner });
  await q(sb.from('job_events').insert(events.map((e) => ({ ...e, tenant_id: T.id, job_id: row.id }))));

  if (o.meter !== undefined) {
    await q(sb.from('meter_readings').insert({ tenant_id: T.id, asset_id: o.asset, job_id: row.id, unit: o.unit ?? 'km', value: o.meter, source: 'intake', read_at: created, created_by: T.worker }));
  }
  row.created = created;
  return row;
}

function escapeXml(text) {
  return String(text).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}

// Placeholder photo: a labelled gradient, so screens look real without
// shipping stock images. Uploaded with its thumbnail and SHA-256.
async function photo(T, jobId, p) {
  const hue = p.hue ?? 215;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},38%,30%)"/><stop offset="1" stop-color="hsl(${hue + 35},30%,11%)"/></linearGradient></defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <g stroke="#ffffff" stroke-opacity="0.08">${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="900"/>`).join('')}</g>
  <circle cx="930" cy="560" r="210" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="26"/>
  <text x="70" y="140" font-family="Arial, Helvetica, sans-serif" font-size="68" font-weight="700" fill="#ffffff">${escapeXml(p.label)}</text>
  <text x="70" y="210" font-family="Arial, Helvetica, sans-serif" font-size="38" fill="#ffffff" fill-opacity="0.8">${escapeXml(p.sub ?? '')}</text>
  <text x="70" y="840" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#ffffff" fill-opacity="0.55">DEMO · Poslar</text>
</svg>`;
  const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 76 }).toBuffer();
  const thumb = await sharp(jpg).resize(360).jpeg({ quality: 70 }).toBuffer();
  const filePath = `${T.id}/${jobId}/${randomUUID()}.jpg`;
  const bucket = sb.storage.from('job-files');
  // The storage API now and then drops a connection: three tries.
  const upload = async (p, body) => {
    for (let i = 0; ; i++) {
      const r = await bucket.upload(p, body, { contentType: 'image/jpeg', upsert: true }).catch((e) => ({ error: e }));
      if (!r.error) return;
      if (i === 2) throw new Error(`upload: ${r.error.message}`);
      await new Promise((ok) => setTimeout(ok, 1500));
    }
  };
  await upload(filePath, jpg);
  await upload(`${filePath}.thumb.jpg`, thumb);
  const [row] = await q(
    sb
      .from('attachments')
      .insert({
        tenant_id: T.id,
        job_id: jobId,
        path: filePath,
        mime: 'image/jpeg',
        size_bytes: jpg.length,
        tag: p.tag ?? 'intake',
        caption: p.caption ?? null,
        stage: p.stage ?? null,
        zone: p.zone ?? null,
        visibility: p.customer ? 'customer' : 'internal',
        has_thumb: true,
        sha256: createHash('sha256').update(jpg).digest('hex'),
        taken_at: p.when ?? at(p.d ?? 1, 9, 40),
        created_by: T.worker,
        created_at: p.when ?? at(p.d ?? 1, 9, 41),
      })
      .select('id')
  );
  return row.id;
}

// results: [itemCode, status, measure?, note?]
async function inspection(T, jobId, code, title, results, { completed = false, d = 1, units = {} } = {}) {
  const [ins] = await q(
    sb
      .from('inspections')
      .insert({ tenant_id: T.id, job_id: jobId, template_code: code, title, performed_by: T.worker, started_at: at(d, 9, 5), completed_at: completed ? at(d, 10, 20) : null })
      .select('id')
  );
  const rows = await q(
    sb
      .from('inspection_results')
      .insert(
        results.map(([item, status, value, note]) => ({
          tenant_id: T.id,
          inspection_id: ins.id,
          item_code: item,
          status,
          measure_value: value ?? null,
          measure_unit: value !== undefined && value !== null ? units[item] ?? null : null,
          note: note ?? null,
        }))
      )
      .select('id, item_code, status')
  );
  return { id: ins.id, results: rows };
}

const checklistCodes = (name, count) => Array.from({ length: count }, (_, i) => `${name}_${String(i + 1).padStart(2, '0')}`);

async function conditionReport(T, jobId, { diagram = 'car', kind = 'intake', marks = [], equipment = [], fuel = null, d = 1 }) {
  await q(
    sb.from('condition_reports').insert({
      tenant_id: T.id,
      job_id: jobId,
      kind,
      diagram,
      marks,
      equipment: equipment.map(([item, present]) => ({ item, present })),
      fuel_level: fuel,
      staff_id: T.worker,
      created_at: at(d, kind === 'handover' ? 16 : 8, 40),
    })
  );
}

async function messages(T, jobId, help, task) {
  await q(
    sb.from('job_messages').insert([
      { tenant_id: T.id, job_id: jobId, sender_id: T.worker, kind: 'help', body: help, status: 'open' },
      { tenant_id: T.id, job_id: jobId, sender_id: T.owner, receiver_id: T.worker, kind: 'task', body: task, status: 'taken' },
    ])
  );
}

async function approvalLink(T, jobId) {
  const [row] = await q(sb.from('approvals').insert({ tenant_id: T.id, job_id: jobId, sent_via: 'link', created_by: T.owner }).select('token'));
  await q(sb.from('job_events').insert({ tenant_id: T.id, job_id: jobId, event_type: 'approval', message: 'Poslano na odobrenje', actor_id: T.owner }));
  return `${APP_URL}/approve/${row.token}`;
}

// ---------------------------------------------------------------------
// VOLT — autoelektrika
// ---------------------------------------------------------------------
async function seedVolt() {
  const T = await workshop({ pkg: 'volt', name: 'Autoelektrika Horvat', city: 'Zagreb', address: 'Savska cesta 120', phone: '+385 1 555 0101', owner: 'Marko Horvat', worker: 'Ivan Perić' });
  const c1 = await client(T, { first: 'Ivan', last: 'Kovač', phone: '+385 91 234 5678', city: 'Zagreb' });
  const c2 = await client(T, { first: 'Marija', last: 'Babić', phone: '+385 98 765 4321', city: 'Velika Gorica' });
  const c3 = await client(T, { company: 'Dostava Brzi d.o.o.', first: 'Tomislav', last: 'Jurić', phone: '+385 99 111 2233', city: 'Zagreb' });
  const c4 = await client(T, { first: 'Petar', last: 'Novak', phone: '+385 95 444 5566', city: 'Samobor' });
  const c5 = await client(T, { first: 'Ana', last: 'Marić', phone: '+385 91 777 8899', city: 'Zagreb' });
  const a1 = await asset(T, c1, { id: 'ZG-1234-AB', make: 'Volkswagen', model: 'Golf 7 2.0 TDI', year: 2016, fuel: 'diesel', engine: 'CRBC', vin: 'WVWZZZAUZGW123456' });
  const a2 = await asset(T, c2, { id: 'ZG-5521-KM', make: 'BMW', model: '320d F30', year: 2015, fuel: 'diesel', engine: 'N47D20C' });
  const a3 = await asset(T, c3, { type: 'van', id: 'ZG-8890-DB', make: 'Mercedes-Benz', model: 'Sprinter 316 CDI', year: 2019, fuel: 'diesel' });
  const a4 = await asset(T, c4, { id: 'SB-321-PN', make: 'Škoda', model: 'Octavia 1.6 TDI', year: 2017, fuel: 'diesel' });
  const a5 = await asset(T, c5, { id: 'ZG-7712-AM', make: 'Peugeot', model: '308 1.2 PureTech', year: 2018, fuel: 'petrol' });

  const j1 = await job(T, {
    client: c1,
    asset: a1,
    phase: 'diagnosis',
    d: 1,
    meter: 187450,
    complaint: 'Akumulator se prazni, preko noći, dvaput palio s kablovima',
    diagnosis: 'Nakon zaključavanja 850 mA, nakon 45 min i dalje 205 mA. Vađenjem F23 pada na 38 mA, krug kuke za prikolicu.',
    lines: [
      { d: 'Dijagnostika elektroničkih sustava', qty: 1, price: 55 },
      { d: 'Mjerenje i lociranje parazitske potrošnje', qty: 2, price: 55 },
      { kind: 'part', d: 'Akumulator AGM 70 Ah 760 A', approval: 'proposed', priority: 'recommended', price: 165, buy: 118 },
      { d: 'Zamjena i registracija akumulatora (BMS)', qty: 0.5, approval: 'proposed', priority: 'recommended', price: 55 },
    ],
  });
  const drain = await q(
    sb.from('volt_drain_sessions').insert({ tenant_id: T.id, job_id: j1.id, method: 'clamp', target_ma: 50, expected_sleep_min: 30, started_at: at(1, 10), culprit_circuit: 'F23', culprit_module: 'Modul kuke za prikolicu', verdict: 'too_high', created_by: T.worker }).select('id')
  );
  await q(
    sb.from('volt_drain_readings').insert(
      [
        [0, 850, 'zaključano'],
        [5, 620, null],
        [15, 380, null],
        [25, 240, null],
        [35, 210, null],
        [45, 205, 'izvađen F23'],
        [50, 38, null],
        [60, 36, null],
      ].map(([t, ma, event]) => ({ tenant_id: T.id, session_id: drain[0].id, t_offset_min: t, current_ma: ma, event }))
    )
  );
  await q(sb.from('volt_battery_tests').insert({ tenant_id: T.id, job_id: j1.id, battery_type: 'agm', rest_voltage_v: 12.31, rated_cca_a: 760, measured_cca_a: 505, soh_pct: 64, soc_pct: 72, cranking_min_v: 9.6, result: 'replace', created_by: T.worker }));
  await inspection(T, j1.id, 'volt.diag_protocol', 'Dijagnostički protokol', checklistCodes('diag_protocol', 5).map((c) => [c, 'ok']), { d: 1 });
  await conditionReport(T, j1.id, {
    marks: [
      { zone: 'battery', code: 'O', note: 'polovi oksidirani' },
      { zone: 'window_fl', code: 'N', note: 'podizač lijevi ne diže staklo' },
      { zone: 'headlight_l', code: 'N', note: 'kratko svjetlo ne svijetli' },
      { zone: 'fuse_box', code: 'P', note: 'osigurač labav u ležištu' },
    ],
    equipment: [['Ključevi', true], ['Daljinski', true], ['Dokumenti vozila', true], ['Punjač / kabel', false], ['Radio kod', false], ['Servisna knjižica', true]],
    fuel: '1/4',
  });
  await photo(T, j1.id, { label: 'Stanje pri prijemu', sub: 'ZG-1234-AB · Golf 7', tag: 'intake', hue: 210 });
  await photo(T, j1.id, { label: 'Strujna kliješta, 850 mA', sub: 'Početno mjerenje nakon zaključavanja', tag: 'meter', hue: 190 });
  await messages(T, j1.id, 'F23 ne piše u shemi, što je na tom osiguraču kod Golfa 7?', 'Kad nađeš krivca, slikaj modul i javi prije zamjene.');
  const voltLink = await approvalLink(T, j1.id);

  const j2 = await job(T, {
    client: c2,
    asset: a2,
    phase: 'in_progress',
    d: 2,
    meter: 214300,
    complaint: 'Lampica na armaturi, gubi snagu na autocesti',
    lines: [
      { d: 'Dijagnostika elektroničkih sustava', qty: 1, price: 55 },
      { kind: 'part', d: 'Crijevo interkulera', price: 85, buy: 52 },
      { d: 'Zamjena crijeva interkulera', qty: 0.8, price: 55 },
    ],
  });
  const [s2] = await q(sb.from('volt_scans').insert({ tenant_id: T.id, job_id: j2.id, kind: 'initial', tool: 'Autel MS909', meter_value: 214300, scanned_at: at(2, 9), created_by: T.worker }).select('id'));
  await q(
    sb.from('volt_dtc_findings').insert([
      { tenant_id: T.id, scan_id: s2.id, job_id: j2.id, module: 'ECM', code: 'P0299', description: 'Prenizak pritisak punjenja turbopunjača', status: 'active' },
      { tenant_id: T.id, scan_id: s2.id, job_id: j2.id, module: 'ECM', code: 'P0401', description: 'Protok EGR ventila nedovoljan', status: 'stored' },
    ])
  );
  await q(sb.from('volt_charging_tests').insert({ tenant_id: T.id, job_id: j2.id, idle_voltage_v: 14.2, loaded_voltage_v: 13.9, charge_current_a: 42, ripple_mv: 60, alternator_type: 'classic', result: 'ok', created_by: T.worker }));
  await photo(T, j2.id, { label: 'Zaslon dijagnostike', sub: 'P0299 · P0401', tag: 'dtc_screen', hue: 260 });

  const j3 = await job(T, {
    client: c3,
    asset: a3,
    phase: 'awaiting_parts',
    d: 3,
    urgent: true,
    meter: 162880,
    complaint: 'Ne pali / verglanje, lampica punjenja svijetli',
    lines: [
      { d: 'Test akumulatora, anlasera i alternatora', qty: 0.5, price: 55 },
      { kind: 'part', d: 'Alternator 14 V 180 A (reman)', priority: 'urgent', price: 320, buy: 235 },
      { d: 'Zamjena alternatora', qty: 1.5, price: 55 },
    ],
    promised: at(-1, 14),
  });
  await q(sb.from('volt_charging_tests').insert({ tenant_id: T.id, job_id: j3.id, idle_voltage_v: 12.4, loaded_voltage_v: 12.1, charge_current_a: 4, ripple_mv: 820, alternator_type: 'lin', result: 'replace', created_by: T.worker }));
  await photo(T, j3.id, { label: 'Alternator, ripple 820 mV', sub: 'Osciloskop, diode', tag: 'scope', hue: 20 });

  const j4 = await job(T, {
    client: c4,
    asset: a4,
    phase: 'ready',
    d: 4,
    meter: 132010,
    complaint: 'Ključ / imobilizator, izgubljen jedan ključ, treba novi',
    summary: 'Isprogramiran novi ključ s transponderom, izgubljeni ključ onemogućen. Ukupno 2 ključa u vozilu.',
    lines: [
      { d: 'Programiranje ključa', qty: 1, price: 65 },
      { kind: 'part', d: 'Ključ s transponderom (ID48)', price: 90, buy: 38 },
    ],
  });
  await q(sb.from('volt_keys').insert({ tenant_id: T.id, asset_id: a4, job_id: j4.id, key_type: 'flip', transponder: 'ID48 / Megamos Crypto', programmed_now: 1, total_after: 2, lost_disabled: true, method: 'obd' }));
  await q(
    sb.from('volt_module_interventions').insert({ tenant_id: T.id, job_id: j4.id, module: 'IMMO', kind: 'immo_key', tool: 'Autel IM608', voltage_stabilized: true, result: 'success', notes: 'Izgubljeni ključ obrisan iz memorije.', performed_by: T.worker, performed_at: at(3, 11) })
  );

  const j5 = await job(T, {
    client: c5,
    asset: a5,
    phase: 'collected',
    paid: true,
    d: 20,
    meter: 88450,
    complaint: 'Lampica ABS i ESP povremeno',
    summary: 'Očišćen i zaštićen konektor ABS modula, kodovi obrisani, kontrolna vožnja bez grešaka.',
    lines: [
      { d: 'Dijagnostika elektroničkih sustava', qty: 1, price: 55 },
      { d: 'Popravak konektora i instalacije', qty: 1.5, price: 55 },
      { kind: 'material', d: 'Kontakt sprej i termoskupljajuće', price: 12 },
    ],
  });
  const [s5] = await q(sb.from('volt_scans').insert({ tenant_id: T.id, job_id: j5.id, kind: 'initial', tool: 'Autel MS909', scanned_at: at(20, 9), created_by: T.worker }).select('id'));
  await q(
    sb.from('volt_dtc_findings').insert({
      tenant_id: T.id,
      scan_id: s5.id,
      job_id: j5.id,
      module: 'Gateway',
      code: 'U0121',
      description: 'Gubitak komunikacije s ABS-om',
      status: 'intermittent',
      cleared: true,
      confirmed_cause: 'Korodiran konektor ABS modula (voda s vjetrobrana)',
      resolution_note: 'Očišćeno, zaštićeno, brtva poklopca zamijenjena',
    })
  );

  const j6 = await job(T, {
    client: c1,
    asset: a1,
    phase: 'collected',
    paid: true,
    d: 75,
    meter: 181200,
    complaint: 'Svjetla, kratka svjetla desno ne rade',
    summary: 'Zamijenjena žarulja H7 i konektor fara.',
    lines: [
      { d: 'Dijagnostika i popravak', qty: 0.7, price: 55 },
      { kind: 'part', d: 'Žarulja H7 i konektor', price: 24 },
    ],
  });
  const [s6] = await q(sb.from('volt_scans').insert({ tenant_id: T.id, job_id: j6.id, kind: 'initial', scanned_at: at(75, 9), created_by: T.worker }).select('id'));
  await q(
    sb.from('volt_dtc_findings').insert({ tenant_id: T.id, scan_id: s6.id, job_id: j6.id, module: 'BCM', code: 'U0140', status: 'stored', cleared: true, confirmed_cause: 'Nizak napon nakon pražnjenja akumulatora, BCM zapamtio grešku' })
  );
  await job(T, { client: c2, asset: a2, phase: 'collected', paid: true, d: 130, meter: 201500, complaint: 'Klima ne radi', lines: [{ d: 'Dijagnostika klime', qty: 1, price: 55 }, { kind: 'part', d: 'Relej kompresora', price: 28 }] });
  await job(T, { client: c3, asset: a3, phase: 'collected', paid: false, d: 9, meter: 161200, complaint: 'Naknadna ugradnja kamere za vožnju unatrag', lines: [{ d: 'Ugradnja kamere i povezivanje', qty: 3, price: 55 }, { kind: 'part', d: 'Kamera s nosačem', price: 145 }] });
  await job(T, { client: c2, asset: a2, phase: 'intake', d: 0, meter: 214650, complaint: 'Podizači, centralno, komfor, prednji desni podizač ne radi', assigned: false });
  return { T, links: [voltLink] };
}

// ---------------------------------------------------------------------
// GEAR — automehanika
// ---------------------------------------------------------------------
const GEAR_UNITS = { g02: '°C', g11: 'V', g16: 'mm', g18: 'mm', g23: '%', g32: 'mm', g33: 'bar', g34: 'god.', g47: '°C' };
const GEAR_LABELS = {
  g11: 'Akumulator, napon mirovanja',
  g16: 'Prednje pločice',
  g18: 'Stražnje pločice ili obloge',
  g23: 'Kočiona tekućina, udio vode',
  g30: 'Manžete poluosovina',
  g32: 'Dubina šare (najmanja)',
  g44: 'Metlice brisača',
};

async function seedGear() {
  const T = await workshop({ pkg: 'gear', name: 'Autoservis Kovač', city: 'Split', address: 'Put Supavla 21', phone: '+385 21 555 0202', owner: 'Ante Kovač', worker: 'Josip Radić' });
  const [sup] = await q(
    sb
      .from('gear_suppliers')
      .insert([
        { tenant_id: T.id, name: 'Dalmacija Autodijelovi', phone: '+385 21 444 100', delivery_days: 1, customer_number: 'K-10492' },
        { tenant_id: T.id, name: 'Euro Parts Split', phone: '+385 21 444 200', delivery_days: 2 },
      ])
      .select('id')
  );
  const c1 = await client(T, { first: 'Mate', last: 'Barišić', phone: '+385 91 300 1122', city: 'Split' });
  const c2 = await client(T, { first: 'Ivana', last: 'Tomić', phone: '+385 98 300 3344', city: 'Solin' });
  const c3 = await client(T, { first: 'Nikola', last: 'Grgić', phone: '+385 95 300 5566', city: 'Kaštela' });
  const c4 = await client(T, { company: 'Taxi Riva d.o.o.', first: 'Duje', last: 'Matić', phone: '+385 99 300 7788', city: 'Split' });
  const a1 = await asset(T, c1, { id: 'ST-455-MB', make: 'Opel', model: 'Astra K 1.6 CDTI', year: 2017, fuel: 'diesel' });
  const a2 = await asset(T, c2, { id: 'ST-812-IT', make: 'Renault', model: 'Clio IV 0.9 TCe', year: 2016, fuel: 'petrol' });
  const a3 = await asset(T, c3, { id: 'ST-190-NG', make: 'Ford', model: 'Focus 1.5 EcoBlue', year: 2019, fuel: 'diesel' });
  const a4 = await asset(T, c4, { id: 'ST-7001-TX', make: 'Toyota', model: 'Corolla Hybrid', year: 2021, fuel: 'hybrid', internal: 'Taxi 07' });

  const j1 = await job(T, { client: c1, asset: a1, phase: 'diagnosis', d: 0, meter: 168400, complaint: 'Redovni servis, Kočnice škripe / slabo koče' });
  const dviResults = [
    ['g01', 'ok'], ['g02', 'ok', -28], ['g03', 'ok'], ['g04', 'na'], ['g05', 'ok'], ['g06', 'ok'], ['g07', 'ok'], ['g08', 'warn', null, 'zaprljan'], ['g09', 'warn'], ['g10', 'ok'],
    ['g11', 'warn', 12.3], ['g12', 'ok'], ['g13', 'ok'], ['g14', 'ok'], ['g15', 'ok'],
    ['g16', 'warn', 3.2], ['g17', 'ok'], ['g18', 'crit', 2.1, 'lijeva strana do metala'], ['g19', 'warn'], ['g20', 'ok'], ['g21', 'ok'], ['g22', 'ok'], ['g23', 'crit', 3.5],
    ['g24', 'ok'], ['g25', 'ok'], ['g26', 'ok'], ['g27', 'ok'], ['g28', 'ok'], ['g29', 'ok'], ['g30', 'warn', null, 'lijeva unutarnja napukla'], ['g31', 'ok'],
    ['g32', 'warn', 2.6], ['g33', 'ok', 2.3], ['g34', 'ok', 4], ['g35', 'ok'], ['g36', 'ok'], ['g37', 'ok'],
    ['g44', 'warn', null, 'ostavljaju trag'],
  ];
  const dvi = await inspection(T, j1.id, 'gear.dvi50', 'Inspekcija u 50 točaka', dviResults, { d: 0, units: GEAR_UNITS });
  // Findings → proposed lines with prices, linked back to the result.
  const findingPrices = { g18: [140, 'urgent', 'Kočione pločice i diskovi straga'], g23: [45, 'urgent', 'Zamjena kočione tekućine'], g16: [95, 'recommended', 'Kočione pločice naprijed'], g11: [120, 'recommended', 'Akumulator 60 Ah'], g30: [75, 'recommended', 'Manžeta poluosovine lijeva'], g32: [320, 'recommended', 'Komplet ljetnih guma 205/55 R16'], g44: [28, 'optional', 'Metlice brisača (par)'] };
  let sort = 1;
  for (const r of dvi.results.filter((x) => findingPrices[x.item_code])) {
    const [price, priority, description] = findingPrices[r.item_code];
    const [line] = await q(
      sb
        .from('job_lines')
        .insert({ tenant_id: T.id, job_id: j1.id, sort: sort++, kind: r.item_code === 'g23' ? 'labor' : 'part', description, qty: 1, unit: 'kom', approval: 'proposed', priority, source: 'inspection', inspection_result_id: r.id })
        .select('id')
    );
    await q(sb.from('job_line_prices').insert({ job_line_id: line.id, tenant_id: T.id, unit_price: price }));
    await q(sb.from('inspection_results').update({ job_line_id: line.id }).eq('id', r.id));
  }
  const [svc] = await q(sb.from('job_lines').insert({ tenant_id: T.id, job_id: j1.id, sort: sort++, kind: 'labor', description: 'Mali servis, zamjena ulja i filtera', qty: 0.6, unit: 'h', approval: 'approved', source: 'template', template_code: 'gear.small_service' }).select('id'));
  await q(sb.from('job_line_prices').insert({ job_line_id: svc.id, tenant_id: T.id, unit_price: 45 }));
  await photo(T, j1.id, { label: 'Stražnje pločice 2,1 mm', sub: 'Nalaz inspekcije · Hitno', tag: 'inspection', hue: 0, customer: true, d: 0 });
  await photo(T, j1.id, { label: 'Manžeta poluosovine', sub: 'Napuknuta, lijeva unutarnja', tag: 'inspection', hue: 30, customer: true, d: 0 });
  await conditionReport(T, j1.id, {
    marks: [
      { zone: 'brake_rl', code: 'I', note: 'stražnje pločice na granici' },
      { zone: 'driveshaft', code: 'L', note: 'manžeta lijeva unutarnja napuknuta' },
      { zone: 'tyre_rl', code: 'I', note: 'stražnja lijeva, šara na granici' },
      { zone: 'exhaust', code: 'K', note: 'zadnji lonac, korozija' },
    ],
    equipment: [['Ključevi', true], ['Druga garnitura ključeva', false], ['Dokumenti vozila', true], ['Servisna knjižica', true], ['Rezervni kotač', true], ['Trokut i prva pomoć', true], ['Podna prostirka', true]],
    fuel: '1/2',
    d: 0,
  });
  const gearLink = await approvalLink(T, j1.id);
  await messages(T, j1.id, 'Za Astru nema diskova straga na stanju, naručiti ili pričekati odobrenje?', 'Pošalji stranci poveznicu, pa naruči tek odobreno.');

  const j2 = await job(T, {
    client: c2,
    asset: a2,
    phase: 'in_progress',
    d: 1,
    meter: 97400,
    complaint: 'Redovni servis',
    lines: [
      { d: 'Zamjena ulja i filtera', qty: 0.6, price: 45 },
      { kind: 'part', d: 'Filter ulja', price: 12, buy: 6.5 },
      { kind: 'material', d: 'Motorno ulje 5W-30', qty: 4.5, unit: 'l', price: 11, buy: 6 },
      { kind: 'part', d: 'Filter zraka', price: 18, buy: 9 },
    ],
  });
  await q(
    sb.from('gear_parts').insert([
      { tenant_id: T.id, job_line_id: j2.lines[1], job_id: j2.id, catalog_number: 'OC 1051', brand: 'Mahle', supplier_id: sup.id, order_status: 'installed', installed_meter: 97400, installed_date: day(0) },
      { tenant_id: T.id, job_line_id: j2.lines[3], job_id: j2.id, catalog_number: 'C 2201', brand: 'Mann', supplier_id: sup.id, order_status: 'arrived' },
    ])
  );
  const j3 = await job(T, {
    client: c3,
    asset: a3,
    phase: 'awaiting_parts',
    d: 2,
    meter: 121800,
    complaint: 'Remen razvoda, po servisnom planu',
    lines: [
      { d: 'Zamjena kompleta remena razvoda i vodene pumpe', qty: 3.5, price: 45 },
      { kind: 'part', d: 'Komplet remena razvoda s vodenom pumpom', price: 220, buy: 158 },
      { kind: 'material', d: 'Rashladna tekućina', qty: 5, unit: 'l', price: 4 },
    ],
    promised: at(-2, 15),
  });
  await q(sb.from('gear_parts').insert({ tenant_id: T.id, job_line_id: j3.lines[1], job_id: j3.id, catalog_number: 'KTBWP9140', brand: 'Dayco', supplier_id: sup.id, order_status: 'ordered', supplier_order_no: 'NAR-55821' }));
  await job(T, { client: c4, asset: a4, phase: 'ready', d: 3, meter: 244100, complaint: 'Klima ne hladi', summary: 'Servis klime: vakuum, punjenje 520 g R1234yf, test propusnosti OK.', lines: [{ d: 'Servis klime', qty: 0.8, price: 45 }, { kind: 'material', d: 'Rashladni plin R1234yf', qty: 520, unit: 'g', price: 0.12 }] });
  await job(T, { client: c1, asset: a1, phase: 'collected', paid: true, d: 35, meter: 165000, complaint: 'Veliki servis', lines: [{ d: 'Veliki servis prema planu proizvođača', qty: 2, price: 45 }, { kind: 'part', d: 'Filteri (ulje, zrak, kabina, gorivo)', price: 70 }, { kind: 'material', d: 'Motorno ulje', qty: 5, unit: 'l', price: 11 }] });
  await job(T, { client: c4, asset: a4, phase: 'collected', paid: true, d: 62, meter: 229800, complaint: 'Kočnice naprijed', lines: [{ d: 'Zamjena pločica i diskova naprijed', qty: 1.2, price: 45 }, { kind: 'part', d: 'Pločice i diskovi naprijed', price: 155 }] });
  await job(T, { client: c3, asset: a3, phase: 'collected', paid: true, d: 110, meter: 112300, complaint: 'Kvačilo proklizava', lines: [{ d: 'Zamjena kompleta kvačila', qty: 5, price: 45 }, { kind: 'part', d: 'Komplet kvačila s dvomasenim zamašnjakom', price: 610 }] });
  // A service a year and a month old: shows up in Poslovanje → Podsjetnici.
  const c5 = await client(T, { first: 'Ante', last: 'Perić', phone: '+385 91 300 9900', city: 'Split' });
  const a5 = await asset(T, c5, { id: 'ST-330-AP', make: 'Peugeot', model: '308 1.6 HDi', year: 2015, fuel: 'diesel' });
  await job(T, { client: c5, asset: a5, phase: 'collected', paid: true, d: 395, meter: 187400, complaint: 'Redovni servis', lines: [{ d: 'Zamjena ulja i filtera', qty: 0.6, price: 45 }, { kind: 'part', d: 'Filter ulja', price: 12 }, { kind: 'material', d: 'Motorno ulje', qty: 5, unit: 'l', price: 11 }] });

  await q(
    sb.from('gear_asset_schedule').insert([
      { tenant_id: T.id, asset_id: a1, task_code: 'oil', label: 'Ulje i filter ulja', interval_km: 15000, interval_months: 12, last_done_meter: 165000, last_done_date: day(-35), next_due_meter: 180000, next_due_date: day(330) },
      { tenant_id: T.id, asset_id: a1, task_code: 'timing_belt', label: 'Remen razvoda', interval_km: 120000, interval_months: 60, last_done_meter: 52000, last_done_date: day(-1900), next_due_meter: 172000, next_due_date: day(-75) },
      { tenant_id: T.id, asset_id: a2, task_code: 'brake_fluid', label: 'Kočiona tekućina', interval_months: 24, last_done_date: day(-700), next_due_date: day(30) },
      { tenant_id: T.id, asset_id: a4, task_code: 'oil', label: 'Ulje i filter ulja', interval_km: 15000, interval_months: 12, last_done_meter: 229800, last_done_date: day(-62), next_due_meter: 244800, next_due_date: day(303) },
      { tenant_id: T.id, asset_id: a3, task_code: 'ac_service', label: 'Servis klime', interval_months: 24, last_done_date: day(-715), next_due_date: day(15) },
    ])
  );
  return { T, links: [gearLink] };
}

// ---------------------------------------------------------------------
// BODY — limarija i lakirnica
// ---------------------------------------------------------------------
async function seedBody() {
  const T = await workshop({ pkg: 'body', name: 'Limarija i lakirnica Jurić', city: 'Rijeka', address: 'Industrijska zona Kukuljanovo 14', phone: '+385 51 555 0303', owner: 'Dario Jurić', worker: 'Filip Knežević' });
  const insurers = await q(
    sb
      .from('insurers')
      .insert([
        { tenant_id: T.id, name: 'Osiguranje Jadran d.d.', phone: '+385 51 600 100', email: 'stete@primjer.hr' },
        { tenant_id: T.id, name: 'Sigurnost osiguranje d.d.', phone: '+385 1 600 200' },
      ])
      .select('id')
  );
  const c1 = await client(T, { first: 'Sanja', last: 'Vuković', phone: '+385 91 400 1122', city: 'Rijeka' });
  const c2 = await client(T, { first: 'Goran', last: 'Pavlović', phone: '+385 98 400 3344', city: 'Opatija' });
  const c3 = await client(T, { first: 'Lana', last: 'Šimić', phone: '+385 95 400 5566', city: 'Kastav' });
  const c4 = await client(T, { first: 'Robert', last: 'Kos', phone: '+385 99 400 7788', city: 'Rijeka' });
  const a1 = await asset(T, c1, { id: 'RI-220-SV', make: 'Toyota', model: 'Yaris', year: 2020, fuel: 'hybrid', paint: '1G3' });
  const a2 = await asset(T, c2, { id: 'RI-771-GP', make: 'Volkswagen', model: 'Passat B8', year: 2018, fuel: 'diesel', paint: 'LC9X' });
  const a3 = await asset(T, c3, { id: 'RI-455-LS', make: 'Hyundai', model: 'Tucson', year: 2022, fuel: 'petrol', paint: 'PR2' });
  const a4 = await asset(T, c4, { id: 'RI-903-RK', make: 'Audi', model: 'A4 Avant', year: 2019, fuel: 'diesel', paint: 'LY9T' });

  const j1 = await job(T, { client: c1, asset: a1, phase: 'diagnosis', d: 0, complaint: 'Parkiranje, udaren prednji branik i blatobran', meter: 45200 });
  const [e1] = await q(sb.from('body_estimates').insert({ tenant_id: T.id, job_id: j1.id, version: 1, status: 'draft', loss_type: 'parking', loss_date: day(-2) }).select('id'));
  await q(
    sb.from('body_panel_damages').insert([
      { tenant_id: T.id, estimate_id: e1.id, zone: 'front_bumper', damage_type: 'crack', size: 'medium', operation: 'replace', hours_body: 0, hours_prep: 1.2, hours_paint: 1.5, hours_assembly: 1 },
      { tenant_id: T.id, estimate_id: e1.id, zone: 'fender_fl', damage_type: 'dent', size: 'small', operation: 'repair', hours_body: 1.5, hours_prep: 1, hours_paint: 1.2, hours_assembly: 0.5 },
      { tenant_id: T.id, estimate_id: e1.id, zone: 'headlight_l', damage_type: 'scratch', size: 'small', operation: 'polish', hours_body: 0, hours_prep: 0, hours_paint: 0, hours_assembly: 0.3 },
    ])
  );
  for (const [i, angle] of ['Prednja lijeva 3/4', 'Prednja strana', 'Lijevi bok'].entries()) {
    await photo(T, j1.id, { label: angle, sub: 'RI-220-SV · prije popravka', tag: 'angle', stage: 'before', zone: angle, hue: 330 + i * 8, customer: true, d: 0 });
  }
  await conditionReport(T, j1.id, {
    marks: [
      { zone: 'front_bumper', code: 'P', note: 'sredina, pukotina oko 8 cm' },
      { zone: 'fender_fl', code: 'U', note: 'prednji blatobran lijevi' },
      { zone: 'headlight_l', code: 'O' },
      { zone: 'wheel_fl', code: 'O', note: 'naplatak prednji lijevi, krak' },
      { zone: 'pillar_c_l', code: 'O', note: 'C stup lijevi, donji rub' },
    ],
    equipment: [['Ključevi', true], ['Dokumenti vozila', true], ['Europsko izvješće o nezgodi', false], ['Polica osiguranja', true], ['Radio / ukrasne lajsne', true], ['Sadržaj prtljažnika', false], ['Registracijske ploče', true]],
    fuel: '3/4',
    d: 0,
  });

  const j2 = await job(T, {
    client: c2,
    asset: a2,
    phase: 'in_progress',
    d: 6,
    meter: 156300,
    complaint: 'Sudar, stražnji dio, osiguranje',
    lines: [
      { d: 'Limarski radovi', qty: 6.5, price: 42 },
      { d: 'Priprema i lakiranje', qty: 7, price: 42 },
      { kind: 'part', d: 'Stražnji branik (original)', price: 390, buy: 305 },
      { kind: 'material', d: 'Materijal za lakiranje', price: 210, buy: 120 },
    ],
  });
  const [e2] = await q(
    sb.from('body_estimates').insert({ tenant_id: T.id, job_id: j2.id, version: 1, status: 'approved', insurer_id: insurers[0].id, claim_number: 'ŠT-2026-88412', policy_number: 'AO-4471029', loss_date: day(-9), loss_type: 'collision', assessor_name: 'Ivo Mikulić', inspected_at: at(7, 11) }).select('id')
  );
  await q(sb.from('private_amounts').insert({ tenant_id: T.id, entity: 'body_estimates', entity_id: e2.id, field: 'approved_amount', amount: 1680 }));
  await q(
    sb.from('body_panel_damages').insert([
      { tenant_id: T.id, estimate_id: e2.id, zone: 'rear_bumper', damage_type: 'break', size: 'large', operation: 'replace', hours_body: 0, hours_prep: 1.5, hours_paint: 2, hours_assembly: 1.2 },
      { tenant_id: T.id, estimate_id: e2.id, zone: 'trunk', damage_type: 'deformation', size: 'medium', operation: 'repair', hours_body: 4, hours_prep: 1.5, hours_paint: 2, hours_assembly: 0 },
      { tenant_id: T.id, estimate_id: e2.id, zone: 'quarter_rr', damage_type: 'dent', size: 'small', operation: 'repair', hours_body: 2.5, hours_prep: 1, hours_paint: 1.5, hours_assembly: 0 },
    ])
  );
  const [pj] = await q(
    sb.from('body_paint_jobs').insert({ tenant_id: T.id, job_id: j2.id, paint_code: 'LC9X', paint_name: 'Deep Black Pearl', paint_system: 'Vodena baza', coat_structure: 'two_stage', color_match: 'spectro', variant: 'V2', booth_temp_c: 22.5, booth_humidity_pct: 55 }).select('id')
  );
  await q(
    sb.from('body_paint_mix_lines').insert(
      [
        ['M-900', 412.0, 412.6],
        ['M-940', 86.0, 85.1],
        ['M-915', 24.5, 25.4],
        ['M-802', 8.2, 8.2],
      ].map(([code, target, actual], i) => ({ tenant_id: T.id, paint_job_id: pj.id, sort: i + 1, component_code: code, target_g: target, actual_g: actual }))
    )
  );
  await q(
    sb.from('body_production_phases').insert([
      { tenant_id: T.id, job_id: j2.id, phase: 'disassembly', started_at: at(5, 8), finished_at: at(5, 10, 30), worker_id: T.worker },
      { tenant_id: T.id, job_id: j2.id, phase: 'bodywork', started_at: at(5, 11), finished_at: at(3, 15), worker_id: T.worker },
      { tenant_id: T.id, job_id: j2.id, phase: 'prep', started_at: at(1, 8), worker_id: T.worker },
    ])
  );
  await q(sb.from('body_adas_calibrations').insert({ tenant_id: T.id, job_id: j2.id, system: 'parking_sensors', procedure: 'static', result: 'success', performed_at: at(2, 14) }));
  await q(sb.from('body_material_usage').insert([{ tenant_id: T.id, job_id: j2.id, material: 'filler', qty: 350, unit: 'g' }, { tenant_id: T.id, job_id: j2.id, material: 'primer', qty: 400, unit: 'ml' }]));
  await photo(T, j2.id, { label: 'Stražnji branik, lom', sub: 'Prije · za osiguranje', tag: 'damage', stage: 'before', hue: 350, customer: true, d: 6 });
  await photo(T, j2.id, { label: 'Probna pločica LC9X', sub: 'Usporedba pod dnevnim svjetlom', tag: 'test_panel', stage: 'during', hue: 240, d: 1 });
  await messages(T, j2.id, 'Nijansa na peti vratima malo svjetlija, prijelaz na blatobran?', 'Da, prijelaz na desni stražnji blatobran. Upiši u Lakirnicu.');

  const j3 = await job(T, { client: c3, asset: a3, phase: 'awaiting_approval', d: 4, meter: 23100, complaint: 'Tuča, krov i hauba', lines: [{ d: 'PDR, izvlačenje udubljenja bez lakiranja', qty: 9, price: 50 }] });
  await q(sb.from('body_estimates').insert({ tenant_id: T.id, job_id: j3.id, version: 1, status: 'sent', insurer_id: insurers[1].id, claim_number: 'KS-26-10277', loss_type: 'hail', loss_date: day(-6) }));
  await photo(T, j3.id, { label: 'Krov, tuča', sub: '38 udubljenja', tag: 'damage', stage: 'before', hue: 200, customer: true, d: 4 });

  await job(T, { client: c4, asset: a4, phase: 'ready', d: 5, meter: 98100, complaint: 'Poliranje / zaštita', summary: 'Poliranje u tri koraka, keramička zaštita.', lines: [{ d: 'Poliranje i zaštita laka', qty: 4, price: 40 }, { kind: 'material', d: 'Paste i zaštita', price: 35 }] });
  await job(T, { client: c1, asset: a1, phase: 'collected', paid: true, d: 48, meter: 41000, complaint: 'Vandalizam, ogreben bok', lines: [{ d: 'Priprema i lakiranje dvaju dijelova', qty: 5.5, price: 42 }, { kind: 'material', d: 'Materijal za lakiranje', price: 140 }] });
  await job(T, { client: c2, asset: a2, phase: 'collected', paid: true, d: 95, meter: 149000, complaint: 'Divljač, prednji dio', lines: [{ d: 'Limarski radovi i lakiranje', qty: 11, price: 42 }, { kind: 'part', d: 'Prednji branik i rešetka', price: 520 }] });
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// WHEEL — vulkanizeri i hotel za gume
// ---------------------------------------------------------------------
async function seedWheel() {
  const T = await workshop({ pkg: 'wheel', name: 'Vulkanizer Brzi kotač', city: 'Osijek', address: 'Vukovarska cesta 52', phone: '+385 31 555 0404', owner: 'Zoran Šarić', worker: 'Dejan Vuković' });
  const locs = [];
  for (const [sector, racks] of [['A', 2], ['B', 1]]) {
    for (let rack = 1; rack <= racks; rack++) for (let shelf = 1; shelf <= 3; shelf++) for (let slot = 1; slot <= 4; slot++) locs.push({ tenant_id: T.id, sector, rack, shelf, slot });
  }
  const locations = await q(sb.from('wheel_storage_locations').insert(locs).select('id, sector, rack, shelf, slot'));
  locations.sort((a, b) => `${a.sector}${a.rack}${a.shelf}${a.slot}`.localeCompare(`${b.sector}${b.rack}${b.shelf}${b.slot}`));
  await q(
    sb.from('wheel_torque_specs').insert([
      { tenant_id: T.id, make: 'Volkswagen', torque_nm: 120, bolt_size: 'M14×1,5', retorque_km: 50 },
      { tenant_id: T.id, make: 'Škoda', torque_nm: 120, bolt_size: 'M14×1,5', retorque_km: 50 },
      { tenant_id: T.id, make: 'Opel', torque_nm: 110, bolt_size: 'M12×1,5', retorque_km: 50 },
      { tenant_id: T.id, make: 'Toyota', torque_nm: 103, bolt_size: 'M12×1,5', retorque_km: 50 },
    ])
  );

  const owners = [
    { first: 'Krešimir', last: 'Tadić', phone: '+385 91 500 1100', car: { id: 'OS-112-KT', make: 'Volkswagen', model: 'Passat', year: 2017 }, size: [215, 55, 17, '94', 'V'] },
    { first: 'Jasna', last: 'Lovrić', phone: '+385 98 500 2200', car: { id: 'OS-543-JL', make: 'Škoda', model: 'Fabia', year: 2019 }, size: [185, 60, 15, '88', 'H'] },
    { first: 'Hrvoje', last: 'Blažević', phone: '+385 95 500 3300', car: { id: 'OS-790-HB', make: 'Opel', model: 'Insignia', year: 2018 }, size: [225, 45, 18, '95', 'W'] },
    { first: 'Martina', last: 'Pranjić', phone: '+385 99 500 4400', car: { id: 'OS-221-MP', make: 'Toyota', model: 'RAV4', year: 2021 }, size: [225, 65, 17, '102', 'H'] },
    { first: 'Dalibor', last: 'Matić', phone: '+385 91 500 5500', car: { id: 'DA-341-DM', make: 'Volkswagen', model: 'Tiguan', year: 2020 }, size: [235, 55, 18, '100', 'V'] },
    { first: 'Tena', last: 'Jukić', phone: '+385 98 500 6600', car: { id: 'OS-677-TJ', make: 'Škoda', model: 'Octavia', year: 2021 }, size: [205, 55, 16, '91', 'V'] },
  ];
  const people = [];
  for (const [i, o] of owners.entries()) {
    const c = await client(T, { first: o.first, last: o.last, phone: o.phone, city: 'Osijek' });
    const a = await asset(T, c, { ...o.car });
    const [w, asp, rim, li, si] = o.size;
    const winterTread = [6.8, 5.1, 3.7, 7.4, 4.6, 6.1][i];
    const sets = await q(
      sb
        .from('wheel_tire_sets')
        .insert([
          { tenant_id: T.id, client_id: c, asset_id: a, season: 'summer', width: w, aspect: asp, rim_diameter: rim, load_index: li, speed_index: si, brand: ['Michelin', 'Continental', 'Bridgestone', 'Goodyear', 'Pirelli', 'Hankook'][i], model: 'Primacy', on_rims: false, rim_material: null, bolts_included: false, status: 'on_vehicle' },
          { tenant_id: T.id, client_id: c, asset_id: a, season: 'winter', width: w, aspect: asp, rim_diameter: rim, load_index: li, speed_index: 'H', brand: ['Nokian', 'Continental', 'Michelin', 'Goodyear', 'Kleber', 'Hankook'][i], model: 'WinterContact', on_rims: i % 2 === 0, rim_material: i % 2 === 0 ? 'steel' : null, bolts_included: i % 2 === 0, status: 'stored' },
        ])
        .select('id, season')
    );
    const winter = sets.find((s) => s.season === 'winter');
    const summer = sets.find((s) => s.season === 'summer');
    await q(
      sb.from('wheel_tires').insert(
        ['FL', 'FR', 'RL', 'RR'].flatMap((pos, k) => [
          { tenant_id: T.id, set_id: winter.id, position: pos, dot_week: 10 + k, dot_year: 2019 + (i % 4), tread_outer_mm: winterTread + (k < 2 ? -0.3 : 0.4), tread_middle_mm: winterTread + (k < 2 ? 0 : 0.6), tread_inner_mm: winterTread - (k < 2 ? 0.8 : 0), measured_at: at(160), damage: 'none' },
          { tenant_id: T.id, set_id: summer.id, position: pos, dot_week: 30 + k, dot_year: 2022, tread_outer_mm: 5.4, tread_middle_mm: 5.8, tread_inner_mm: 5.2, measured_at: at(1), damage: 'none' },
        ])
      )
    );
    const [stay] = await q(
      sb.from('wheel_storage_stays').insert({ tenant_id: T.id, set_id: winter.id, location_id: locations[i * 2].id, checked_in_at: at(160 - i), season_label: 'Zimske 2025/26', contract_signed: true, created_by: T.worker }).select('id')
    );
    await q(sb.from('private_amounts').insert({ tenant_id: T.id, entity: 'wheel_storage_stays', entity_id: stay.id, field: 'fee', amount: 25 }));
    people.push({ c, a, winter: winter.id, summer: summer.id, car: o.car });
  }

  const [p1, p2, p3, p4, p5, p6] = people;
  const j1 = await job(T, {
    client: p1.c,
    asset: p1.a,
    phase: 'in_progress',
    d: 0,
    meter: 142300,
    complaint: 'Sezonska zamjena',
    lines: [
      { d: 'Skidanje i montaža 4 kotača', unit: 'paušal', price: 30 },
      { d: 'Balansiranje 4 kotača', unit: 'paušal', price: 20 },
      { kind: 'fee', d: 'Čuvanje seta guma jednu sezonu', unit: 'paušal', price: 25 },
    ],
  });
  await q(sb.from('wheel_torque_records').insert({ tenant_id: T.id, job_id: j1.id, applied_nm: 120, tool: 'Moment ključ Hazet 5122', tool_calibrated_on: day(-120), retorque_due: day(7) }));
  await q(sb.from('wheel_balancing').insert(['FL', 'FR', 'RL', 'RR'].map((position, k) => ({ tenant_id: T.id, job_id: j1.id, position, weight_inner_g: [15, 20, 5, 10][k], weight_outer_g: [10, 5, 15, 0][k] }))));
  await inspection(T, j1.id, 'wheel.season_change', 'Sezonska zamjena', checklistCodes('season_change', 4).map((c) => [c, 'ok']), { d: 0 });
  await conditionReport(T, j1.id, {
    marks: [
      { zone: 'tyre_fl', code: 'I', note: 'prednja lijeva ljetna, šara 5,4 mm' },
      { zone: 'wheel_fl', code: 'O', note: 'naplatak prednji lijevi, rub od rubnika' },
      { zone: 'valve_fr', code: 'N', note: 'kapica ventila prednjeg desnog nestala' },
      { zone: 'lock_nut', code: 'N', note: 'ključ sigurnosnog vijka nije u autu' },
    ],
    equipment: [['Ključ sigurnosnih vijaka', false], ['Kapice (4)', true], ['Vijci u vrećici', true], ['Rezervni kotač', true], ['Senzori TPMS', true]],
    fuel: '1/2',
    d: 0,
  });
  await photo(T, j1.id, { label: 'Zimske, šara 6,8 mm', sub: 'OS-112-KT · izmjereno', tag: 'tire', hue: 200, d: 0 });

  const j2 = await job(T, { client: p3.c, asset: p3.a, phase: 'diagnosis', d: 1, meter: 118900, complaint: 'Vibracije u volanu, Vuče u stranu', lines: [{ d: 'Mjerenje i podešavanje geometrije', unit: 'paušal', price: 45 }] });
  const [al] = await q(sb.from('wheel_alignments').insert({ tenant_id: T.id, job_id: j2.id, device: 'Hunter Hawkeye', spec_source: 'Hunter WinAlign', steering_centered: true, performed_at: at(1, 11) }).select('id'));
  await q(
    sb.from('wheel_alignment_values').insert([
      { tenant_id: T.id, alignment_id: al.id, axle: 'front', wheel: 'left', parameter: 'toe', before_value: 0.35, after_value: 0.08, spec_min: 0.0, spec_max: 0.17, unit: 'deg' },
      { tenant_id: T.id, alignment_id: al.id, axle: 'front', wheel: 'right', parameter: 'toe', before_value: -0.12, after_value: 0.07, spec_min: 0.0, spec_max: 0.17, unit: 'deg' },
      { tenant_id: T.id, alignment_id: al.id, axle: 'front', wheel: 'left', parameter: 'camber', before_value: -1.45, after_value: -0.95, spec_min: -1.25, spec_max: -0.25, unit: 'deg' },
      { tenant_id: T.id, alignment_id: al.id, axle: 'rear', wheel: 'total', parameter: 'total_toe', before_value: 0.22, after_value: 0.22, spec_min: 0.1, spec_max: 0.4, unit: 'deg' },
    ])
  );
  await photo(T, j2.id, { label: 'Ispis geometrije', sub: 'Prije / poslije', tag: 'alignment_report', hue: 150, d: 1 });

  const j3 = await job(T, { client: p2.c, asset: p2.a, phase: 'ready', d: 1, meter: 64200, complaint: 'Krpanje gume, čavao', lines: [{ d: 'Krpanje gume (gazeći sloj)', unit: 'paušal', price: 15 }] });
  await q(sb.from('wheel_repairs').insert({ tenant_id: T.id, job_id: j3.id, position: 'RL', damage_zone: 'tread', method: 'combo' }));
  const j4 = await job(T, { client: p4.c, asset: p4.a, phase: 'intake', d: 0, meter: 39800, complaint: 'Guma probušena, bok', assigned: false, urgent: true });
  await q(sb.from('wheel_repairs').insert({ tenant_id: T.id, job_id: j4.id, position: 'FR', damage_zone: 'sidewall' }));
  await photo(T, j4.id, { label: 'Oštećenje boka', sub: 'Nije popravljivo, nova guma', tag: 'damage', hue: 5, customer: true, d: 0 });
  await conditionReport(T, j4.id, {
    marks: [{ zone: 'tyre_fr', code: 'L', note: 'bok prednje desne, rez od ruba' }, { zone: 'wheel_fr', code: 'O', note: 'naplatak prednji desni, lagana ogrebotina' }],
    equipment: [['Ključ sigurnosnih vijaka', true], ['Kapice (4)', false], ['Rezervni kotač', false], ['Senzori TPMS', true]],
    fuel: '1/4',
    d: 0,
  });
  await job(T, { client: p5.c, asset: p5.a, phase: 'collected', paid: true, d: 12, meter: 71000, complaint: 'Sezonska zamjena', lines: [{ d: 'Skidanje i montaža 4 kotača', unit: 'paušal', price: 30 }, { d: 'Balansiranje 4 kotača', unit: 'paušal', price: 20 }] });
  await job(T, { client: p6.c, asset: p6.a, phase: 'collected', paid: true, d: 40, meter: 52300, complaint: 'Nove gume', lines: [{ kind: 'part', d: 'Guma 205/55 R16 91V', qty: 4, price: 89, buy: 64 }, { d: 'Montaža i balansiranje', unit: 'paušal', price: 40 }] });
  await job(T, { client: p2.c, asset: p2.a, phase: 'collected', paid: true, d: 170, meter: 58000, complaint: 'Sezonska zamjena', lines: [{ d: 'Skidanje i montaža 4 kotača', unit: 'paušal', price: 30 }, { kind: 'fee', d: 'Čuvanje seta guma', unit: 'paušal', price: 25 }] });
  await messages(T, j1.id, 'Jedan vijak sigurnosni, ključ nije u autu, što sad?', 'Nazovi stranku, imamo univerzalni set u ormaru 2.');
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// FLEET — teretni program, građevina, flote
// ---------------------------------------------------------------------
async function seedFleet() {
  const T = await workshop({ pkg: 'fleet', name: 'Servis gospodarskih vozila Perić', city: 'Sesvete', address: 'Zagrebačka 210', phone: '+385 1 555 0505', owner: 'Stjepan Perić', worker: 'Mario Bošnjak' });
  const t1 = await client(T, { company: 'Transport Horvat d.o.o.', first: 'Damir', last: 'Horvat', phone: '+385 91 600 1100', city: 'Dugo Selo', oib: '12345678903' });
  await q(
    sb.from('fleet_accounts').insert([
      { tenant_id: T.id, client_id: t1, fleet_manager_name: 'Damir Horvat', fleet_manager_phone: '+385 91 600 1100', payment_terms_days: 30, po_required: true },
    ])
  );
  const truck1 = await asset(T, t1, { type: 'tractor_unit', id: 'ZG-4410-TH', make: 'MAN', model: 'TGX 18.470', year: 2020, fuel: 'diesel', internal: 'K-04', axles: '4x2', gvw: 18 });
  const truck2 = await asset(T, t1, { type: 'tractor_unit', id: 'ZG-4411-TH', make: 'Volvo', model: 'FH 500', year: 2019, fuel: 'diesel', internal: 'K-05', axles: '4x2', gvw: 18 });
  const trailer1 = await asset(T, t1, { type: 'semi_trailer', id: 'ZG-123-PR', make: 'Schmitz Cargobull', model: 'S.KO Cool', year: 2018, parent: truck1, internal: 'P-11', axles: '3 osovine' });
  const truck3 = await asset(T, t1, { type: 'truck', id: 'ZG-7702-TH', make: 'Mercedes-Benz', model: 'Atego 1224', year: 2016, fuel: 'diesel', internal: 'K-09', gvw: 12 });

  await q(
    sb.from('fleet_compliance_items').insert([
      { tenant_id: T.id, asset_id: truck1, kind: 'technical_inspection', valid_from: day(-355), valid_until: day(10) },
      { tenant_id: T.id, asset_id: truck1, kind: 'tachograph', valid_from: day(-733), valid_until: day(-3) },
      { tenant_id: T.id, asset_id: truck1, kind: 'fire_extinguisher', valid_from: day(-340), valid_until: day(25) },
      { tenant_id: T.id, asset_id: truck2, kind: 'technical_inspection', valid_from: day(-200), valid_until: day(165) },
      { tenant_id: T.id, asset_id: truck2, kind: 'adr', valid_from: day(-300), valid_until: day(42) },
      { tenant_id: T.id, asset_id: trailer1, kind: 'preventive_inspection', valid_from: day(-170), valid_until: day(12) },
      { tenant_id: T.id, asset_id: truck3, kind: 'technical_inspection', valid_from: day(-330), valid_until: day(35) },
    ])
  );
  const [plan] = await q(sb.from('fleet_pm_plans').insert({ tenant_id: T.id, name: 'PM-A kamion', interval_km: 60000, interval_days: 365, checklist_code: 'fleet.pm_a', template_code: 'fleet.pm_a' }).select('id'));
  await q(sb.from('fleet_asset_pm').insert({ tenant_id: T.id, asset_id: truck2, plan_id: plan.id, last_done_km: 402000, last_done_date: day(-300), next_due_km: 462000, next_due_date: day(65) }));

  const j1 = await job(T, { client: t1, asset: truck1, phase: 'in_progress', d: 0, source: 'field', meter: 388950, urgent: true, complaint: 'Terenska intervencija, vozilo stoji na parkiralištu, ne pali', lines: [{ kind: 'fee', d: 'Izlazak na teren', unit: 'paušal', price: 60 }, { d: 'Rad na terenu', qty: 2, price: 65 }, { kind: 'part', d: 'Relej anlasera', price: 48, buy: 22 }] });
  await q(
    sb.from('fleet_field_jobs').insert({ tenant_id: T.id, job_id: j1.id, address: 'Parkiralište TPK, Dugo Selo', lat: 45.8061, lng: 16.2376, departed_at: at(0, 7, 10), arrived_at: at(0, 7, 55), work_started: at(0, 8, 5), travel_km: 18 })
  );
  await q(sb.from('fleet_downtime').insert({ tenant_id: T.id, asset_id: truck1, job_id: j1.id, from_at: at(1, 16), reason: 'breakdown' }));
  await photo(T, j1.id, { label: 'Motor ne pali', sub: 'MAN TGX · teren Dugo Selo', tag: 'field', hue: 40, d: 0 });
  await conditionReport(T, j1.id, {
    diagram: 'truck',
    marks: [
      { zone: 'door_l', code: 'O', note: 'lijeva vrata kabine, donji rub' },
      { zone: 'step_l', code: 'B', note: 'stepenica lijeva, savijena' },
      { zone: 'tyre_fl', code: 'L', note: 'prednja lijeva, bočni rez' },
      { zone: 'air_lines', code: 'R', note: 'zračna crijeva, ovitak ispucao' },
      { zone: 'ebs_cable', code: 'K', note: 'utikač ABS prikolice, oksidacija' },
    ],
    equipment: [['Ključevi', true], ['Kartica tahografa', true], ['Dokumenti vozila', true], ['Vatrogasni aparat', true], ['Trokut i prva pomoć', true], ['Klinovi', true], ['Lanci', false], ['Ključ cerade / kaveza', true]],
    fuel: '3/4',
    d: 0,
  });

  const j2 = await job(T, {
    client: t1,
    asset: truck2,
    phase: 'in_progress',
    d: 1,
    meter: 461800,
    complaint: 'Planski servis (PM)',
    lines: [
      { d: 'Plansko održavanje A', qty: 3, price: 55 },
      { kind: 'part', d: 'Filter ulja', price: 35, buy: 21 },
      { kind: 'part', d: 'Filter goriva', price: 45, buy: 27 },
      { kind: 'material', d: 'Motorno ulje 10W-40', qty: 32, unit: 'l', price: 6, buy: 3.8 },
    ],
  });
  await inspection(T, j2.id, 'fleet.pm_a', 'PM-A', checklistCodes('pm_a', 8).map((c, i) => [c, i === 3 ? 'warn' : i < 6 ? 'ok' : 'not_checked', null, i === 3 ? 'Obloge straga 40%' : null]), { d: 1 });

  await job(T, { client: t1, asset: truck3, phase: 'awaiting_parts', d: 3, meter: 612400, complaint: 'Kočnice / zrak, pada tlak u krugu 2', lines: [{ d: 'Dijagnostika zračnog sustava', qty: 1.5, price: 55 }, { kind: 'part', d: 'Ventil četverokružni zaštitni', price: 210, buy: 150 }] });
  await job(T, { client: t1, asset: trailer1, phase: 'ready', d: 2, meter: 0, complaint: 'Pregled prikolice', summary: 'Ležajevi, kočnice i svjetla pregledani, zamijenjena žarulja pozicije.', lines: [{ d: 'Pregled priključnog vozila', qty: 1.5, price: 55 }] });
  await job(T, { client: t1, asset: truck1, phase: 'collected', paid: false, d: 16, meter: 388200, complaint: 'Tahograf', lines: [{ d: 'Periodični pregled tahografa', unit: 'paušal', price: 120 }] });
  await job(T, { client: t1, asset: truck3, phase: 'collected', paid: true, d: 80, meter: 598000, complaint: 'Zamjena uloška sušača zraka', lines: [{ d: 'Zamjena uloška sušača zraka', qty: 0.5, price: 55 }, { kind: 'part', d: 'Uložak sušača zraka', price: 45 }] });

  await q(sb.from('fleet_service_requests').insert({ tenant_id: T.id, asset_id: trailer1, reported_by: 'Vozač Ivica (K-04)', description: 'Kočnice cvile na prikolici, ABS lampica povremeno', priority: 'urgent', status: 'new' }));
  await q(
    sb.from('fleet_driver_checks').insert({
      tenant_id: T.id,
      asset_id: truck1,
      driver_name: 'Ivica Lončar',
      submitted_at: at(0, 5, 45),
      meter_value: 388950,
      meter_unit: 'km',
      has_defects: true,
      results: [
        { item: 'Gume, tlak i oštećenja', ok: true },
        { item: 'Kabeli i crijeva prikolice (zrak, ABS, svjetla)', ok: false, note: 'ABS lampica prikolice' },
      ],
    })
  );
  await messages(T, j1.id, 'Na terenu nema signala, koji je relej anlasera za ovaj MAN?', 'Bosch 0 331 303 007, fotka pločice je u galeriji.');
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// MACHINE — bageri, traktori, priključci
// ---------------------------------------------------------------------
async function seedMachine() {
  const T = await workshop({ pkg: 'machine', name: 'Servis radnih strojeva Kamen', city: 'Vrbovec', address: 'Moslavačka 14', phone: '+385 1 555 0606', owner: 'Siniša Kralj', worker: 'Ivan Bašić' });
  const t2 = await client(T, { company: 'Građevina Kamen d.o.o.', first: 'Siniša', last: 'Kralj', phone: '+385 98 600 2200', city: 'Vrbovec' });
  const t3 = await client(T, { company: 'Agro Slavonija d.o.o.', first: 'Zdenko', last: 'Pavić', phone: '+385 95 600 3300', city: 'Đakovo' });
  await q(
    sb.from('fleet_accounts').insert([
      { tenant_id: T.id, client_id: t2, fleet_manager_name: 'Siniša Kralj', fleet_manager_phone: null, payment_terms_days: 45, po_required: false },
      { tenant_id: T.id, client_id: t3, fleet_manager_name: 'Zdenko Pavić', fleet_manager_phone: null, payment_terms_days: 60, po_required: false },
    ])
  );
  const digger = await asset(T, t2, { type: 'machine', id: 'CAT-320-0071', make: 'Caterpillar', model: '320 GC', year: 2021, unit: 'mth', vin: 'CAT0320GCXXX01234', internal: 'B-2' });
  const tractor = await asset(T, t3, { type: 'tractor', id: 'OS-T-221', make: 'John Deere', model: '6155R', year: 2019, unit: 'mth' });
  await asset(T, t3, { type: 'implement', id: 'PRS-8', make: 'Amazone', model: 'UX 5201 prskalica', year: 2020, unit: 'mth', parent: tractor });

  await q(
    sb.from('fleet_compliance_items').insert([
      { tenant_id: T.id, asset_id: digger, kind: 'insurance', valid_from: day(-300), valid_until: day(65) },
      { tenant_id: T.id, asset_id: tractor, kind: 'technical_inspection', valid_from: day(-200), valid_until: day(40) },
      { tenant_id: T.id, asset_id: digger, kind: 'fire_extinguisher', valid_from: day(-280), valid_until: day(18) },
    ])
  );
  const [plan] = await q(sb.from('fleet_pm_plans').insert({ tenant_id: T.id, name: 'Servis 250 mth', interval_mth: 250, checklist_code: 'machine.service', template_code: 'machine.service_250' }).select('id'));
  await q(sb.from('fleet_asset_pm').insert({ tenant_id: T.id, asset_id: digger, plan_id: plan.id, last_done_mth: 4000, last_done_date: day(-40), next_due_mth: 4250, next_due_date: day(20) }));

  const j1 = await job(T, { client: t2, asset: digger, phase: 'in_progress', d: 0, source: 'field', unit: 'mth', meter: 4213.5, urgent: true, complaint: 'Terenska intervencija, Hidraulika, curi crijevo na strijeli', lines: [{ kind: 'fee', d: 'Izlazak na teren', unit: 'paušal', price: 60 }, { d: 'Rad na terenu', qty: 2, price: 65 }, { kind: 'part', d: 'Hidraulično crijevo 1/2" 1,6 m (izrada)', price: 95, buy: 58 }] });
  await q(
    sb.from('fleet_field_jobs').insert({ tenant_id: T.id, job_id: j1.id, address: 'Gradilište obilaznica Vrbovec, dionica 3', lat: 45.8829, lng: 16.4213, departed_at: at(0, 7, 10), arrived_at: at(0, 7, 55), work_started: at(0, 8, 5), travel_km: 38 })
  );
  await q(sb.from('fleet_downtime').insert({ tenant_id: T.id, asset_id: digger, job_id: j1.id, from_at: at(1, 16), reason: 'breakdown' }));
  await photo(T, j1.id, { label: 'Crijevo na strijeli', sub: 'CAT 320 · teren Vrbovec', tag: 'field', hue: 40, d: 0 });
  await conditionReport(T, j1.id, {
    diagram: 'truck',
    marks: [
      { zone: 'hose_l', code: 'P', note: 'hidraulično crijevo lijevo na strijeli, curi' },
      { zone: 'boom', code: 'O', note: 'strijela, ogrebotine od rada' },
      { zone: 'track_l', code: 'R', note: 'gusjenica lijeva, zglobovi suhi' },
      { zone: 'cab_glass', code: 'K', note: 'prednje staklo, kamenčić desno' },
      { zone: 'bucket', code: 'B', note: 'zubi žlice istrošeni' },
    ],
    equipment: [['Ključevi kabine', true], ['Pločica stroja', true], ['Dokumenti stroja', true], ['Vatrogasni aparat', true], ['Priključak', true], ['Utezi', false], ['Uputstva', false]],
    d: 0,
  });

  await inspection(T, j1.id, 'machine.check', 'Pregled stroja', checklistCodes('check', 9).map((c, i) => [c, i === 2 ? 'warn' : i < 7 ? 'ok' : 'not_checked', null, i === 2 ? 'Crijevo na strijeli curi' : null]), { d: 0 });

  const jTractor = await job(T, { client: t3, asset: tractor, phase: 'collected', paid: true, d: 25, unit: 'mth', meter: 3120, complaint: 'Planski servis (PM)', lines: [{ d: 'Servis 500 mth', qty: 4, price: 55 }, { kind: 'part', d: 'Filteri i ulje', price: 310 }] });
  await conditionReport(T, jTractor.id, {
    diagram: 'truck',
    kind: 'handover',
    marks: [{ zone: 'hood', code: 'O', note: 'poklopac motora, stara ogrebotina' }, { zone: 'mirror_l', code: 'O' }],
    equipment: [['Ključevi kabine', true], ['Pločica stroja', true], ['Dokumenti stroja', true], ['Vatrogasni aparat', true], ['Priključak', true], ['Utezi', true], ['Uputstva', true]],
    d: 25,
  });
  await job(T, { client: t2, asset: digger, phase: 'ready', d: 3, unit: 'mth', meter: 3980, complaint: 'Servis 250 mth', lines: [{ d: 'Servis radnog stroja (250 mth)', qty: 3, price: 55 }, { kind: 'part', d: 'Filter ulja', price: 30 }, { kind: 'material', d: 'Motorno ulje', qty: 15, unit: 'l', price: 6 }] });
  await job(T, { client: t3, asset: tractor, phase: 'diagnosis', d: 1, unit: 'mth', meter: 3188, complaint: 'Klimatizacija kabine ne hladi, curi voda na pod', lines: [{ d: 'Dijagnostika klime kabine', qty: 1.5, price: 55 }] });

  await q(sb.from('fleet_service_requests').insert({ tenant_id: T.id, asset_id: digger, reported_by: 'Strojar Marko (B-2)', description: 'Curi ulje ispod stroja, nivo hidraulike pada', priority: 'urgent', status: 'new' }));
  await messages(T, j1.id, 'Na terenu nema signala za plan crijeva, koja je dimenzija spojnice?', 'JIC 3/4", fotka pločice stroja je u galeriji.');
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// MOTO (motocikli, skuteri, quadovi)
// ---------------------------------------------------------------------
async function seedMoto() {
  const T = await workshop({ pkg: 'moto', name: 'Moto centar Barić', city: 'Zadar', address: 'Obala kneza Branimira 8', phone: '+385 23 555 0606', owner: 'Tonći Barić', worker: 'Luka Šarić' });
  const areas = [];
  for (let s = 1; s <= 10; s++) areas.push({ tenant_id: T.id, area: 'Hala 1', slot: String(s), kind: 'hall' });
  for (let s = 1; s <= 6; s++) areas.push({ tenant_id: T.id, area: 'Otvoreno', slot: `P${s}`, kind: 'outdoor' });
  const locations = await q(sb.from('moto_storage_locations').insert(areas).select('id, area, slot'));
  const hall = locations.filter((l) => l.area === 'Hala 1').sort((a, b) => Number(a.slot) - Number(b.slot));

  const c1 = await client(T, { first: 'Frane', last: 'Perica', phone: '+385 91 700 1100', city: 'Zadar' });
  const c2 = await client(T, { first: 'Kristina', last: 'Ivić', phone: '+385 98 700 2200', city: 'Biograd na Moru' });
  const c3 = await client(T, { first: 'Petra', last: 'Mikulić', phone: '+385 99 700 4400', city: 'Zadar' });
  const m1 = await asset(T, c1, { type: 'motorcycle', id: 'ZD-445-FP', make: 'Yamaha', model: 'MT-07', year: 2020, fuel: 'petrol' });
  const m2 = await asset(T, c2, { type: 'motorcycle', id: 'ZD-990-KI', make: 'BMW', model: 'R 1250 GS', year: 2021, fuel: 'petrol' });
  const m3 = await asset(T, c3, { type: 'scooter', id: 'ZD-312-SK', make: 'Yamaha', model: 'XMAX 300', year: 2022, fuel: 'petrol' });

  const j1 = await job(T, { client: c1, asset: m1, phase: 'diagnosis', d: 1, meter: 18450, complaint: 'Ne pali, stajao 3 mjeseca' });
  await conditionReport(T, j1.id, {
    diagram: 'moto',
    marks: [
      { zone: 'fairing_l', code: 'O', note: 'bočni oklop lijevi, donji rub, oko 4 cm' },
      { zone: 'lever_brake', code: 'O', note: 'ručica prednje kočnice, vrh' },
      { zone: 'mirror_l', code: 'O', note: 'retrovizor lijevi' },
      { zone: 'wheel_f', code: 'K', note: 'prednja felga, lijevi krak' },
      { zone: 'slider_l', code: 'O', note: 'klizač lijevi, trag pada' },
    ],
    equipment: [
      ['Ključ kontakta', true],
      ['Ključ kacige', false],
      ['Kaciga', true],
      ['Lijevi kofer', false],
      ['Desni kofer', false],
      ['Gornji kofer', false],
      ['Dokumenti vozila', true],
      ['Daljinski alarma', false],
      ['Punjač / održavač', false],
      ['Cerada', false],
      ['Prekidač za slučaj pada', true],
      ['Alat', false],
    ],
    fuel: '1/4',
    d: 1,
  });
  await photo(T, j1.id, { label: 'Lijevi oklop, ogrebotina', sub: 'Zatečeno stanje pri prijemu', tag: 'fairing', hue: 280, d: 1 });

  const j2 = await job(T, {
    client: c3,
    asset: m3,
    phase: 'in_progress',
    d: 2,
    meter: 9200,
    complaint: 'Servis variomata, čudan zvuk pri ubrzanju',
    lines: [
      { d: 'Servis variomata', qty: 1.5, price: 45 },
      { kind: 'part', d: 'Remen variomata', price: 40, approval: 'proposed', priority: 'recommended' },
      { kind: 'part', d: 'Valjčići (set)', price: 20, approval: 'proposed', priority: 'recommended' },
    ],
  });
  await messages(T, j2.id, 'Remen je ispucan, a valjčići neravnomjerno istrošeni, predlažem oboje.', 'Predloži stranci preko poveznice, cijena je u stavkama.');

  await job(T, {
    client: c2,
    asset: m2,
    phase: 'ready',
    d: 3,
    meter: 26100,
    complaint: 'Redovni servis',
    summary: 'Servis 30.000: ulje, filteri, svjećice, kočiona tekućina, podešen ventilski razmak.',
    lines: [
      { d: 'Veliki servis motocikla', qty: 3.5, price: 45 },
      { kind: 'part', d: 'Filteri, svjećice, brtve', price: 118 },
      { kind: 'material', d: 'Motorno ulje 5W-40', qty: 4, unit: 'l', price: 14 },
    ],
  });
  await q(sb.from('moto_storage_stays').insert({ tenant_id: T.id, asset_id: m2, location_id: hall[3].id, from_date: day(-3), until_date: day(150) }));
  await job(T, { client: c1, asset: m1, phase: 'collected', paid: true, d: 140, meter: 16800, complaint: 'Redovni servis', lines: [{ d: 'Zamjena ulja i filtera, pregled', qty: 1, price: 45 }, { kind: 'part', d: 'Filter ulja', price: 14 }] });
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// MARINE (plovila, jet-skiji, vanbrodski i unutarnji motori)
// ---------------------------------------------------------------------
async function seedMarine() {
  const T = await workshop({ pkg: 'marine', name: 'Nautika Barić', city: 'Zadar', address: 'Obala kneza Branimira 8', phone: '+385 23 555 0607', owner: 'Ivo Barić', worker: 'Dino Šarić' });
  const areas = [];
  for (let s = 1; s <= 8; s++) areas.push({ tenant_id: T.id, area: 'Hala', slot: String(s), kind: 'hall' });
  for (let s = 1; s <= 10; s++) areas.push({ tenant_id: T.id, area: 'Zimovnik', slot: `Z${s}`, kind: 'outdoor' });
  const locations = await q(sb.from('moto_storage_locations').insert(areas).select('id, area, slot'));
  const hall = locations.filter((l) => l.area === 'Hala').sort((a, b) => Number(a.slot) - Number(b.slot));
  const outside = locations.filter((l) => l.area === 'Zimovnik');

  const c1 = await client(T, { first: 'Šime', last: 'Vlahov', phone: '+385 95 700 3300', city: 'Sukošan' });
  const c2 = await client(T, { first: 'Petra', last: 'Jurić', phone: '+385 99 700 4400', city: 'Zadar' });
  const boat = await asset(T, c1, { type: 'boat', id: 'ZD-1234', make: 'Jeanneau', model: 'Cap Camarat 6.5 WA', year: 2018, vin: 'FR-JEA65412G718', unit: 'mth' });
  const engine = await asset(T, c1, { type: 'outboard', id: '6ML-1045872', make: 'Yamaha', model: 'F150 XB', year: 2018, unit: 'mth', parent: boat });
  const jet = await asset(T, c2, { type: 'jetski', id: 'ZD-JS-77', make: 'Sea-Doo', model: 'GTI SE 170', year: 2022, vin: 'YDV12345L122', unit: 'mth' });
  await q(sb.from('moto_vessel_details').insert({ asset_id: boat, tenant_id: T.id, vessel_name: 'Galeb', registration_mark: 'ZD-1234', length_m: 6.4, beam_m: 2.54, hull_material: 'grp', home_port: 'Sukošan', berth: 'Marina Dalmacija, gat C-14' }));
  await q(sb.from('moto_engine_details').insert({ asset_id: engine, tenant_id: T.id, engine_serial: '6ML-1045872', power_hp: 150, stroke: '4T', position: 'single', impeller_replaced_mth: 410, impeller_replaced_date: day(-560) }));

  const j1 = await job(T, {
    client: c1,
    asset: engine,
    phase: 'in_progress',
    d: 2,
    unit: 'mth',
    meter: 612.4,
    complaint: 'Konzervacija (zimovanje)',
    lines: [
      { kind: 'package', d: 'Konzervacija vanbrodskog motora', unit: 'paušal', price: 180 },
      { kind: 'material', d: 'Ulje noge', unit: 'l', price: 22 },
      { kind: 'material', d: 'Ulje za konzervaciju', price: 15 },
      { kind: 'part', d: 'Impeler', approval: 'proposed', priority: 'recommended', price: 45 },
    ],
  });
  const ins = await inspection(T, j1.id, 'marine.winterize_outboard', 'Konzervacija, vanbrodski motor', checklistCodes('winterize_outboard', 12).map((c, i) => [c, i < 7 ? 'ok' : i === 7 ? 'warn' : 'not_checked', null, i === 7 ? 'Anoda noge 60% istrošena' : null]), { d: 2 });
  await q(sb.from('moto_seasonal_protocols').insert({ tenant_id: T.id, job_id: j1.id, kind: 'winterize', inspection_id: ins.id, fuel_stabilized: true, battery_maintained: true, anodes_wear_pct: { noga: 60, trim: 35, trup: 20 } }));
  await q(sb.from('moto_storage_stays').insert({ tenant_id: T.id, asset_id: boat, location_id: outside[0].id, from_date: day(-2), until_date: day(180) }));
  await conditionReport(T, j1.id, {
    diagram: 'boat',
    marks: [
      { zone: 'bow', code: 'O', note: 'prova, lijevi bok uz špic' },
      { zone: 'hull_l', code: 'O', note: 'bok lijevi, uz odbojnik' },
      { zone: 'stern', code: 'U', note: 'krma, desni kut krmene ploče' },
      { zone: 'transom', code: 'U', note: 'krmena ploča, desni kut' },
      { zone: 'anodes', code: 'R', note: 'anoda noge 60 % istrošena' },
      { zone: 'prop', code: 'O', note: 'propeler, jedna lopatica' },
    ],
    equipment: [
      ['Ključ kontakta', true],
      ['Daljinski alarma', false],
      ['Punjač / održavač', true],
      ['Cerada', false],
      ['Prsluk za spašavanje', true],
      ['Sidro', true],
      ['Prekidač za slučaj pada', true],
      ['Veslo', false],
      ['Dokumenti plovila', true],
      ['Gašenje / aparat', true],
    ],
    fuel: '1/2',
    d: 2,
  });
  await photo(T, j1.id, { label: 'Anoda noge, 60 %', sub: 'Yamaha F150 · preporuka zamjene', tag: 'part_old', hue: 185, customer: true, d: 2 });

  await q(sb.from('moto_storage_stays').insert({ tenant_id: T.id, asset_id: jet, location_id: hall[0].id, from_date: day(-20), until_date: day(200), battery_checks: [{ at: at(10), v: 12.6 }] }));
  await job(T, { client: c2, asset: jet, phase: 'collected', paid: true, d: 20, unit: 'mth', meter: 142, complaint: 'Konzervacija (zimovanje)', lines: [{ kind: 'package', d: 'Konzervacija jet-skija', unit: 'paušal', price: 150 }] });
  await job(T, { client: c1, asset: engine, phase: 'collected', paid: true, d: 190, unit: 'mth', meter: 540, complaint: 'Dekonzervacija', lines: [{ kind: 'package', d: 'Dekonzervacija i test rada', unit: 'paušal', price: 120 }, { kind: 'part', d: 'Anode (komplet)', price: 64 }] });
  await messages(T, j1.id, 'Impeler je tvrd i napuknut na jednoj lopatici, mijenjamo?', 'Predloži stranci preko poveznice, cijena je u stavkama.');
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// AIR — klime i dizalice topline, rad na terenu
// ---------------------------------------------------------------------
const AIR_UNITS = { a05: '°C', a06: '°C', b04: 'A', b05: 'bar', h01: 'bar', h02: 'bar', h05: '°C', h07: '%', i01: 'bar', i02: 'mbar', i03: 'm', i04: 'g' };

// A wall-clock time in Zagreb, `dayOffset` days from today.
function zagrebAt(dayOffset, hour, minute = 0) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb' }).format(new Date(Date.now() + dayOffset * 86400000));
  const guess = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Zagreb', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(guess);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const offset = (Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute')) - guess.getTime()) / 60000;
  return new Date(guess.getTime() - offset * 60000).toISOString();
}

async function seedAir() {
  const T = await workshop({ pkg: 'air', name: 'Klima servis Polar', city: 'Zagreb', address: 'Heinzelova 62', phone: '+385 1 555 0707', owner: 'Hrvoje Vidović', worker: 'Nikola Barić' });
  await q(sb.from('profiles').update({ fgas_certificate: 'HR-FP-2021-0418' }).eq('id', T.owner));
  await q(sb.from('profiles').update({ fgas_certificate: 'HR-FP-2023-1127' }).eq('id', T.worker));

  const site = async (clientId, s) => {
    const [row] = await q(sb.from('sites').insert({ tenant_id: T.id, client_id: clientId, ...s }).select('id'));
    return row.id;
  };
  const device = async (clientId, siteId, a, eq) => {
    const id = await asset(T, clientId, { ...a, site: siteId, unit: 'mth' });
    await q(sb.from('air_equipment').insert({ asset_id: id, tenant_id: T.id, ...eq }));
    return id;
  };
  const plan = async (p) => {
    const [row] = await q(sb.from('maintenance_plans').insert({ tenant_id: T.id, interval_months: 12, template_code: 'air.service_one', ...p }).select('id'));
    return row.id;
  };

  // Customers, places and devices
  const kralj = await client(T, { first: 'Ivana', last: 'Kralj', phone: '+385 91 800 1100', city: 'Zagreb' });
  const kraljFlat = await site(kralj, { kind: 'flat', address: 'Ilica 112', city: 'Zagreb', postal_code: '10000', access_notes: '3. kat, zvono Kralj. Ključ kod susjede u stanu 7.', lat: 45.8133, lng: 15.9606 });
  const kraljAc = await device(kralj, kraljFlat, { type: 'ac_split', id: 'Dnevni boravak', make: 'Daikin', model: 'FTXP35M / RXP35M', year: 2022, vin: 'E001234' }, { refrigerant: 'R32', charge_kg: 0.8, cooling_kw: 3.5, heating_kw: 4.0, install_date: '2022-06-14', warranty_until: '2027-06-14', indoor_serial: 'E001234', outdoor_serial: 'O009876' });

  const peric = await client(T, { first: 'Marko', last: 'Perić', phone: '+385 98 800 2200', city: 'Zagreb' });
  const pericHouse = await site(peric, { kind: 'house', address: 'Trnjanska cesta 45', city: 'Zagreb', access_notes: 'Ulaz s dvorišta, pas u dvorištu, nazvati prije dolaska.', lat: 45.7958, lng: 15.9784 });
  const pericAc = await device(peric, pericHouse, { type: 'ac_split', id: 'Spavaća soba', make: 'Mitsubishi Electric', model: 'MSZ-LN35VG', year: 2021 }, { refrigerant: 'R32', charge_kg: 1.0, cooling_kw: 3.5, install_date: '2021-05-20' });
  const pericHp = await device(peric, pericHouse, { type: 'heat_pump', id: 'Grijanje kuće', make: 'Daikin', model: 'Altherma 3 R 8 kW', year: 2020 }, { refrigerant: 'R32', charge_kg: 1.8, heating_kw: 8, install_date: '2020-10-02' });

  const bura = await client(T, { company: 'Apartmani Bura d.o.o.', first: 'Tea', last: 'Jurković', phone: '+385 95 800 3300', city: 'Samobor' });
  const buraA1 = await site(bura, { kind: 'apartment', label: 'Apartman A1', address: 'Samoborska cesta 5', city: 'Samobor', access_notes: 'Ključ u sefu uz ulaz, šifra 4471. Gosti odlaze do 10 h.', contact_name: 'Tea Jurković', contact_phone: '+385 95 800 3300' });
  const buraA2 = await site(bura, { kind: 'apartment', label: 'Apartman A2', address: 'Samoborska cesta 5', city: 'Samobor', access_notes: 'Isti sef, šifra 4471.' });
  const buraAc1 = await device(bura, buraA1, { type: 'ac_split', id: 'A1', make: 'Gree', model: 'Pular GWH12AGB', year: 2023 }, { refrigerant: 'R32', charge_kg: 0.7, cooling_kw: 3.5, install_date: '2023-05-10' });
  const buraAc2 = await device(bura, buraA2, { type: 'ac_split', id: 'A2', make: 'Gree', model: 'Pular GWH12AGB', year: 2023 }, { refrigerant: 'R32', charge_kg: 0.7, cooling_kw: 3.5, install_date: '2023-05-10' });

  const ured = await client(T, { company: 'Ured Centar d.o.o.', first: 'Goran', last: 'Šimunović', phone: '+385 1 600 7788', city: 'Zagreb', oib: '98765432106' });
  const uredSite = await site(ured, { kind: 'office', label: 'Poslovni prostor, 4. kat', address: 'Vukovarska avenija 200', city: 'Zagreb', access_notes: 'Prijava na recepciji, vanjske jedinice na krovu, ključ kod domara.', contact_name: 'Domar Ivo', contact_phone: '+385 91 600 1234' });
  const uredVrv = await device(ured, uredSite, { type: 'ac_vrf', id: 'VRV krov', make: 'Daikin', model: 'VRV IV RXYQ10U', year: 2018 }, { refrigerant: 'R410A', charge_kg: 8.5, indoor_units: 9, cooling_kw: 28, heating_kw: 31.5, install_date: '2018-04-12' });

  const horvat = await client(T, { first: 'Ana', last: 'Horvat', phone: '+385 99 800 4400', city: 'Zagreb' });
  const horvatFlat = await site(horvat, { kind: 'flat', address: 'Savska cesta 30', city: 'Zagreb', access_notes: '5. kat, lift radi.' });
  const horvatNew = await device(horvat, horvatFlat, { type: 'ac_split', id: 'Radna soba', make: 'Daikin', model: 'Perfera FTXM25R' }, { refrigerant: 'R32', charge_kg: 0.75, cooling_kw: 2.5 });

  // Maintenance plans (one overdue, a few due soon)
  const planKralj = await plan({ client_id: kralj, site_id: kraljFlat, asset_id: kraljAc, title: 'Godišnji servis klime', next_due_date: day(0) });
  await plan({ client_id: peric, site_id: pericHouse, asset_id: pericHp, title: 'Godišnji servis dizalice topline', next_due_date: day(-10), template_code: 'air.heat_pump_service' });
  await plan({ client_id: peric, site_id: pericHouse, asset_id: pericAc, title: 'Godišnji servis klime', next_due_date: day(20) });
  await plan({ client_id: bura, site_id: buraA1, asset_id: buraAc1, title: 'Servis klime prije sezone', next_due_date: day(12) });
  const planA2 = await plan({ client_id: bura, site_id: buraA2, asset_id: buraAc2, title: 'Servis klime prije sezone', next_due_date: day(12) });
  await plan({ client_id: ured, site_id: uredSite, asset_id: uredVrv, title: 'Provjera propuštanja VRV sustava', next_due_date: day(8), template_code: 'air.leak_check' });

  const serviceLines = [
    { kind: 'package', d: 'Godišnji servis klima uređaja, 1 unutarnja jedinica', unit: 'paušal', price: 60 },
    { kind: 'material', d: 'Sredstvo za čišćenje i dezinfekciju isparivača', price: 8 },
  ];

  // Today 08:00 — Ivana Kralj: done, report sent (she was at work).
  const j1 = await job(T, {
    client: kralj,
    asset: kraljAc,
    phase: 'ready',
    d: 0,
    complaint: 'Godišnji servis klime',
    summary: 'Očišćeni filteri i isparivač, dezinficirano, odvod kondenzata protočan. Izolacija cijevi na vanjskoj jedinici oštećena od sunca, preporuka zamjene.',
    source: 'field',
    lines: serviceLines,
    extra: {
      work_mode: 'field',
      site_id: kraljFlat,
      plan_id: planKralj,
      scheduled_start: zagrebAt(0, 8),
      scheduled_end: zagrebAt(0, 9),
      departed_at: zagrebAt(0, 7, 40),
      customer_notified_at: zagrebAt(0, 7, 41),
      arrived_at: zagrebAt(0, 8, 3),
      arrived_lat: 45.81327,
      arrived_lng: 15.96071,
      left_at: zagrebAt(0, 8, 58),
      finished_at: zagrebAt(0, 8, 58),
      report_shared_at: zagrebAt(0, 9, 1),
    },
  });
  await q(sb.from('maintenance_plans').update({ next_due_date: day(365), last_job_id: j1.id }).eq('id', planKralj));
  await inspection(
    T,
    j1.id,
    'air.service_split',
    'Godišnji servis klima uređaja',
    [
      ['a01', 'ok'], ['a02', 'ok'], ['a03', 'ok'], ['a04', 'ok'], ['a05', 'ok', 11.5], ['a06', 'ok', 9.5],
      ['b01', 'ok'], ['b02', 'ok'], ['b03', 'ok'], ['b04', 'ok', 3.8], ['b05', 'ok', 9.2],
      ['c01', 'ok'], ['c02', 'warn', null, 'Izolacija na vanjskoj jedinici ispucala od sunca'], ['c03', 'ok'], ['c04', 'ok'], ['c05', 'ok'],
      ['d01', 'ok'], ['d02', 'ok'],
    ],
    { completed: true, d: 0, units: AIR_UNITS }
  );
  await conditionReport(T, j1.id, {
    marks: [
      { zone: 'indoor_filter', code: 'R', note: 'filter zaprljan, očišćen' },
      { zone: 'indoor_coil', code: 'O', note: 'isparivač, prašina prije pranja' },
      { zone: 'insulation', code: 'P', note: 'izolacija cijevi na vanjskoj, ispucala od sunca' },
      { zone: 'outdoor_fins', code: 'O', note: 'rebra vanjske jedinice, prašina' },
    ],
    equipment: [['Daljinski klime', true], ['Filteri', true], ['Dokumentacija uređaja', false], ['Poklopci jedinice', true]],
    d: 0,
  });
  await photo(T, j1.id, { label: 'Isparivač, prije', sub: 'Ilica 112 · Daikin FTXP35M', tag: 'before', hue: 30, customer: true, d: 0, when: zagrebAt(0, 8, 6) });
  await photo(T, j1.id, { label: 'Isparivač, poslije', sub: 'Očišćeno i dezinficirano', tag: 'after', hue: 175, customer: true, d: 0, when: zagrebAt(0, 8, 50) });
  await photo(T, j1.id, { label: 'Natpisna pločica', sub: 'R32 · 0,80 kg', tag: 'nameplate', hue: 210, d: 0, when: zagrebAt(0, 8, 8) });

  // Today 10:00 — Marko Perić: heat pump, technician on site now.
  const j2 = await job(T, {
    client: peric,
    asset: pericHp,
    phase: 'in_progress',
    d: 0,
    complaint: 'Godišnji servis dizalice topline, Ne grije dovoljno u kupaonici',
    source: 'field',
    lines: [{ kind: 'package', d: 'Godišnji servis dizalice topline', unit: 'paušal', price: 120 }],
    extra: {
      work_mode: 'field',
      site_id: pericHouse,
      scheduled_start: zagrebAt(0, 10),
      scheduled_end: zagrebAt(0, 12),
      departed_at: zagrebAt(0, 9, 35),
      customer_notified_at: zagrebAt(0, 9, 36),
      arrived_at: zagrebAt(0, 10, 2),
      arrived_lat: 45.79581,
      arrived_lng: 15.97843,
    },
  });
  await inspection(T, j2.id, 'air.heat_pump', 'Servis dizalice topline', [['h01', 'warn', 0.9, 'Dopunjeno na 1,5 bar'], ['h02', 'ok', 1.0], ['h03', 'ok'], ['h07', 'warn', 35]], { d: 0, units: AIR_UNITS });
  await conditionReport(T, j2.id, {
    marks: [
      { zone: 'outdoor_case', code: 'R', note: 'kućište vanjske, korozija na nosaču' },
      { zone: 'outdoor_bracket', code: 'R', note: 'konzole, površinska hrđa' },
      { zone: 'indoor_drain', code: 'O', note: 'odvod kondenzata, talog' },
    ],
    equipment: [['Daljinski klime', true], ['Filteri', true], ['Dokumentacija uređaja', true], ['Poklopci jedinice', true]],
    d: 0,
  });
  await messages(T, j2.id, 'Anoda spremnika na 35 %, imamo li zamjensku u kombiju?', 'U kombiju je jedna, uzmi je i dodaj stavku.');

  // Today 13:00 — apartment A1: water leaking, owner not there.
  await job(T, {
    client: bura,
    asset: buraAc1,
    phase: 'diagnosis',
    d: 1,
    urgent: true,
    complaint: 'Curi voda, gosti dolaze u 15 h',
    source: 'phone',
    extra: { work_mode: 'field', site_id: buraA1, scheduled_start: zagrebAt(0, 13), scheduled_end: zagrebAt(0, 14) },
  });

  // Today 15:30 — office VRV leak check (owner goes himself).
  await job(T, {
    client: ured,
    asset: uredVrv,
    phase: 'diagnosis',
    d: 5,
    assigned: 'owner',
    complaint: 'Periodična provjera propuštanja (F-plin)',
    source: 'phone',
    lines: [{ d: 'Periodična provjera propuštanja s upisom u evidenciju', unit: 'paušal', price: 40 }],
    extra: { work_mode: 'field', site_id: uredSite, scheduled_start: zagrebAt(0, 15, 30), scheduled_end: zagrebAt(0, 16, 30) },
  });

  // Tomorrow 09:00 — new installation.
  await job(T, {
    client: horvat,
    asset: horvatNew,
    phase: 'diagnosis',
    d: 3,
    complaint: 'Montaža novog uređaja 2,5 kW u radnu sobu',
    source: 'phone',
    lines: [{ kind: 'package', d: 'Montaža split klime do 3,5 kW (do 3 m instalacije)', unit: 'paušal', price: 280 }],
    extra: { work_mode: 'field', site_id: horvatFlat, scheduled_start: zagrebAt(1, 9), scheduled_end: zagrebAt(1, 13) },
  });

  // Waiting for a date — from the maintenance plan.
  await job(T, {
    client: bura,
    asset: buraAc2,
    phase: 'intake',
    d: 1,
    assigned: false,
    complaint: 'Servis klime prije sezone',
    source: 'phone',
    extra: { work_mode: 'field', site_id: buraA2, plan_id: planA2 },
  });

  // History: last month's service and last year's leak repair on the VRV.
  await job(T, { client: peric, asset: pericAc, phase: 'collected', paid: true, d: 25, complaint: 'Godišnji servis klime', source: 'field', lines: serviceLines, extra: { work_mode: 'field', site_id: pericHouse, arrived_at: at(25, 9), left_at: at(25, 10) } });
  const leakJob = await job(T, {
    client: ured,
    asset: uredVrv,
    phase: 'collected',
    paid: true,
    d: 350,
    complaint: 'Slabo hladi, sumnja na propuštanje',
    summary: 'Pronađeno propuštanje na holender spoju unutarnje jedinice 4. Spoj prerađen, tlačna proba, vakuum, dopuna 1,2 kg R410A.',
    source: 'field',
    lines: [
      { d: 'Traženje i popravak propuštanja', qty: 3, price: 55 },
      { kind: 'material', d: 'Radna tvar R410A', qty: 1200, unit: 'g', price: 0.09 },
    ],
    extra: { work_mode: 'field', site_id: uredSite, arrived_at: at(350, 9), left_at: at(350, 13) },
  });
  await q(
    sb.from('air_fgas_log').insert([
      { tenant_id: T.id, job_id: leakJob.id, asset_id: uredVrv, refrigerant: 'R410A', action: 'leak_check', quantity_kg: 0, leak_found: true, leak_location: 'Holender spoj, unutarnja jedinica 4', cause: null, technician_id: T.owner, technician_cert: 'HR-FP-2021-0418', performed_at: at(350, 9, 30) },
      { tenant_id: T.id, job_id: leakJob.id, asset_id: uredVrv, refrigerant: 'R410A', action: 'repair', quantity_kg: 0, leak_found: false, leak_location: null, cause: 'Spoj prerađen, tlačna proba dušikom 40 bar bez pada', technician_id: T.owner, technician_cert: 'HR-FP-2021-0418', performed_at: at(350, 11) },
      { tenant_id: T.id, job_id: leakJob.id, asset_id: uredVrv, refrigerant: 'R410A', action: 'top_up', quantity_kg: 1.2, leak_found: false, leak_location: null, cause: null, technician_id: T.owner, technician_cert: 'HR-FP-2021-0418', performed_at: at(350, 12, 30) },
      // Control check within a month of the repair, as the rules require.
      { tenant_id: T.id, job_id: leakJob.id, asset_id: uredVrv, refrigerant: 'R410A', action: 'leak_check', quantity_kg: 0, leak_found: false, leak_location: null, cause: 'Kontrola nakon popravka, bez propuštanja', technician_id: T.owner, technician_cert: 'HR-FP-2021-0418', performed_at: at(324, 10) },
    ])
  );
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// Poslar Vodoinstalater: a plumber in Split
// ---------------------------------------------------------------------
async function seedAqua() {
  const T = await workshop({ pkg: 'aqua', name: 'Vodoinstalacije Jadran', city: 'Split', address: 'Domovinskog rata 44', phone: '+385 21 555 0808', owner: 'Ante Bilić', worker: 'Duje Matić' });
  const site = async (clientId, s) => {
    const [row] = await q(sb.from('sites').insert({ tenant_id: T.id, client_id: clientId, ...s }).select('id'));
    return row.id;
  };
  const device = async (clientId, siteId, a, eq) => {
    const id = await asset(T, clientId, { ...a, site: siteId, unit: 'mth' });
    if (eq) await q(sb.from('aqua_equipment').insert({ asset_id: id, tenant_id: T.id, ...eq }));
    return id;
  };
  const plan = async (p) => {
    const [row] = await q(sb.from('maintenance_plans').insert({ tenant_id: T.id, interval_months: 12, template_code: 'aqua.heater_service', ...p }).select('id'));
    return row.id;
  };

  const tomic = await client(T, { first: 'Mira', last: 'Tomić', phone: '+385 91 700 1100', city: 'Split' });
  const tomicFlat = await site(tomic, { kind: 'flat', address: 'Poljička cesta 12', city: 'Split', postal_code: '21000', access_notes: '4. kat, bojler u kupaonici iznad perilice.', lat: 43.5056, lng: 16.4612 });
  const tomicHeater = await device(tomic, tomicFlat, { type: 'water_heater', id: 'Kupaonica', make: 'Gorenje', model: 'TGR 80 N', year: 2019, vin: 'GOR80-554120' }, { energy: 'electric', capacity_l: 80, power_kw: 2, working_pressure_bar: 6, install_date: '2019-04-10', anode_changed_on: day(-3 * 365), descaled_on: day(-3 * 365) });

  const kovac = await client(T, { first: 'Zoran', last: 'Kovač', phone: '+385 98 700 2200', city: 'Split' });
  const kovacHouse = await site(kovac, { kind: 'house', address: 'Put Supavla 5', city: 'Split', access_notes: 'Kotlovnica u garaži, ključ u poštanskom sandučiću.', lat: 43.5185, lng: 16.4198 });
  const kovacBoiler = await device(kovac, kovacHouse, { type: 'gas_boiler', id: 'Kotlovnica', make: 'Vaillant', model: 'ecoTEC plus VU 246/5-5', year: 2018 }, { energy: 'gas', power_kw: 24, working_pressure_bar: 3, install_date: '2018-10-20' });
  const kovacHeater = await device(kovac, kovacHouse, { type: 'water_heater', id: 'Kat', make: 'Ariston', model: 'Pro1 Eco 100', year: 2016 }, { energy: 'electric', capacity_l: 100, power_kw: 1.8, anode_changed_on: day(-900) });

  const konoba = await client(T, { company: 'Konoba Lučica d.o.o.', first: 'Nikola', last: 'Radić', phone: '+385 95 700 3300', city: 'Split', oib: '12345678903' });
  const konobaSite = await site(konoba, { kind: 'commercial', label: 'Konoba', address: 'Obala Lazareta 3', city: 'Split', access_notes: 'Ulaz za dostavu sa stražnje strane. Kuhinja radi od 11 h.', contact_name: 'Šef kuhinje Mate', contact_phone: '+385 95 700 3301' });
  const konobaDrain = await device(konoba, konobaSite, { type: 'drainage', id: 'Odvod kuhinje', make: null, model: 'Odvod sudopera i separator masti' });

  const babic = await client(T, { first: 'Josip', last: 'Babić', phone: '+385 99 700 4400', city: 'Kaštel Stari' });
  const babicHouse = await site(babic, { kind: 'house', address: 'Ulica kralja Tomislava 18', city: 'Kaštel Stari', access_notes: 'Novogradnja, ključ kod majstora za pločice.' });
  const babicBath = await device(babic, babicHouse, { type: 'plumbing', id: 'Kupaonica gore', make: null, model: 'Nova instalacija, PPR i PEX' });

  const novak = await client(T, { first: 'Lucija', last: 'Novak', phone: '+385 91 700 5500', city: 'Split' });
  const novakFlat = await site(novak, { kind: 'flat', address: 'Vukovarska 21', city: 'Split', access_notes: '2. kat. Susjed ispod javlja mrlju na stropu.' });
  const novakPipes = await device(novak, novakFlat, { type: 'plumbing', id: 'Kuhinja i kupaonica', make: null, model: 'Stara instalacija, pocinčane cijevi' });

  const planTomic = await plan({ client_id: tomic, site_id: tomicFlat, asset_id: tomicHeater, title: 'Servis bojlera', next_due_date: day(0) });
  await plan({ client_id: kovac, site_id: kovacHouse, asset_id: kovacBoiler, title: 'Godišnji servis plinskog kotla', next_due_date: day(5), template_code: 'aqua.boiler_service' });
  await plan({ client_id: kovac, site_id: kovacHouse, asset_id: kovacHeater, title: 'Servis bojlera', next_due_date: day(-12) });

  // Today 08:00 — Mira Tomić: heater serviced, report sent.
  const j1 = await job(T, {
    client: tomic,
    asset: tomicHeater,
    phase: 'ready',
    d: 0,
    complaint: 'Servis bojlera',
    summary: 'Zamijenjena anoda (potrošena 90 %), očišćen kamenac, nova brtva prirubnice. Sigurnosni ventil ispušta, nema curenja.',
    source: 'field',
    lines: [
      { kind: 'package', d: 'Servis bojlera: anoda, kamenac, brtva', unit: 'paušal', price: 70 },
      { kind: 'part', d: 'Magnezijeva anoda', price: 20 },
      { kind: 'part', d: 'Brtva prirubnice', price: 8 },
    ],
    extra: {
      work_mode: 'field',
      site_id: tomicFlat,
      plan_id: planTomic,
      scheduled_start: zagrebAt(0, 8),
      scheduled_end: zagrebAt(0, 9, 30),
      departed_at: zagrebAt(0, 7, 45),
      customer_notified_at: zagrebAt(0, 7, 46),
      arrived_at: zagrebAt(0, 8, 4),
      arrived_lat: 43.50561,
      arrived_lng: 16.46118,
      left_at: zagrebAt(0, 9, 22),
      finished_at: zagrebAt(0, 9, 22),
      report_shared_at: zagrebAt(0, 9, 25),
    },
  });
  await q(sb.from('maintenance_plans').update({ next_due_date: day(365), last_job_id: j1.id }).eq('id', planTomic));
  await q(sb.from('aqua_equipment').update({ anode_changed_on: day(0), descaled_on: day(0) }).eq('asset_id', tomicHeater));
  await inspection(T, j1.id, 'aqua.heater_service', 'Servis bojlera', [['a01', 'crit', 90, 'Anoda gotovo potrošena, zamijenjena'], ['a02', 'ok'], ['a03', 'ok'], ['a04', 'ok'], ['b01', 'ok'], ['b02', 'ok'], ['b03', 'ok', 62], ['b04', 'ok'], ['b05', 'ok']], {
    completed: true,
    d: 0,
    units: { a01: '%', b03: '°C' },
  });
  await conditionReport(T, j1.id, {
    marks: [
      { zone: 'heater', code: 'R', note: 'bojler, anoda potrošena 90 %' },
      { zone: 'pipe_visible', code: 'R', note: 'priključak hladne, površinska korozija' },
    ],
    equipment: [['Glavni ključ / pristup', true], ['Dokumentacija uređaja', false], ['Filteri', false], ['Ventili skinuti', false]],
    d: 0,
  });
  await photo(T, j1.id, { label: 'Stara anoda', sub: 'Gorenje TGR 80 · potrošena 90 %', tag: 'before', hue: 25, customer: true, d: 0, when: zagrebAt(0, 8, 20) });
  await photo(T, j1.id, { label: 'Kamenac iz bojlera', sub: 'Poljička cesta 12', tag: 'before', hue: 45, customer: true, d: 0, when: zagrebAt(0, 8, 35) });
  await photo(T, j1.id, { label: 'Natpisna pločica', sub: '80 l · 2 kW · 6 bar', tag: 'nameplate', hue: 215, d: 0, when: zagrebAt(0, 8, 10) });

  // Today 10:30 — new bathroom: pressure test on site now.
  const j2 = await job(T, {
    client: babic,
    asset: babicBath,
    phase: 'in_progress',
    d: 6,
    complaint: 'Nova instalacija kupaonice, tlačna proba prije pločica',
    source: 'field',
    lines: [
      { d: 'Razvod vode kupaonice (PPR, PEX)', qty: 9, price: 35 },
      { kind: 'material', d: 'Cijevi, fitinzi i ventili', unit: 'paušal', price: 240 },
      { d: 'Tlačna proba instalacije sa zapisnikom', qty: 1, price: 35 },
    ],
    extra: {
      work_mode: 'field',
      site_id: babicHouse,
      scheduled_start: zagrebAt(0, 10, 30),
      scheduled_end: zagrebAt(0, 12),
      departed_at: zagrebAt(0, 10, 5),
      customer_notified_at: zagrebAt(0, 10, 6),
      arrived_at: zagrebAt(0, 10, 28),
      arrived_lat: 43.5486,
      arrived_lng: 16.3497,
    },
  });
  await q(
    sb.from('aqua_pressure_tests').insert([
      { tenant_id: T.id, job_id: j2.id, asset_id: babicBath, section: 'Hladna voda', medium: 'water', test_pressure_bar: 10, end_pressure_bar: 9.9, duration_min: 30, passed: true, technician_id: T.worker, performed_at: zagrebAt(0, 10, 45) },
      { tenant_id: T.id, job_id: j2.id, asset_id: babicBath, section: 'Topla voda i cirkulacija', medium: 'water', test_pressure_bar: 10, end_pressure_bar: 10, duration_min: 30, passed: true, technician_id: T.worker, performed_at: zagrebAt(0, 11, 20) },
    ])
  );
  await conditionReport(T, j2.id, {
    marks: [
      { zone: 'pipe_visible', code: 'O', note: 'PPR razvod, bez pločica' },
      { zone: 'tap_l', code: 'N', note: 'slavine još nisu montirane' },
      { zone: 'shower', code: 'N', note: 'tuš kabina nije postavljena' },
    ],
    equipment: [['Glavni ključ / pristup', true], ['Dokumentacija uređaja', false], ['Filteri', false], ['Ventili skinuti', true]],
    d: 6,
  });
  await photo(T, j2.id, { label: 'Manometar 10 bar', sub: 'Početak probe · hladna voda', tag: 'gauge', hue: 205, customer: true, d: 0, when: zagrebAt(0, 10, 45) });
  await photo(T, j2.id, { label: 'Manometar 9,9 bar', sub: 'Nakon 30 min', tag: 'gauge', hue: 195, customer: true, d: 0, when: zagrebAt(0, 11, 16) });
  await messages(T, j2.id, 'Majstor za pločice pita smije li sutra krenuti?', 'Kad i topla prođe, javi mu da može. Pošalji mi slike manometra.');

  // Today 14:00 — restaurant drain, urgent.
  const jDrain = await job(T, {
    client: konoba,
    asset: konobaDrain,
    phase: 'diagnosis',
    d: 0,
    urgent: true,
    complaint: 'Začepljen odvod u kuhinji, voda se vraća',
    source: 'phone',
    lines: [{ kind: 'package', d: 'Odčepljenje odvoda spiralom', unit: 'paušal', price: 60 }],
    extra: { work_mode: 'field', site_id: konobaSite, scheduled_start: zagrebAt(0, 14), scheduled_end: zagrebAt(0, 15) },
  });
  await conditionReport(T, jDrain.id, {
    marks: [
      { zone: 'siphon', code: 'R', note: 'sifon sudopera, pun masti' },
      { zone: 'floor_drain', code: 'R', note: 'podni odvod kuhinje, voda se vraća' },
    ],
    equipment: [['Glavni ključ / pristup', true], ['Dokumentacija uređaja', false], ['Filteri', false], ['Ventili skinuti', false]],
    d: 0,
  });

  // Tomorrow 09:00 — boiler service.
  await job(T, {
    client: kovac,
    asset: kovacBoiler,
    phase: 'diagnosis',
    d: 2,
    complaint: 'Godišnji servis plinskog kotla',
    source: 'phone',
    lines: [{ kind: 'package', d: 'Godišnji servis plinskog kotla s analizom dimnih plinova', unit: 'paušal', price: 90 }],
    extra: { work_mode: 'field', site_id: kovacHouse, scheduled_start: zagrebAt(1, 9), scheduled_end: zagrebAt(1, 10, 30) },
  });

  // Waiting for a date: a leak the neighbour below noticed.
  await job(T, {
    client: novak,
    asset: novakPipes,
    phase: 'intake',
    d: 0,
    assigned: false,
    complaint: 'Curi voda, mrlja na stropu kod susjeda',
    source: 'phone',
    extra: { work_mode: 'field', site_id: novakFlat },
  });

  // History
  await job(T, {
    client: kovac,
    asset: kovacHeater,
    phase: 'collected',
    paid: true,
    d: 40,
    complaint: 'Bojler ne grije',
    summary: 'Pregorio grijač, zamijenjen. Termostat ispravan.',
    source: 'field',
    lines: [
      { d: 'Zamjena grijača bojlera', qty: 1, price: 35 },
      { kind: 'part', d: 'Grijač 1,8 kW', price: 32 },
      { kind: 'fee', d: 'Izlazak na intervenciju', unit: 'paušal', price: 30 },
    ],
    extra: { work_mode: 'field', site_id: kovacHouse, arrived_at: at(40, 9), left_at: at(40, 10, 10) },
  });
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// Poslar Vučna služba: a towing service by the A1 near Karlovac
// ---------------------------------------------------------------------
async function seedTow() {
  const T = await workshop({ pkg: 'tow', name: 'Autovuča Sokol', city: 'Karlovac', address: 'Zagrebačka cesta 120', phone: '+385 47 555 0909', owner: 'Dario Sokol', worker: 'Ivan Grgić' });
  const call = (jobId, c) => q(sb.from('tow_calls').insert({ tenant_id: T.id, job_id: jobId, truck: 'KA-101-VS', ...c }));

  const novak = await client(T, { first: 'Petra', last: 'Novak', phone: '+385 91 900 1100', city: 'Zagreb' });
  const novakCar = await asset(T, novak, { id: 'ZG-5521-PN', make: 'Škoda', model: 'Octavia 2.0 TDI', year: 2018 });
  const juric = await client(T, { first: 'Tomislav', last: 'Jurić', phone: '+385 98 900 2200', city: 'Karlovac' });
  const juricCar = await asset(T, juric, { id: 'KA-334-TJ', make: 'Volkswagen', model: 'Passat B8 Variant', year: 2016 });
  const kos = await client(T, { first: 'Marina', last: 'Kos', phone: '+385 95 900 3300', city: 'Duga Resa' });
  const kosCar = await asset(T, kos, { id: 'KA-778-MK', make: 'Renault', model: 'Clio IV', year: 2014 });
  const brzi = await client(T, { company: 'Prijevoz Brzi d.o.o.', first: 'Stjepan', last: 'Herceg', phone: '+385 47 900 4400', city: 'Ogulin', oib: '45678912307' });
  const brziVan = await asset(T, brzi, { type: 'van', id: 'OG-210-BR', make: 'Iveco', model: 'Daily 35S16', year: 2020 });
  const lovric = await client(T, { first: 'Karlo', last: 'Lovrić', phone: '+385 99 900 5500', city: 'Karlovac' });
  const lovricCar = await asset(T, lovric, { id: 'KA-905-KL', make: 'Peugeot', model: '308', year: 2017 });
  const vidic = await client(T, { first: 'Sanja', last: 'Vidić', phone: '+385 91 900 6600', city: 'Rijeka' });
  const vidicCar = await asset(T, vidic, { id: 'RI-4410-SV', make: 'Toyota', model: 'Yaris Hybrid', year: 2021 });

  // 06:40 — flat battery on the motorway, started on the spot.
  const j1 = await job(T, {
    client: novak,
    asset: novakCar,
    phase: 'ready',
    paid: true,
    d: 0,
    assigned: 'owner',
    complaint: 'Prazan akumulator',
    summary: 'Vozilo pokrenuto, akumulator star 6 godina. Preporučena zamjena.',
    source: 'phone',
    lines: [
      { kind: 'package', d: 'Pokretanje vozila s praznim akumulatorom', unit: 'paušal', price: 35 },
      { kind: 'fee', d: 'Dodatak za noć, vikend ili blagdan', unit: 'paušal', price: 30 },
    ],
  });
  await call(j1.id, { service: 'jump_start', payer: 'private', pickup_address: 'A1, odmorište Draganić, smjer Split', pickup_lat: 45.5764, pickup_lng: 15.6362, called_at: zagrebAt(0, 6, 40), departed_at: zagrebAt(0, 6, 44), arrived_at: zagrebAt(0, 7, 5), loaded_at: null, delivered_at: zagrebAt(0, 7, 18), truck: 'KA-202-VS' });

  // Yesterday — accident, insurer pays, car waits on our yard.
  const j2 = await job(T, {
    client: juric,
    asset: juricCar,
    phase: 'awaiting_parts',
    d: 4,
    complaint: 'Prometna nezgoda',
    diagnosis: 'Oštećen prednji dio i hladnjak, vozilo nije u voznom stanju.',
    source: 'phone',
    lines: [
      { kind: 'fee', d: 'Izlazak vučnog vozila', unit: 'paušal', price: 40 },
      { kind: 'package', d: 'Vuča vozila', qty: 18, unit: 'km', price: 1.3 },
    ],
  });
  await call(j2.id, { service: 'tow', payer: 'insurance', payer_name: 'Osiguranje Demo d.d.', claim_no: 'ST-2026-118843', pickup_address: 'D1, Mostanje, kod benzinske', pickup_lat: 45.4655, pickup_lng: 15.5612, dropoff_address: 'Naš plac, Zagrebačka cesta 120', distance_km: 18, called_at: at(4, 17, 20), departed_at: at(4, 17, 24), arrived_at: at(4, 17, 41), loaded_at: at(4, 18, 5), delivered_at: at(4, 18, 30) });
  await q(sb.from('tow_storage').insert({ tenant_id: T.id, job_id: j2.id, asset_id: juricCar, spot: 'B3', in_at: at(4, 18, 30), note: 'Čeka procjenitelja osiguranja.' }));
  await conditionReport(T, j2.id, {
    marks: [
      { zone: 'front_bumper', code: 'U', note: 'prednji branik, sredina' },
      { zone: 'hood', code: 'U', note: 'hauba, prednji rub' },
      { zone: 'headlight_l', code: 'L', note: 'far lijevi, rasprsnut' },
      { zone: 'tie_front', code: 'T', note: 'točka vezanja naprijed, trag remena' },
      { zone: 'underbody', code: 'T', note: 'podvozje, trag vitla' },
    ],
    equipment: [['Ključevi', true], ['Prometna dozvola', true], ['Rezervni kotač', true], ['Stvari u vozilu', false], ['Dječja sjedalica', false], ['Registracijske ploče', true]],
    fuel: '1/2',
    d: 4,
  });
  await photo(T, j2.id, { label: 'Na mjestu nezgode', sub: 'KA-334-TJ · D1 Mostanje', tag: 'pickup', hue: 10, d: 4, when: at(4, 17, 45) });
  await photo(T, j2.id, { label: 'Utovareno', sub: 'Vezano u četiri točke', tag: 'loaded', hue: 40, d: 4, when: at(4, 18, 6) });

  // Right now — tow from Duga Resa to a workshop in Karlovac.
  const j3 = await job(T, {
    client: kos,
    asset: kosCar,
    phase: 'in_progress',
    d: 0,
    complaint: 'Ne pali',
    source: 'phone',
    lines: [{ kind: 'package', d: 'Vuča vozila u gradu (do 15 km)', unit: 'paušal', price: 60 }],
  });
  await call(j3.id, { service: 'tow', payer: 'assistance', payer_name: 'Asistencija Demo', claim_no: 'AP-55120', pickup_address: 'Duga Resa, Ulica Josipa Jurja Strossmayera 8', pickup_lat: 45.4471, pickup_lng: 15.4979, dropoff_address: 'Autoservis Mrežnica, Karlovac', distance_km: 12, called_at: zagrebAt(0, 9, 10), departed_at: zagrebAt(0, 9, 14), arrived_at: zagrebAt(0, 9, 36), loaded_at: zagrebAt(0, 9, 52), truck: 'KA-101-VS' });
  await photo(T, j3.id, { label: 'Pri preuzimanju', sub: 'KA-778-MK · ogrebotina na stražnjem braniku', tag: 'damage', hue: 5, d: 0, when: zagrebAt(0, 9, 40) });
  await conditionReport(T, j3.id, {
    marks: [
      { zone: 'rear_bumper', code: 'O', note: 'stražnji branik, desni kut' },
      { zone: 'wheel_rl', code: 'N', note: 'kotač stražnji lijevi, kapica nestala' },
      { zone: 'contents', code: 'N', note: 'prtljažnik prazan, bez osobnih stvari' },
    ],
    equipment: [['Ključevi', true], ['Prometna dozvola', true], ['Rezervni kotač', false], ['Stvari u vozilu', false], ['Dječja sjedalica', false], ['Registracijske ploče', true]],
    fuel: '1/4',
    d: 0,
  });

  // On the way — van in a ditch.
  const j4 = await job(T, {
    client: brzi,
    asset: brziVan,
    phase: 'diagnosis',
    d: 0,
    urgent: true,
    complaint: 'Izvlačenje iz jarka',
    source: 'phone',
    lines: [{ d: 'Izvlačenje vozila vitlom', qty: 1, price: 70 }],
  });
  await call(j4.id, { service: 'winch', payer: 'company', pickup_address: 'Cesta Ogulin - Josipdol, 3 km od Ogulina', dropoff_address: null, called_at: zagrebAt(0, 10, 2), departed_at: zagrebAt(0, 10, 6), truck: 'KA-202-VS' });

  // Just called — keys locked in.
  const j5 = await job(T, { client: lovric, asset: lovricCar, phase: 'intake', d: 0, assigned: false, complaint: 'Ključevi zaključani u vozilu', source: 'phone' });
  await call(j5.id, { service: 'unlock', payer: 'private', pickup_address: 'Karlovac, parking Tržnog centra Mirjana', called_at: zagrebAt(0, 10, 25) });

  // Last week — tourist towed home's way to a workshop, picked up from yard.
  const j6 = await job(T, {
    client: vidic,
    asset: vidicCar,
    phase: 'collected',
    paid: true,
    d: 8,
    complaint: 'Pukla guma, nema rezervne',
    source: 'phone',
    lines: [
      { kind: 'package', d: 'Vuča vozila s autoceste', unit: 'paušal', price: 120 },
      { kind: 'fee', d: 'Ležarina na placu', qty: 2, unit: 'dan', price: 10 },
    ],
  });
  await call(j6.id, { service: 'tow', payer: 'assistance', payer_name: 'Asistencija Demo', claim_no: 'AP-54988', pickup_address: 'A1, 51. km smjer Zagreb', dropoff_address: 'Naš plac', distance_km: 22, called_at: at(8, 14, 5), departed_at: at(8, 14, 9), arrived_at: at(8, 14, 33), loaded_at: at(8, 14, 50), delivered_at: at(8, 15, 20) });
  await q(sb.from('tow_storage').insert({ tenant_id: T.id, job_id: j6.id, asset_id: vidicCar, spot: 'A1', in_at: at(8, 15, 20), out_at: at(6, 11), released_to: 'Sanja Vidić, osobna 112233445' }));
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// Poslar Auto plac: a used-car lot in Osijek
// ---------------------------------------------------------------------
async function seedDeal() {
  const T = await workshop({ pkg: 'deal', name: 'Auto plac Drava', city: 'Osijek', address: 'Vukovarska cesta 210', phone: '+385 31 555 1010', owner: 'Krešimir Pavlović', worker: 'Matej Šimić' });
  const price = (jobId, field, amount) => q(sb.from('private_amounts').insert({ tenant_id: T.id, entity: 'deal_stock', entity_id: jobId, field, amount }));
  const stock = (jobId, assetId, s) => q(sb.from('deal_stock').insert({ tenant_id: T.id, job_id: jobId, asset_id: assetId, ...s }));
  const prep = [
    { d: 'Zamjena ulja i filtera', qty: 0.6, price: 40 },
    { kind: 'part', d: 'Filter ulja', price: 12 },
    { kind: 'material', d: 'Motorno ulje', qty: 5, unit: 'l', price: 11 },
    { kind: 'sublet', d: 'Dubinsko čišćenje i poliranje', unit: 'paušal', price: 150 },
  ];

  // 1 — Golf, 75 days on the lot: time to drop the price.
  const s1 = await client(T, { first: 'Dragan', last: 'Marić', phone: '+385 91 300 1100', city: 'Osijek' });
  const a1 = await asset(T, s1, { id: 'OS-412-DM', make: 'Volkswagen', model: 'Golf 7 1.6 TDI', year: 2017, vin: 'WVWZZZAUZHW123456', fuel: 'diesel' });
  const j1 = await job(T, { client: s1, asset: a1, phase: 'ready', d: 75, meter: 168400, complaint: 'Otkup od privatne osobe', summary: 'Servis i poliranje odrađeni, slike u oglasu.', source: 'workshop', lines: prep });
  await stock(j1.id, a1, { source: 'private', purchased_on: day(-75), asking_price: 11900, listed_on: day(-68), ad_url: 'https://example.com/oglas/golf-7', keys_count: 2, service_book: true, registered_until: day(120) });
  await price(j1.id, 'purchase', 9200);
  await price(j1.id, 'lowest', 11200);
  await q(
    sb.from('deal_test_drives').insert([
      { tenant_id: T.id, job_id: j1.id, asset_id: a1, driver_name: 'Ivan Lukić', driver_phone: '+385 98 300 7700', licence_no: '10293847', out_at: at(20, 11), back_at: at(20, 11, 35), staff_id: T.worker },
      { tenant_id: T.id, job_id: j1.id, asset_id: a1, driver_name: 'Petar Knežević', driver_phone: '+385 95 300 8800', licence_no: '20394857', out_at: at(3, 16), back_at: at(3, 16, 25), staff_id: T.owner },
    ])
  );
  await photo(T, j1.id, { label: 'Golf 7, prednja strana', sub: 'Za oglas', tag: 'ad', hue: 220, d: 68 });
  await photo(T, j1.id, { label: 'Kilometraža 168.400', sub: 'Pri otkupu', tag: 'meter', hue: 200, d: 75 });
  await conditionReport(T, j1.id, {
    marks: [
      { zone: 'front_bumper', code: 'K', note: 'desni kut, odlupan lak' },
      { zone: 'door_rl', code: 'O', note: 'stražnja vrata lijeva, parking' },
      { zone: 'wheel_fl', code: 'O', note: 'naplatak prednji lijevi' },
      { zone: 'seat_driver', code: 'I', note: 'sjedalo vozača, habanje ruba' },
      { zone: 'underbody', code: 'R', note: 'podvozje, točkasta korozija' },
    ],
    equipment: [['Ključevi (oba)', true], ['Daljinski', true], ['Prometna dozvola', true], ['Servisna knjižica', true], ['Rezervni kotač', true], ['Druge gume', false], ['Radio kod', true]],
    fuel: '1/2',
    d: 75,
  });

  // 2 — BMW being prepared.
  const s2 = await client(T, { first: 'Hrvoje', last: 'Bošnjak', phone: '+385 99 300 2200', city: 'Đakovo' });
  const a2 = await asset(T, s2, { id: 'DJ-118-HB', make: 'BMW', model: '320d Touring F31', year: 2016, fuel: 'diesel' });
  const j2 = await job(T, {
    client: s2,
    asset: a2,
    phase: 'in_progress',
    d: 12,
    meter: 192300,
    complaint: 'Staro za novo, Servis prije prodaje',
    source: 'workshop',
    lines: [
      { d: 'Zamjena pločica i diskova naprijed', qty: 1.2, price: 40 },
      { kind: 'part', d: 'Pločice i diskovi naprijed', price: 140 },
      ...prep,
    ],
  });
  await stock(j2.id, a2, { source: 'trade_in', purchased_on: day(-12), keys_count: 1, service_book: true, registered_until: day(40), notes: 'Samo jedan ključ, naručiti drugi.' });
  await price(j2.id, 'purchase', 12500);
  await messages(T, j2.id, 'Diskovi straga isto na granici, mijenjam i njih?', 'Ne, samo naprijed. Straga upiši u napomenu za kupca.');

  // 3 — Octavia, bought three days ago, check in progress.
  const s3 = await client(T, { company: 'Leasing Slavonija d.o.o.', first: 'Ana', last: 'Kolar', phone: '+385 31 300 3300', city: 'Osijek', oib: '76543210984' });
  const a3 = await asset(T, s3, { id: 'OS-920-LS', make: 'Škoda', model: 'Octavia 1.5 TSI', year: 2019, fuel: 'petrol' });
  const j3 = await job(T, { client: s3, asset: a3, phase: 'diagnosis', d: 3, meter: 98500, complaint: 'Povrat s leasinga', source: 'workshop', lines: [{ d: 'Pregled i dijagnostika pri otkupu', qty: 1, price: 40 }] });
  await stock(j3.id, a3, { source: 'leasing', purchased_on: day(-3), keys_count: 2, service_book: true, registered_until: day(200) });
  await price(j3.id, 'purchase', 13800);
  await inspection(T, j3.id, 'deal.buy_check', 'Pregled pri otkupu', [['a01', 'ok'], ['a02', 'ok'], ['a03', 'ok'], ['a04', 'ok', 2], ['b01', 'warn', 340, 'Stražnja lijeva vrata lakirana'], ['b02', 'ok'], ['b04', 'warn', 2.8, 'Stražnje gume za zamjenu']], { d: 0, units: { a04: 'kom', b01: 'µm', b04: 'mm' } });
  await conditionReport(T, j3.id, {
    marks: [
      { zone: 'door_rl', code: 'L', note: 'stražnja vrata lijeva, lakirana, 340 µm' },
      { zone: 'tyre_rl', code: 'I', note: 'stražnja lijeva guma 2,8 mm' },
      { zone: 'tyre_rr', code: 'I', note: 'stražnja desna guma 2,7 mm' },
    ],
    equipment: [['Ključevi (oba)', true], ['Daljinski', true], ['Prometna dozvola', true], ['Servisna knjižica', true], ['Rezervni kotač', true], ['Druge gume', false], ['Radio kod', false]],
    fuel: '3/4',
    d: 3,
  });

  // 4 — Mégane, 110 days on the lot, reserved.
  const s4 = await client(T, { first: 'Vesna', last: 'Jukić', phone: '+385 91 300 4400', city: 'Vinkovci' });
  const a4 = await asset(T, s4, { id: 'VK-301-VJ', make: 'Renault', model: 'Mégane 1.5 dCi', year: 2015, fuel: 'diesel' });
  const j4 = await job(T, { client: s4, asset: a4, phase: 'ready', d: 110, meter: 211000, complaint: 'Otkup od privatne osobe', source: 'workshop', lines: prep });
  await stock(j4.id, a4, { source: 'private', purchased_on: day(-110), asking_price: 6400, listed_on: day(-100), keys_count: 2, reserved_by: 'Ivan Lukić', reserved_until: day(3), registered_until: day(60) });
  await price(j4.id, 'purchase', 5100);
  await price(j4.id, 'lowest', 5900);

  // Sold: Astra nine days ago, Focus forty days ago.
  const s5 = await client(T, { first: 'Mario', last: 'Đurić', phone: '+385 98 300 5500', city: 'Osijek' });
  const a5 = await asset(T, s5, { id: 'OS-655-MD', make: 'Opel', model: 'Astra K 1.6 CDTI', year: 2018, fuel: 'diesel' });
  const j5 = await job(T, { client: s5, asset: a5, phase: 'collected', d: 52, meter: 121000, complaint: 'Otkup od privatne osobe', source: 'workshop', lines: prep });
  await stock(j5.id, a5, { source: 'private', purchased_on: day(-52), asking_price: 9500, listed_on: day(-47), sold_on: day(-9), buyer_name: 'Luka Pavić', buyer_phone: '+385 99 300 9900', warranty_months: 6, keys_count: 2, service_book: true });
  await price(j5.id, 'purchase', 7500);
  await price(j5.id, 'sale', 9300);

  const s6 = await client(T, { first: 'Goran', last: 'Vuković', phone: '+385 95 300 6600', city: 'Našice' });
  const a6 = await asset(T, s6, { id: 'NA-207-GV', make: 'Ford', model: 'Focus 1.0 EcoBoost', year: 2016, fuel: 'petrol' });
  const j6 = await job(T, { client: s6, asset: a6, phase: 'collected', d: 85, meter: 134000, complaint: 'Staro za novo', source: 'workshop', lines: prep.slice(0, 3) });
  await stock(j6.id, a6, { source: 'trade_in', purchased_on: day(-85), asking_price: 7900, listed_on: day(-80), sold_on: day(-40), buyer_name: 'Tena Barišić', buyer_phone: '+385 91 300 1212', warranty_months: 3, keys_count: 2 });
  await price(j6.id, 'purchase', 6300);
  await price(j6.id, 'sale', 7600);
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// Poslar Auto kozmetika: a detailing studio in Zagreb
// ---------------------------------------------------------------------
async function seedDetail() {
  const T = await workshop({ pkg: 'detail', name: 'Sjaj Detailing', city: 'Zagreb', address: 'Slavonska avenija 52', phone: '+385 1 555 1111', owner: 'Luka Barišić', worker: 'Filip Golubić' });
  const lak = (values) => ['b01', 'b02', 'b03', 'b04', 'b05'].map((c, i) => [c, values[i] < 60 ? 'crit' : values[i] < 80 ? 'warn' : 'ok', values[i]]);
  const units = { b01: 'µm', b02: 'µm', b03: 'µm', b04: 'µm', b05: 'µm' };

  const c1 = await client(T, { first: 'Ivana', last: 'Perić', phone: '+385 91 811 1100', city: 'Zagreb' });
  const a1 = await asset(T, c1, { id: 'ZG-4410-IP', make: 'BMW', model: 'X3 xDrive20d', year: 2021, fuel: 'diesel' });
  const c2 = await client(T, { first: 'Marko', last: 'Šimić', phone: '+385 98 811 2200', city: 'Velika Gorica' });
  const a2 = await asset(T, c2, { id: 'VG-218-MS', make: 'Volkswagen', model: 'Golf 8 GTI', year: 2022, fuel: 'petrol' });
  const c3 = await client(T, { company: 'Rent Adria d.o.o.', first: 'Tena', last: 'Kralj', phone: '+385 1 811 3300', city: 'Zagreb', oib: '33445566778' });
  const a3 = await asset(T, c3, { type: 'van', id: 'ZG-7702-RA', make: 'Renault', model: 'Trafic', year: 2019, fuel: 'diesel' });
  const c4 = await client(T, { first: 'Petra', last: 'Lončar', phone: '+385 95 811 4400', city: 'Zagreb' });
  const a4 = await asset(T, c4, { id: 'ZG-1290-PL', make: 'Audi', model: 'A4 Avant', year: 2017, fuel: 'diesel' });

  // Two-step correction under way; the paint was measured first.
  const j1 = await job(T, {
    client: c1,
    asset: a1,
    phase: 'in_progress',
    d: 1,
    meter: 48200,
    complaint: 'Korekcija laka i keramička zaštita',
    lines: [
      { kind: 'package', d: 'Korekcija laka u dva koraka (rezanje i završno poliranje)', unit: 'paušal', price: 280 },
      { kind: 'package', d: 'Priprema laka i nanošenje keramičke zaštite', unit: 'paušal', price: 380 },
      { kind: 'material', d: 'Keramički premaz', price: 70 },
    ],
  });
  await inspection(T, j1.id, 'detail.intake', 'Prijem vozila', [['a01', 'warn', null, 'Ogrebotine od pranja u autopraonici, desna vrata'], ['a02', 'warn', null, 'Prednji lijevi naplatak izgreban'], ['a03', 'ok'], ['a04', 'ok'], ['a05', 'ok'], ...lak([128, 121, 74, 132, 118])], { completed: true, d: 1, units });
  await conditionReport(T, j1.id, {
    marks: [
      { zone: 'hood', code: 'H', note: 'hauba, hologrami od pranja' },
      { zone: 'door_fr', code: 'O', note: 'prednja vrata desna, ogrebotine od rotacije' },
      { zone: 'door_rr', code: 'O', note: 'stražnja vrata desna' },
      { zone: 'wheel_fl', code: 'O', note: 'naplatak prednji lijevi, izgreban' },
      { zone: 'seat_driver', code: 'M', note: 'sjedalo vozača, prašina u šavovima' },
    ],
    equipment: [['Ključevi', true], ['Daljinski', true], ['Tepisi', true], ['Dječja sjedalica', false], ['Punjač ili kabel', true], ['Sitnice u kabini', false]],
    fuel: '1/2',
    d: 1,
  });
  await photo(T, j1.id, { label: 'Prije: hologrami na haubi', sub: 'BMW X3 · ZG-4410-IP', tag: 'before', hue: 215, customer: true, d: 1 });
  await photo(T, j1.id, { label: 'Lijeva strana 74 µm', sub: 'Tanki lak, samo lagano poliranje', tag: 'damage', hue: 30, d: 1 });
  await messages(T, j1.id, 'Lijeva strana ima 74 µm, idem samo s finom pastom?', 'Da, tamo bez rezanja. Upiši u napomenu za mušteriju.');

  // Done, ceramic on, the yearly care switched on.
  const j2 = await job(T, {
    client: c2,
    asset: a2,
    phase: 'ready',
    d: 3,
    meter: 21500,
    complaint: 'Keramička zaštita novog vozila',
    summary: 'Dekontaminacija, poliranje u jednom koraku i keramika u dva sloja. Mušterija upućena: 7 dana bez šampona.',
    lines: [
      { kind: 'package', d: 'Poliranje laka u jednom koraku s voskom', unit: 'paušal', price: 150 },
      { kind: 'package', d: 'Priprema laka i nanošenje keramičke zaštite', unit: 'paušal', price: 380 },
      { kind: 'material', d: 'Keramički premaz', price: 70 },
    ],
  });
  await inspection(T, j2.id, 'detail.ceramic', 'Keramička zaštita', [['c01', 'ok'], ['c02', 'ok'], ['c03', 'ok'], ['c04', 'ok', 21], ['c05', 'ok', 48], ['c06', 'ok', 2], ['c07', 'ok', null, 'Gtechniq Crystal Serum Light, serija 2406'], ['c08', 'ok']], { completed: true, d: 2, units: { c04: '°C', c05: '%', c06: 'sloj' } });
  await q(sb.from('maintenance_plans').insert({ tenant_id: T.id, client_id: c2, asset_id: a2, title: 'Održavanje keramičke zaštite', interval_months: 12, next_due_date: day(362), template_code: 'detail.ceramic_care', last_job_id: j2.id }));
  await photo(T, j2.id, { label: 'Poslije: Golf GTI', sub: 'Keramika, 2 sloja', tag: 'after', hue: 0, customer: true, d: 2 });
  await conditionReport(T, j2.id, {
    kind: 'handover',
    marks: [{ zone: 'hood', code: 'K', note: 'stara točka od kamenčića, nije dirano' }],
    equipment: [['Ključevi', true], ['Daljinski', true], ['Tepisi', true], ['Dječja sjedalica', false], ['Punjač ili kabel', true], ['Sitnice u kabini', true]],
    fuel: '1/2',
    d: 2,
  });

  // A rental van, inside only.
  await job(T, { client: c3, asset: a3, phase: 'intake', d: 0, complaint: 'Dubinsko čišćenje unutra prije sezone', lines: [{ kind: 'package', d: 'Dubinsko čišćenje unutrašnjosti (sjedala, tepisi, plastika)', unit: 'paušal', price: 90 }] });

  // Ceramic from last year: care is due.
  const j4 = await job(T, { client: c4, asset: a4, phase: 'collected', paid: true, d: 350, meter: 131000, complaint: 'Keramička zaštita', lines: [{ kind: 'package', d: 'Priprema laka i nanošenje keramičke zaštite', unit: 'paušal', price: 380 }, { kind: 'material', d: 'Keramički premaz', price: 70 }] });
  await q(sb.from('maintenance_plans').insert({ tenant_id: T.id, client_id: c4, asset_id: a4, title: 'Održavanje keramičke zaštite', interval_months: 12, next_due_date: day(15), template_code: 'detail.ceramic_care', last_job_id: j4.id }));
  await job(T, { client: c1, asset: a1, phase: 'collected', paid: true, d: 120, meter: 41000, complaint: 'Kompletna kozmetika', lines: [{ kind: 'package', d: 'Pranje izvana i dubinsko čišćenje unutra', unit: 'paušal', price: 140 }] });
  return { T, links: [] };
}

// Field trades: a customer's address and the object at it.
async function fieldSite(T, clientId, s) {
  const [row] = await q(sb.from('sites').insert({ tenant_id: T.id, client_id: clientId, ...s }).select('id'));
  return row.id;
}

// ---------------------------------------------------------------------
// Poslar Električar: an electrician in Rijeka
// ---------------------------------------------------------------------
async function seedElectric() {
  const T = await workshop({ pkg: 'electric', name: 'Elektro Kvarner', city: 'Rijeka', address: 'Zvonimirova 30', phone: '+385 51 555 1212', owner: 'Damir Jelenić', worker: 'Toni Mavrić' });
  const device = (clientId, siteId, a) => asset(T, clientId, { ...a, site: siteId, unit: 'mth' });

  const c1 = await client(T, { first: 'Sandra', last: 'Žic', phone: '+385 91 812 1100', city: 'Rijeka' });
  const s1 = await fieldSite(T, c1, { kind: 'flat', address: 'Krešimirova 14', city: 'Rijeka', postal_code: '51000', access_notes: '3. kat. Razvodni ormar u hodniku, iza ogledala.', lat: 45.3313, lng: 14.4295 });
  const i1 = await device(c1, s1, { type: 'electrical', id: 'Stan Krešimirova 14', model: 'Instalacija iz 1985., Al vodiči' });
  const b1 = await device(c1, s1, { type: 'switchboard', id: 'Ormar u hodniku', make: 'Schneider', model: 'Resi9, 24 modula', year: 2016 });

  const c2 = await client(T, { first: 'Branko', last: 'Ćiković', phone: '+385 98 812 2200', city: 'Kastav' });
  const s2 = await fieldSite(T, c2, { kind: 'house', address: 'Belići 22', city: 'Kastav', access_notes: 'Izmjenjivač u garaži, paneli na južnom krovu.', lat: 45.3727, lng: 14.3486 });
  const pv = await device(c2, s2, { type: 'solar_pv', id: 'Krov jug, 10 kW', make: 'Fronius', model: 'Symo 10.0-3-M', year: 2022, vin: 'FR-26180044' });

  const c3 = await client(T, { first: 'Iva', last: 'Kukuljan', phone: '+385 95 812 3300', city: 'Opatija' });
  const s3 = await fieldSite(T, c3, { kind: 'house', address: 'Nova cesta 61', city: 'Opatija', access_notes: 'Garaža ispod kuće, šifra 2580.' });
  const ev = await device(c3, s3, { type: 'ev_charger', id: 'Garaža', make: 'Wallbox', model: 'Pulsar Plus 11 kW' });

  const c4 = await client(T, { company: 'Caffe bar Molo d.o.o.', first: 'Saša', last: 'Brnčić', phone: '+385 51 812 4400', city: 'Rijeka', oib: '55667788991' });
  const s4 = await fieldSite(T, c4, { kind: 'commercial', label: 'Caffe bar Molo', address: 'Riva 8', city: 'Rijeka', access_notes: 'Otvoreno od 7 h. Ormar u skladištu iza šanka.', contact_name: 'Šef smjene Ana', contact_phone: '+385 51 812 4401' });
  const i4 = await device(c4, s4, { type: 'electrical', id: 'Caffe bar Molo', model: 'Lokal, trofazni priključak' });

  // Today: the test with measurements, done.
  const j1 = await job(T, {
    client: c1,
    asset: i1,
    phase: 'ready',
    d: 0,
    complaint: 'Ispitivanje instalacije prije prodaje stana',
    summary: 'Izmjereno svih 9 krugova. Izolacija kupaonice granična, preporučena zamjena kruga.',
    source: 'field',
    lines: [{ kind: 'package', d: 'Ispitivanje električne instalacije sa zapisnikom', unit: 'paušal', price: 120 }],
    extra: { work_mode: 'field', site_id: s1, scheduled_start: zagrebAt(0, 8), scheduled_end: zagrebAt(0, 10), departed_at: zagrebAt(0, 7, 40), customer_notified_at: zagrebAt(0, 7, 41), arrived_at: zagrebAt(0, 8, 2), left_at: zagrebAt(0, 9, 50), finished_at: zagrebAt(0, 9, 50) },
  });
  await inspection(T, j1.id, 'electric.measure', 'Ispitivanje instalacije', [['a01', 'warn', 1.6, 'Krug kupaonice'], ['a02', 'ok', 0.21], ['a03', 'ok', 0.84], ['a04', 'ok', 6.2], ['a05', 'ok', 24], ['a06', 'ok', 21], ['b01', 'ok'], ['b02', 'ok'], ['b03', 'warn', null, 'Utičnica u kuhinji napukla'], ['b04', 'ok'], ['b05', 'ok']], { completed: true, d: 0, units: { a01: 'MΩ', a02: 'Ω', a03: 'Ω', a04: 'Ω', a05: 'ms', a06: 'mA' } });
  await conditionReport(T, j1.id, {
    marks: [
      { zone: 'board', code: 'O', note: 'ormar, poklopac ogreben' },
      { zone: 'rcd', code: 'O', note: 'FID, stariji model' },
      { zone: 'socket_l', code: 'P', note: 'utičnica kuhinja lijevo, napukla' },
      { zone: 'earth', code: 'O', note: 'uzemljenje, spoj provjeren' },
    ],
    equipment: [['Ključ ormara', true], ['Shema razvoda', false], ['Oznake krugova', true]],
    d: 0,
  });
  await photo(T, j1.id, { label: 'Razvodni ormar', sub: 'Krešimirova 14 · 9 krugova', tag: 'board', hue: 210, customer: true, d: 0, when: zagrebAt(0, 8, 10) });
  await photo(T, j1.id, { label: 'Otpor izolacije 1,6 MΩ', sub: 'Krug kupaonice', tag: 'meter_reading', hue: 45, customer: true, d: 0, when: zagrebAt(0, 9, 5) });

  // Solar plant: yearly check, plan due in a week.
  await q(sb.from('maintenance_plans').insert({ tenant_id: T.id, client_id: c2, site_id: s2, asset_id: pv, title: 'Godišnji pregled', interval_months: 12, next_due_date: day(7), template_code: 'electric.solar' }));
  await job(T, { client: c2, asset: pv, phase: 'collected', paid: true, d: 358, complaint: 'Pregled sunčane elektrane', source: 'field', lines: [{ kind: 'package', d: 'Godišnji pregled sunčane elektrane s mjerenjima', unit: 'paušal', price: 150 }], extra: { work_mode: 'field', site_id: s2 } });

  // Tomorrow: a car charger.
  await job(T, {
    client: c3,
    asset: ev,
    phase: 'diagnosis',
    d: 2,
    complaint: 'Montaža kućnog punjača 11 kW',
    source: 'phone',
    lines: [
      { kind: 'package', d: 'Montaža i spajanje kućnog punjača za električni auto', unit: 'paušal', price: 250 },
      { kind: 'material', d: 'Kabel, zaštita i sitni materijal', unit: 'paušal', price: 60 },
    ],
    extra: { work_mode: 'field', site_id: s3, scheduled_start: zagrebAt(1, 9), scheduled_end: zagrebAt(1, 12) },
  });

  // Urgent: the bar has no power on one phase.
  await job(T, {
    client: c4,
    asset: i4,
    phase: 'intake',
    d: 0,
    urgent: true,
    assigned: false,
    complaint: 'Nema struje na aparatu za kavu i hladnjacima, iskače FID',
    source: 'phone',
    lines: [{ kind: 'fee', d: 'Izlazak na intervenciju', unit: 'paušal', price: 30 }],
    extra: { work_mode: 'field', site_id: s4 },
  });

  await job(T, { client: c1, asset: b1, phase: 'collected', paid: true, d: 60, complaint: 'Iskače FID sklopka', summary: 'Neispravna FID sklopka zamijenjena.', source: 'field', lines: [{ d: 'Ugradnja FID sklopke u razvodni ormar', qty: 1, price: 35 }, { kind: 'part', d: 'FID sklopka 40 A / 30 mA', price: 45 }], extra: { work_mode: 'field', site_id: s1 } });
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// Poslar Kućanski aparati: an appliance service in Osijek
// ---------------------------------------------------------------------
async function seedAppliance() {
  const T = await workshop({ pkg: 'appliance', name: 'Servis Bijela tehnika Ban', city: 'Osijek', address: 'Trg Ante Starčevića 4', phone: '+385 31 555 1313', owner: 'Zlatko Ban', worker: 'Ivan Rajić' });
  const device = (clientId, siteId, a) => asset(T, clientId, { ...a, site: siteId, unit: 'mth' });

  const c1 = await client(T, { first: 'Marija', last: 'Kovačević', phone: '+385 91 813 1100', city: 'Osijek' });
  const s1 = await fieldSite(T, c1, { kind: 'flat', address: 'Vukovarska 102', city: 'Osijek', postal_code: '31000', access_notes: '5. kat, lift radi. Perilica u kupaonici.', lat: 45.5550, lng: 18.6955 });
  const w1 = await device(c1, s1, { type: 'washer', id: 'Kupaonica', make: 'Bosch', model: 'Serie 6 WAU28T60BY', year: 2018, vin: 'FD 9806 200421' });

  const c2 = await client(T, { first: 'Stjepan', last: 'Matić', phone: '+385 98 813 2200', city: 'Đakovo' });
  const s2 = await fieldSite(T, c2, { kind: 'house', address: 'Kralja Tomislava 9', city: 'Đakovo', access_notes: 'Kuhinja u prizemlju.' });
  const f2 = await device(c2, s2, { type: 'fridge', id: 'Kuhinja', make: 'Gorenje', model: 'NRK6192AXL4', year: 2015 });

  const c3 = await client(T, { company: 'Caffe Corso d.o.o.', first: 'Davor', last: 'Pejić', phone: '+385 31 813 3300', city: 'Osijek', oib: '66778899002' });
  const s3 = await fieldSite(T, c3, { kind: 'commercial', label: 'Caffe Corso', address: 'Županijska 7', city: 'Osijek', contact_name: 'Davor', contact_phone: '+385 31 813 3300' });
  const cm = await device(c3, s3, { type: 'coffee_machine', id: 'Šank', make: 'Saeco', model: 'Royal One Touch', year: 2020 });

  const c4 = await client(T, { first: 'Ana', last: 'Bošnjak', phone: '+385 95 813 4400', city: 'Osijek' });
  const s4 = await fieldSite(T, c4, { kind: 'flat', address: 'Divaltova 55', city: 'Osijek' });
  const d4 = await device(c4, s4, { type: 'dishwasher', id: 'Kuhinja', make: 'Beko', model: 'DFN26420W', year: 2019 });

  // Today: the washing machine pump, repaired.
  const j1 = await job(T, {
    client: c1,
    asset: w1,
    phase: 'ready',
    d: 0,
    complaint: 'Ne izbacuje vodu, greška E18',
    summary: 'Pumpa odvoda blokirana i pregorjela. Zamijenjena, filter očišćen. Jamstvo na popravak 6 mjeseci.',
    source: 'field',
    lines: [
      { kind: 'fee', d: 'Izlazak i dijagnostika kvara', unit: 'paušal', price: 35 },
      { d: 'Zamjena pumpe odvoda', qty: 0.7, price: 35 },
      { kind: 'part', d: 'Pumpa odvoda Bosch 00145787', price: 40 },
    ],
    extra: { work_mode: 'field', site_id: s1, scheduled_start: zagrebAt(0, 8, 30), scheduled_end: zagrebAt(0, 9, 30), departed_at: zagrebAt(0, 8, 10), customer_notified_at: zagrebAt(0, 8, 11), arrived_at: zagrebAt(0, 8, 31), left_at: zagrebAt(0, 9, 25), finished_at: zagrebAt(0, 9, 25) },
  });
  await inspection(T, j1.id, 'appliance.check', 'Pregled uređaja', [['a01', 'ok'], ['a02', 'crit', null, 'E18: voda se ne izbacuje'], ['a03', 'ok', 7], ['a04', 'ok'], ['b01', 'ok', 24], ['b03', 'ok', 18], ['c01', 'crit', null, 'Pumpa blokirana, u filteru novčić'], ['c02', 'ok'], ['c03', 'ok'], ['c04', 'warn', null, 'Malo kamenca na grijaču'], ['c05', 'ok']], { completed: true, d: 0, units: { a03: 'god.', b01: 'Ω', b03: 'MΩ' } });
  await conditionReport(T, j1.id, {
    marks: [
      { zone: 'front', code: 'O', note: 'vrata perilice, trag kamenca' },
      { zone: 'hose_out', code: 'R', note: 'crijevo odvoda, stvrdnuto' },
      { zone: 'drum', code: 'O', note: 'bubanj, novčić u filteru' },
      { zone: 'door_seal', code: 'O', note: 'brtva vrata, talog' },
    ],
    equipment: [['Uputstva', false], ['Priključna crijeva', true], ['Ladice / police', true], ['Stari dio za pokazati', true]],
    d: 0,
  });
  await conditionReport(T, j1.id, {
    kind: 'handover',
    marks: [
      { zone: 'front', code: 'O', note: 'vrata, stari trag ostaje' },
      { zone: 'hose_out', code: 'O', note: 'novo crijevo odvoda' },
    ],
    equipment: [['Uputstva', false], ['Priključna crijeva', true], ['Ladice / police', true], ['Stari dio za pokazati', true]],
    d: 0,
  });
  await photo(T, j1.id, { label: 'Natpisna pločica', sub: 'Bosch WAU28T60BY · FD 9806', tag: 'nameplate', hue: 210, d: 0, when: zagrebAt(0, 8, 35) });
  await photo(T, j1.id, { label: 'Šifra greške E18', sub: 'Na zaslonu pri dolasku', tag: 'error_code', hue: 0, customer: true, d: 0, when: zagrebAt(0, 8, 33) });
  await photo(T, j1.id, { label: 'Stara pumpa', sub: 'Blokirana, pregorjela', tag: 'part_old', hue: 30, customer: true, d: 0, when: zagrebAt(0, 9, 5) });

  // Fridge not cooling, part ordered.
  const jFridge = await job(T, {
    client: c2,
    asset: f2,
    phase: 'awaiting_parts',
    d: 2,
    complaint: 'Hladnjak ne hladi, zamrzivač radi',
    diagnosis: 'Neispravan termostat hladnjaka. Naručen originalni dio, stiže u četvrtak.',
    source: 'phone',
    lines: [
      { kind: 'fee', d: 'Izlazak i dijagnostika kvara', unit: 'paušal', price: 35 },
      { d: 'Zamjena termostata', qty: 0.7, price: 35 },
      { kind: 'part', d: 'Termostat Gorenje 409155', price: 30 },
    ],
    extra: { work_mode: 'field', site_id: s2 },
  });
  await conditionReport(T, jFridge.id, {
    marks: [
      { zone: 'side_l', code: 'O', note: 'bok lijevi, udubljenje od pomaka' },
      { zone: 'door_seal', code: 'O', note: 'brtva vrata hladnjaka, tvrda' },
      { zone: 'panel', code: 'O', note: 'upravljačka ploča, bez greške na zaslonu' },
    ],
    equipment: [['Uputstva', true], ['Priključna crijeva', false], ['Ladice / police', true], ['Stari dio za pokazati', false]],
    d: 2,
  });

  // The coffee machine: descaling every six months.
  await q(sb.from('maintenance_plans').insert({ tenant_id: T.id, client_id: c3, site_id: s3, asset_id: cm, title: 'Redovno čišćenje kamenca', interval_months: 6, next_due_date: day(4), template_code: 'appliance.descale' }));
  await job(T, { client: c3, asset: cm, phase: 'collected', paid: true, d: 178, complaint: 'Čišćenje kamenca', source: 'field', lines: [{ kind: 'package', d: 'Čišćenje kamenca i servis aparata za kavu', unit: 'paušal', price: 45 }], extra: { work_mode: 'field', site_id: s3 } });

  await job(T, { client: c4, asset: d4, phase: 'diagnosis', d: 1, complaint: 'Perilica posuđa curi ispod vrata', source: 'phone', lines: [{ kind: 'fee', d: 'Izlazak i dijagnostika kvara', unit: 'paušal', price: 35 }], extra: { work_mode: 'field', site_id: s4, scheduled_start: zagrebAt(0, 15), scheduled_end: zagrebAt(0, 16) } });
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// Poslar Bravar: a locksmith in Split, day and night
// ---------------------------------------------------------------------
async function seedLocksmith() {
  const T = await workshop({ pkg: 'locksmith', name: 'Bravar Ključ 0-24', city: 'Split', address: 'Ulica Domovinskog rata 61', phone: '+385 21 555 1414', owner: 'Mate Perković', worker: 'Josip Kalebić' });
  const door = (clientId, siteId, a) => asset(T, clientId, { ...a, site: siteId, unit: 'mth' });

  const c1 = await client(T, { first: 'Klara', last: 'Babić', phone: '+385 91 814 1100', city: 'Split' });
  const s1 = await fieldSite(T, c1, { kind: 'flat', address: 'Kninska 24', city: 'Split', postal_code: '21000', access_notes: '2. kat, stan desno.', lat: 43.5130, lng: 16.4580 });
  const d1 = await door(c1, s1, { type: 'door_lock', id: 'Ulazna vrata', make: 'Mottura', model: 'Cilindar 30/35' });

  const c2 = await client(T, { company: 'Apartmani Bačvice d.o.o.', first: 'Nina', last: 'Grgić', phone: '+385 98 814 2200', city: 'Split', oib: '77889900113' });
  const s2 = await fieldSite(T, c2, { kind: 'apartment', label: 'Apartman 3', address: 'Šetalište Petra Preradovića 4', city: 'Split', access_notes: 'Ključ kod recepcije u prizemlju.' });
  const d2 = await door(c2, s2, { type: 'door_lock', id: 'Apartman 3', make: 'EVVA', model: 'ICS cilindar' });

  const c3 = await client(T, { company: 'Zlatarna Riva', first: 'Ante', last: 'Vuković', phone: '+385 21 814 3300', city: 'Split', oib: '88990011224' });
  const s3 = await fieldSite(T, c3, { kind: 'commercial', label: 'Zlatarna Riva', address: 'Obala Hrvatskog narodnog preporoda 12', city: 'Split' });
  const safe = await door(c3, s3, { type: 'safe', id: 'Sef u skladištu', make: 'Format', model: 'Gigant Pro' });

  // Last night, 01:20: locked out, opened without damage.
  const j1 = await job(T, {
    client: c1,
    asset: d1,
    phase: 'collected',
    paid: true,
    d: 1,
    assigned: 'owner',
    complaint: 'Zaključana vani, ključ ostao unutra',
    summary: 'Vrata otvorena bez oštećenja. Osobna pregledana, adresa se poklapa.',
    source: 'phone',
    lines: [
      { kind: 'package', d: 'Otvaranje zaključanih vrata bez oštećenja', unit: 'paušal', price: 60 },
      { kind: 'fee', d: 'Dodatak za noć, vikend ili blagdan', unit: 'paušal', price: 40 },
    ],
    extra: { work_mode: 'field', site_id: s1, departed_at: zagrebAt(-1, 1, 25), arrived_at: zagrebAt(-1, 1, 41), left_at: zagrebAt(-1, 2, 5), finished_at: zagrebAt(-1, 2, 5) },
  });
  await inspection(T, j1.id, 'locksmith.opening', 'Zapisnik otvaranja', checklistCodes('opening', 6).map((c, i) => [c, 'ok', null, i === 1 ? 'Adresa na osobnoj iskaznici' : i === 3 ? 'Otvoreno bez oštećenja (ploča)' : null]), { completed: true, d: 1 });
  await conditionReport(T, j1.id, {
    marks: [
      { zone: 'door_leaf', code: 'O', note: 'krilo, stara ogrebotina uz kvaku' },
      { zone: 'cylinder', code: 'O', note: 'cilindar Mottura 30/35, bez loma' },
      { zone: 'handle_out', code: 'O', note: 'vanjska kvaka' },
      { zone: 'frame', code: 'O', note: 'štok, bez oštećenja od otvaranja' },
    ],
    equipment: [['Ključevi predani', false], ['Stari cilindar', false], ['Kartice / transponderi', false], ['Dokaz prava ulaska', true]],
    d: 1,
  });
  await conditionReport(T, j1.id, {
    kind: 'handover',
    marks: [
      { zone: 'door_leaf', code: 'O', note: 'krilo, stara ogrebotina ostaje' },
      { zone: 'cylinder', code: 'O', note: 'otvoreno pločom, cilindar cijel' },
    ],
    equipment: [['Ključevi predani', true], ['Stari cilindar', false], ['Kartice / transponderi', false], ['Dokaz prava ulaska', true]],
    d: 1,
  });
  await photo(T, j1.id, { label: 'Vrata prije otvaranja', sub: 'Kninska 24 · 01:43', tag: 'before', hue: 25, customer: true, d: 1, when: zagrebAt(-1, 1, 43) });
  await photo(T, j1.id, { label: 'Dokaz prava ulaska', sub: 'Osobna, adresa Kninska 24', tag: 'id_check', hue: 200, d: 1, when: zagrebAt(-1, 1, 45) });
  await photo(T, j1.id, { label: 'Nakon otvaranja', sub: 'Bez oštećenja', tag: 'after', hue: 140, customer: true, d: 1, when: zagrebAt(-1, 2, 0) });

  // Today: a safety cylinder in the same flat.
  await job(T, {
    client: c1,
    asset: d1,
    phase: 'diagnosis',
    d: 0,
    complaint: 'Ugradnja sigurnosnog cilindra',
    source: 'phone',
    lines: [
      { d: 'Ugradnja sigurnosnog cilindra', qty: 0.5, price: 35 },
      { kind: 'part', d: 'Sigurnosni cilindar s karticom i 5 ključeva', price: 95 },
    ],
    extra: { work_mode: 'field', site_id: s1, scheduled_start: zagrebAt(0, 16), scheduled_end: zagrebAt(0, 17) },
  });

  // Apartments: new cylinder after a guest lost the key.
  const jApt = await job(T, {
    client: c2,
    asset: d2,
    phase: 'in_progress',
    d: 0,
    complaint: 'Gost izgubio ključ, zamjena cilindra prije dolaska novih gostiju',
    source: 'phone',
    lines: [
      { d: 'Zamjena cilindra', qty: 0.5, price: 35 },
      { kind: 'part', d: 'Cilindar s 3 ključa', price: 35 },
    ],
    extra: { work_mode: 'field', site_id: s2, scheduled_start: zagrebAt(0, 11), scheduled_end: zagrebAt(0, 12), departed_at: zagrebAt(0, 10, 45), arrived_at: zagrebAt(0, 11, 2) },
  });
  await conditionReport(T, jApt.id, {
    marks: [
      { zone: 'cylinder', code: 'N', note: 'stari cilindar skida se, ključ izgubljen' },
      { zone: 'escutch', code: 'O', note: 'štitnik, ogreben od pokušaja otvaranja' },
      { zone: 'hinge_top', code: 'O', note: 'gornja šarka, bez zračnosti' },
    ],
    equipment: [['Ključevi predani', false], ['Stari cilindar', true], ['Kartice / transponderi', false], ['Dokaz prava ulaska', true]],
    d: 0,
  });

  // The jeweller's safe: yearly service.
  await q(sb.from('maintenance_plans').insert({ tenant_id: T.id, client_id: c3, site_id: s3, asset_id: safe, title: 'Godišnji servis sefa i brava', interval_months: 12, next_due_date: day(20), template_code: 'locksmith.lock' }));
  await job(T, { client: c3, asset: safe, phase: 'collected', paid: true, d: 345, complaint: 'Servis sefa', source: 'field', lines: [{ d: 'Ugradnja ili zamjena brave', qty: 1, price: 35 }], extra: { work_mode: 'field', site_id: s3 } });
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// Poslar Bazeni: weekly pool service in Zadar
// ---------------------------------------------------------------------
async function seedPool() {
  const T = await workshop({ pkg: 'pool', name: 'Bazeni Jadran', city: 'Zadar', address: 'Ulica Kneza Branimira 8', phone: '+385 23 555 1515', owner: 'Luka Šimunić', worker: 'Ivan Ćurković' });
  const obj = (clientId, siteId, a) => asset(T, clientId, { ...a, site: siteId, unit: 'mth' });

  const c1 = await client(T, { first: 'Maja', last: 'Kovač', phone: '+385 91 816 1100', city: 'Zadar' });
  const s1 = await fieldSite(T, c1, { kind: 'house', address: 'Put Dikla 18', city: 'Zadar', postal_code: '23000', access_notes: 'Vrata u okućnici, šifra 1941. Strojarnica lijevo od kuće.', lat: 44.1194, lng: 15.2422 });
  const p1 = await obj(c1, s1, { type: 'swimming_pool', id: 'Bazen u vrtu', make: 'Astral', model: '8 × 4 m, pješčani filter' });

  const c2 = await client(T, { company: 'Villa Lavanda', first: 'Petra', last: 'Marin', phone: '+385 98 816 2200', city: 'Nin', oib: '55667788990' });
  const s2 = await fieldSite(T, c2, { kind: 'house', label: 'Villa Lavanda', address: 'Zrinsko-Frankopanska 4', city: 'Nin', access_notes: 'Ključ kod susjeda, kuća 6.' });
  const p2 = await obj(c2, s2, { type: 'swimming_pool', id: 'Bazen vile', make: 'Hayward', model: 'Overflow 10 × 5' });

  const j1 = await job(T, {
    client: c1,
    asset: p1,
    phase: 'collected',
    paid: true,
    d: 2,
    assigned: 'owner',
    complaint: 'Tjedni servis, voda malo mutna',
    summary: 'pH 7.5, slobodni klor 0.4 mg/l. Dodan šok klor, ispran filter. Voda bistra na odlasku.',
    source: 'phone',
    lines: [{ kind: 'package', d: 'Tjedni servis: mjerenje, kemija, čišćenje skimmera i pregled filtera', unit: 'paušal', price: 45 }],
    extra: { work_mode: 'field', site_id: s1, departed_at: zagrebAt(-2, 8, 10), arrived_at: zagrebAt(-2, 8, 28), left_at: zagrebAt(-2, 9, 20), finished_at: zagrebAt(-2, 9, 20) },
  });
  await inspection(T, j1.id, 'pool.water', 'Mjerenje vode', [['a01', 'ok', 7.5], ['a02', 'warn', 0.4, 'Ispod 0,5'], ['a03', 'ok', 0.2], ['a04', 'ok', 40], ['a05', 'ok', 24], ['a06', 'warn', null, 'Blago mutna'], ['b01', 'ok'], ['b02', 'ok'], ['b03', 'ok'], ['b04', 'ok'], ['b05', 'ok']], { completed: true, d: 2, units: { a01: '', a02: 'mg/l', a03: 'mg/l', a04: 'mg/l', a05: '°C' } });
  await conditionReport(T, j1.id, {
    marks: [
      { zone: 'wall_l', code: 'O', note: 'zid lijevi, alga uz vodenu liniju' },
      { zone: 'skimmer', code: 'R', note: 'skimer, košara puna lišća' },
      { zone: 'liner', code: 'O', note: 'folija, sitna mrlja na dnu' },
      { zone: 'pump', code: 'O', note: 'pumpa, curenje na mehaničkoj brtvi nije vidljivo' },
    ],
    equipment: [['Plahta / pokrov', false], ['Robot / usis', true], ['Kemija na licu mjesta', true], ['Ključ strojarnice', true]],
    d: 2,
  });
  await photo(T, j1.id, { label: 'Voda prije šoka', sub: 'Put Dikla 18', tag: 'water', hue: 190, customer: true, d: 2, when: zagrebAt(-2, 8, 30) });

  const jOpen = await job(T, {
    client: c2,
    asset: p2,
    phase: 'diagnosis',
    d: 0,
    complaint: 'Otvaranje sezone, plahta još na bazenu',
    source: 'phone',
    lines: [{ kind: 'package', d: 'Otvaranje bazena: čišćenje, spajanje, start kemija', unit: 'paušal', price: 180 }],
    extra: { work_mode: 'field', site_id: s2, scheduled_start: zagrebAt(1, 9), scheduled_end: zagrebAt(1, 12) },
  });
  await conditionReport(T, jOpen.id, {
    marks: [
      { zone: 'cover', code: 'O', note: 'plahta, lišće i talog' },
      { zone: 'wall_deep', code: 'R', note: 'zid dubokog kraja, alga' },
      { zone: 'filter', code: 'R', note: 'filter, pijesak slegnut' },
    ],
    equipment: [['Plahta / pokrov', true], ['Robot / usis', false], ['Kemija na licu mjesta', false], ['Ključ strojarnice', true]],
    d: 0,
  });
  await job(T, {
    client: c1,
    asset: p1,
    phase: 'in_progress',
    d: 0,
    complaint: 'Tjedni servis, kontrola klora nakon šoka',
    source: 'phone',
    lines: [{ kind: 'package', d: 'Tjedni servis: mjerenje, kemija, čišćenje skimmera i pregled filtera', unit: 'paušal', price: 45 }],
    extra: { work_mode: 'field', site_id: s1, scheduled_start: zagrebAt(0, 8), scheduled_end: zagrebAt(0, 9), departed_at: zagrebAt(0, 7, 50), arrived_at: zagrebAt(0, 8, 8) },
  });

  await q(sb.from('maintenance_plans').insert({ tenant_id: T.id, client_id: c1, site_id: s1, asset_id: p1, title: 'Tjedni obilazak', interval_months: 1, next_due_date: day(5), template_code: 'pool.weekly' }));
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// Poslar Apartmani: turnover cleaning in Dubrovnik
// ---------------------------------------------------------------------
async function seedClean() {
  const T = await workshop({ pkg: 'clean', name: 'Čisto Jadran', city: 'Dubrovnik', address: 'Put Republike 5', phone: '+385 20 555 1616', owner: 'Ana Puljić', worker: 'Ivana Mandić' });
  const unit = (clientId, siteId, a) => asset(T, clientId, { ...a, site: siteId, unit: 'mth' });

  const c1 = await client(T, { company: 'Apartmani Pile', first: 'Marko', last: 'Režić', phone: '+385 91 817 1100', city: 'Dubrovnik', oib: '33445566778' });
  const s1 = await fieldSite(T, c1, { kind: 'apartment', label: 'Apartman 2', address: 'Ulica od Puča 12', city: 'Dubrovnik', postal_code: '20000', access_notes: '2. kat, ključ u sefu, šifra 2015.', lat: 42.6403, lng: 18.1084 });
  const u1 = await unit(c1, s1, { type: 'apartment_unit', id: 'Apartman 2', model: 'Studio, 2 osobe' });

  const c2 = await client(T, { company: 'Ured Stradun', first: 'Tea', last: 'Katić', phone: '+385 98 817 2200', city: 'Dubrovnik', oib: '44556677889' });
  const s2 = await fieldSite(T, c2, { kind: 'office', label: 'Ured 1. kat', address: 'Pred Dvorom 3', city: 'Dubrovnik', access_notes: 'Zvono Katić, lift.' });
  const u2 = await unit(c2, s2, { type: 'office_unit', id: 'Ured 1. kat', model: '4 stola, kuhinjica' });

  const j1 = await job(T, {
    client: c1,
    asset: u1,
    phase: 'collected',
    paid: true,
    d: 1,
    assigned: 'worker',
    complaint: 'Smjena: odjava 10:00, novi gosti 15:00',
    summary: 'Studio očišćen, posteljina zamijenjena. Jedna čaša napukla — slika na nalogu.',
    source: 'phone',
    lines: [{ kind: 'package', d: 'Čišćenje apartmana između gostiju (kreveti, kupaonica, kuhinja, podovi)', unit: 'paušal', price: 55 }],
    extra: { work_mode: 'field', site_id: s1, departed_at: zagrebAt(-1, 10, 15), arrived_at: zagrebAt(-1, 10, 28), left_at: zagrebAt(-1, 12, 5), finished_at: zagrebAt(-1, 12, 5) },
  });
  await inspection(T, j1.id, 'clean.turnover', 'Smjena između gostiju', [['a01', 'ok'], ['a02', 'ok'], ['a03', 'ok'], ['a04', 'ok'], ['a05', 'ok'], ['a06', 'ok'], ['b01', 'warn', null, 'Napukla čaša'], ['b02', 'ok'], ['b03', 'ok'], ['b04', 'ok'], ['b05', 'ok']], { completed: true, d: 1 });
  await conditionReport(T, j1.id, {
    marks: [
      { zone: 'kitchen', code: 'O', note: 'kuhinja, masni trag na ploči' },
      { zone: 'bath', code: 'O', note: 'kupaonica, kamenac na slavinama' },
      { zone: 'bed_1', code: 'O', note: 'spavaća, posteljina zamijenjena' },
    ],
    equipment: [['Ključevi / kartice', true], ['Daljinski klime', true], ['Inventar (popis)', true], ['Posteljina predana', true]],
    d: 1,
  });
  await conditionReport(T, j1.id, {
    kind: 'handover',
    marks: [{ zone: 'kitchen', code: 'O', note: 'napukla čaša ostavljena na šanku, slika na nalogu' }],
    equipment: [['Ključevi / kartice', true], ['Daljinski klime', true], ['Inventar (popis)', true], ['Posteljina predana', true]],
    d: 1,
  });
  await photo(T, j1.id, { label: 'Gotov studio', sub: 'Apartman 2', tag: 'after', hue: 40, customer: true, d: 1, when: zagrebAt(-1, 12, 0) });

  const jOffice = await job(T, {
    client: c2,
    asset: u2,
    phase: 'diagnosis',
    d: 0,
    complaint: 'Redovno čišćenje ureda, petkom',
    source: 'phone',
    lines: [{ kind: 'package', d: 'Redovno čišćenje ureda', unit: 'paušal', price: 40 }],
    extra: { work_mode: 'field', site_id: s2, scheduled_start: zagrebAt(0, 16), scheduled_end: zagrebAt(0, 17, 30) },
  });
  await conditionReport(T, jOffice.id, {
    marks: [
      { zone: 'living', code: 'O', note: 'uredski prostor, prašina na policama' },
      { zone: 'kitchen', code: 'O', note: 'kuhinjica, talog u sudoperu' },
    ],
    equipment: [['Ključevi / kartice', true], ['Daljinski klime', true], ['Inventar (popis)', false], ['Posteljina predana', false]],
    d: 0,
  });
  const s3 = await fieldSite(T, c1, { kind: 'apartment', label: 'Apartman 1', address: 'Ulica od Puča 12', city: 'Dubrovnik', postal_code: '20000', access_notes: '1. kat, isti sef, šifra 2014.' });
  const u3 = await unit(c1, s3, { type: 'apartment_unit', id: 'Apartman 1', model: 'Dvosobni, 4 osobe' });
  await job(T, {
    client: c1,
    asset: u3,
    phase: 'intake',
    d: 0,
    assigned: false,
    complaint: 'Smjena: odjava 11:00, novi gosti 16:00',
    source: 'phone',
    lines: [{ kind: 'package', d: 'Čišćenje apartmana između gostiju (kreveti, kupaonica, kuhinja, podovi)', unit: 'paušal', price: 55 }],
    extra: { work_mode: 'field', site_id: s3 },
  });

  await q(sb.from('maintenance_plans').insert({ tenant_id: T.id, client_id: c2, site_id: s2, asset_id: u2, title: 'Redovno čišćenje', interval_months: 1, next_due_date: day(3), template_code: 'clean.office' }));
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// The AI phone at work: in every trade one call the owner missed, taken
// by the AI secretary, ended as a job in Prijem with its slot, the call
// summary and the conversation (the scenes on the trade pages).
// ---------------------------------------------------------------------
const AI_BOOKINGS = {
  volt: {
    client: { first: 'Marina', last: 'Vuković', phone: '+385 91 744 2310', city: 'Zagreb' },
    asset: { id: 'ZG-7713-MV', make: 'Škoda', model: 'Octavia III 1.6 TDI', year: 2015, fuel: 'diesel' },
    complaint: 'Ujutro teško pali. Svijetle lampica akumulatora i ESP-a, traje desetak dana.',
    slot: [1, 8, 30, 60],
    summary: 'Marina Vuković: Škoda Octavia ujutro teško pali, svijetle lampica akumulatora i ESP-a, traje desetak dana. Dogovorena dijagnostika sutra u 8:30.',
    talk: [
      ['Poslar', 'Dobar dan, Autoelektrika Horvat, ovdje Poslar. Majstor trenutno ne može, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Dobar dan, Octavia mi ujutro jako teško pali, a pale se lampica akumulatora i ESP.'],
      ['Poslar', 'Razumijem. Koliko dugo to traje i pali li auto na kraju?'],
      ['Mušterija', 'Desetak dana. Upali iz drugog, trećeg puta.'],
      ['Poslar', 'Predlažem dijagnostiku sutra u 8:30. Može registracija vozila?'],
      ['Mušterija', 'ZG 7713 MV. Sutra u pola devet mi odgovara.'],
      ['Poslar', 'Upisano: sutra u 8:30, dijagnostika za Škodu Octaviju ZG-7713-MV. Majstor će Vam potvrditi termin porukom. Doviđenja.'],
    ],
  },
  gear: {
    client: { first: 'Petar', last: 'Jurić', phone: '+385 98 451 2207', city: 'Split' },
    asset: { id: 'ST-552-PJ', make: 'Volkswagen', model: 'Golf VII 1.6 TDI', year: 2016, fuel: 'diesel' },
    complaint: 'Mali servis: ulje i filteri. Pali se lampica servisa.',
    slot: [1, 8, 0, 60],
    summary: 'Petar Jurić traži mali servis za VW Golf VII 1.6 TDI (ST-552-PJ). Pali se lampica servisa, zadnji servis prije godinu dana. Termin sutra u 8:00, auto ostavlja ujutro.',
    talk: [
      ['Poslar', 'Dobar dan, Autoservis Kovač, ovdje Poslar. Majstor je pod autom, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Trebao bih mali servis, pali mi se lampica servisa na Golfu.'],
      ['Poslar', 'Može. Koji je model i registracija?'],
      ['Mušterija', 'Golf sedmica, 1.6 TDI, ST 552 PJ. Zadnji servis bio je prije godinu dana.'],
      ['Poslar', 'Prvi slobodan termin je sutra u 8:00, a zatim sutra u 11:00. Što Vam više odgovara?'],
      ['Mušterija', 'Sutra u osam, ostavit ću auto ujutro.'],
      ['Poslar', 'Upisano: sutra u 8:00, mali servis za Golf ST-552-PJ. Majstor će Vam potvrditi termin porukom. Doviđenja.'],
    ],
  },
  body: {
    client: { first: 'Lana', last: 'Petrović', phone: '+385 95 662 1408', city: 'Rijeka' },
    asset: { id: 'RI-2290-LP', make: 'Hyundai', model: 'i30 1.4 T-GDi', year: 2019, fuel: 'petrol' },
    complaint: 'Ogrebotina i udubljenje na desnim stražnjim vratima (parkiralište). Ima kasko.',
    slot: [1, 10, 0, 30],
    summary: 'Lana Petrović: ogrebotina i udubljenje na desnim stražnjim vratima Hyundaija i30, oštećeno na parkiralištu. Ima kasko i javit će osiguranju. Procjena štete sutra u 10:00.',
    talk: [
      ['Poslar', 'Dobar dan, Limarija i lakirnica Jurić, ovdje Poslar. Majstor trenutno ne može, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Netko mi je na parkiralištu udario vrata, ogrebeno je i malo udubljeno.'],
      ['Poslar', 'Žao mi je. Koja su vrata i o kojem je vozilu riječ?'],
      ['Mušterija', 'Desna stražnja, Hyundai i30, RI 2290 LP. Imam kasko.'],
      ['Poslar', 'Za procjenu štete imamo slobodno sutra u 10:00. Ponesite policu kaska. Odgovara li Vam?'],
      ['Mušterija', 'Odgovara, hvala.'],
      ['Poslar', 'Upisano: sutra u 10:00, procjena štete za Hyundai i30 RI-2290-LP. Doviđenja.'],
    ],
  },
  wheel: {
    client: { first: 'Goran', last: 'Kovačević', phone: '+385 98 233 5106', city: 'Osijek' },
    asset: { id: 'OS-631-GK', make: 'Škoda', model: 'Fabia III 1.0 TSI', year: 2018, fuel: 'petrol' },
    complaint: 'Sezonska zamjena: zimske gume iz hotela (set na čeličnim felgama).',
    slot: [1, 7, 30, 30],
    summary: 'Goran Kovačević: zamjena ljetnih za zimske na Fabiji OS-631-GK. Zimske su kod nas u hotelu, set na čeličnim felgama. Termin sutra u 7:30.',
    talk: [
      ['Poslar', 'Dobar dan, Vulkanizer Brzi kotač, ovdje Poslar. Majstor trenutno ne može, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Treba mi zamjena za zimske, gume su kod vas na čuvanju.'],
      ['Poslar', 'Može. Na koju registraciju su gume spremljene?'],
      ['Mušterija', 'OS 631 GK, Škoda Fabia.'],
      ['Poslar', 'Pronašao sam set zimskih guma na felgama. Slobodno je sutra u 7:30 ili u 13:00.'],
      ['Mušterija', 'Pola osam, prije posla.'],
      ['Poslar', 'Upisano: sutra u 7:30, zamjena na zimske za OS-631-GK. Doviđenja.'],
    ],
  },
  machine: {
    client: { company: 'Građevina Babić d.o.o.', first: 'Ivica', last: 'Babić', phone: '+385 91 557 3305', city: 'Vrbovec' },
    asset: { type: 'machine', id: 'CAT-336-1102', make: 'Caterpillar', model: '336', year: 2020, unit: 'mth' },
    complaint: 'Curi hidraulika na strijeli, stroj stoji na gradilištu.',
    slot: [1, 8, 0, 180],
    summary: 'Ivica Babić, Građevina Babić: bager CAT 336 curi hidraulika, treba terenska intervencija sutra u 8:00.',
    talk: [
      ['Poslar', 'Dobar dan, Servis radnih strojeva Kamen, ovdje Poslar. Majstor trenutno ne može, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Babić, Građevina Babić. Bageru curi crijevo na strijeli.'],
      ['Poslar', 'Koji je stroj i gdje se nalazi?'],
      ['Mušterija', 'CAT 336, obilaznica Vrbovec, dionica 2. Treba nam danas.'],
      ['Poslar', 'Sutra u 8:00 imamo slobodnu ekipu za teren. Može?'],
      ['Mušterija', 'Može, strojar čeka na gradilištu.'],
      ['Poslar', 'Upisano: sutra u 8:00, terenska intervencija, hidraulika na CAT 336. Doviđenja.'],
    ],
  },
  fleet: {
    client: { company: 'Transport Babić d.o.o.', first: 'Ivica', last: 'Babić', phone: '+385 91 557 3304', city: 'Sesvete' },
    asset: { type: 'tractor_unit', id: 'ZG-9081-TB', make: 'MAN', model: 'TGX 18.510', year: 2020, fuel: 'diesel' },
    complaint: 'Redovni servis tegljača po planu (PM-A), 118.000 km.',
    slot: [1, 7, 0, 240],
    summary: 'Ivica Babić, Transport Babić: tegljač MAN TGX ZG-9081-TB treba redovni servis PM-A, ima 118.000 km. Vozilo dolazi sutra u 7:00, mora natrag na cestu do 15:00.',
    talk: [
      ['Poslar', 'Dobar dan, Servis gospodarskih vozila Perić, ovdje Poslar. Majstor trenutno ne može, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Babić, Transport Babić. Tegljaču je došao redovni servis.'],
      ['Poslar', 'Koje vozilo i koliko kilometara?'],
      ['Mušterija', 'MAN TGX, ZG 9081 TB, oko 118 tisuća. Treba nam natrag do tri popodne.'],
      ['Poslar', 'Sutra u 7:00 imamo slobodnu dizalicu za cijelo jutro. Može?'],
      ['Mušterija', 'Može, vozač dolazi u sedam.'],
      ['Poslar', 'Upisano: sutra u 7:00, servis PM-A za ZG-9081-TB, gotovo do 15:00. Doviđenja.'],
    ],
  },
  moto: {
    client: { first: 'Dario', last: 'Grgić', phone: '+385 99 410 7721', city: 'Zadar' },
    asset: { type: 'motorcycle', id: 'ZD-558-RT', make: 'Honda', model: 'CB650R', year: 2021, fuel: 'petrol' },
    complaint: 'Prvo paljenje nakon zime, baterija prazna, treba veliki servis.',
    slot: [2, 10, 0, 60],
    summary: 'Dario Grgić: Honda CB650R ne pali nakon zime, prazna baterija, treba veliki servis prije sezone. Termin prekosutra u 10:00.',
    talk: [
      ['Poslar', 'Dobar dan, Moto centar Barić, ovdje Poslar. Majstor trenutno ne može, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Motor mi ne pali nakon zime, a treba i veliki servis.'],
      ['Poslar', 'Koji je model i koliko ima kilometara?'],
      ['Mušterija', 'Honda CB650R, oko 11 tisuća kilometara.'],
      ['Poslar', 'Prvi slobodan termin je prekosutra u 10:00. Odgovara li Vam?'],
      ['Mušterija', 'Odgovara, dovest ću ga.'],
      ['Poslar', 'Upisano: prekosutra u 10:00, baterija i veliki servis na Hondi CB650R. Doviđenja.'],
    ],
  },
  marine: {
    client: { first: 'Mislav', last: 'Grubišić', phone: '+385 99 410 7720', city: 'Zadar' },
    asset: { type: 'outboard', id: '6EN-1032847', make: 'Yamaha', model: 'F100 FETX', year: 2017, unit: 'mth' },
    complaint: 'Konzervacija vanbrodskog motora za zimu i vađenje broda na suho.',
    slot: [2, 9, 0, 120],
    summary: 'Mislav Grubišić: konzervacija Yamahe F100 za zimu i vađenje broda na suho. Brod dovozi prekosutra ujutro. Termin prekosutra u 9:00.',
    talk: [
      ['Poslar', 'Dobar dan, Nautika Barić, ovdje Poslar. Majstor trenutno ne može, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Trebam konzervaciju motora za zimu i brod na suho.'],
      ['Poslar', 'Koji je motor i koliko ima radnih sati?'],
      ['Mušterija', 'Yamaha F100, oko 410 sati.'],
      ['Poslar', 'Prvi slobodan termin za vađenje je prekosutra u 9:00. Odgovara li Vam?'],
      ['Mušterija', 'Odgovara, dovest ću ga ujutro.'],
      ['Poslar', 'Upisano: prekosutra u 9:00, konzervacija Yamahe F100 i vađenje broda. Doviđenja.'],
    ],
  },
  air: {
    client: { first: 'Tea', last: 'Horvat', phone: '+385 91 220 4417', city: 'Zagreb' },
    site: { kind: 'flat', address: 'Vukovarska 58', city: 'Zagreb', postal_code: '10000', access_notes: '2. kat, zvono Horvat. Parking u dvorištu.', lat: 45.8027, lng: 15.9809 },
    asset: { type: 'ac_split', id: 'Dnevni boravak', make: 'Daikin', model: 'Sensira 3,5 kW', year: 2021 },
    complaint: 'Klima ne grije, na unutarnjoj jedinici treperi lampica.',
    slot: [1, 10, 0, 60],
    summary: 'Tea Horvat: Daikin u dnevnom boravku ne grije, treperi lampica na unutarnjoj jedinici. Stan na 2. katu, Vukovarska 58. Termin sutra od 10:00 do 11:00.',
    talk: [
      ['Poslar', 'Dobar dan, Klima servis Polar, ovdje Poslar. Serviser je na montaži, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Klima mi ne grije, a na unutarnjoj jedinici treperi lampica.'],
      ['Poslar', 'Koja je marka uređaja i na kojoj adresi?'],
      ['Mušterija', 'Daikin, Vukovarska 58, drugi kat.'],
      ['Poslar', 'Serviser je u tom dijelu grada sutra od 10 do 11 sati. Može?'],
      ['Mušterija', 'Može, bit ću doma.'],
      ['Poslar', 'Upisano: sutra od 10:00 do 11:00, Vukovarska 58. Serviser će Vam javiti kad krene. Doviđenja.'],
    ],
  },
  aqua: {
    client: { first: 'Josipa', last: 'Marinović', phone: '+385 98 330 6612', city: 'Split' },
    site: { kind: 'house', address: 'Put Brodarice 12', city: 'Split', postal_code: '21000', access_notes: 'Glavni ventil u šahtu uz ulaz, poklopac lijevo od vrata.', lat: 43.5136, lng: 16.4685 },
    asset: { type: 'plumbing', make: null, model: 'Kuhinja, dovod i odvod' },
    complaint: 'HITNO: puknuta cijev ispod sudopera, voda po kuhinji. Glavni ventil zatvoren.',
    urgent: true,
    slot: [0, 15, 0, 90],
    summary: 'Josipa Marinović: puknula cijev ispod sudopera, voda po kuhinji. Uputio sam je da zatvori glavni ventil u šahtu uz ulaz, zatvorila je. Put Brodarice 12, Split. Hitna intervencija danas u 15:00.',
    talk: [
      ['Poslar', 'Dobar dan, Vodoinstalacije Jadran, ovdje Poslar. Majstor trenutno ne može, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Pukla mi je cijev ispod sudopera, voda je posvuda!'],
      ['Poslar', 'Odmah zatvorite glavni ventil za vodu. Obično je u šahtu uz ulaz ili kod vodomjera. Javite mi kad je zatvoren.'],
      ['Mušterija', 'Zatvorila sam, prestalo je.'],
      ['Poslar', 'Odlično. Isključite i bojler ako je pod vodom. Koja je adresa?'],
      ['Mušterija', 'Put Brodarice 12, Split.'],
      ['Poslar', 'Upisana hitna intervencija danas u 15:00. Majstor će Vas nazvati kad krene. Doviđenja.'],
    ],
  },
  tow: {
    client: { first: 'Damir', last: 'Šimunović', phone: '+385 91 778 2045', city: 'Zagreb' },
    asset: { id: 'ZG-1187-DS', make: 'Audi', model: 'A4 Avant 2.0 TDI', year: 2018, fuel: 'diesel' },
    complaint: 'Vozilo stalo na autocesti, ne pali. Vuča u servis.',
    slot: [0, 3, 40, 60],
    called: [0, 3, 8],
    tow: { service: 'tow', payer: 'assistance', payer_name: 'Asistencija Demo', claim_no: 'AP-56231', pickup_address: 'A1, odmorište Draganić, smjer Zagreb', pickup_lat: 45.5764, pickup_lng: 15.6362, dropoff_address: 'Autoservis Mrežnica, Karlovac', distance_km: 21, truck: 'KA-202-VS' },
    summary: 'Damir Šimunović: Audi A4 stao na A1 kod odmorišta Draganić, smjer Zagreb, ne pali. Lokacija poslana s mobitela. Asistencija Demo, broj predmeta AP-56231. Vuča do servisa u Karlovcu.',
    talk: [
      ['Poslar', 'Dobar dan, Autovuča Sokol, ovdje Poslar. Majstor trenutno ne može, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Auto mi je stao na autocesti i ne pali.'],
      ['Poslar', 'Jeste li na sigurnom? Upalite sva četiri žmigavca i stanite iza zaštitne ograde. Gdje se nalazite?'],
      ['Mušterija', 'Na A1, kod odmorišta Draganić, prema Zagrebu.'],
      ['Poslar', 'Poslao sam Vam poruku s poveznicom za točnu lokaciju. Koje je vozilo i imate li broj predmeta asistencije?'],
      ['Mušterija', 'Audi A4, ZG 1187 DS. Asistencija mi je dala AP 56231.'],
      ['Poslar', 'Upisano. Vučno vozilo kreće odmah, stiže za oko 30 minuta. Vozač će Vas nazvati. Doviđenja.'],
    ],
  },
  deal: {
    client: { first: 'Ivana', last: 'Lukić', phone: '+385 98 300 7700', city: 'Osijek' },
    asset: { id: 'OS-884-IL', make: 'Volkswagen', model: 'Passat B8 2.0 TDI', year: 2016, fuel: 'diesel' },
    complaint: 'Želi prodati svoj Passat, pita za otkup i pregled.',
    slot: [1, 10, 0, 60],
    summary: 'Ivana Lukić: nudi na otkup VW Passat B8 2.0 TDI (OS-884-IL), oko 178.000 km. Pregled i procjena sutra u 10:00.',
    talk: [
      ['Poslar', 'Dobar dan, Auto plac Drava, ovdje Poslar. Kolega je s kupcem, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Imam Passata koji bih htjela prodati, radite li otkup?'],
      ['Poslar', 'Radimo. Koja je godina i koliko ima kilometara?'],
      ['Mušterija', '2016., oko 178 tisuća, OS 884 IL. Servisna je uredna.'],
      ['Poslar', 'Za pregled i procjenu imamo slobodno sutra u 10:00. Ponesite servisnu i oba ključa. Odgovara li Vam?'],
      ['Mušterija', 'Odgovara, hvala.'],
      ['Poslar', 'Upisano: sutra u 10:00, pregled za otkup Passata OS-884-IL. Doviđenja.'],
    ],
  },
  detail: {
    client: { first: 'Robert', last: 'Herceg', phone: '+385 91 815 2201', city: 'Zagreb' },
    asset: { id: 'ZG-3381-RH', make: 'Mercedes-Benz', model: 'C 220d', year: 2020, fuel: 'diesel' },
    complaint: 'Poliranje i keramička zaštita, crni lak s puno ogrebotina od pranja.',
    slot: [2, 8, 0, 480],
    summary: 'Robert Herceg: Mercedes C 220d, crni lak s ogrebotinama od pranja. Želi poliranje i keramiku. Auto ostavlja prekosutra u 8:00 za cijeli dan.',
    talk: [
      ['Poslar', 'Dobar dan, Sjaj Detailing, ovdje Poslar. Majstor trenutno polira, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Htio bih poliranje i keramiku, crni Mercedes, pun je ogrebotina od praonice.'],
      ['Poslar', 'Za korekciju laka i keramiku auto ostaje cijeli dan. Prvi slobodan dan je prekosutra od 8:00. Može registracija?'],
      ['Mušterija', 'ZG 3381 RH. Prekosutra mi odgovara.'],
      ['Poslar', 'Upisano: prekosutra u 8:00, poliranje i keramika za ZG-3381-RH. Majstor će Vam potvrditi cijenu nakon pregleda laka. Doviđenja.'],
    ],
  },
  electric: {
    client: { first: 'Nada', last: 'Mikulić', phone: '+385 98 815 3302', city: 'Rijeka' },
    site: { kind: 'flat', address: 'Vukovarska 44', city: 'Rijeka', postal_code: '51000', access_notes: '1. kat, zvono Mikulić.', lat: 45.3369, lng: 14.4307 },
    asset: { type: 'electrical', id: 'Stan Vukovarska 44', model: 'Kuhinja i dnevni boravak' },
    complaint: 'Iskače FID kad se uključi pećnica.',
    slot: [1, 10, 0, 90],
    summary: 'Nada Mikulić: iskače FID sklopka čim uključi pećnicu, traje tri dana. Stan na 1. katu, Vukovarska 44, Rijeka. Termin sutra u 10:00.',
    talk: [
      ['Poslar', 'Dobar dan, Elektro Kvarner, ovdje Poslar. Majstor je na terenu, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Iskače mi FID čim upalim pećnicu.'],
      ['Poslar', 'Isključite pećnicu iz utičnice ili osigurač za pećnicu do dolaska majstora. Od kada to traje i koja je adresa?'],
      ['Mušterija', 'Tri dana. Vukovarska 44, prvi kat.'],
      ['Poslar', 'Upisano: sutra u 10:00, traženje kvara na Vukovarskoj 44. Majstor će Vam javiti kad krene. Doviđenja.'],
    ],
  },
  appliance: {
    client: { first: 'Vesna', last: 'Radić', phone: '+385 95 815 4403', city: 'Osijek' },
    site: { kind: 'flat', address: 'Reisnerova 17', city: 'Osijek', postal_code: '31000', access_notes: '3. kat, nema lifta.', lat: 45.5545, lng: 18.6870 },
    asset: { type: 'washer', id: 'Kupaonica', make: 'Samsung', model: 'WW80T534DAW', year: 2021 },
    complaint: 'Perilica jako lupa na centrifugi, na zaslonu UE.',
    slot: [1, 13, 0, 60],
    summary: 'Vesna Radić: Samsung perilica lupa na centrifugi, na zaslonu UE. Kupljena 2021. Reisnerova 17, 3. kat bez lifta. Termin sutra u 13:00.',
    talk: [
      ['Poslar', 'Dobar dan, Servis Bijela tehnika Ban, ovdje Poslar. Serviser je kod mušterije, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Perilica mi strašno lupa kad centrifugira, piše UE.'],
      ['Poslar', 'UE obično znači neuravnotežen bubanj, ali lupanje može biti i ležaj. Koja je marka i koliko je stara?'],
      ['Mušterija', 'Samsung, iz 2021. Reisnerova 17, treći kat.'],
      ['Poslar', 'Upisano: sutra u 13:00, pregled perilice na Reisnerovoj 17. Serviser će Vam javiti kad krene. Doviđenja.'],
    ],
  },
  locksmith: {
    client: { first: 'Tomislav', last: 'Bilić', phone: '+385 91 815 5504', city: 'Split' },
    site: { kind: 'flat', address: 'Put Firula 30', city: 'Split', postal_code: '21000', access_notes: 'Prizemlje, ulaz iz dvorišta.', lat: 43.5032, lng: 16.4570 },
    asset: { type: 'door_lock', id: 'Ulazna vrata', model: 'Sigurnosna vrata' },
    complaint: 'HITNO: zaključan vani, ključevi unutra.',
    urgent: true,
    slot: [0, 23, 30, 45],
    called: [0, 23, 5],
    summary: 'Tomislav Bilić: zaključan vani, ključevi ostali u stanu. Put Firula 30, prizemlje. Upozoren da treba osobna iskaznica s tom adresom. Hitni izlazak u 23:30.',
    talk: [
      ['Poslar', 'Dobar večer, Bravar Ključ 0-24, ovdje Poslar. Majstor trenutno ne može, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Zaključao sam se vani, ključevi su unutra.'],
      ['Poslar', 'Razumijem. Koja je adresa i kakva su vrata?'],
      ['Mušterija', 'Put Firula 30, prizemlje. Sigurnosna vrata.'],
      ['Poslar', 'Majstor će trebati vidjeti osobnu iskaznicu s tom adresom ili drugi dokaz da tu stanujete. Imate li je kod sebe?'],
      ['Mušterija', 'Imam, u novčaniku je.'],
      ['Poslar', 'Upisano: hitni izlazak, majstor stiže oko 23:30. Javit će Vam se kad krene. Doviđenja.'],
    ],
  },
  pool: {
    client: { first: 'Ivana', last: 'Barić', phone: '+385 95 816 3305', city: 'Zadar' },
    site: { kind: 'house', address: 'Ulica dr. Franje Tuđmana 9', city: 'Zadar', postal_code: '23000', access_notes: 'Bazen iza kuće, vrata otključana.', lat: 44.1198, lng: 15.2315 },
    asset: { type: 'swimming_pool', id: 'Bazen u vrtu', model: '8 × 4 m' },
    complaint: 'Voda zeleni, gosti dolaze u petak.',
    slot: [1, 9, 0, 90],
    summary: 'Ivana Barić: voda u bazenu zeleni, gosti u petak. Ulica dr. Franje Tuđmana 9, Zadar. Termin sutra u 9:00, šok kloriranje.',
    talk: [
      ['Poslar', 'Dobar dan, Bazeni Jadran, ovdje Poslar. Majstor je na drugom bazenu, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Bazen mi je zelen, a gosti mi dolaze u petak.'],
      ['Poslar', 'To je alga, treba šok i usis. Koja je adresa i koliki je bazen?'],
      ['Mušterija', 'Tuđmanova 9, osam na četiri metra.'],
      ['Poslar', 'Upisano: sutra u 9:00, šok kloriranje na Tuđmanovoj 9. Majstor će Vam javiti kad krene. Doviđenja.'],
    ],
  },
  clean: {
    client: { first: 'Luka', last: 'Grgić', phone: '+385 91 817 4406', city: 'Dubrovnik' },
    site: { kind: 'apartment', address: 'Između polača 7', city: 'Dubrovnik', postal_code: '20000', access_notes: '1. kat, sef za ključ, šifra 0704.', lat: 42.6411, lng: 18.1102 },
    asset: { type: 'apartment_unit', id: 'Apartman A', model: 'Dvosobni, 4 osobe' },
    complaint: 'Gosti otišli ranije, smjena danas do 14:00.',
    urgent: true,
    slot: [0, 11, 0, 120],
    called: [0, 10, 20],
    summary: 'Luka Grgić: gosti otišli ranije, treba smjena do 14:00. Između polača 7, 1. kat, sef 0704. Dolazak u 11:00.',
    talk: [
      ['Poslar', 'Dobar dan, Čisto Jadran, ovdje Poslar. Ana je u drugom apartmanu, pa se javljam automatski. Kako Vam mogu pomoći?'],
      ['Mušterija', 'Gosti su otišli ranije, trebam čišćenje do dva, novi dolaze.'],
      ['Poslar', 'Koji apartman i imate li ključ spreman?'],
      ['Mušterija', 'Apartman A, Između polača 7. Ključ je u sefu, šifra 0704.'],
      ['Poslar', 'Upisano: dolazak u 11:00, smjena apartmana A. Javit ćemo se kad krenemo. Doviđenja.'],
    ],
  },
};

async function aiBooking(T, b) {
  const clientId = await client(T, b.client);
  let siteId = null;
  if (b.site) {
    const [s] = await q(sb.from('sites').insert({ tenant_id: T.id, client_id: clientId, ...b.site }).select('id'));
    siteId = s.id;
  }
  const assetId = await asset(T, clientId, { ...b.asset, site: siteId });
  const [day0, hour, minute, length] = b.slot;
  const start = zagrebAt(day0, hour, minute);
  const end = new Date(new Date(start).getTime() + length * 60000).toISOString();
  const called = b.called ? zagrebAt(...b.called) : new Date(Date.now() - 40 * 60000).toISOString();
  const [row] = await q(
    sb
      .from('jobs')
      .insert({
        tenant_id: T.id,
        client_id: clientId,
        asset_id: assetId,
        phase: 'intake',
        complaint: b.complaint,
        is_urgent: Boolean(b.urgent),
        source: 'phone',
        work_mode: b.site ? 'field' : 'workshop',
        site_id: siteId,
        meter_unit: b.asset.unit ?? 'km',
        scheduled_start: start,
        scheduled_end: end,
        created_by: T.owner,
        created_at: called,
        updated_at: called,
        is_demo: true,
      })
      .select('id, number')
  );
  await q(sb.from('job_events').insert({ tenant_id: T.id, job_id: row.id, event_type: 'created', message: 'Termin dogovorio Poslar na telefonu', created_at: called }));
  if (b.tow) await q(sb.from('tow_calls').insert({ tenant_id: T.id, job_id: row.id, called_at: called, ...b.tow }));
  const seconds = 60 + b.talk.length * 14;
  await q(
    sb.from('phone_calls').insert({
      tenant_id: T.id,
      provider_call_id: `seed-${randomUUID()}`,
      caller: b.client.phone,
      started_at: called,
      ended_at: new Date(new Date(called).getTime() + seconds * 1000).toISOString(),
      duration_s: seconds,
      ended_reason: 'customer-ended-call',
      summary: b.summary,
      transcript: b.talk.map(([who, text]) => `${who}: ${text}`).join('\n'),
      job_id: row.id,
      cost: 0.14,
      created_at: called,
    })
  );
  return row;
}

// ---------------------------------------------------------------------
// Super admin (optional)
// ---------------------------------------------------------------------
async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) return null;
  let user = (await allUsers()).find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Super Admin' } });
    if (error) throw new Error(`super admin: ${error.message}`);
    user = data.user;
  }
  await q(sb.from('platform_admins').upsert({ user_id: user.id }, { onConflict: 'user_id' }));
  return email;
}

// ---------------------------------------------------------------------
console.log('Poslar demo seed →', URL, ONLY.length ? `(samo: ${ONLY.join(', ')})` : '');
await cleanup();
const results = [];
for (const [name, fn] of [
  ['Volt', seedVolt],
  ['Gear', seedGear],
  ['Body', seedBody],
  ['Wheel', seedWheel],
  ['Fleet', seedFleet],
  ['Machine', seedMachine],
  ['Moto', seedMoto],
  ['Marine', seedMarine],
  ['Air', seedAir],
  ['Aqua', seedAqua],
  ['Tow', seedTow],
  ['Deal', seedDeal],
  ['Detail', seedDetail],
  ['Electric', seedElectric],
  ['Appliance', seedAppliance],
  ['Locksmith', seedLocksmith],
  ['Pool', seedPool],
  ['Clean', seedClean],
].filter(([name]) => !ONLY.length || ONLY.includes(name.toLowerCase()))) {
  process.stdout.write(`  ${name}… `);
  const result = await fn();
  if (AI_BOOKINGS[result.T.pkg]) await aiBooking(result.T, AI_BOOKINGS[result.T.pkg]);
  results.push({ name, ...result });
  console.log('✓');
}
if (SAMPLE) {
  console.log(`\nUzorne radionice za probni dan: ${results.map((r) => `uzorak-${r.T.pkg}`).join(', ')} (bez prijave).`);
  process.exit(0);
}
// One login for all of them: no workshop of its own, lands on /demo.
await createUser(`demo@${DOMAIN}`, 'Demo centar');
const admin = await seedSuperAdmin();

console.log('\nJedan račun za sve: demo@%s (lozinka %s) → Demo centar', DOMAIN, PASSWORD);
console.log('Demo računi (lozinka za sve: %s)', PASSWORD);
for (const r of results) {
  console.log(`  ${r.name.padEnd(6)} vlasnik.${r.T.pkg}@${DOMAIN}   radnik.${r.T.pkg}@${DOMAIN}`);
}
if (admin) console.log(`  Super Admin: ${admin} → ${APP_URL}/admin`);
const links = results.flatMap((r) => r.links.map((l) => `  ${r.name}: ${l}`));
if (links.length) console.log('\nPoveznice za odobrenje stranke:\n' + links.join('\n'));
