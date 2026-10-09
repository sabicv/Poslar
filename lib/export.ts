import 'server-only';
import { ASSET_TYPE_LABELS, getPackage, phaseLabel, type JobPhase, type PackageConfig } from '@/config/tenant.config';
import { assetTitle, clientName, formatDate, formatDateTime } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import { todayInZagreb } from '@/lib/time';
import { zip } from '@/lib/zip';
import type { Asset, Client } from '@/types/db';

// Izvoz podataka: everything a workshop has in Poslar, one ZIP for the
// owner (GDPR access and portability, and leaving with one's data). The
// rows are read with the owner's own session, so the database's access
// rules decide what goes in, never this code; the admin client only lists
// the tables and stores the finished file. Photos go in as a list with
// links valid 7 days: a workshop's photos can be gigabytes.
//
// CSV is for Excel: Croatian headers, names instead of ids, no internal
// columns. JSON keeps the raw rows for moving to another program.

const BUCKET = 'backups';
const PAGE = 1000;
const LINK_DAYS = 7;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Counters, the platform's own logs and the demo machinery: not the workshop's data.
const SKIP = new Set(['active_workshops', 'ai_usage', 'app_errors', 'help_videos', 'intake_attempts', 'platform_admins', 'registration_attempts', 'sample_map', 'sample_rows']);

const NAMES: Record<string, string> = {
  tenants: 'radionica',
  profiles: 'tim',
  clients: 'musterije',
  assets: 'vozila-i-uredaji',
  sites: 'adrese',
  jobs: 'nalozi',
  job_lines: 'stavke',
  job_line_prices: 'cijene-stavki',
  job_events: 'povijest-naloga',
  job_messages: 'poruke-na-nalogu',
  approvals: 'odobrenja',
  documents: 'racuni-i-ponude',
  attachments: 'datoteke',
  inspections: 'inspekcije',
  inspection_results: 'rezultati-inspekcija',
  maintenance_plans: 'servisni-planovi',
  meter_readings: 'ocitanja',
  reminders: 'podsjetnici',
  phone_calls: 'pozivi',
  whatsapp_messages: 'whatsapp-poruke',
  templates: 'predlosci',
  template_prices: 'cijene-predlozaka',
  price_lists: 'cjenik',
  subscription_payments: 'uplate-pretplate',
  support_tickets: 'podrska',
  support_messages: 'podrska-poruke',
  copilot_messages: 'pitaj-poslara',
};

const HIDE = new Set([
  'tenant_id',
  'is_demo',
  'sort_name',
  'settings',
  'vocabulary',
  'metadata',
  'enabled_modules',
  'ai_quota',
  'labor_rates',
  'sha256',
  'has_thumb',
  'slug',
  'domain',
  'admin_notes',
  'status_note',
  'referred_by',
  'referral_rewarded_at',
  'terms_accepted_at',
  'terms_version',
  'news_consent_at',
  'sample_until',
  'main_tenant_id',
  'paddle_customer_id',
  'paddle_subscription_id',
  'paddle_status',
  'paddle_event_at',
  'phone_agent_number_id',
  'phone_agent_number',
  'phone_forward_from',
  'logo_url',
  'path',
  'mime',
  'size_bytes',
]);

