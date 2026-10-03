import 'server-only';
import { AI_LABELS, aiQuota, type AiKind } from '@/config/plans';
import type { WorkshopContext } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { zagrebMidnight, todayInZagreb } from '@/lib/time';

function monthStart(): string {
  return zagrebMidnight(`${todayInZagreb().slice(0, 7)}-01`).toISOString();
}

type QuotaTenant = { id: string; plan: string | null; ai_quota: unknown };

// How much of this month's quota is used (all of the workshop's people together).
export async function aiUsageThisMonth(tenantId: string, kind: AiKind): Promise<number> {
  const { count } = await createAdminClient().from('ai_usage').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('kind', kind).gte('created_at', monthStart());
  return count ?? 0;
}

// Null when there is room; otherwise the sentence to show.
export async function aiQuotaBlockFor(tenant: QuotaTenant, kind: AiKind): Promise<string | null> {
  const limit = aiQuota(tenant.plan, tenant.ai_quota, kind);
  const used = await aiUsageThisMonth(tenant.id, kind);
  if (used < limit) return null;
  return `${AI_LABELS[kind]}: ovaj mjesec potrošeno je svih ${limit}. Novi mjesec kreće 1. u mjesecu, a za veći paket javite se kroz „Javi problem” u Postavkama.`;
}

export async function aiQuotaBlock(ctx: WorkshopContext, kind: AiKind): Promise<string | null> {
  return aiQuotaBlockFor(ctx.tenant, kind);
}

export async function recordAiUsageFor(tenantId: string, userId: string | null, kind: AiKind, usage: { model?: string | null; input?: number; output?: number }) {
  await createAdminClient()
    .from('ai_usage')
    .insert({ tenant_id: tenantId, user_id: userId, kind, model: usage.model ?? null, input_tokens: usage.input ?? 0, output_tokens: usage.output ?? 0 });
}

export async function recordAiUsage(ctx: WorkshopContext, kind: AiKind, usage: { model?: string | null; input?: number; output?: number }) {
  await recordAiUsageFor(ctx.tenant.id, ctx.user.id, kind, usage);
}
