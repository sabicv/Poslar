'use server';

import { z } from 'zod';
import { fail, type ActionResult } from '@/lib/action-result';
import { isDemoUser } from '@/lib/demo';
import { appOrigin } from '@/lib/qr';
import { getAuth } from '@/lib/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Passwords: "Zaboravili ste lozinku?" sends a link by e-mail once
// AUTH_EMAIL=1 (Supabase sends it through Brevo, docs/EMAIL_BREVO.md);
// the link signs the person in on /auth/potvrda and leads to
// /nova-lozinka, where anyone signed in sets a new password.

const GENERIC = 'Ako postoji račun s tom adresom, poslali smo poveznicu za novu lozinku. Pogledajte i mapu neželjene pošte.';

export async function requestPasswordReset(values: { email: string; website: string; elapsedMs: number }): Promise<ActionResult<{ message: string }>> {
  if (process.env.AUTH_EMAIL !== '1') return fail('Slanje e-pošte još nije uključeno. Javite nam se na WhatsApp.');
  const email = z.string().trim().toLowerCase().email().safeParse(values.email);
  if (!email.success) return fail('Upišite e-mail kojim se prijavljujete.');
  // Bots fill the hidden field or answer faster than a person can type;
  // they get the same answer, so nothing is learned either way.
  if (values.website !== '' || values.elapsedMs < 1500) return { ok: true, data: { message: GENERIC } };
  const supabase = await createServerSupabaseClient();
  // Supabase limits how often one address gets a mail. Whether the address
  // has an account is never told.
  // The Croatian mail template links to /auth/potvrda with a token (works on
  // any device); the default template comes back here with a code.
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${await appOrigin()}/auth/potvrda?next=/nova-lozinka` });
  return { ok: true, data: { message: GENERIC } };
}

const passwordSchema = z
  .object({ password: z.string().min(8, 'Lozinka mora imati barem 8 znakova.').max(72, 'Lozinka je preduga.'), repeat: z.string() })
  .refine((v) => v.password === v.repeat, { message: 'Lozinke se ne podudaraju.', path: ['repeat'] });

export async function setNewPassword(values: { password: string; repeat: string }): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite lozinku.');
  const { supabase, user } = await getAuth();
  if (!user) return fail('Poveznica je istekla. Zatražite novu.');
  if (isDemoUser(user)) return fail('Demo računi imaju zajedničku lozinku.');
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(/different from the old|same/i.test(error.message) ? 'Nova lozinka mora biti drukčija od stare.' : 'Lozinka nije promijenjena. Pokušajte ponovno.');
  return { ok: true };
}
