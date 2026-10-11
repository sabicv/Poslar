import 'server-only';
import { AI_LABELS, PLANS, aiQuota, type AiKind } from '@/config/plans';
import { GUEST_AI_TOTAL, isGuestTenant } from '@/lib/guest';
import type { WorkshopContext } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { zagrebMidnight, todayInZagreb } from '@/lib/time';
import { groupTenantIds } from '@/lib/workshops';

function monthStart(): string {
  return zagrebMidnight(`${todayInZagreb().slice(0, 7)}-01`).toISOString();
}

type QuotaTenant = { id: string; plan: string | null; ai_quota: unknown; settings?: unknown; main_tenant_id?: string | null };

// How much of this month's quota is used (all of the workshop's people
// together, and all of an owner's workshops together).
export async function aiUsageThisMonth(tenant: { id: string; main_tenant_id?: string | null }, kind: AiKind): Promise<number> {
  const admin = createAdminClient();
  const ids = await groupTenantIds(admin, tenant);
  const { count } = await admin.from('ai_usage').select('id', { count: 'exact', head: true }).in('tenant_id', ids).eq('kind', kind).gte('created_at', monthStart());
  return count ?? 0;
}

function guestTaste(): string {
  return `U demo verziji imate ${GUEST_AI_TOTAL} slikanja i odgovora, ukupno. U svojoj radionici imate od ${PLANS.basic.ai.scan} slikanja i ${PLANS.basic.ai.copilot} odgovora mjesečno, ovisno o paketu.`;
}

async function guestOwnerId(tenantId: string): Promise<string | null> {
  const { data } = await createAdminClient().from('profiles').select('id').eq('tenant_id', tenantId).eq('role', 'owner').limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

// How many of the 5 the guest login has already used. Null when this is not a guest login.
export async function guestAiUsed(userId: string): Promise<number | null> {
  const { data } = await createAdminClient().auth.admin.getUserById(userId);
  if (data.user?.app_metadata?.guest !== true) return null;
  const n = Number(data.user.app_metadata.guest_ai ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

async function noteGuestUse(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  if (data.user?.app_metadata?.guest !== true) return;
  const n = Number(data.user.app_metadata.guest_ai ?? 0);
  const used = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  await admin.auth.admin.updateUserById(userId, { app_metadata: { ...data.user.app_metadata, guest: true, guest_ai: used + 1 } });
}

// Null when there is room; otherwise the sentence to show.
export async function aiQuotaBlockFor(tenant: QuotaTenant, kind: AiKind, userId?: string | null): Promise<string | null> {
  if (isGuestTenant(tenant)) {
    const id = userId || (await guestOwnerId(tenant.id));
    const used = id ? await guestAiUsed(id) : 0;
    if ((used ?? 0) >= GUEST_AI_TOTAL) return guestTaste();
    return null;
  }
  const limit = aiQuota(tenant.plan, tenant.ai_quota, kind);
  const used = await aiUsageThisMonth(tenant, kind);
  if (used < limit) return null;
  return `${AI_LABELS[kind]}: ovaj mjesec potrošeno je svih ${limit}. Novi mjesec kreće 1. u mjesecu, a za veći paket javite se kroz „Javi problem” u Postavkama.`;
}

export async function aiQuotaBlock(ctx: WorkshopContext, kind: AiKind): Promise<string | null> {
  return aiQuotaBlockFor(ctx.tenant, kind, ctx.user.id);
}

export async function recordAiUsageFor(
  tenantId: string,
  userId: string | null,
  kind: AiKind,
  usage: { model?: string | null; input?: number; output?: number },
  countGuest = true
) {
  const admin = createAdminClient();
  await admin.from('ai_usage').insert({ tenant_id: tenantId, user_id: userId, kind, model: usage.model ?? null, input_tokens: usage.input ?? 0, output_tokens: usage.output ?? 0 });
  if (!countGuest) return;
  const { data: row } = await admin.from('tenants').select('settings').eq('id', tenantId).maybeSingle();
  if (!isGuestTenant(row)) return;
  const who = userId ?? (await guestOwnerId(tenantId));
  if (who) await noteGuestUse(who);
}

export async function recordAiUsage(
  ctx: WorkshopContext,
  kind: AiKind,
  usage: { model?: string | null; input?: number; output?: number },
  countGuest = true
) {
  await recordAiUsageFor(ctx.tenant.id, ctx.user.id, kind, usage, countGuest);
}
