// Subscription plans: what the site sells and what the tower enforces.
// Prices are monthly, VAT included, round numbers (Vedran: no 39 or 49,99).
// The first 50 workshops pay the founder price, locked for 24 months
// (tenants.founder_until). AI quotas are per calendar month and keep the AI
// bill predictable: a photo read costs about 1 cent, an answer from Poslar
// about 3 cents. See docs/FINANCIJE.md.

export type PlanId = 'basic' | 'standard' | 'premium';
export type BillingTerm = 'monthly' | '24m';
export type AiKind = 'scan' | 'copilot';

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  // The founder price: the first FOUNDER_SPOTS workshops, FOUNDER_MONTHS long.
  founderPrice: number;
  workers: number;
  people: string;
  qr: boolean;
  ai: Record<AiKind, number>;
  // Poslar na telefonu, in every plan: minutes a month. A call lasts at
  // most a minute, so this is also about the number of calls.
  phoneMinutes: number;
}

export const PLANS: Record<PlanId, Plan> = {
  basic: { id: 'basic', name: 'Basic', price: 40, founderPrice: 30, workers: 2, people: 'Voditelj i 2 radnika', qr: false, ai: { scan: 150, copilot: 100 }, phoneMinutes: 100 },
  standard: { id: 'standard', name: 'Standard', price: 70, founderPrice: 50, workers: 5, people: 'Voditelj i 5 radnika', qr: true, ai: { scan: 300, copilot: 200 }, phoneMinutes: 200 },
  premium: { id: 'premium', name: 'Premium', price: 120, founderPrice: 90, workers: 10, people: 'Voditelj i 10 radnika', qr: true, ai: { scan: 600, copilot: 400 }, phoneMinutes: 400 },
};

export const FOUNDER_SPOTS = 50;
export const FOUNDER_MONTHS = 24;

// A phone call costs us about 8 cents (Twilio, Vapi, voice), so a call
// lasts at most a minute (Vedran, 2026-10-07) and extra calls are an
// add-on: 100 more for 25 € a month (VAT included).
export const PHONE_PACK = { minutes: 100, price: 25 };
export const PHONE_CALL_MAX_SECONDS = 60;

// Monthly AI phone minutes: the plan's, or the tower's override (which
// includes any add-on packs the workshop pays for).
export function phoneQuota(plan: string | null | undefined, override: unknown): number {
  const custom = (override as { phone?: unknown } | null)?.phone;
  return typeof custom === 'number' && custom >= 0 ? custom : getPlan(plan).phoneMinutes;
}
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
export const TERM_DISCOUNT = 0.1;

export const TERM_LABELS: Record<BillingTerm, string> = { monthly: 'Mjesečno', '24m': 'Ugovor 24 mjeseca' };
export const AI_LABELS: Record<AiKind, string> = { scan: 'Slikanje', copilot: 'Pitaj Poslara' };

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) ?? 'basic'] ?? PLANS.basic;
}

// Is the founder price still running? (founder_until is a date.)
export function isFounder(founderUntil: string | null | undefined, today = new Date().toISOString().slice(0, 10)): boolean {
  return Boolean(founderUntil && founderUntil >= today);
}

// What the workshop pays a month, VAT included: the founder price while it
// runs; otherwise the full price (a 24-month contract made before
// 2026-10-08 keeps its 10 % off).
export function monthlyPrice(plan: string | null | undefined, term: string | null | undefined, founderUntil?: string | null): number {
  const p = getPlan(plan);
  if (isFounder(founderUntil)) return p.founderPrice;
  return term === '24m' ? Math.round(p.price * (1 - TERM_DISCOUNT) * 100) / 100 : p.price;
}

// The plan's quota, or the tower's override for this workshop.
export function aiQuota(plan: string | null | undefined, override: unknown, kind: AiKind): number {
  const custom = (override as Partial<Record<AiKind, unknown>> | null)?.[kind];
  return typeof custom === 'number' && custom >= 0 ? custom : getPlan(plan).ai[kind];
}

// Rough AI cost in euros (Sonnet-class prices per million tokens).
// Shown in the tower as an estimate only; the invoice from Anthropic counts.
const PRICE_IN = 3;
const PRICE_OUT = 15;
export function aiCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1_000_000;
}
