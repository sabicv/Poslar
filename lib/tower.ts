import 'server-only';
import { redirect } from 'next/navigation';
import { aiCost, aiQuota, getPlan, monthlyPrice } from '@/config/plans';
import { isGuestTenant } from '@/lib/guest';
import { allRows } from '@/lib/paged';
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
  // An open demo of a visitor (lib/guest.ts): counted with the demos, never as business.
  guest: boolean;
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
  // The workshop whose link it signed up through.
  referredBy: string | null;
  // A branch: the main workshop's name (it pays; the branch adds nothing to revenue).
  branchOf: string | null;
  // Everyone with a login, owner first (for "Nova lozinka").
  staff: { id: string; name: string; role: string; email: string | null; phone: string | null }[];
  // AI phone this month: calls and minutes (Vapi bills by the minute).
  phoneCalls: number;
  phoneMinutes: number;
}

const DAY = 86400000;

type Row = Record<string, unknown>;

// Everything the tower shows about the workshops, in one pass, read a
// page at a time (the API gives at most 1000 rows per request).
export async function loadWorkshops(): Promise<TowerWorkshop[]> {
  const admin = createAdminClient();
  const monthStart = zagrebMidnight(`${todayInZagreb().slice(0, 7)}-01`).toISOString();
  const since = new Date(Date.now() - 60 * DAY).toISOString();
  const [tenants, profiles, jobs, ai, payments, users, calls] = await Promise.all([
    allRows<Tenant>((a, b) => admin.from('tenants').select('*').order('created_at', { ascending: false }).order('id').range(a, b)),
    allRows<Row>((a, b) => admin.from('profiles').select('id, tenant_id, role, full_name, phone, created_at').order('id').range(a, b)),
    allRows<Row>((a, b) => admin.from('jobs').select('tenant_id, created_at, updated_at').gte('updated_at', since).order('id').range(a, b)),
    allRows<Row>((a, b) => admin.from('ai_usage').select('tenant_id, kind, input_tokens, output_tokens').gte('created_at', monthStart).order('id').range(a, b)),
    allRows<Row>((a, b) => admin.from('subscription_payments').select('id, tenant_id, amount, months, paid_on, note').order('paid_on', { ascending: false }).order('id').range(a, b)),
    listEmails(admin),
    allRows<Row>((a, b) => admin.from('phone_calls').select('tenant_id, duration_s').gte('created_at', monthStart).order('id').range(a, b)),
  ]);

  const now = Date.now();
  const today = todayInZagreb();
  const names = new Map(tenants.map((t) => [t.id, t.name]));
  return tenants.map((t) => {
    const staff = profiles.filter((p) => p.tenant_id === t.id);
    const ownerRow = staff.filter((p) => p.role === 'owner').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
    const mine = jobs.filter((j) => j.tenant_id === t.id);
    const last = mine.reduce<string | null>((m, j) => (!m || (j.updated_at as string) > m ? (j.updated_at as string) : m), null);
    const usage = ai.filter((a) => a.tenant_id === t.id);
    const plan = getPlan(t.plan);
    const trialLeft = t.status === 'trial' && t.trial_ends_at ? Math.ceil((new Date(t.trial_ends_at).getTime() - now) / DAY) : null;
    const signedUpDaysAgo = (now - new Date(t.created_at).getTime()) / DAY;
    const quietSince = last ? (now - new Date(last).getTime()) / DAY : signedUpDaysAgo;
    return {
      tenant: t,
      demo: (t.settings as { demo?: unknown } | null)?.demo === true || isGuestTenant(t),
      guest: isGuestTenant(t),
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
      monthly: t.main_tenant_id ? 0 : monthlyPrice(t.plan, t.billing_term, t.founder_until),
      trialLeft,
      overdue: !t.main_tenant_id && t.status === 'active' && Boolean(t.paid_until && t.paid_until < today),
      // Signed up and gone silent: two weeks without a job (three days for a brand-new one).
      quiet: t.status !== 'suspended' && (last ? quietSince > 14 : signedUpDaysAgo > 3),
      payments: payments.filter((p) => p.tenant_id === t.id).map((p) => ({ id: p.id as string, amount: Number(p.amount), months: p.months as number, paid_on: p.paid_on as string, note: (p.note as string | null) ?? null })),
      referredBy: t.referred_by ? (names.get(t.referred_by) ?? null) : null,
      branchOf: t.main_tenant_id ? (names.get(t.main_tenant_id) ?? '') : null,
      phoneCalls: calls.filter((c) => c.tenant_id === t.id).length,
      phoneMinutes: Math.round(calls.filter((c) => c.tenant_id === t.id).reduce((s, c) => s + Number(c.duration_s ?? 0), 0) / 60),
      staff: [...staff]
        .sort((a, b) => (a.role === b.role ? String(a.created_at).localeCompare(String(b.created_at)) : a.role === 'owner' ? -1 : 1))
        .map((p) => ({ id: p.id as string, name: (p.full_name as string | null) ?? '-', role: p.role as string, email: users.get(p.id as string) ?? null, phone: (p.phone as string | null) ?? null })),
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
