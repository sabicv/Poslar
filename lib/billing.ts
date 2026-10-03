import 'server-only';
import { getPlan, monthlyPrice } from '@/config/plans';
import { addDays, todayInZagreb } from '@/lib/time';
import type { Tenant } from '@/types/db';

// Paying the TaktiX subscription by bank transfer: who to pay (set in the
// server environment, never in code), the workshop's own reference, and
// where the workshop stands. Card payments come later (Stripe).

export const GRACE_DAYS = 7;
export const WARN_DAYS = 7;

export interface Payee {
  name: string;
  street: string;
  city: string;
  iban: string;
}

export function payee(): Payee | null {
  const iban = process.env.TAKTIX_IBAN?.replace(/\s/g, '').toUpperCase();
  const name = process.env.TAKTIX_PAYEE_NAME?.trim();
  if (!iban || !/^HR\d{19}$/.test(iban) || !name) return null;
  return { name, street: process.env.TAKTIX_PAYEE_STREET?.trim() ?? '', city: process.env.TAKTIX_PAYEE_CITY?.trim() ?? '', iban };
}

export function support(): { phone: string | null; email: string | null } {
  return { phone: process.env.SUPPORT_PHONE?.trim() || null, email: process.env.SUPPORT_EMAIL?.trim() || null };
}

export type BillingStatus = 'demo' | 'trial' | 'manual' | 'paid' | 'due_soon' | 'grace' | 'overdue' | 'suspended';

export interface Subscription {
  status: BillingStatus;
  planName: string;
  monthly: number;
  paidUntil: string | null;
  lockOn: string | null;
  daysLeft: number | null;
}

const days = (from: string, to: string) => Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86400000);

// Where a workshop stands. Only a workshop with a "paid until" date is
// ever locked for not paying; one without (demo, a deal made by hand)
// is left alone.
export function subscription(t: Pick<Tenant, 'status' | 'plan' | 'billing_term' | 'paid_until' | 'trial_ends_at' | 'settings'>, today = todayInZagreb()): Subscription {
  const plan = getPlan(t.plan);
  const base = { planName: plan.name, monthly: monthlyPrice(t.plan, t.billing_term), paidUntil: t.paid_until, lockOn: null as string | null, daysLeft: null as number | null };
  if ((t.settings as { demo?: unknown } | null)?.demo === true) return { ...base, status: 'demo' };
  if (t.status === 'suspended') return { ...base, status: 'suspended' };
  if (t.status === 'trial') {
    const end = t.trial_ends_at ? t.trial_ends_at.slice(0, 10) : null;
    return { ...base, status: 'trial', daysLeft: end ? days(today, end) : null };
  }
  if (!t.paid_until) return { ...base, status: 'manual' };
  const left = days(today, t.paid_until);
  const lockOn = addDays(t.paid_until, GRACE_DAYS + 1);
  if (left >= WARN_DAYS) return { ...base, status: 'paid', daysLeft: left };
  if (left >= 0) return { ...base, status: 'due_soon', daysLeft: left, lockOn };
  if (today < lockOn) return { ...base, status: 'grace', daysLeft: left, lockOn };
  return { ...base, status: 'overdue', daysLeft: left, lockOn };
}
