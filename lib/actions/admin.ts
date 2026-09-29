'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { PACKAGE_IDS, type PackageId } from '@/config/tenant.config';
import { fail, type ActionResult } from '@/lib/action-result';
import { isPlatformAdmin } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

// Super Admin (the SaaS operator). Every action re-checks the caller.
async function guard() {
  return (await isPlatformAdmin()) ? null : fail('Samo administrator platforme.');
}

const createSchema = z.object({
  package: z.enum(PACKAGE_IDS as [PackageId, ...PackageId[]]),
  workshopName: z.string().trim().min(2, 'Upišite naziv radionice.').max(120),
  fullName: z.string().trim().min(2, 'Upišite ime vlasnika.').max(120),
  email: z.string().trim().toLowerCase().email('Neispravan e-mail.'),
  password: z.string().min(8, 'Lozinka mora imati barem 8 znakova.').max(72),
  status: z.enum(['trial', 'active']),
  trialDays: z.number().int().min(1).max(365),
  oib: z.string().trim().regex(/^\d{11}$/).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
});

export async function adminCreateWorkshop(values: z.input<typeof createSchema>): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = createSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite podatke.');
  const v = parsed.data;
  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({ email: v.email, password: v.password, email_confirm: true, user_metadata: { full_name: v.fullName } });
  if (error || !created.user) return fail(/already|registered|exists/i.test(error?.message ?? '') ? 'Taj e-mail već ima račun.' : error?.message ?? 'Račun nije stvoren.');
  const { error: rpcError } = await admin.rpc('register_workshop', {
    p_user_id: created.user.id,
    p_full_name: v.fullName,
    p_workshop_name: v.workshopName,
    p_package: v.package,
    p_oib: v.oib || null,
    p_phone: v.phone || null,
    p_city: v.city || null,
    p_status: v.status,
    p_trial_days: v.trialDays,
  });
  if (rpcError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return fail(rpcError.message);
  }
  revalidatePath('/admin');
  return { ok: true };
}

export async function adminSetStatus(tenantId: string, status: 'trial' | 'active' | 'suspended', note: string | null): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const { error } = await createAdminClient().from('tenants').update({ status, status_note: note?.trim() || null }).eq('id', tenantId);
  if (error) return fail(error);
  revalidatePath('/admin');
  return { ok: true };
}

export async function adminExtendTrial(tenantId: string, days: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const admin = createAdminClient();
  const { data } = await admin.from('tenants').select('trial_ends_at').eq('id', tenantId).single();
  const base = data?.trial_ends_at && new Date(data.trial_ends_at) > new Date() ? new Date(data.trial_ends_at) : new Date();
  base.setDate(base.getDate() + days);
  const { error } = await admin.from('tenants').update({ status: 'trial', trial_ends_at: base.toISOString() }).eq('id', tenantId);
  if (error) return fail(error);
  revalidatePath('/admin');
  return { ok: true };
}

export async function adminSetPackage(tenantId: string, pkg: PackageId): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!PACKAGE_IDS.includes(pkg)) return fail('Nepoznat paket.');
  const { error } = await createAdminClient().from('tenants').update({ package: pkg, enabled_modules: [] }).eq('id', tenantId);
  if (error) return fail(error);
  revalidatePath('/admin');
  return { ok: true };
}
