'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPlan, isFounder, PLAN_IDS, type PlanId } from '@/config/plans';
import { fail, type ActionResult } from '@/lib/action-result';
import { isGuestTenant } from '@/lib/guest';
import { paddleConfig, portalUrl, previewSubscriptionPlan, priceIdOf, prorationMode, updateSubscriptionPlan } from '@/lib/paddle';
import { requireOwner } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

// "Kartica i računi": Paddle's page for the card and its invoices.
export async function openCardPortal() {
  const ctx = await requireOwner();
  const cfg = paddleConfig();
  const customer = ctx.tenant.paddle_customer_id;
  if (!cfg || !customer) redirect('/app/settings/pretplata');
  const url = await portalUrl(cfg, customer, ctx.tenant.paddle_subscription_id ?? null);
  redirect(url ?? '/app/settings/pretplata?kartica=greska');
}

export type PlanChangePreview = {
  plan: PlanId;
  name: string;
  upgrade: boolean;
  chargeNow: number | null;
  recurring: number | null;
  nextBilledAt: string | null;
};

async function planChangeGuard() {
  const ctx = await requireOwner();
  const t = ctx.tenant;
  if (isGuestTenant(t) || (t.settings as { demo?: unknown } | null)?.demo === true || t.sample_until) {
    return { ok: false as const, error: 'U demo radionici paket se ne mijenja.' };
  }
  if (t.main_tenant_id) return { ok: false as const, error: 'Paket se mijenja u glavnoj radionici.' };
  const cfg = paddleConfig();
  const subscriptionId = t.paddle_subscription_id;
  if (!cfg || !subscriptionId || !['active', 'trialing', 'past_due'].includes(t.paddle_status ?? '')) {
    return { ok: false as const, error: 'Paket karticom mijenjate kad je pretplata aktivna.' };
  }
  return { ok: true as const, ctx, cfg, subscriptionId, current: t.plan as PlanId, founder: isFounder(t.founder_until) };
}

function parsePlan(value: string): PlanId | null {
  return PLAN_IDS.includes(value as PlanId) ? (value as PlanId) : null;
}

// Numbers Paddle would charge, before the owner confirms.
export async function previewPlanChange(plan: string): Promise<ActionResult<PlanChangePreview>> {
  const gate = await planChangeGuard();
  if (!gate.ok) return fail(gate.error);
  const next = parsePlan(plan);
  if (!next) return fail('Nepoznat paket.');
  if (next === gate.current) return fail('To je već Vaš paket.');
  const priceId = priceIdOf(gate.cfg, next, gate.founder);
  const mode = prorationMode(gate.current, next);
  const previewed = await previewSubscriptionPlan(gate.cfg, gate.subscriptionId, priceId, mode);
  if (!previewed.ok) return fail(previewed.error);
  return {
    ok: true,
    data: {
      plan: next,
      name: getPlan(next).name,
      upgrade: mode === 'prorated_immediately',
      chargeNow: previewed.preview.chargeNow,
      recurring: previewed.preview.recurring,
      nextBilledAt: previewed.preview.nextBilledAt,
    },
  };
}

// Replace the subscription's single item. Upgrade bills the difference now;
// a declined card leaves the old plan (Paddle prevent_change).
export async function changePlan(plan: string): Promise<ActionResult<{ plan: PlanId }>> {
  const gate = await planChangeGuard();
  if (!gate.ok) return fail(gate.error);
  const next = parsePlan(plan);
  if (!next) return fail('Nepoznat paket.');
  if (next === gate.current) return fail('To je već Vaš paket.');
  const priceId = priceIdOf(gate.cfg, next, gate.founder);
  const mode = prorationMode(gate.current, next);
  const updated = await updateSubscriptionPlan(gate.cfg, gate.subscriptionId, priceId, mode);
  if (!updated.ok) return fail(updated.error);
  await createAdminClient().from('tenants').update({ plan: next }).eq('id', gate.ctx.tenant.id);
  revalidatePath('/app/settings/pretplata');
  revalidatePath('/app/settings');
  return { ok: true, data: { plan: next } };
}
