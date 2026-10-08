'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fail, type ActionResult } from '@/lib/action-result';
import { accountantOf, sendAccountantPackage } from '@/lib/accountant';
import { isGuestTenant } from '@/lib/guest';
import { requireOwner } from '@/lib/session';

// The accountant's address and whether the package goes by itself.
const schema = z.object({
  email: z.string().trim().toLowerCase().email('Neispravan e-mail knjigovođe.').or(z.literal('')),
  auto: z.boolean(),
});

export async function saveAccountant(values: z.input<typeof schema>): Promise<ActionResult> {
  const ctx = await requireOwner();
  const parsed = schema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite e-mail.');
  const settings = (ctx.tenant.settings as Record<string, unknown> | null) ?? {};
  const before = accountantOf(settings);
  const accountant = { email: parsed.data.email || null, auto: parsed.data.auto, last_sent: before.lastSent };
  const { error } = await ctx.supabase.from('tenants').update({ settings: { ...settings, accountant } }).eq('id', ctx.tenant.id);
  if (error) return fail(error);
  revalidatePath('/app/business');
  return { ok: true };
}

// "Pošalji knjigovođi": the chosen month, now.
export async function sendToAccountant(month: string): Promise<ActionResult<{ count: number; to: string }>> {
  const ctx = await requireOwner();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail('Neispravan mjesec.');
  if (isGuestTenant(ctx.tenant) || (ctx.tenant.settings as { demo?: unknown } | null)?.demo === true) return fail('U demo verziji e-mail se ne šalje. Paket možete preuzeti.');
  const acc = accountantOf(ctx.tenant.settings);
  if (!acc.email) return fail('Upišite e-mail knjigovođe.');
  const r = await sendAccountantPackage(ctx.supabase, ctx.tenant, month, acc.email, ctx.tenant.email || ctx.user.email || null);
  if (!r.ok) return fail(r.error);
  return { ok: true, data: { count: r.count, to: acc.email } };
}
