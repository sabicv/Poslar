import 'server-only';
import { AI_LABELS, aiQuota, type AiKind } from '@/config/plans';
import type { WorkshopContext } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { zagrebMidnight, todayInZagreb } from '@/lib/time';

function monthStart(): string {
  return zagrebMidnight(`${todayInZagreb().slice(0, 7)}-01`).toISOString();
}

// How much of this month's quota is used (all of the workshop's people together).
export async function aiUsageThisMonth(tenantId: string, kind: AiKind): Promise<number> {
  const { count } = await createAdminClient().from('ai_usage').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('kind', kind).gte('created_at', monthStart());
  return count ?? 0;
}

// Null when there is room; otherwise the sentence to show.
export async function aiQuotaBlock(ctx: WorkshopContext, kind: AiKind): Promise<string | null> {
  const limit = aiQuota(ctx.tenant.plan, ctx.tenant.ai_quota, kind);
  const used = await aiUsageThisMonth(ctx.tenant.id, kind);
  if (used < limit) return null;
  return `${AI_LABELS[kind]}: ovaj mjesec potrošeno je svih ${limit}. Novi mjesec kreće 1. u mjesecu, a za veći paket javite se kroz „Javi problem” u Postavkama.`;
}

export async function recordAiUsage(ctx: WorkshopContext, kind: AiKind, usage: { model?: string | null; input?: number; output?: number }) {
  await createAdminClient()
    .from('ai_usage')
    .insert({ tenant_id: ctx.tenant.id, user_id: ctx.user.id, kind, model: usage.model ?? null, input_tokens: usage.input ?? 0, output_tokens: usage.output ?? 0 });
}
