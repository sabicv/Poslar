import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { todayInZagreb } from '@/lib/time';
import { zip } from '@/lib/zip';

// Tjedna sigurnosna kopija: every table as JSON in one ZIP in the private
// "backups" bucket, the last KEEP kept. The tower downloads them, so a copy
// can also live away from Supabase. Not a replacement for the database's
// own backups (Supabase Pro), a second line.

type Admin = ReturnType<typeof createAdminClient>;
const BUCKET = 'backups';
const KEEP = 8;
const PAGE = 5000;

export interface BackupFile {
  name: string;
  size: number;
  created: string;
}

export async function listBackups(admin: Admin): Promise<BackupFile[]> {
  const { data } = await admin.storage.from(BUCKET).list('', { limit: 100, sortBy: { column: 'name', order: 'desc' } });
  return (data ?? [])
    .filter((f) => f.name.endsWith('.zip'))
    .map((f) => ({ name: f.name, size: Number((f.metadata as { size?: number } | null)?.size ?? 0), created: f.created_at ?? '' }));
}

export async function runBackup(admin: Admin): Promise<{ name: string; tables: number; rows: number; bytes: number }> {
  const { data: names, error } = await admin.rpc('backup_tables');
  if (error) throw new Error(`backup_tables: ${error.message}`);
  const files: { name: string; data: string }[] = [];
  let rows = 0;
  for (const table of (names ?? []) as string[]) {
    const all: unknown[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error: pageError } = await admin.rpc('backup_table', { p_table: table, p_offset: offset, p_limit: PAGE });
      if (pageError) throw new Error(`backup_table ${table}: ${pageError.message}`);
      const page = (data ?? []) as unknown[];
      all.push(...page);
      if (page.length < PAGE) break;
    }
    rows += all.length;
    files.push({ name: `${table}.json`, data: JSON.stringify(all) });
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  files.push({ name: 'README.txt', data: `Poslar, sigurnosna kopija baze ${todayInZagreb()}.\nSvaka tablica je jedna JSON datoteka (popis redaka). Datoteke (slike, PDF) nisu u kopiji; one su u Supabase Storageu.\n` });
  const archive = zip(files);
  const name = `poslar-${stamp}.zip`;
  const { error: upError } = await admin.storage.from(BUCKET).upload(name, archive, { contentType: 'application/zip', upsert: false });
  if (upError) throw new Error(`upload: ${upError.message}`);
  // The oldest go.
  const old = (await listBackups(admin)).slice(KEEP).map((f) => f.name);
  if (old.length) await admin.storage.from(BUCKET).remove(old);
  return { name, tables: files.length - 1, rows, bytes: archive.byteLength };
}

// The evening run: a new copy when the last one is a week old.
export async function weeklyBackup(admin: Admin): Promise<string | { name: string; tables: number; rows: number; bytes: number }> {
  const [last] = await listBackups(admin);
  if (last?.created && Date.now() - Date.parse(last.created) < 6.5 * 86400000) return 'not due';
  return runBackup(admin);
}

export async function backupLink(admin: Admin, name: string): Promise<string | null> {
  if (!/^poslar-[\dT-]+\.zip$/.test(name)) return null;
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(name, 300, { download: true });
  return data?.signedUrl ?? null;
}

export interface StorageUse {
  database: number;
  files: number;
  byBucket: { bucket: string; files: number; bytes: number }[];
  byWorkshop: { tenantId: string; bytes: number }[];
}

// Room taken: the database and the files, and the workshops with the most files.
export async function storageUse(admin: Admin): Promise<StorageUse> {
  const { data } = await admin.rpc('platform_storage');
  const rows = (data ?? []) as { bucket: string; files: number; bytes: number }[];
  const database = Number(rows.find((r) => r.bucket === 'database')?.bytes ?? 0);
  const buckets = rows.filter((r) => r.bucket !== 'database').map((r) => ({ bucket: r.bucket, files: Number(r.files), bytes: Number(r.bytes) }));
  // Per workshop from the app's own file list (photos and documents).
  const per = new Map<string, number>();
  for (let from = 0; from < 200000; from += 1000) {
    const { data: page } = await admin.from('attachments').select('tenant_id, size_bytes').order('id').range(from, from + 999);
    for (const a of page ?? []) per.set(a.tenant_id as string, (per.get(a.tenant_id as string) ?? 0) + Number(a.size_bytes ?? 0));
    if (!page || page.length < 1000) break;
  }
  return {
    database,
    files: buckets.reduce((s, b) => s + b.bytes, 0),
    byBucket: buckets.sort((a, b) => b.bytes - a.bytes),
    byWorkshop: [...per.entries()].map(([tenantId, bytes]) => ({ tenantId, bytes })).sort((a, b) => b.bytes - a.bytes),
  };
}
