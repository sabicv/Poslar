import 'server-only';
import { PLANS, phoneQuota } from '@/config/plans';
import { createAdminClient } from '@/lib/supabase/admin';
import { todayInZagreb, zagrebMidnight } from '@/lib/time';
import { groupTenantIds } from '@/lib/workshops';

type Admin = ReturnType<typeof createAdminClient>;

export interface PhoneUsage {
  used: number;
  quota: number;
  // 0 to 100 and beyond; null when nothing is included.
  pct: number | null;
}

type QuotaTenant = { id: string; plan: string | null; ai_quota: unknown; status?: string | null; settings?: unknown; main_tenant_id?: string | null };

// The month's calls Poslar takes: the plan's, or the tower's override
// (add-on packs included). A workshop on trial or a demo gets at least
// Standard's, like the QR door intake, so it can be tried.
export function effectivePhoneQuota(t: QuotaTenant): number {
  const quota = phoneQuota(t.plan, t.ai_quota);
  const custom = (t.ai_quota as { phone?: unknown } | null)?.phone;
  if (typeof custom === 'number') return quota;
  const demo = (t.settings as { demo?: unknown } | null)?.demo === true;
  return t.status === 'trial' || demo ? Math.max(quota, PLANS.standard.phoneCalls) : quota;
}

// Calls this calendar month (Zagreb) against the quota. A call lasts at
// most a minute, so a call is what a workshop counts (Vedran, 2026-10-07).
// An owner's workshops share them.
export async function phoneUsage(admin: Admin, tenant: QuotaTenant): Promise<PhoneUsage> {
  const monthStart = zagrebMidnight(`${todayInZagreb().slice(0, 7)}-01`).toISOString();
  const ids = await groupTenantIds(admin, tenant);
  const { count } = await admin.from('phone_calls').select('id', { count: 'exact', head: true }).in('tenant_id', ids).gte('created_at', monthStart);
  const used = count ?? 0;
  const quota = effectivePhoneQuota(tenant);
  return { used, quota, pct: quota > 0 ? Math.round((used / quota) * 100) : null };
}
