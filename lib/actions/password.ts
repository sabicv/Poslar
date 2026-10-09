'use server';

import { z } from 'zod';
import { fail, type ActionResult } from '@/lib/action-result';
import { isDemoUser } from '@/lib/demo';
import { appOrigin } from '@/lib/qr';
import { getAuth } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Passwords: "Zaboravili ste lozinku?" sends a link only to an existing
// login address (AUTH_EMAIL=1, Brevo through Supabase). The token belongs
// to that user; someone else's inbox cannot open this account. No row in
// auth.users → no mail, the form fails. The link signs in on /auth/potvrda
// and leads to /nova-lozinka.

const MISSING = 'Nema računa s tom adresom. Upišite e-mail kojim se prijavljujete.';

async function loginAccount(email: string) {
  const admin = createAdminClient();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function requestPasswordReset(values: { email: string; website: string; elapsedMs: number }): Promise<ActionResult<{ message: string }>> {
  if (process.env.AUTH_EMAIL !== '1') return fail('Slanje e-pošte još nije uključeno. Javite nam se na WhatsApp.');
  const email = z.string().trim().toLowerCase().email().safeParse(values.email);
  if (!email.success) return fail('Upišite e-mail kojim se prijavljujete.');
  // Bots fill the hidden field or answer faster than a person can type.
  if (values.website !== '' || values.elapsedMs < 1500) return fail(MISSING);
  const account = await loginAccount(email.data);
  if (!account) return fail(MISSING);
  if (isDemoUser(account)) return fail('Demo računi imaju zajedničku lozinku.');
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${await appOrigin()}/auth/potvrda?next=/nova-lozinka` });
  if (error) return fail('Poveznica nije poslana. Pokušajte ponovno.');
  return { ok: true, data: { message: `Poveznica je poslana na ${email.data}. Otvorite je na tom sandučiću. Pogledajte i neželjenu poštu.` } };
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
