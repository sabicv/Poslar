import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { getPlan } from '@/config/plans';
import { getPackage, type PackageConfig } from '@/config/tenant.config';
import { createAdminClient } from '@/lib/supabase/admin';

// The door QR code: a workshop's public intake page at /q/<token>. The
// token is the only key, so it is long and random, and the owner can
// replace it (old posters stop working). Everything here runs with the
// service role, always scoped to the one workshop the token names.

export interface IntakeTenant {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  logo_url: string | null;
  plan: string | null;
  ai_quota: unknown;
  pkg: PackageConfig;
}

// Standard and Premium have it; a workshop on trial and the demo see it too.
export function qrAllowed(t: { plan: string | null; status: string; settings: unknown }): boolean {
  return getPlan(t.plan).qr || t.status === 'trial' || (t.settings as { demo?: unknown } | null)?.demo === true;
}

export type IntakeState = { kind: 'ok'; tenant: IntakeTenant } | { kind: 'missing' } | { kind: 'off'; name: string; phone: string | null };

export async function loadIntake(token: string): Promise<IntakeState> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { kind: 'missing' };
  const { data: t } = await createAdminClient()
    .from('tenants')
    .select('id, name, phone, address, city, logo_url, package, plan, status, trial_ends_at, settings, intake_enabled, ai_quota')
    .eq('intake_token', token)
    .maybeSingle();
  if (!t) return { kind: 'missing' };
  const trialOver = t.status === 'trial' && t.trial_ends_at && new Date(t.trial_ends_at as string) < new Date();
  if (!t.intake_enabled || t.status === 'suspended' || trialOver || !qrAllowed(t as never)) return { kind: 'off', name: t.name as string, phone: (t.phone as string | null) ?? null };
  return {
    kind: 'ok',
    tenant: {
      id: t.id as string,
      name: t.name as string,
      phone: (t.phone as string | null) ?? null,
      address: (t.address as string | null) ?? null,
      city: (t.city as string | null) ?? null,
      logo_url: (t.logo_url as string | null) ?? null,
      plan: (t.plan as string | null) ?? null,
      ai_quota: t.ai_quota,
      pkg: getPackage(t.package as string),
    },
  };
}

export async function senderHash(): Promise<string> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(`intake|${ip}|${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`).digest('hex').slice(0, 40);
}

// Limits against fake or repeated submissions: per sender an hour and a
// day, and per workshop a day. Counted before the work is done.
const LIMITS = { submit: { hour: 3, day: 8, workshopDay: 40 }, scan: { hour: 8, day: 20, workshopDay: 120 } } as const;

export async function overLimit(tenantId: string, ipHash: string, kind: 'submit' | 'scan'): Promise<boolean> {
  const admin = createAdminClient();
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const count = async (since: string, mine: boolean) => {
    let q = admin.from('intake_attempts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('kind', kind).gte('created_at', since);
    if (mine) q = q.eq('ip_hash', ipHash);
    return (await q).count ?? 0;
  };
  const [hour, day, all] = await Promise.all([count(hourAgo, true), count(dayAgo, true), count(dayAgo, false)]);
  const l = LIMITS[kind];
  if (hour >= l.hour || day >= l.day || all >= l.workshopDay) return true;
  await admin.from('intake_attempts').insert({ tenant_id: tenantId, ip_hash: ipHash, kind });
  return false;
}

export const digitsOf = (phone: string) => phone.replace(/\D/g, '').replace(/^00/, '').replace(/^385/, '0');
export const plateKey = (plate: string) => plate.toUpperCase().replace(/[^A-Z0-9ČĆŽŠĐ]/g, '');
