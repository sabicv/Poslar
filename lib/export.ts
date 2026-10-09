import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import { todayInZagreb } from '@/lib/time';
import { zip } from '@/lib/zip';

// Izvoz podataka: everything a workshop has in Poslar, one ZIP for the
// owner (GDPR access and portability, and leaving with one's data). The
// rows are read with the owner's own session, so the database's access
// rules decide what goes in, never this code; the admin client only lists
// the tables and stores the finished file. Photos go in as a list with
// links valid 7 days: a workshop's photos can be gigabytes.

const BUCKET = 'backups';
const PAGE = 1000;
const LINK_DAYS = 7;
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

type Row = Record<string, unknown>;

function csv(rows: Row[]): string {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `\uFEFF${[keys.map(cell).join(';'), ...rows.map((r) => keys.map((k) => cell(r[k])).join(';'))].join('\r\n')}\r\n`;
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

  const files: { name: string; data: string }[] = [];
  for (const { table, rows } of read) {
    const base = NAMES[table] ?? table;
    files.push({ name: `tablice/${base}.csv`, data: csv(rows) }, { name: `json/${base}.json`, data: JSON.stringify(rows, null, 1) });
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
        attachments.map((a) => ({
          id: a.id,
          job_id: a.job_id ?? '',
          asset_id: a.asset_id ?? '',
          oznaka: a.tag ?? '',
          opis: a.caption ?? '',
          snimljeno: a.taken_at ?? a.created_at ?? '',
          sha256: a.sha256 ?? '',
          datoteka: a.path,
          poveznica: links.get(a.path as string) ?? '',
        }))
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
      'tablice/  Svaka tablica kao CSV za Excel (točka-zarez, UTF-8).',
      'json/     Iste tablice u JSON obliku, za prijenos u drugi program.',
      attachments.length
        ? `fotografije-i-datoteke.csv  Popis svih fotografija i datoteka s poveznicom za preuzimanje. Poveznice vrijede do ${until}; nakon toga napravite novi izvoz.`
        : 'Radionica nema fotografija ni datoteka.',
      '',
      'Stupci tenant_id, job_id, client_id i asset_id povezuju retke među tablicama.',
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
