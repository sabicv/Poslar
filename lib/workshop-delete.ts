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

// A whole workshop: files first, then the workshop (its rows go with it),
// then its people's logins; a tower account keeps its login. The caller
// decides whether this workshop may go.
export async function deleteWorkshop(admin: Admin, tenantId: string): Promise<string | null> {
  const [{ data: people }, { data: tower }] = await Promise.all([admin.from('profiles').select('id').eq('tenant_id', tenantId), admin.from('platform_admins').select('user_id')]);
  const keep = new Set((tower ?? []).map((r) => r.user_id as string));
  for (const bucket of ['job-files', 'branding']) await removeFolder(admin, bucket, tenantId);
  const { error } = await admin.from('tenants').delete().eq('id', tenantId);
  if (error) return error.message;
  for (const p of people ?? []) if (!keep.has(p.id as string)) await admin.auth.admin.deleteUser(p.id as string);
  return null;
}
