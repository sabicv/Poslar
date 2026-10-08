import 'server-only';
import { cache } from 'react';
import type { PackageId } from '@/config/tenant.config';
import { isGuestTenant } from '@/lib/guest';
import type { WorkshopContext } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Tenant } from '@/types/db';

// Više radionica pod jednim vlasnikom (0030): the main workshop pays, its
// branches (tenants.main_tenant_id) follow its subscription. Premium
// covers up to three; people, scans, questions and phone minutes are
// counted for all of them together.

type Admin = ReturnType<typeof createAdminClient>;
export const MAX_WORKSHOPS = 3;

export interface OwnWorkshop {
  id: string;
  name: string;
  package: PackageId;
  city: string | null;
  main: boolean;
  active: boolean;
}

// The main workshop's id, for a branch or the main one itself.
export const groupId = (t: Pick<Tenant, 'id'> & { main_tenant_id?: string | null }) => t.main_tenant_id ?? t.id;

// Every workshop of the group (main first).
export async function groupTenantIds(admin: Admin, t: Pick<Tenant, 'id'> & { main_tenant_id?: string | null }): Promise<string[]> {
  const main = groupId(t);
  const { data } = await admin.from('tenants').select('id').eq('main_tenant_id', main);
  return [main, ...(data ?? []).map((r) => r.id as string)];
}

// The workshops this owner can open, the open one marked. Workers and
// owners of one workshop get one row.
export const myWorkshops = cache(async (ctx: WorkshopContext): Promise<OwnWorkshop[]> => {
  if (!ctx.isOwner) return [];
  const { data } = await createAdminClient()
    .from('profiles')
    .select('tenant:tenants(id, name, package, city, main_tenant_id, created_at)')
    .eq('id', ctx.user.id)
    .eq('role', 'owner');
  const rows = (data ?? [])
    .map((r) => r.tenant as unknown as { id: string; name: string; package: PackageId; city: string | null; main_tenant_id: string | null; created_at: string } | null)
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  return rows
    .sort((a, b) => Number(Boolean(a.main_tenant_id)) - Number(Boolean(b.main_tenant_id)) || a.created_at.localeCompare(b.created_at))
    .map((t) => ({ id: t.id, name: t.name, package: t.package, city: t.city, main: !t.main_tenant_id, active: t.id === ctx.tenant.id }));
});

// Who may add a branch: the owner of a real workshop on Premium, or on
// its 30 free days (to try it). Not the open demo, the shared demo
// workshops or the 24-hour trial on examples.
export function branchesAllowed(t: Tenant): 'ok' | 'plan' | 'demo' {
  const settings = (t.settings as { demo?: unknown } | null) ?? {};
  if (isGuestTenant(t) || settings.demo === true || t.sample_until) return 'demo';
  if (t.plan === 'premium' || t.status === 'trial') return 'ok';
  return 'plan';
}
