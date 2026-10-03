import 'server-only';
import { redirect } from 'next/navigation';
import { aiCost, aiQuota, getPlan, monthlyPrice } from '@/config/plans';
import { isPlatformAdmin } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { todayInZagreb, zagrebMidnight } from '@/lib/time';
import type { Tenant } from '@/types/db';

export async function requireTower() {
  if (!(await isPlatformAdmin())) redirect('/app');
  return createAdminClient();
}

export interface TowerWorkshop {
  tenant: Tenant;
  demo: boolean;
  owner: { name: string; email: string | null; phone: string | null } | null;
  people: number;
  overLimit: boolean;
  jobs30: number;
  lastActivity: string | null;
  ai: { scan: number; copilot: number; scanQuota: number; copilotQuota: number; cost: number };
  monthly: number;
  trialLeft: number | null;
  overdue: boolean;
  quiet: boolean;
  payments: { id: string; amount: number; months: number; paid_on: string; note: string | null }[];
}

const DAY = 86400000;

// Everything the tower shows about the workshops, in one pass. Small
// numbers for now (dozens of workshops); paged queries when that changes.
export async function loadWorkshops(): Promise<TowerWorkshop[]> {
  const admin = createAdminClient();
  const monthStart = zagrebMidnight(`${todayInZagreb().slice(0, 7)}-01`).toISOString();
  const since = new Date(Date.now() - 60 * DAY).toISOString();
  const [{ data: tenants }, { data: profiles }, { data: jobs }, { data: ai }, { data: payments }, users] = await Promise.all([
    admin.from('tenants').select('*').order('created_at', { ascending: false }),
    admin.from('profiles').select('id, tenant_id, role, full_name, phone, created_at'),
    admin.from('jobs').select('tenant_id, created_at, updated_at').gte('updated_at', since).limit(20000),
    admin.from('ai_usage').select('tenant_id, kind, input_tokens, output_tokens').gte('created_at', monthStart).limit(50000),
    admin.from('subscription_payments').select('id, tenant_id, amount, months, paid_on, note').order('paid_on', { ascending: false }),
    listEmails(admin),
  ]);

  const now = Date.now();
  const today = todayInZagreb();
  return ((tenants ?? []) as Tenant[]).map((t) => {
    const staff = (profiles ?? []).filter((p) => p.tenant_id === t.id);
    const ownerRow = staff.filter((p) => p.role === 'owner').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
    const mine = (jobs ?? []).filter((j) => j.tenant_id === t.id);
    const last = mine.reduce<string | null>((m, j) => (!m || (j.updated_at as string) > m ? (j.updated_at as string) : m), null);
    const usage = (ai ?? []).filter((a) => a.tenant_id === t.id);
    const plan = getPlan(t.plan);
    const trialLeft = t.status === 'trial' && t.trial_ends_at ? Math.ceil((new Date(t.trial_ends_at).getTime() - now) / DAY) : null;
    const signedUpDaysAgo = (now - new Date(t.created_at).getTime()) / DAY;
    const quietSince = last ? (now - new Date(last).getTime()) / DAY : signedUpDaysAgo;
    return {
      tenant: t,
      demo: (t.settings as { demo?: unknown } | null)?.demo === true,
      owner: ownerRow ? { name: (ownerRow.full_name as string | null) ?? '', email: users.get(ownerRow.id as string) ?? null, phone: (ownerRow.phone as string | null) ?? t.phone } : null,
      people: staff.length,
      overLimit: staff.length - 1 > plan.workers,
      jobs30: mine.filter((j) => now - new Date(j.created_at as string).getTime() < 30 * DAY).length,
      lastActivity: last,
      ai: {
        scan: usage.filter((u) => u.kind === 'scan').length,
        copilot: usage.filter((u) => u.kind === 'copilot').length,
        scanQuota: aiQuota(t.plan, t.ai_quota, 'scan'),
        copilotQuota: aiQuota(t.plan, t.ai_quota, 'copilot'),
        cost: usage.reduce((s, u) => s + aiCost(Number(u.input_tokens), Number(u.output_tokens)), 0),
      },
      monthly: monthlyPrice(t.plan, t.billing_term),
      trialLeft,
      overdue: t.status === 'active' && Boolean(t.paid_until && t.paid_until < today),
      // Signed up and gone silent: two weeks without a job (three days for a brand-new one).
      quiet: t.status !== 'suspended' && (last ? quietSince > 14 : signedUpDaysAgo > 3),
      payments: (payments ?? []).filter((p) => p.tenant_id === t.id).map((p) => ({ id: p.id as string, amount: Number(p.amount), months: p.months as number, paid_on: p.paid_on as string, note: (p.note as string | null) ?? null })),
    };
  });
}

async function listEmails(admin: ReturnType<typeof createAdminClient>): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) if (u.email) map.set(u.id, u.email);
    if (data.users.length < 1000) break;
  }
  return map;
}

export async function towerCounts() {
  const admin = createAdminClient();
  const [{ count: tickets }, { count: errors }] = await Promise.all([
    admin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    admin.from('app_errors').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ]);
  return { tickets: tickets ?? 0, errors: errors ?? 0 };
}