const LABELS: Record<string, string> = {
  first_name: 'Ime',
  last_name: 'Prezime',
  company_name: 'Tvrtka',
  full_name: 'Ime',
  kind: 'Vrsta',
  oib: 'OIB',
  phone: 'Telefon',
  email: 'E-mail',
  address: 'Adresa',
  city: 'Grad',
  notes: 'Bilješke',
  created_at: 'Unijeto',
  updated_at: 'Izmijenjeno',
  client_id: 'Mušterija',
  asset_id: 'Vozilo / uređaj',
  parent_asset_id: 'Nadređeno',
  job_id: 'Nalog',
  site_id: 'Adresa',
  price_list_id: 'Cjenik',
  job_line_id: 'Stavka',
  assigned_to: 'Dodijeljeno',
  created_by: 'Unio',
  technician_id: 'Radnik',
  sender_id: 'Pošiljatelj',
  receiver_id: 'Primatelj',
  actor_id: 'Tko',
  asset_type: 'Vrsta',
  identifier: 'Oznaka',
  vin: 'VIN',
  make: 'Marka',
  model: 'Model',
  variant: 'Varijanta',
  year: 'Godište',
  fuel: 'Gorivo',
  internal_number: 'Interna oznaka',
  number: 'Nalog',
  phase: 'Faza',
  complaint: 'Opis',
  diagnosis_notes: 'Dijagnoza',
  work_summary: 'Sažetak rada',
  payment_status: 'Plaćanje',
  source: 'Izvor',
  role: 'Uloga',
  name: 'Naziv',
  title: 'Naslov',
  description: 'Opis',
  qty: 'Količina',
  unit: 'Jedinica',
  unit_price: 'Cijena',
  purchase_price: 'Nabavna',
  discount_pct: 'Popust %',
  vat_rate: 'PDV %',
  priority: 'Prioritet',
  approval: 'Odobrenje',
  scheduled_start: 'Termin',
  promised_at: 'Obećano',
  paid_at: 'Plaćeno',
  finished_at: 'Završeno',
  collected_at: 'Preuzeto',
  caller: 'Pozivatelj',
  started_at: 'Početak',
  ended_at: 'Kraj',
  duration_s: 'Trajanje (s)',
  summary: 'Sažetak',
  label: 'Oznaka',
  postal_code: 'Poštanski broj',
  access_notes: 'Pristup',
  contact_name: 'Kontakt',
  contact_phone: 'Telefon kontakta',
  invoice_number: 'Račun',
  invoice_year: 'Godina računa',
  invoice_issued_at: 'Izdano',
  invoice_payment_method: 'Način plaćanja',
  work_mode: 'Način rada',
  is_urgent: 'Hitno',
  is_default: 'Zadani',
  parts_markup_pct: 'Marža dijelova %',
  version: 'Verzija',
  status: 'Status',
  claim_number: 'Broj štete',
  policy_number: 'Polica',
  loss_date: 'Datum štete',
  loss_type: 'Vrsta štete',
  assessor_name: 'Procjenitelj',
  inspected_at: 'Pregledano',
  tag: 'Oznaka',
  visibility: 'Vidljivost',
  stage: 'Faza snimke',
  zone: 'Zona',
  taken_at: 'Snimljeno',
};

const WORDS: Record<string, string> = {
  person: 'osoba',
  company: 'tvrtka',
  house: 'kuća',
  flat: 'stan',
  apartment: 'apartman',
  office: 'ured',
  commercial: 'poslovni prostor',
  other: 'ostalo',
  petrol: 'benzin',
  diesel: 'dizel',
  hybrid: 'hibrid',
  plugin: 'plug-in hibrid',
  electric: 'električni',
  lpg: 'LPG',
  cng: 'CNG',
  unpaid: 'nije plaćeno',
  paid: 'plaćeno',
  workshop: 'radionica',
  phone: 'Poslar na telefonu',
  booking: 'rezervacija online',
  qr: 's vrata',
  field: 'teren',
  fleet_request: 'vozni park',
  owner: 'voditelj',
  worker: 'radnik',
  labor: 'rad',
  part: 'dio',
  material: 'materijal',
  package: 'paket',
  sublet: 'vanjska usluga',
  fee: 'naknada',
  urgent: 'hitno',
  recommended: 'preporučeno',
  optional: 'po želji',
  proposed: 'predloženo',
  approved: 'odobreno',
  declined: 'odbijeno',
  deferred: 'odgođeno',
  cash: 'gotovina',
  card: 'kartica',
  transfer: 'virman',
  estimate: 'ponuda',
  invoice: 'račun',
  approval: 'odobrenje',
  draft: 'nacrt',
  sent: 'poslano',
  parking: 'parkiranje',
  collision: 'sudar',
  hail: 'tuča',
  customer: 'mušterija',
  internal: 'interno',
  before: 'prije',
  during: 'tijekom',
  after: 'poslije',
};

type Row = Record<string, unknown>;

type Ctx = {
  client: Map<string, string>;
  asset: Map<string, string>;
  job: Map<string, string>;
  site: Map<string, string>;
  priceList: Map<string, string>;
  person: Map<string, string>;
  line: Map<string, string>;
  pkg: PackageConfig;
};

const of = (read: { table: string; rows: Row[] }[], table: string) => read.find((r) => r.table === table)?.rows ?? [];

function context(read: { table: string; rows: Row[] }[]): Ctx {
  const clients = of(read, 'clients');
  const assets = of(read, 'assets');
  const jobs = of(read, 'jobs');
  const sites = of(read, 'sites');
  const lists = of(read, 'price_lists');
  const people = of(read, 'profiles');
  const lines = of(read, 'job_lines');
  const tenant = of(read, 'tenants')[0];
  return {
    client: new Map(clients.map((c) => [String(c.id), clientName(c as unknown as Client)])),
    asset: new Map(
      assets.map((a) => {
        const title = [a.identifier, assetTitle(a as unknown as Asset)].filter((x) => x && x !== '-').join(' · ');
        return [String(a.id), title];
      })
    ),
    job: new Map(jobs.map((j) => [String(j.id), j.number != null ? String(j.number) : ''])),
    site: new Map(sites.map((s) => [String(s.id), [s.address, s.city].filter(Boolean).join(', ')])),
    priceList: new Map(lists.map((p) => [String(p.id), String(p.name ?? '')])),
    person: new Map(people.map((p) => [String(p.id), String(p.full_name ?? '')])),
    line: new Map(lines.map((l) => [String(l.id), String(l.description ?? '')])),
    pkg: getPackage(typeof tenant?.package === 'string' ? tenant.package : null),
  };
}

