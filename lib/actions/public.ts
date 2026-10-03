'use server';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PACKAGE_IDS, type PackageId } from '@/config/tenant.config';
import { fail, type ActionResult } from '@/lib/action-result';
import { createAdminClient } from '@/lib/supabase/admin';

async function clientIp(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  return { ip, userAgent: h.get('user-agent') };
}

// ---------------------------------------------------------------------
// Self-registration: a workshop signs up and gets a free trial.
//
// Abuse protection: honeypot field, minimum time on the form, at most
// REGISTRATION_PER_HOUR attempts per IP (stored only as a salted hash) and
// REGISTRATION_DAILY_LIMIT in total. With REGISTRATION_EMAIL_CONFIRM=1 the
// account must confirm its e-mail before the first sign-in (needs custom
// SMTP in Supabase); an existing address then gets the same answer as a
// new one, so the form can't be used to discover who has an account.
// ---------------------------------------------------------------------
const registerSchema = z.object({
  package: z.enum(PACKAGE_IDS as [PackageId, ...PackageId[]]),
  // Optional: a new workshop starts under the owner's name and renames itself in Postavke.
  workshopName: z.string().trim().max(120).optional().or(z.literal('')),
  fullName: z.string().trim().min(2, 'Upišite ime i prezime.').max(120),
  email: z.string().trim().toLowerCase().email('Neispravan e-mail.'),
  password: z.string().min(8, 'Lozinka mora imati barem 8 znakova.').max(72),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(80).optional(),
  oib: z.string().trim().regex(/^\d{11}$/, 'OIB ima 11 znamenki.').optional().or(z.literal('')),
  website: z.string(),
  elapsedMs: z.number().int().min(0),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Potvrdite uvjete korištenja.' }) }),
  // The referral code from another workshop's link (its payment reference).
  referral: z.string().trim().regex(/^\d{1,9}$/).optional().or(z.literal('')),
});

const GENERIC_FAILURE = 'Registracija nije uspjela. Ako već imate račun, prijavite se; inače pokušajte ponovno za nekoliko minuta.';

export async function registerWorkshop(values: z.input<typeof registerSchema>): Promise<ActionResult<{ confirmEmail: boolean }>> {
  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite podatke.');
  const v = parsed.data;
  // Bots fill the hidden field or submit faster than a person can type.
  if (v.website !== '' || v.elapsedMs < 3000) return fail(GENERIC_FAILURE);

  const admin = createAdminClient();
  const { ip } = await clientIp();
  const ipHash = createHash('sha256').update(`${ip ?? 'unknown'}|${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`).digest('hex').slice(0, 40);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const [{ count: perIp }, { count: perDay }] = await Promise.all([
    admin.from('registration_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', hourAgo),
    admin.from('registration_attempts').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
  ]);
  if ((perIp ?? 0) >= (Number(process.env.REGISTRATION_PER_HOUR) || 5) || (perDay ?? 0) >= (Number(process.env.REGISTRATION_DAILY_LIMIT) || 100)) {
    return fail(GENERIC_FAILURE);
  }
  await admin.from('registration_attempts').insert({ ip_hash: ipHash });

  const confirmEmail = process.env.REGISTRATION_EMAIL_CONFIRM === '1';
  let userId: string | null = null;
  if (confirmEmail) {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const { data, error } = await anon.auth.signUp({
      email: v.email,
      password: v.password,
      options: { data: { full_name: v.fullName }, emailRedirectTo: `${appUrl}/login?potvrda=1` },
    });
    if (error) return fail(GENERIC_FAILURE);
    // An address that already has an account comes back without identities:
    // answer exactly as for a new one.
    if (!data.user || (data.user.identities && data.user.identities.length === 0)) return { ok: true, data: { confirmEmail: true } };
    userId = data.user.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: v.email, password: v.password, email_confirm: true, user_metadata: { full_name: v.fullName } });
    // Said plainly: a craftsman who already has an account should log in,
    // not wonder why the form "doesn't work".
    if (error && /already been registered|already exists/i.test(error.message)) return fail('Ovaj e-mail već ima račun. Prijavi se s njim.');
    if (error || !data.user) return fail(GENERIC_FAILURE);
    userId = data.user.id;
  }

  const trialDays = Math.max(1, Number(process.env.TRIAL_DAYS ?? 30) || 30);
  const { data: tenantId, error: rpcError } = await admin.rpc('register_workshop', {
    p_user_id: userId,
    p_full_name: v.fullName,
    p_workshop_name: v.workshopName || v.fullName,
    p_package: v.package,
    p_oib: v.oib || null,
    p_phone: v.phone || null,
    p_city: v.city || null,
    p_status: 'trial',
    p_trial_days: trialDays,
  });
  if (rpcError) {
    await admin.auth.admin.deleteUser(userId);
    return fail('Radionica nije stvorena. Pokušajte ponovno.');
  }
  // Sent by another workshop: remember who, for its free month later.
  if (v.referral && tenantId) {
    const { data: referrer } = await admin.from('tenants').select('id').eq('billing_ref', Number(v.referral)).maybeSingle();
    if (referrer && referrer.id !== tenantId) await admin.from('tenants').update({ referred_by: referrer.id }).eq('id', tenantId as string);
  }
  return { ok: true, data: { confirmEmail } };
}

// ---------------------------------------------------------------------
// Customer approval by link (no account). The whole decision runs in one
// database function (decide_approval, 0007_hardening.sql): the link is
// locked while deciding, expiry and job lock are checked, every proposed
// line must be decided exactly once, and it is saved all-or-nothing.
// ---------------------------------------------------------------------
const decisionSchema = z.object({
  signerName: z.string().trim().min(2, 'Upišite ime i prezime.').max(120),
  decisions: z.array(z.object({ lineId: z.string().uuid(), decision: z.enum(['approved', 'declined']) })).min(1).max(200),
});

const APPROVAL_ERRORS: Record<string, string> = {
  approval_not_found: 'Poveznica ne postoji.',
  approval_already_decided: 'Odluka je već poslana. Hvala!',
  approval_expired: 'Poveznica je istekla. Javite se servisu.',
  approval_job_locked: 'Nalog je zaključan. Javite se servisu.',
  approval_incomplete: 'Odlučite o svakoj predloženoj stavci (odobravam ili ne sada).',
  approval_nothing_proposed: 'Nema stavki za odluku.',
  approval_signer: 'Upišite ime i prezime.',
  approval_invalid: 'Odabir nije ispravan. Osvježite stranicu.',
};

export async function submitApproval(token: string, values: z.input<typeof decisionSchema>): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return fail('Neispravna poveznica.');
  const parsed = decisionSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite odabir.');
  const { ip, userAgent } = await clientIp();
  const { error } = await createAdminClient().rpc('decide_approval', {
    p_token: token,
    p_signer: parsed.data.signerName,
    p_decisions: parsed.data.decisions,
    p_ip: ip,
    p_user_agent: userAgent,
  });
  if (error) {
    const key = Object.keys(APPROVAL_ERRORS).find((k) => error.message.includes(k));
    return fail(key ? APPROVAL_ERRORS[key] : 'Odluka nije spremljena. Pokušajte ponovno.');
  }
  return { ok: true };
}
