// Subscription plans: what the site sells and what the tower enforces.
// Prices are monthly, VAT included; 24 months on contract is 10 % less.
// AI quotas are per calendar month and keep the AI bill predictable: a
// photo read costs about 1 cent, a Kopilot answer about 3 to 4 cents.

export type PlanId = 'basic' | 'standard' | 'premium';
export type BillingTerm = 'monthly' | '24m';
export type AiKind = 'scan' | 'copilot';

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  workers: number;
  people: string;
  qr: boolean;
  ai: Record<AiKind, number>;
  // AI phone (AI tajnik): minutes of calls included each month.
  phoneMinutes: number;
}

export const PLANS: Record<PlanId, Plan> = {
  basic: { id: 'basic', name: 'Basic', price: 30, workers: 2, people: 'Voditelj i 2 radnika', qr: false, ai: { scan: 150, copilot: 100 }, phoneMinutes: 0 },
  standard: { id: 'standard', name: 'Standard', price: 50, workers: 5, people: 'Voditelj i 5 radnika', qr: true, ai: { scan: 300, copilot: 200 }, phoneMinutes: 60 },
  premium: { id: 'premium', name: 'Premium', price: 90, workers: 10, people: 'Voditelj i 10 radnika', qr: true, ai: { scan: 600, copilot: 400 }, phoneMinutes: 150 },
};

// AI phone minutes cost us roughly 0.10 to 0.20 € each (Vapi, voice,
// number), so they are capped (Vedran, 2026-10-05): a monthly add-on of
// 100 minutes for 25 € (VAT included), and no call longer than 4 minutes.
export const PHONE_PACK = { minutes: 100, price: 25 };
export const PHONE_CALL_MAX_SECONDS = 240;

// Monthly AI phone minutes: the plan's, or the tower's override (which
// includes any add-on packs the workshop pays for).
export function phoneQuota(plan: string | null | undefined, override: unknown): number {
  const custom = (override as { phone?: unknown } | null)?.phone;
  return typeof custom === 'number' && custom >= 0 ? custom : getPlan(plan).phoneMinutes;
}
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
export const TERM_DISCOUNT = 0.1;

export const TERM_LABELS: Record<BillingTerm, string> = { monthly: 'Mjesečno', '24m': 'Ugovor 24 mjeseca' };
export const AI_LABELS: Record<AiKind, string> = { scan: 'Slikanje', copilot: 'Kopilot' };

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) ?? 'basic'] ?? PLANS.basic;
}

// What the workshop pays a month, VAT included.
export function monthlyPrice(plan: string | null | undefined, term: string | null | undefined): number {
  const price = getPlan(plan).price;
  return term === '24m' ? Math.round(price * (1 - TERM_DISCOUNT) * 100) / 100 : price;
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
