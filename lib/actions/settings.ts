'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getPlan } from '@/config/plans';
import { fail, type ActionResult } from '@/lib/action-result';
import { isGuestTenant } from '@/lib/guest';
import { requireWorkshop } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

const text = (max = 200) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

const tenantSchema = z.object({
  name: z.string().trim().min(2, 'Upišite naziv radionice.').max(120),
  oib: z.string().trim().regex(/^\d{11}$/, 'OIB ima 11 znamenki.').nullable().optional().or(z.literal('')).transform((v) => v || null),
  phone: text(40),
  email: text(),
  address: text(),
  city: text(80),
});

export async function updateTenant(values: z.input<typeof tenantSchema>): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Podatke radionice uređuje voditelj servisa.');
  const parsed = tenantSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite podatke.');
  const { error } = await ctx.supabase.from('tenants').update(parsed.data).eq('id', ctx.tenant.id);
  if (error) return fail(error);
  revalidatePath('/app', 'layout');
  return { ok: true };
}

// What the invoice needs besides name, OIB and address; kept in the
// workshop's settings next to anything already there.
const billingSchema = z.object({
  iban: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, '').toUpperCase())
    .refine((v) => v === '' || /^HR\d{19}$/.test(v), 'IBAN: HR i 19 znamenki.'),
  vat_registered: z.boolean(),
  invoice_note: z.string().trim().max(300),
  // Marks of the business premises and billing device, as registered with
  // the Tax Administration: the invoice number then reads 12/PP1/1.
  premises: z.string().trim().max(20).regex(/^[A-Za-z0-9]*$/, 'Oznaka prostora: samo slova i brojke, bez razmaka.').optional().default(''),
  device: z.string().trim().max(6).regex(/^\d*$/, 'Oznaka naplatnog uređaja je broj.').optional().default(''),
});

export async function updateBilling(values: z.input<typeof billingSchema>): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Podatke za račun uređuje voditelj servisa.');
  const parsed = billingSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite podatke.');
  const { premises, device } = parsed.data;
  if (Boolean(premises) !== Boolean(device)) return fail('Upišite i oznaku poslovnog prostora i oznaku naplatnog uređaja, ili nijednu.');
  const settings = {
    ...((ctx.tenant.settings as Record<string, unknown> | null) ?? {}),
    iban: parsed.data.iban || null,
    vat_registered: parsed.data.vat_registered,
    invoice_note: parsed.data.invoice_note || null,
    fiscal: premises ? { premises: premises.toUpperCase(), device } : null,
  };
  const { error } = await ctx.supabase.from('tenants').update({ settings }).eq('id', ctx.tenant.id);
  if (error) return fail(error);
  revalidatePath('/app/settings');
  return { ok: true };
}

export async function setTenantLogo(logoUrl: string | null): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Logo mijenja voditelj servisa.');
  if (logoUrl && !logoUrl.includes(`/branding/${ctx.tenant.id}/`)) return fail('Neispravan logo.');
  const { error } = await ctx.supabase.from('tenants').update({ logo_url: logoUrl }).eq('id', ctx.tenant.id);
  if (error) return fail(error);
  revalidatePath('/app', 'layout');
  return { ok: true };
}

export async function setOptionalModule(module: string, enabled: boolean): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Module uključuje voditelj servisa.');
  if (!ctx.pkg.optionalModules.includes(module as never)) return fail('Taj modul nije dostupan u ovom paketu.');
  const current = new Set(ctx.tenant.enabled_modules ?? []);
  if (enabled) current.add(module);
  else current.delete(module);
  const { error } = await ctx.supabase.from('tenants').update({ enabled_modules: [...current] }).eq('id', ctx.tenant.id);
  if (error) return fail(error);
  revalidatePath('/app', 'layout');
  return { ok: true };
}

export async function updateMyProfile(values: { full_name: string; phone: string; fgas_certificate?: string }): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const { error } = await ctx.supabase
    .from('profiles')
    .update({
      full_name: values.full_name.trim().slice(0, 120) || null,
      phone: values.phone.trim().slice(0, 40) || null,
      ...(values.fgas_certificate !== undefined ? { fgas_certificate: values.fgas_certificate.trim().slice(0, 60) || null } : {}),
    })
    .eq('id', ctx.user.id);
  if (error) return fail(error);
  revalidatePath('/app', 'layout');
  return { ok: true };
}

