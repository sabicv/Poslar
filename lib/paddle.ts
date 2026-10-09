import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PLAN_IDS, type PlanId } from '@/config/plans';
import { rewardReferrer } from '@/lib/referrals';
import { createAdminClient } from '@/lib/supabase/admin';

// Plaćanje karticom: Paddle (Merchant of Record) runs the checkout, VAT and
// the invoice to the workshop; we only learn the outcome by webhook. Off
// until the keys are set (docs/PADDLE.md); the bank slip always works.

type Admin = ReturnType<typeof createAdminClient>;

export interface PaddleConfig {
  clientToken: string;
  environment: 'sandbox' | 'production';
  // Per plan: the full price and, for the first 50 workshops, the founder price.
  prices: Record<PlanId, { full: string; founder: string | null }>;
}

const env = (key: string) => process.env[key]?.trim() || null;

export function paddleConfig(): PaddleConfig | null {
  const clientToken = env('PADDLE_CLIENT_TOKEN');
  if (!clientToken || !env('PADDLE_API_KEY') || !env('PADDLE_WEBHOOK_SECRET')) return null;
  const prices = {} as PaddleConfig['prices'];
  for (const id of PLAN_IDS) {
    const full = env(`PADDLE_PRICE_${id.toUpperCase()}`);
    if (!full) return null;
    prices[id] = { full, founder: env(`PADDLE_PRICE_${id.toUpperCase()}_FOUNDER`) };
  }
  return { clientToken, environment: clientToken.startsWith('test_') || env('PADDLE_ENVIRONMENT') === 'sandbox' ? 'sandbox' : 'production', prices };
}

export function planOfPrice(cfg: PaddleConfig, priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  return (PLAN_IDS.find((id) => cfg.prices[id].full === priceId || cfg.prices[id].founder === priceId) as PlanId | undefined) ?? null;
}

export function priceIdOf(cfg: PaddleConfig, plan: PlanId, founder: boolean): string {
  return (founder && cfg.prices[plan].founder) || cfg.prices[plan].full;
}

const PLAN_RANK: Record<PlanId, number> = { basic: 0, standard: 1, premium: 2 };

// Upgrade: charge the difference now. Downgrade: new price from the next renewal, no refund.
export function prorationMode(from: PlanId, to: PlanId): 'prorated_immediately' | 'prorated_next_billing_period' {
  return PLAN_RANK[to] > PLAN_RANK[from] ? 'prorated_immediately' : 'prorated_next_billing_period';
}

export interface PlanUpdatePreview {
  chargeNow: number | null;
  recurring: number | null;
  nextBilledAt: string | null;
}

function paddleHeaders(): HeadersInit {
  return { Authorization: `Bearer ${env('PADDLE_API_KEY')}`, 'content-type': 'application/json' };
}

function paddleError(body: { error?: { detail?: string; code?: string } }, fallback: string): string {
  const code = body.error?.code ?? '';
  if (/payment/i.test(code) || /payment/i.test(body.error?.detail ?? '')) return 'Kartica je odbijena. Promjena nije provedena.';
  if (/locked|conflict/i.test(code)) return 'Pretplata se trenutno ne može mijenjati. Pokušajte za minutu.';
  return fallback;
}

function euroFromMinor(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n / 100 : null;
}

async function paddlePatch(cfg: PaddleConfig, path: string, payload: unknown): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${paddleApi(cfg)}${path}`, {
      method: 'PATCH',
      headers: paddleHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: { detail?: string; code?: string } };
    if (!res.ok || !body.data) return { ok: false, error: paddleError(body, 'Promjena paketa nije uspjela. Pokušajte za minutu.') };
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, error: 'Paddle trenutno ne odgovara. Pokušajte za minutu.' };
  }
}

function itemsBody(priceId: string, mode: 'prorated_immediately' | 'prorated_next_billing_period') {
  return { items: [{ price_id: priceId, quantity: 1 }], proration_billing_mode: mode };
}

export async function previewSubscriptionPlan(
  cfg: PaddleConfig,
  subscriptionId: string,
  priceId: string,
  mode: 'prorated_immediately' | 'prorated_next_billing_period'
): Promise<{ ok: true; preview: PlanUpdatePreview } | { ok: false; error: string }> {
  const res = await paddlePatch(cfg, `/subscriptions/${subscriptionId}/preview`, itemsBody(priceId, mode));
  if (!res.ok) return res;
  const immediate = res.data.immediate_transaction as { details?: { totals?: { grand_total?: string } } } | null | undefined;
  const recurring = res.data.recurring_transaction_details as { totals?: { grand_total?: string }; details?: { totals?: { grand_total?: string } } } | null | undefined;
  return {
    ok: true,
    preview: {
      chargeNow: euroFromMinor(immediate?.details?.totals?.grand_total),
      recurring: euroFromMinor(recurring?.details?.totals?.grand_total ?? recurring?.totals?.grand_total),
      nextBilledAt: typeof res.data.next_billed_at === 'string' ? res.data.next_billed_at : null,
    },
  };
}

export async function updateSubscriptionPlan(
  cfg: PaddleConfig,
  subscriptionId: string,
  priceId: string,
  mode: 'prorated_immediately' | 'prorated_next_billing_period'
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await paddlePatch(cfg, `/subscriptions/${subscriptionId}`, itemsBody(priceId, mode));
  return res.ok ? { ok: true } : res;
}

export function paddleApi(cfg: PaddleConfig): string {
  return env('PADDLE_API_BASE') ?? (cfg.environment === 'sandbox' ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com');
}

// "Paddle-Signature: ts=…;h1=…", HMAC-SHA256 of "ts:body" with the
// notification secret, and not older than five minutes.
export function validPaddleSignature(raw: string, header: string | null, now = Date.now()): boolean {
  const secret = env('PADDLE_WEBHOOK_SECRET');
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(';').map((p) => p.split('=') as [string, string]));
  const ts = Number(parts.ts);
  if (!parts.h1 || !Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${parts.ts}:${raw}`).digest('hex'));
  const given = Buffer.from(parts.h1);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// The page where a paying workshop changes its card and downloads Paddle's invoices.