function hide(table: string, key: string): boolean {
  if (HIDE.has(key) || key.endsWith('_token') || key === 'token') return true;
  if (table === 'clients' && key === 'name') return true;
  return false;
}

function when(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  return value;
}

function word(key: string, value: unknown, ctx: Ctx): unknown {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'da' : 'ne';
  if (typeof value === 'string') {
    if (key === 'phase') return phaseLabel(ctx.pkg, value as JobPhase);
    if (key === 'asset_type') return ASSET_TYPE_LABELS[value as keyof typeof ASSET_TYPE_LABELS] ?? value;
    if (WORDS[value]) return WORDS[value];
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return when(value);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

const PEOPLE = new Set(['assigned_to', 'created_by', 'technician_id', 'sender_id', 'receiver_id', 'actor_id']);

function lookup(key: string, value: unknown, ctx: Ctx): string | undefined | false {
  if (key !== 'id' && !key.endsWith('_id') && !PEOPLE.has(key)) return undefined;
  if (value == null || value === '') return '';
  const id = String(value);
  if (key === 'client_id') return ctx.client.get(id) ?? '';
  if (key === 'asset_id' || key === 'parent_asset_id') return ctx.asset.get(id) ?? '';
  if (key === 'job_id' || key === 'last_job_id') return ctx.job.get(id) ?? '';
  if (key === 'site_id') return ctx.site.get(id) ?? '';
  if (key === 'price_list_id') return ctx.priceList.get(id) ?? '';
  if (key === 'job_line_id') return ctx.line.get(id) ?? '';
  if (PEOPLE.has(key)) return ctx.person.get(id) ?? '';
  if (key === 'id' || UUID.test(id)) return false;
  return undefined;
}

function pick(row: Row, keys: string[], ctx: Ctx): Row {
  const out: Row = {};
  for (const key of keys) {
    const found = lookup(key, row[key], ctx);
    out[LABELS[key] ?? key] = found === undefined ? word(key, row[key], ctx) : found === false ? '' : found;
  }
  return out;
}

function generic(table: string, row: Row, ctx: Ctx): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (hide(table, key)) continue;
    const found = lookup(key, value, ctx);
    if (found === false) continue;
    out[LABELS[key] ?? key] = found === undefined ? word(key, value, ctx) : found;
  }
  return out;
}

function sheetRow(table: string, row: Row, ctx: Ctx): Row {
  if (table === 'clients') {
    return pick(row, ['first_name', 'last_name', 'company_name', 'kind', 'oib', 'phone', 'email', 'address', 'city', 'notes', 'price_list_id', 'created_at'], ctx);
  }
  if (table === 'assets') {
    return pick(row, ['client_id', 'identifier', 'make', 'model', 'year', 'vin', 'asset_type', 'fuel', 'internal_number', 'site_id', 'notes', 'created_at'], ctx);
  }
  if (table === 'sites') {
    return pick(row, ['client_id', 'label', 'kind', 'address', 'city', 'postal_code', 'contact_name', 'contact_phone', 'access_notes'], ctx);
  }
  if (table === 'jobs') {
    return pick(
      row,
      [
        'number',
        'client_id',
        'asset_id',
        'phase',
        'complaint',
        'payment_status',
        'source',
        'scheduled_start',
        'promised_at',
        'assigned_to',
        'is_urgent',
        'work_mode',
        'invoice_number',
        'invoice_year',
        'invoice_issued_at',
        'invoice_payment_method',
        'paid_at',
        'finished_at',
        'collected_at',
        'created_at',
      ],
      ctx
    );
  }
  if (table === 'job_lines') {
    return pick(row, ['job_id', 'kind', 'description', 'qty', 'unit', 'priority', 'approval', 'technician_id'], ctx);
  }
  if (table === 'job_line_prices') {
    return pick(row, ['job_line_id', 'unit_price', 'purchase_price', 'discount_pct', 'vat_rate'], ctx);
  }
  if (table === 'profiles') {
    return pick(row, ['full_name', 'role', 'phone'], ctx);
  }
  if (table === 'tenants') {
    return pick(row, ['name', 'oib', 'phone', 'email', 'address', 'city'], ctx);
  }
  if (table === 'price_lists') {
    return pick(row, ['name', 'discount_pct', 'parts_markup_pct', 'is_default'], ctx);
  }
  if (table === 'documents') {
    return pick(row, ['title', 'kind', 'job_id', 'sent_to', 'sent_at', 'created_at'], ctx);
  }
  if (table === 'phone_calls') {
    return pick(row, ['caller', 'started_at', 'ended_at', 'duration_s', 'summary'], ctx);
  }
  return generic(table, row, ctx);
}

