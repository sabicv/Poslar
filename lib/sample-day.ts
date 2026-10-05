import 'server-only';
import type { PackageId } from '@/config/tenant.config';
import { GUEST_KEEP_HOURS } from '@/lib/guest';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteWorkshop } from '@/lib/workshop-delete';

// The 24-hour trial ("probni dan"): a new workshop opens as a copy of its
// trade's sample workshop (uzorak-<package>, made by `npm run db:seed --
// --uzorak`); the database copies the rows (clone_sample, 0025) and here
// the photos follow. Without a sample for the trade the workshop simply
// starts empty, on its 30 free days.

type Admin = ReturnType<typeof createAdminClient>;

export const SAMPLE_HOURS = 24;

const BUCKET = 'job-files';

// A few files at a time: fast enough, and gentle on the storage API.
async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<unknown>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    })
  );
}

export async function startSampleDay(admin: Admin, tenantId: string, pkg: PackageId): Promise<boolean> {
  const { data: source } = await admin.from('tenants').select('id').eq('slug', `uzorak-${pkg}`).eq('settings->>sample', 'true').maybeSingle();
  if (!source) return false;
  const { data: files, error } = await admin.rpc('clone_sample', { p_source: source.id, p_target: tenantId });
  if (error) {
    console.error('clone_sample', error.message);
    return false;
  }
  // A missing photo shows as an empty frame, never stops the trial.
  await eachLimited((files ?? []) as { from_path: string; to_path: string }[], 8, (f) => admin.storage.from(BUCKET).copy(f.from_path, f.to_path));
  return true;
}

// Real work from now on: the samples go, what the owner entered stays, and
// the 30 free days start today.
export async function endSampleDay(admin: Admin, tenantId: string): Promise<string | null> {
  const { data: gone, error } = await admin.rpc('end_sample', { p_tenant: tenantId });
  if (error) return error.message;
  const paths = ((gone ?? []) as { path: string }[]).map((g) => g.path);
  for (let i = 0; i < paths.length; i += 100) await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
  const trialDays = Math.max(1, Number(process.env.TRIAL_DAYS ?? 30) || 30);
  const { error: patchError } = await admin
    .from('tenants')
    .update({ trial_ends_at: new Date(Date.now() + trialDays * 86400000).toISOString() })
    .eq('id', tenantId)
    .eq('status', 'trial');
  return patchError?.message ?? null;
}

// Open demo workshops (lib/guest.ts) past their 24 hours and the review
// time after, a few at a time so no request waits long. One whose examples
// never arrived has no clock and goes after a day and a half.
export async function deleteExpiredGuests(admin: Admin, limit = 5): Promise<number> {
  const ended = new Date(Date.now() - GUEST_KEEP_HOURS * 3600000).toISOString();
  const stray = new Date(Date.now() - 36 * 3600000).toISOString();
  const [{ data: a }, { data: b }] = await Promise.all([
    admin.from('tenants').select('id').eq('settings->>guest', 'true').lt('sample_until', ended).limit(limit),
    admin.from('tenants').select('id').eq('settings->>guest', 'true').is('sample_until', null).lt('created_at', stray).limit(limit),
  ]);
  let deleted = 0;
  for (const t of [...(a ?? []), ...(b ?? [])]) if (!(await deleteWorkshop(admin, t.id as string))) deleted++;
  return deleted;
}

// Hours left of the 24, rounded up (shown in the banner).
export function sampleHoursLeft(until: string | null): number | null {
  if (!until) return null;
  const ms = new Date(until).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 3600000) : 0;
}