export async function portalUrl(cfg: PaddleConfig, customerId: string, subscriptionId: string | null): Promise<string | null> {
  try {
    const res = await fetch(`${paddleApi(cfg)}/customers/${customerId}/portal-sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('PADDLE_API_KEY')}`, 'content-type': 'application/json' },
      body: JSON.stringify(subscriptionId ? { subscription_ids: [subscriptionId] } : {}),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: { urls?: { general?: { overview?: string } } } };
    return res.ok ? (body.data?.urls?.general?.overview ?? null) : null;
  } catch {
    return null;
  }
}

interface PaddleEvent {
  event_id?: string;
  event_type: string;
  occurred_at?: string;
  data: {
    id: string;
    status?: string;
    customer_id?: string;
    subscription_id?: string | null;
    custom_data?: { tenant_id?: string } | null;
    items?: { price?: { id?: string } }[];
    current_billing_period?: { starts_at?: string; ends_at?: string } | null;
    billing_period?: { starts_at?: string; ends_at?: string } | null;
    details?: { totals?: { grand_total?: string; currency_code?: string } };
    currency_code?: string;
  };
}

// The workshop an event is about: its id in the checkout's custom data, or
// the subscription we already know. A branch never pays (its main does).
async function tenantOf(admin: Admin, e: PaddleEvent): Promise<string | null> {
  const subscription = e.data.subscription_id ?? (e.event_type.startsWith('subscription.') ? e.data.id : null);
  if (subscription) {
    const { data } = await admin.from('tenants').select('id').eq('paddle_subscription_id', subscription).maybeSingle();
    if (data) return data.id as string;
  }
  const id = e.data.custom_data?.tenant_id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin.from('tenants').select('id, main_tenant_id').eq('id', id).maybeSingle();
  return data ? ((data.main_tenant_id as string | null) ?? (data.id as string)) : null;
}

export async function applyPaddleEvent(admin: Admin, cfg: PaddleConfig, e: PaddleEvent): Promise<string> {
  const tenantId = await tenantOf(admin, e);
  if (!tenantId) return 'unknown workshop';

  if (e.event_type.startsWith('subscription.')) {
    const s = e.data;
    const occurred = e.occurred_at ? Date.parse(e.occurred_at) : Date.now();
    const { data: cur } = await admin.from('tenants').select('paddle_event_at').eq('id', tenantId).single();
    // A retry or a delayed older event must not revert a newer subscription.
    if (cur?.paddle_event_at && Date.parse(cur.paddle_event_at as string) > occurred) return 'stale subscription event';
    const plan = planOfPrice(cfg, s.items?.[0]?.price?.id);
    const patch: Record<string, unknown> = {
      paddle_subscription_id: s.id,
      paddle_customer_id: s.customer_id ?? null,
      paddle_status: s.status ?? null,
      paddle_event_at: e.occurred_at ?? new Date().toISOString(),
    };
    if (plan) patch.plan = plan;
    if (s.status === 'active' || s.status === 'trialing') {
      patch.status = 'active';
      patch.status_note = null;
      patch.billing_term = 'monthly';
      if (s.current_billing_period?.ends_at) patch.paid_until = s.current_billing_period.ends_at.slice(0, 10);
    }
    await admin.from('tenants').update(patch).eq('id', tenantId);
    return `subscription ${s.status}`;
  }

  if (e.event_type === 'transaction.completed') {
    const t = e.data;
    const minor = Number(t.details?.totals?.grand_total ?? 0);
    const { error } = await admin.from('subscription_payments').insert({
      tenant_id: tenantId,
      amount: Math.round(minor) / 100,
      months: 1,
      note: `Kartica (Paddle)${(t.details?.totals?.currency_code ?? t.currency_code ?? 'EUR') !== 'EUR' ? `, ${t.details?.totals?.currency_code ?? t.currency_code}` : ''}`,
      provider: 'paddle',
      provider_ref: t.id,
    });
    // A repeated webhook finds the row already there.
    if (error) return 'payment already recorded';
    const ends = t.billing_period?.ends_at?.slice(0, 10);
    if (ends) {
      const { data: cur } = await admin.from('tenants').select('paid_until').eq('id', tenantId).single();
      if (!cur?.paid_until || cur.paid_until < ends) await admin.from('tenants').update({ paid_until: ends, status: 'active', status_note: null }).eq('id', tenantId);
    }
    await rewardReferrer(tenantId);
    return 'payment recorded';
  }
  return 'ignored';
}
