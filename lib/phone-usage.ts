import 'server-only';
import { PLANS, phoneQuota } from '@/config/plans';
import { allRows } from '@/lib/paged';
import { createAdminClient } from '@/lib/supabase/admin';
import { todayInZagreb, zagrebMidnight } from '@/lib/time';

type Admin = ReturnType<typeof createAdminClient>;

export interface PhoneUsage {
  used: number;
  quota: number;
  // 0 to 100 and beyond; null when nothing is included.
  pct: number | null;
}

type QuotaTenant = { id: string; plan: string | null; ai_quota: unknown; status?: string | null; settings?: unknown };

// The month's AI phone minutes: the plan's, or the tower's override (add-on
// packs included). A workshop on trial or a demo gets at least Standard's,
// like the QR door intake, so the AI secretary can be tried.
export function effectivePhoneQuota(t: QuotaTenant): number {
  const quota = phoneQuota(t.plan, t.ai_quota);
  const custom = (t.ai_quota as { phone?: unknown } | null)?.phone;
  if (typeof custom === 'number') return quota;
  const demo = (t.settings as { demo?: unknown } | null)?.demo === true;
  return t.status === 'trial' || demo ? Math.max(quota, PLANS.standard.phoneMinutes) : quota;
}

// AI phone minutes this calendar month (Zagreb), the month's total rounded
// up, against the workshop's quota.
export async function phoneUsage(admin: Admin, tenant: QuotaTenant): Promise<PhoneUsage> {
  const monthStart = zagrebMidnight(`${todayInZagreb().slice(0, 7)}-01`).toISOString();
  const calls = await allRows<{ duration_s: number | null }>((a, b) =>
    admin.from('phone_calls').select('duration_s').eq('tenant_id', tenant.id).gte('created_at', monthStart).order('id').range(a, b)
  );
  const seconds = calls.reduce((s, c) => s + Number(c.duration_s ?? 0), 0);
  const used = Math.ceil(seconds / 60);
  const quota = effectivePhoneQuota(tenant);
  return { used, quota, pct: quota > 0 ? Math.round((used / quota) * 100) : null };
}