function used(rows: Row[]): Row[] {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => rows.some((r) => r[k] !== '' && r[k] != null));
  return rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? ''])));
}

function csv(rows: Row[]): string {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `\uFEFF${[keys.map(cell).join(';'), ...rows.map((r) => keys.map((k) => cell(r[k])).join(';'))].join('\r\n')}\r\n`;
}

function excel(table: string, rows: Row[], ctx: Ctx): string {
  return csv(used(rows.map((r) => sheetRow(table, r, ctx))));
}

async function readAll(supabase: ServerSupabaseClient, table: string): Promise<Row[] | null> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
    if (error) return rows.length ? rows : null;
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function exportWorkshop(supabase: ServerSupabaseClient, tenantId: string, workshopName: string): Promise<string> {
  const admin = createAdminClient();
  const { data: names, error } = await admin.rpc('backup_tables');
  if (error) throw new Error(`backup_tables: ${error.message}`);
  const tables = ((names ?? []) as string[]).filter((t) => !SKIP.has(t));

  const read: { table: string; rows: Row[] }[] = [];
  for (let i = 0; i < tables.length; i += 8) {
    const batch = await Promise.all(tables.slice(i, i + 8).map(async (table) => ({ table, rows: await readAll(supabase, table) })));
    for (const { table, rows } of batch) {
      // An owner of several workshops sees only the open one here.
      const own = rows?.filter((r) => (table === 'tenants' ? r.id === tenantId : !('tenant_id' in r) || r.tenant_id === tenantId));
      if (own?.length) read.push({ table, rows: own });
    }
  }

  const ctx = context(read);
  const files: { name: string; data: string }[] = [];
  for (const { table, rows } of read) {
    const base = NAMES[table] ?? table;
    files.push({ name: `tablice/${base}.csv`, data: excel(table, rows, ctx) }, { name: `json/${base}.json`, data: JSON.stringify(rows, null, 1) });
  }

  const attachments = read.find((r) => r.table === 'attachments')?.rows ?? [];
  const paths = attachments.map((a) => a.path).filter((p): p is string => typeof p === 'string' && p.length > 0);
  const links = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 500) {
    const { data } = await supabase.storage.from('job-files').createSignedUrls(paths.slice(i, i + 500), LINK_DAYS * 86400, { download: true });
    for (const s of data ?? []) if (s.path && s.signedUrl) links.set(s.path, s.signedUrl);
  }
  if (attachments.length) {
    files.push({
      name: 'fotografije-i-datoteke.csv',
      data: csv(
        used(
          attachments.map((a) => ({
            Nalog: ctx.job.get(String(a.job_id ?? '')) ?? '',
            'Vozilo / uređaj': ctx.asset.get(String(a.asset_id ?? '')) ?? '',
            Oznaka: a.tag ?? '',
            Opis: a.caption ?? '',
            Snimljeno: when(a.taken_at ?? a.created_at),
            Datoteka: a.path,
            Poveznica: links.get(a.path as string) ?? '',
          }))
        )
      ),
    });
  }

  const today = todayInZagreb();
  const until = new Date(Date.now() + LINK_DAYS * 86400000).toISOString().slice(0, 10);
  files.unshift({
    name: 'PROCITAJ.txt',
    data: [
      `Poslar, izvoz podataka radionice ${workshopName}, ${today}.`,
      '',
      'tablice/  Svaka tablica kao CSV za Excel (točka-zarez, UTF-8): stupci na hrvatskom, bez internog šuma.',
      'json/     Iste tablice potpuno, za prijenos u drugi program.',
      attachments.length
        ? `fotografije-i-datoteke.csv  Popis svih fotografija i datoteka s poveznicom za preuzimanje. Poveznice vrijede do ${until}; nakon toga napravite novi izvoz.`
        : 'Radionica nema fotografija ni datoteka.',
      '',
    ].join('\r\n'),
  });

  const archive = zip(files, new Date(), { compress: true });
  const folder = `izvoz/${tenantId}`;
  const { data: old } = await admin.storage.from(BUCKET).list(folder, { limit: 100 });
  if (old?.length) await admin.storage.from(BUCKET).remove(old.map((f) => `${folder}/${f.name}`));
  const name = `${folder}/poslar-izvoz-${today}-${Date.now()}.zip`;
  const { error: upError } = await admin.storage.from(BUCKET).upload(name, archive, { contentType: 'application/zip', upsert: false });
  if (upError) throw new Error(`upload: ${upError.message}`);
  const { data: link } = await admin.storage.from(BUCKET).createSignedUrl(name, 600, { download: `poslar-izvoz-${today}.zip` });
  if (!link?.signedUrl) throw new Error('signed url');
  return link.signedUrl;
}
