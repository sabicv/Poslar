// npm run db:seed — creates one demo workshop per package (Volt, Gear,
// Body, Wheel, Fleet, Moto, Air), each with an owner and a worker account,
// customers, vehicles/machines/boats, work orders in every phase with
// priced lines, inspections, condition reports, package records (tyre
// hotel, DTC findings, paint recipes, field jobs, seasonal protocols) and
// generated placeholder photos with thumbnails.
//
// Safe to re-run: every demo-* workshop and its files are deleted first;
// the @demo.xfiles.hr accounts are kept and reset, so a tester stays
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
const DOMAIN = 'demo.xfiles.hr';
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

// Only the six demo workshops this script made (exact slug + demo flag),
// never a real workshop whose name happens to start with "Demo".
const DEMO_SLUGS = ['volt', 'gear', 'body', 'wheel', 'fleet', 'moto', 'air'].map((p) => `demo-${p}`);

async function cleanup() {
  const tenants = await q(sb.from('tenants').select('id').in('slug', DEMO_SLUGS).eq('settings->>demo', 'true'));
  const ids = tenants.map((t) => t.id);
  if (ids.length) {
    const files = await q(sb.from('attachments').select('path, has_thumb').in('tenant_id', ids));
    const paths = files.flatMap((f) => (f.has_thumb ? [f.path, `${f.path}.thumb.jpg`] : [f.path]));
    for (let i = 0; i < paths.length; i += 100) await sb.storage.from('job-files').remove(paths.slice(i, i + 100));
  }
  // The demo accounts themselves stay (same id, so whoever is testing stays
  // signed in through a reset); only strays in the demo domain go.
  const keep = new Set([`demo@${DOMAIN}`, ...DEMO_SLUGS.flatMap((s) => [`vlasnik.${s.slice(5)}@${DOMAIN}`, `radnik.${s.slice(5)}@${DOMAIN}`])]);
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
  const attrs = { email_confirm: true, user_metadata: { full_name: fullName }, app_metadata: { demo: true } };
  const known = existingUsers.get(email.toLowerCase());
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
  const ownerUser = await createUser(`vlasnik.${pkg}@${DOMAIN}`, owner);
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
  await q(sb.from('tenants').update({ slug: `demo-${pkg}`, address, email: `info@${pkg}.${DOMAIN}`, settings: { demo: true } }).eq('id', tenantId));
  const workerUser = await createUser(`radnik.${pkg}@${DOMAIN}`, worker);
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

  const events = [{ event_type: 'created', message: `Nalog ${row.number} otvorio/la ${T.ownerName}`, created_at: created, actor_id: T.owner }];
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
  <text x="70" y="840" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#ffffff" fill-opacity="0.55">DEMO · X-Files</text>
</svg>`;
  const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 76 }).toBuffer();
  const thumb = await sharp(jpg).resize(360).jpeg({ quality: 70 }).toBuffer();
  const filePath = `${T.id}/${jobId}/${randomUUID()}.jpg`;
  const bucket = sb.storage.from('job-files');
  const up = await bucket.upload(filePath, jpg, { contentType: 'image/jpeg' });
  if (up.error) throw new Error(`upload: ${up.error.message}`);
  await bucket.upload(`${filePath}.thumb.jpg`, thumb, { contentType: 'image/jpeg' });
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

async function conditionReport(T, jobId, { diagram = 'car', marks = [], equipment = [], fuel = '1/2', d = 1 }) {
  await q(
    sb.from('condition_reports').insert({
      tenant_id: T.id,
      job_id: jobId,
      kind: 'intake',
      diagram,
      marks,
      equipment: equipment.map(([item, present]) => ({ item, present })),
      fuel_level: fuel,
      staff_id: T.worker,
      created_at: at(d, 8, 40),
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
    complaint: 'Akumulator se prazni — preko noći, dvaput palio s kablovima',
    diagnosis: 'Nakon zaključavanja 850 mA, nakon 45 min i dalje 205 mA. Vađenjem F23 pada na 38 mA — krug kuke za prikolicu.',
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
  await conditionReport(T, j1.id, { marks: [{ zone: 'rear_bumper', code: 'O' }, { zone: 'door_fl', code: 'U' }], equipment: [['Ključevi', true], ['Daljinski', true], ['Dokumenti vozila', true], ['Punjač / kabel', false]], fuel: '1/4' });
  await photo(T, j1.id, { label: 'Stanje pri prijemu', sub: 'ZG-1234-AB · Golf 7', tag: 'intake', hue: 210 });
  await photo(T, j1.id, { label: 'Strujna kliješta — 850 mA', sub: 'Početno mjerenje nakon zaključavanja', tag: 'meter', hue: 190 });
  await messages(T, j1.id, 'F23 ne piše u shemi — što je na tom osiguraču kod Golfa 7?', 'Kad nađeš krivca, slikaj modul i javi prije zamjene.');
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
  await photo(T, j3.id, { label: 'Alternator — ripple 820 mV', sub: 'Osciloskop, diode', tag: 'scope', hue: 20 });

  const j4 = await job(T, {
    client: c4,
    asset: a4,
    phase: 'ready',
    d: 4,
    meter: 132010,
    complaint: 'Ključ / imobilizator — izgubljen jedan ključ, treba novi',
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
    complaint: 'Svjetla — kratka svjetla desno ne rade',
    summary: 'Zamijenjena žarulja H7 i konektor fara.',
    lines: [
      { d: 'Dijagnostika i popravak', qty: 0.7, price: 55 },
      { kind: 'part', d: 'Žarulja H7 i konektor', price: 24 },
    ],
  });
  const [s6] = await q(sb.from('volt_scans').insert({ tenant_id: T.id, job_id: j6.id, kind: 'initial', scanned_at: at(75, 9), created_by: T.worker }).select('id'));
  await q(
    sb.from('volt_dtc_findings').insert({ tenant_id: T.id, scan_id: s6.id, job_id: j6.id, module: 'BCM', code: 'U0140', status: 'stored', cleared: true, confirmed_cause: 'Nizak napon nakon pražnjenja akumulatora — BCM zapamtio grešku' })
  );
  await job(T, { client: c2, asset: a2, phase: 'collected', paid: true, d: 130, meter: 201500, complaint: 'Klima ne radi', lines: [{ d: 'Dijagnostika klime', qty: 1, price: 55 }, { kind: 'part', d: 'Relej kompresora', price: 28 }] });
  await job(T, { client: c3, asset: a3, phase: 'collected', paid: false, d: 9, meter: 161200, complaint: 'Naknadna ugradnja kamere za vožnju unatrag', lines: [{ d: 'Ugradnja kamere i povezivanje', qty: 3, price: 55 }, { kind: 'part', d: 'Kamera s nosačem', price: 145 }] });
  await job(T, { client: c2, asset: a2, phase: 'intake', d: 0, meter: 214650, complaint: 'Podizači, centralno, komfor — prednji desni podizač ne radi', assigned: false });
  return { T, links: [voltLink] };
}

// ---------------------------------------------------------------------
// GEAR — automehanika
// ---------------------------------------------------------------------
const GEAR_UNITS = { g02: '°C', g11: 'V', g16: 'mm', g18: 'mm', g23: '%', g32: 'mm', g33: 'bar', g34: 'god.', g47: '°C' };
const GEAR_LABELS = {
  g11: 'Akumulator — napon mirovanja',
  g16: 'Prednje pločice',
  g18: 'Stražnje pločice ili obloge',
  g23: 'Kočiona tekućina — udio vode',
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
  const [svc] = await q(sb.from('job_lines').insert({ tenant_id: T.id, job_id: j1.id, sort: sort++, kind: 'labor', description: 'Mali servis — zamjena ulja i filtera', qty: 0.6, unit: 'h', approval: 'approved', source: 'template', template_code: 'gear.small_service' }).select('id'));
  await q(sb.from('job_line_prices').insert({ job_line_id: svc.id, tenant_id: T.id, unit_price: 45 }));
  await photo(T, j1.id, { label: 'Stražnje pločice 2,1 mm', sub: 'Nalaz inspekcije · Hitno', tag: 'inspection', hue: 0, customer: true, d: 0 });
  await photo(T, j1.id, { label: 'Manžeta poluosovine', sub: 'Napuknuta — lijeva unutarnja', tag: 'inspection', hue: 30, customer: true, d: 0 });
  await conditionReport(T, j1.id, { marks: [{ zone: 'front_bumper', code: 'K' }], equipment: [['Ključevi', true], ['Dokumenti vozila', true], ['Servisna knjižica', true], ['Rezervni kotač', true]], fuel: '1/2', d: 0 });
  const gearLink = await approvalLink(T, j1.id);
  await messages(T, j1.id, 'Za Astru nema diskova straga na stanju — naručiti ili pričekati odobrenje?', 'Pošalji stranci poveznicu, pa naruči tek odobreno.');

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
    complaint: 'Remen razvoda — po servisnom planu',
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

  const j1 = await job(T, { client: c1, asset: a1, phase: 'diagnosis', d: 0, complaint: 'Parkiranje — udaren prednji branik i blatobran', meter: 45200 });
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
  await conditionReport(T, j1.id, { marks: [{ zone: 'front_bumper', code: 'P' }, { zone: 'fender_fl', code: 'U' }, { zone: 'headlight_l', code: 'O' }], equipment: [['Ključevi', true], ['Dokumenti vozila', true], ['Europsko izvješće o nezgodi', false], ['Polica osiguranja', true]], fuel: '3/4', d: 0 });

  const j2 = await job(T, {
    client: c2,
    asset: a2,
    phase: 'in_progress',
    d: 6,
    meter: 156300,
    complaint: 'Sudar — stražnji dio, osiguranje',
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
  await photo(T, j2.id, { label: 'Stražnji branik — lom', sub: 'Prije · za osiguranje', tag: 'damage', stage: 'before', hue: 350, customer: true, d: 6 });
  await photo(T, j2.id, { label: 'Probna pločica LC9X', sub: 'Usporedba pod dnevnim svjetlom', tag: 'test_panel', stage: 'during', hue: 240, d: 1 });
  await messages(T, j2.id, 'Nijansa na peti vratima malo svjetlija — prijelaz na blatobran?', 'Da, prijelaz na desni stražnji blatobran. Upiši u Lakirnicu.');

  const j3 = await job(T, { client: c3, asset: a3, phase: 'awaiting_approval', d: 4, meter: 23100, complaint: 'Tuča — krov i hauba', lines: [{ d: 'PDR — izvlačenje udubljenja bez lakiranja', qty: 9, price: 50 }] });
  await q(sb.from('body_estimates').insert({ tenant_id: T.id, job_id: j3.id, version: 1, status: 'sent', insurer_id: insurers[1].id, claim_number: 'KS-26-10277', loss_type: 'hail', loss_date: day(-6) }));
  await photo(T, j3.id, { label: 'Krov — tuča', sub: '38 udubljenja', tag: 'damage', stage: 'before', hue: 200, customer: true, d: 4 });

  await job(T, { client: c4, asset: a4, phase: 'ready', d: 5, meter: 98100, complaint: 'Poliranje / zaštita', summary: 'Poliranje u tri koraka, keramička zaštita.', lines: [{ d: 'Poliranje i zaštita laka', qty: 4, price: 40 }, { kind: 'material', d: 'Paste i zaštita', price: 35 }] });
  await job(T, { client: c1, asset: a1, phase: 'collected', paid: true, d: 48, meter: 41000, complaint: 'Vandalizam — ogreben bok', lines: [{ d: 'Priprema i lakiranje dvaju dijelova', qty: 5.5, price: 42 }, { kind: 'material', d: 'Materijal za lakiranje', price: 140 }] });
  await job(T, { client: c2, asset: a2, phase: 'collected', paid: true, d: 95, meter: 149000, complaint: 'Divljač — prednji dio', lines: [{ d: 'Limarski radovi i lakiranje', qty: 11, price: 42 }, { kind: 'part', d: 'Prednji branik i rešetka', price: 520 }] });
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
  await photo(T, j1.id, { label: 'Zimske — šara 6,8 mm', sub: 'OS-112-KT · izmjereno', tag: 'tire', hue: 200, d: 0 });

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

  const j3 = await job(T, { client: p2.c, asset: p2.a, phase: 'ready', d: 1, meter: 64200, complaint: 'Krpanje gume — čavao', lines: [{ d: 'Krpanje gume (gazeći sloj)', unit: 'paušal', price: 15 }] });
  await q(sb.from('wheel_repairs').insert({ tenant_id: T.id, job_id: j3.id, position: 'RL', damage_zone: 'tread', method: 'combo' }));
  const j4 = await job(T, { client: p4.c, asset: p4.a, phase: 'intake', d: 0, meter: 39800, complaint: 'Guma probušena — bok', assigned: false, urgent: true });
  await q(sb.from('wheel_repairs').insert({ tenant_id: T.id, job_id: j4.id, position: 'FR', damage_zone: 'sidewall' }));
  await photo(T, j4.id, { label: 'Oštećenje boka', sub: 'Nije popravljivo — nova guma', tag: 'damage', hue: 5, customer: true, d: 0 });
  await job(T, { client: p5.c, asset: p5.a, phase: 'collected', paid: true, d: 12, meter: 71000, complaint: 'Sezonska zamjena', lines: [{ d: 'Skidanje i montaža 4 kotača', unit: 'paušal', price: 30 }, { d: 'Balansiranje 4 kotača', unit: 'paušal', price: 20 }] });
  await job(T, { client: p6.c, asset: p6.a, phase: 'collected', paid: true, d: 40, meter: 52300, complaint: 'Nove gume', lines: [{ kind: 'part', d: 'Guma 205/55 R16 91V', qty: 4, price: 89, buy: 64 }, { d: 'Montaža i balansiranje', unit: 'paušal', price: 40 }] });
  await job(T, { client: p2.c, asset: p2.a, phase: 'collected', paid: true, d: 170, meter: 58000, complaint: 'Sezonska zamjena', lines: [{ d: 'Skidanje i montaža 4 kotača', unit: 'paušal', price: 30 }, { kind: 'fee', d: 'Čuvanje seta guma', unit: 'paušal', price: 25 }] });
  await messages(T, j1.id, 'Jedan vijak sigurnosni, ključ nije u autu — što sad?', 'Nazovi stranku, imamo univerzalni set u ormaru 2.');
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// FLEET — teretni program, građevina, flote
// ---------------------------------------------------------------------
async function seedFleet() {
  const T = await workshop({ pkg: 'fleet', name: 'Servis gospodarskih vozila Perić', city: 'Sesvete', address: 'Zagrebačka 210', phone: '+385 1 555 0505', owner: 'Stjepan Perić', worker: 'Mario Bošnjak' });
  const t1 = await client(T, { company: 'Transport Horvat d.o.o.', first: 'Damir', last: 'Horvat', phone: '+385 91 600 1100', city: 'Dugo Selo', oib: '12345678903' });
  const t2 = await client(T, { company: 'Građevina Kamen d.o.o.', first: 'Siniša', last: 'Kralj', phone: '+385 98 600 2200', city: 'Vrbovec' });
  const t3 = await client(T, { company: 'Agro Slavonija d.o.o.', first: 'Zdenko', last: 'Pavić', phone: '+385 95 600 3300', city: 'Đakovo' });
  await q(
    sb.from('fleet_accounts').insert([
      { tenant_id: T.id, client_id: t1, fleet_manager_name: 'Damir Horvat', fleet_manager_phone: '+385 91 600 1100', payment_terms_days: 30, po_required: true },
      { tenant_id: T.id, client_id: t2, fleet_manager_name: 'Siniša Kralj', fleet_manager_phone: null, payment_terms_days: 45, po_required: false },
      { tenant_id: T.id, client_id: t3, fleet_manager_name: 'Zdenko Pavić', fleet_manager_phone: null, payment_terms_days: 60, po_required: false },
    ])
  );
  const truck1 = await asset(T, t1, { type: 'tractor_unit', id: 'ZG-4410-TH', make: 'MAN', model: 'TGX 18.470', year: 2020, fuel: 'diesel', internal: 'K-04', axles: '4x2', gvw: 18 });
  const truck2 = await asset(T, t1, { type: 'tractor_unit', id: 'ZG-4411-TH', make: 'Volvo', model: 'FH 500', year: 2019, fuel: 'diesel', internal: 'K-05', axles: '4x2', gvw: 18 });
  const trailer1 = await asset(T, t1, { type: 'semi_trailer', id: 'ZG-123-PR', make: 'Schmitz Cargobull', model: 'S.KO Cool', year: 2018, parent: truck1, internal: 'P-11', axles: '3 osovine' });
  const truck3 = await asset(T, t1, { type: 'truck', id: 'ZG-7702-TH', make: 'Mercedes-Benz', model: 'Atego 1224', year: 2016, fuel: 'diesel', internal: 'K-09', gvw: 12 });
  const digger = await asset(T, t2, { type: 'machine', id: 'CAT-320-0071', make: 'Caterpillar', model: '320 GC', year: 2021, unit: 'mth', vin: 'CAT0320GCXXX01234', internal: 'B-2' });
  const tractor = await asset(T, t3, { type: 'tractor', id: 'OS-T-221', make: 'John Deere', model: '6155R', year: 2019, unit: 'mth' });
  await asset(T, t3, { type: 'implement', id: 'PRS-8', make: 'Amazone', model: 'UX 5201 prskalica', year: 2020, unit: 'mth', parent: tractor });

  await q(
    sb.from('fleet_compliance_items').insert([
      { tenant_id: T.id, asset_id: truck1, kind: 'technical_inspection', valid_from: day(-355), valid_until: day(10) },
      { tenant_id: T.id, asset_id: truck1, kind: 'tachograph', valid_from: day(-733), valid_until: day(-3) },
      { tenant_id: T.id, asset_id: truck1, kind: 'fire_extinguisher', valid_from: day(-340), valid_until: day(25) },
      { tenant_id: T.id, asset_id: truck2, kind: 'technical_inspection', valid_from: day(-200), valid_until: day(165) },
      { tenant_id: T.id, asset_id: truck2, kind: 'adr', valid_from: day(-300), valid_until: day(42) },
      { tenant_id: T.id, asset_id: trailer1, kind: 'preventive_inspection', valid_from: day(-170), valid_until: day(12) },
      { tenant_id: T.id, asset_id: truck3, kind: 'technical_inspection', valid_from: day(-330), valid_until: day(35) },
      { tenant_id: T.id, asset_id: digger, kind: 'insurance', valid_from: day(-300), valid_until: day(65) },
    ])
  );
  const [plan] = await q(sb.from('fleet_pm_plans').insert({ tenant_id: T.id, name: 'PM-A kamion', interval_km: 60000, interval_days: 365, checklist_code: 'fleet.pm_a', template_code: 'fleet.pm_a' }).select('id'));
  await q(sb.from('fleet_asset_pm').insert({ tenant_id: T.id, asset_id: truck2, plan_id: plan.id, last_done_km: 402000, last_done_date: day(-300), next_due_km: 462000, next_due_date: day(65) }));

  const j1 = await job(T, { client: t2, asset: digger, phase: 'in_progress', d: 0, source: 'field', unit: 'mth', meter: 4213.5, urgent: true, complaint: 'Terenska intervencija, Hidraulika — curi crijevo na strijeli', lines: [{ kind: 'fee', d: 'Izlazak na teren', unit: 'paušal', price: 60 }, { d: 'Rad na terenu', qty: 2, price: 65 }, { kind: 'part', d: 'Hidraulično crijevo 1/2" 1,6 m (izrada)', price: 95, buy: 58 }] });
  await q(
    sb.from('fleet_field_jobs').insert({ tenant_id: T.id, job_id: j1.id, address: 'Gradilište obilaznica Vrbovec, dionica 3', lat: 45.8829, lng: 16.4213, departed_at: at(0, 7, 10), arrived_at: at(0, 7, 55), work_started: at(0, 8, 5), travel_km: 38 })
  );
  await q(sb.from('fleet_downtime').insert({ tenant_id: T.id, asset_id: digger, job_id: j1.id, from_at: at(1, 16), reason: 'breakdown' }));
  await photo(T, j1.id, { label: 'Crijevo na strijeli', sub: 'CAT 320 · teren Vrbovec', tag: 'field', hue: 40, d: 0 });

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

  await job(T, { client: t1, asset: truck3, phase: 'awaiting_parts', d: 3, meter: 612400, complaint: 'Kočnice / zrak — pada tlak u krugu 2', lines: [{ d: 'Dijagnostika zračnog sustava', qty: 1.5, price: 55 }, { kind: 'part', d: 'Ventil četverokružni zaštitni', price: 210, buy: 150 }] });
  await job(T, { client: t1, asset: trailer1, phase: 'ready', d: 2, meter: 0, complaint: 'Pregled prikolice', summary: 'Ležajevi, kočnice i svjetla pregledani, zamijenjena žarulja pozicije.', lines: [{ d: 'Pregled priključnog vozila', qty: 1.5, price: 55 }] });
  await job(T, { client: t3, asset: tractor, phase: 'collected', paid: true, d: 25, unit: 'mth', meter: 3120, complaint: 'Planski servis (PM)', lines: [{ d: 'Servis 500 mth', qty: 4, price: 55 }, { kind: 'part', d: 'Filteri i ulje', price: 310 }] });
  await job(T, { client: t1, asset: truck1, phase: 'collected', paid: false, d: 16, meter: 388200, complaint: 'Tahograf', lines: [{ d: 'Periodični pregled tahografa', unit: 'paušal', price: 120 }] });
  await job(T, { client: t1, asset: truck1, phase: 'collected', paid: true, d: 80, meter: 371000, complaint: 'Vozilo stoji — ne pali', lines: [{ d: 'Terenska intervencija i popravak', qty: 3, price: 65 }, { kind: 'part', d: 'Relej anlasera', price: 48 }] });

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
  await messages(T, j1.id, 'Na terenu nema signala za plan crijeva — koja je dimenzija spojnice?', 'JIC 3/4", fotka pločice stroja je u galeriji.');
  return { T, links: [] };
}

// ---------------------------------------------------------------------
// MOTO & MARINE
// ---------------------------------------------------------------------
async function seedMoto() {
  const T = await workshop({ pkg: 'moto', name: 'Moto & Marine Barić', city: 'Zadar', address: 'Obala kneza Branimira 8', phone: '+385 23 555 0606', owner: 'Tonći Barić', worker: 'Luka Šarić' });
  const areas = [];
  for (let s = 1; s <= 10; s++) areas.push({ tenant_id: T.id, area: 'Hala 1', slot: String(s), kind: 'hall' });
  for (let s = 1; s <= 6; s++) areas.push({ tenant_id: T.id, area: 'Otvoreno', slot: `P${s}`, kind: 'outdoor' });
  const locations = await q(sb.from('moto_storage_locations').insert(areas).select('id, area, slot'));
  const hall = locations.filter((l) => l.area === 'Hala 1').sort((a, b) => Number(a.slot) - Number(b.slot));
  const outside = locations.filter((l) => l.area === 'Otvoreno');

  const c1 = await client(T, { first: 'Frane', last: 'Perica', phone: '+385 91 700 1100', city: 'Zadar' });
  const c2 = await client(T, { first: 'Kristina', last: 'Ivić', phone: '+385 98 700 2200', city: 'Biograd na Moru' });
  const c3 = await client(T, { first: 'Šime', last: 'Vlahov', phone: '+385 95 700 3300', city: 'Sukošan' });
  const c4 = await client(T, { first: 'Petra', last: 'Mikulić', phone: '+385 99 700 4400', city: 'Zadar' });
  const m1 = await asset(T, c1, { type: 'motorcycle', id: 'ZD-445-FP', make: 'Yamaha', model: 'MT-07', year: 2020, fuel: 'petrol' });
  const m2 = await asset(T, c2, { type: 'motorcycle', id: 'ZD-990-KI', make: 'BMW', model: 'R 1250 GS', year: 2021, fuel: 'petrol' });
  const boat = await asset(T, c3, { type: 'boat', id: 'ZD-1234', make: 'Jeanneau', model: 'Cap Camarat 6.5 WA', year: 2018, vin: 'FR-JEA65412G718', unit: 'mth' });
  const engine = await asset(T, c3, { type: 'outboard', id: '6ML-1045872', make: 'Yamaha', model: 'F150 XB', year: 2018, unit: 'mth', parent: boat });
  const jet = await asset(T, c4, { type: 'jetski', id: 'ZD-JS-77', make: 'Sea-Doo', model: 'GTI SE 170', year: 2022, vin: 'YDV12345L122', unit: 'mth' });
  await q(sb.from('moto_vessel_details').insert({ asset_id: boat, tenant_id: T.id, vessel_name: 'Galeb', registration_mark: 'ZD-1234', length_m: 6.4, beam_m: 2.54, hull_material: 'grp', home_port: 'Sukošan', berth: 'Marina Dalmacija, gat C-14' }));
  await q(sb.from('moto_engine_details').insert({ asset_id: engine, tenant_id: T.id, engine_serial: '6ML-1045872', power_hp: 150, stroke: '4T', position: 'single', impeller_replaced_mth: 410, impeller_replaced_date: day(-560) }));

  const j1 = await job(T, {
    client: c3,
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
  const ins = await inspection(T, j1.id, 'moto.winterize_outboard', 'Konzervacija — vanbrodski motor', checklistCodes('winterize_outboard', 12).map((c, i) => [c, i < 7 ? 'ok' : i === 7 ? 'warn' : 'not_checked', null, i === 7 ? 'Anoda noge 60% istrošena' : null]), { d: 2 });
  await q(sb.from('moto_seasonal_protocols').insert({ tenant_id: T.id, job_id: j1.id, kind: 'winterize', inspection_id: ins.id, fuel_stabilized: true, battery_maintained: true, anodes_wear_pct: { noga: 60, trim: 35, trup: 20 } }));
  await q(sb.from('moto_storage_stays').insert({ tenant_id: T.id, asset_id: boat, location_id: outside[0].id, from_date: day(-2), until_date: day(180) }));
  await photo(T, j1.id, { label: 'Anoda noge — 60 %', sub: 'Yamaha F150 · preporuka zamjene', tag: 'part_old', hue: 185, customer: true, d: 2 });

  const j2 = await job(T, { client: c1, asset: m1, phase: 'diagnosis', d: 1, meter: 18450, complaint: 'Ne pali — stajao 3 mjeseca' });
  await conditionReport(T, j2.id, {
    diagram: 'moto',
    marks: [{ zone: 'Lijevi bočni oklop', code: 'O' }, { zone: 'Ručice kočnice i kvačila', code: 'O' }],
    equipment: [['Kaciga', true], ['Ključ', true], ['Bočni kofer', false], ['Top case', false], ['Punjač / održavač', false]],
    fuel: '1/4',
    d: 1,
  });
  await photo(T, j2.id, { label: 'Lijevi oklop — ogrebotina', sub: 'Zatečeno stanje pri prijemu', tag: 'fairing', hue: 280, d: 1 });

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
  await q(sb.from('moto_storage_stays').insert({ tenant_id: T.id, asset_id: jet, location_id: hall[0].id, from_date: day(-20), until_date: day(200), battery_checks: [{ at: at(10), v: 12.6 }] }));
  await job(T, { client: c4, asset: jet, phase: 'collected', paid: true, d: 20, unit: 'mth', meter: 142, complaint: 'Konzervacija (zimovanje)', lines: [{ kind: 'package', d: 'Konzervacija jet-skija', unit: 'paušal', price: 150 }] });
  await job(T, { client: c3, asset: engine, phase: 'collected', paid: true, d: 190, unit: 'mth', meter: 540, complaint: 'Dekonzervacija', lines: [{ kind: 'package', d: 'Dekonzervacija i test rada', unit: 'paušal', price: 120 }, { kind: 'part', d: 'Anode (komplet)', price: 64 }] });
  await job(T, { client: c1, asset: m1, phase: 'collected', paid: true, d: 140, meter: 16800, complaint: 'Redovni servis', lines: [{ d: 'Zamjena ulja i filtera, pregled', qty: 1, price: 45 }, { kind: 'part', d: 'Filter ulja', price: 14 }] });
  await messages(T, j1.id, 'Impeler je tvrd i napuknut na jednoj lopatici — mijenjamo?', 'Predloži stranci preko poveznice, cijena je u stavkama.');
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
  const pericHouse = await site(peric, { kind: 'house', address: 'Trnjanska cesta 45', city: 'Zagreb', access_notes: 'Ulaz s dvorišta, pas u dvorištu — nazvati prije dolaska.', lat: 45.7958, lng: 15.9784 });
  const pericAc = await device(peric, pericHouse, { type: 'ac_split', id: 'Spavaća soba', make: 'Mitsubishi Electric', model: 'MSZ-LN35VG', year: 2021 }, { refrigerant: 'R32', charge_kg: 1.0, cooling_kw: 3.5, install_date: '2021-05-20' });
  const pericHp = await device(peric, pericHouse, { type: 'heat_pump', id: 'Grijanje kuće', make: 'Daikin', model: 'Altherma 3 R 8 kW', year: 2020 }, { refrigerant: 'R32', charge_kg: 1.8, heating_kw: 8, install_date: '2020-10-02' });

  const bura = await client(T, { company: 'Apartmani Bura d.o.o.', first: 'Tea', last: 'Jurković', phone: '+385 95 800 3300', city: 'Samobor' });
  const buraA1 = await site(bura, { kind: 'apartment', label: 'Apartman A1', address: 'Samoborska cesta 5', city: 'Samobor', access_notes: 'Ključ u sefu uz ulaz, šifra 4471. Gosti odlaze do 10 h.', contact_name: 'Tea Jurković', contact_phone: '+385 95 800 3300' });
  const buraA2 = await site(bura, { kind: 'apartment', label: 'Apartman A2', address: 'Samoborska cesta 5', city: 'Samobor', access_notes: 'Isti sef, šifra 4471.' });
  const buraAc1 = await device(bura, buraA1, { type: 'ac_split', id: 'A1', make: 'Gree', model: 'Pular GWH12AGB', year: 2023 }, { refrigerant: 'R32', charge_kg: 0.7, cooling_kw: 3.5, install_date: '2023-05-10' });
  const buraAc2 = await device(bura, buraA2, { type: 'ac_split', id: 'A2', make: 'Gree', model: 'Pular GWH12AGB', year: 2023 }, { refrigerant: 'R32', charge_kg: 0.7, cooling_kw: 3.5, install_date: '2023-05-10' });

  const ured = await client(T, { company: 'Ured Centar d.o.o.', first: 'Goran', last: 'Šimunović', phone: '+385 1 600 7788', city: 'Zagreb', oib: '98765432106' });
  const uredSite = await site(ured, { kind: 'office', label: 'Poslovni prostor, 4. kat', address: 'Vukovarska avenija 200', city: 'Zagreb', access_notes: 'Prijava na recepciji, vanjske jedinice na krovu — ključ kod domara.', contact_name: 'Domar Ivo', contact_phone: '+385 91 600 1234' });
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
    { kind: 'package', d: 'Godišnji servis klima uređaja — 1 unutarnja jedinica', unit: 'paušal', price: 60 },
    { kind: 'material', d: 'Sredstvo za čišćenje i dezinfekciju isparivača', price: 8 },
  ];

  // Today 08:00 — Ivana Kralj: done, report sent (she was at work).
  const j1 = await job(T, {
    client: kralj,
    asset: kraljAc,
    phase: 'ready',
    d: 0,
    complaint: 'Godišnji servis klime',
    summary: 'Očišćeni filteri i isparivač, dezinficirano, odvod kondenzata protočan. Izolacija cijevi na vanjskoj jedinici oštećena od sunca — preporuka zamjene.',
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
  await photo(T, j1.id, { label: 'Isparivač — prije', sub: 'Ilica 112 · Daikin FTXP35M', tag: 'before', hue: 30, customer: true, d: 0, when: zagrebAt(0, 8, 6) });
  await photo(T, j1.id, { label: 'Isparivač — poslije', sub: 'Očišćeno i dezinficirano', tag: 'after', hue: 175, customer: true, d: 0, when: zagrebAt(0, 8, 50) });
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
  await messages(T, j2.id, 'Anoda spremnika na 35 % — imamo li zamjensku u kombiju?', 'U kombiju je jedna, uzmi je i dodaj stavku.');

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
    complaint: 'Slabo hladi — sumnja na propuštanje',
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
      { tenant_id: T.id, job_id: leakJob.id, asset_id: uredVrv, refrigerant: 'R410A', action: 'leak_check', quantity_kg: 0, leak_found: false, leak_location: null, cause: 'Kontrola nakon popravka — bez propuštanja', technician_id: T.owner, technician_cert: 'HR-FP-2021-0418', performed_at: at(324, 10) },
    ])
  );
  return { T, links: [] };
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
console.log('X-Files demo seed →', URL);
await cleanup();
const results = [];
for (const [name, fn] of [
  ['Volt', seedVolt],
  ['Gear', seedGear],
  ['Body', seedBody],
  ['Wheel', seedWheel],
  ['Fleet', seedFleet],
  ['Moto', seedMoto],
  ['Air', seedAir],
]) {
  process.stdout.write(`  ${name}… `);
  const result = await fn();
  results.push({ name, ...result });
  console.log('✓');
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