const staffSchema = z.object({
  fullName: z.string().trim().min(2, 'Upišite ime i prezime.').max(120),
  email: z.string().trim().toLowerCase().email('Neispravan e-mail.'),
  password: z.string().min(8, 'Lozinka mora imati barem 8 znakova.').max(72),
  role: z.enum(['owner', 'worker']),
});

// Staff accounts are created on the server with the service role: a
// browser can never insert a profile or pick its own role.
export async function createStaff(values: z.input<typeof staffSchema>): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Tim uređuje voditelj servisa.');
  if (isGuestTenant(ctx.tenant)) return fail('U demo verziji ne dodajete ljude. U svojoj radionici svaki radnik dobiva svoju prijavu.');
  const parsed = staffSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite podatke.');
  const v = parsed.data;
  // The plan sets how many people work in the app besides the owner.
  const plan = getPlan(ctx.tenant.plan);
  const { count } = await ctx.supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('tenant_id', ctx.tenant.id);
  if ((count ?? 1) - 1 >= plan.workers) {
    return fail(`Paket ${plan.name} ima mjesta za ${plan.workers} radnika uz voditelja. Za više ljudi javite se kroz „Javi problem”.`);
  }
  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { full_name: v.fullName },
  });
  if (error || !created.user) {
    return fail(/already|registered|exists/i.test(error?.message ?? '') ? 'Taj e-mail već ima račun.' : error ?? 'Račun nije stvoren.');
  }
  const { error: profileError } = await admin.from('profiles').insert({ id: created.user.id, tenant_id: ctx.tenant.id, full_name: v.fullName, role: v.role });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return fail(profileError);
  }
  revalidatePath('/app/settings');
  return { ok: true };
}

async function staffOfMyWorkshop(userId: string) {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return { ctx, error: 'Tim uređuje voditelj servisa.' };
  if (userId === ctx.user.id) return { ctx, error: 'Ne možete mijenjati vlastiti račun ovdje.' };
  const { data } = await ctx.supabase.from('profiles').select('id').eq('id', userId).eq('tenant_id', ctx.tenant.id).maybeSingle();
  if (!data) return { ctx, error: 'Djelatnik nije pronađen.' };
  return { ctx, error: null };
}

export async function setStaffRole(userId: string, role: 'owner' | 'worker'): Promise<ActionResult> {
  const { error } = await staffOfMyWorkshop(userId);
  if (error) return fail(error);
  const { error: updateError } = await createAdminClient().from('profiles').update({ role }).eq('id', userId);
  if (updateError) return fail(updateError);
  revalidatePath('/app/settings');
  return { ok: true };
}

export async function resetStaffPassword(userId: string, password: string): Promise<ActionResult> {
  const { error } = await staffOfMyWorkshop(userId);
  if (error) return fail(error);
  if (password.length < 8) return fail('Lozinka mora imati barem 8 znakova.');
  const { error: authError } = await createAdminClient().auth.admin.updateUserById(userId, { password });
  if (authError) return fail(authError);
  return { ok: true };
}

export async function removeStaff(userId: string): Promise<ActionResult> {
  const { error } = await staffOfMyWorkshop(userId);
  if (error) return fail(error);
  const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(userId);
  if (deleteError) return fail(deleteError);
  revalidatePath('/app/settings');
  return { ok: true };
}

// ---------------------------------------------------------------------
// QR self-intake: on and off, and a new code (old posters stop working)
// ---------------------------------------------------------------------
export async function setIntakeEnabled(enabled: boolean): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Samoprijem uključuje voditelj servisa.');
  const { error } = await ctx.supabase.from('tenants').update({ intake_enabled: enabled }).eq('id', ctx.tenant.id);
  if (error) return fail(error);
  revalidatePath('/app/settings/qr');
  return { ok: true };
}

export async function rotateIntakeToken(): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Novi kod radi voditelj servisa.');
  const { error } = await createAdminClient().from('tenants').update({ intake_token: crypto.randomUUID() }).eq('id', ctx.tenant.id);
  if (error) return fail(error);
  revalidatePath('/app/settings/qr');
  return { ok: true };
}
