import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;

// Storage has no folders to delete: every file under the prefix goes, a
// page of 1000 at a time (a failed removal stops it, never loops).
async function removeFolder(admin: Admin, bucket: string, prefix: string, depth = 0): Promise<void> {
  if (depth > 4) return;
  for (let round = 0; round < 50; round++) {
    const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    if (!data?.length) return;
    const files = data.filter((o) => o.id).map((o) => `${prefix}/${o.name}`);
    for (const folder of data.filter((o) => !o.id)) await removeFolder(admin, bucket, `${prefix}/${folder.name}`, depth + 1);
    if (files.length) {
      const { error } = await admin.storage.from(bucket).remove(files);
      if (error) return;
    }
    if (data.length < 1000) return;
  }
}

// A whole workshop: files first, then the workshop (its rows go with it;
// a main workshop takes its branches along), then its people's logins.
// A tower account keeps its login, and so does anyone who still belongs
// to another workshop. The caller decides whether this workshop may go.
export async function deleteWorkshop(admin: Admin, tenantId: string, keepUserIds: readonly string[] = []): Promise<string | null> {
  const { data: branches } = await admin.from('tenants').select('id').eq('main_tenant_id', tenantId);
  const going = [tenantId, ...(branches ?? []).map((b) => b.id as string)];
  const [{ data: people }, { data: tower }] = await Promise.all([admin.from('profiles').select('id').in('tenant_id', going), admin.from('platform_admins').select('user_id')]);
  const keep = new Set([...(tower ?? []).map((r) => r.user_id as string), ...keepUserIds]);
  for (const id of going) for (const bucket of ['job-files', 'branding']) await removeFolder(admin, bucket, id);
  const { error } = await admin.from('tenants').delete().eq('id', tenantId);
  if (error) return error.message;
  for (const id of new Set((people ?? []).map((p) => p.id as string))) {
    if (keep.has(id)) continue;
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', id);
    if (!count) await admin.auth.admin.deleteUser(id);
  }
  return null;
}
