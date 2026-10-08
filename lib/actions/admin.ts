'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { HELP_TOPIC_IDS } from '@/config/help';
import { PLANS, PLAN_IDS, type PlanId } from '@/config/plans';
import { PACKAGE_IDS, type PackageId } from '@/config/tenant.config';
import { fail, type ActionResult } from '@/lib/action-result';
import { rewardReferrer } from '@/lib/referrals';
import { isPlatformAdmin } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteWorkshop } from '@/lib/workshop-delete';

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
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// A branch is billed through its main workshop (0030): the subscription
// is changed there, and the branches follow.
async function payer(tenantId: string): Promise<string> {
  const { data } = await createAdminClient().from('tenants').select('main_tenant_id').eq('id', tenantId).maybeSingle();
  return (data?.main_tenant_id as string | null) ?? tenantId;
}

export async function adminSetStatus(tenantId: string, status: 'trial' | 'active' | 'suspended', note: string | null): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const { error } = await createAdminClient().from('tenants').update({ status, status_note: note?.trim() || null }).eq('id', await payer(tenantId));
  if (error) return fail(error);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function adminExtendTrial(tenantId: string, days: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const admin = createAdminClient();
  const target = await payer(tenantId);
  const { data } = await admin.from('tenants').select('trial_ends_at').eq('id', target).single();
  const base = data?.trial_ends_at && new Date(data.trial_ends_at) > new Date() ? new Date(data.trial_ends_at) : new Date();
  base.setDate(base.getDate() + days);
  const { error } = await admin.from('tenants').update({ status: 'trial', trial_ends_at: base.toISOString() }).eq('id', target);
  if (error) return fail(error);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

export async function adminSetPackage(tenantId: string, pkg: PackageId): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!PACKAGE_IDS.includes(pkg)) return fail('Nepoznat paket.');
  const { error } = await createAdminClient().from('tenants').update({ package: pkg, enabled_modules: [] }).eq('id', tenantId);
  if (error) return fail(error);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ---------------------------------------------------------------------
// Subscription: plan, term, paid until, notes, AI quota override
// ---------------------------------------------------------------------
const subscriptionSchema = z.object({
  plan: z.enum(PLAN_IDS as [PlanId, ...PlanId[]]),
  term: z.enum(['monthly', '24m']),
  paidUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  notes: z.string().trim().max(4000).nullable(),
  aiScan: z.number().int().min(0).max(100000).nullable(),
  aiCopilot: z.number().int().min(0).max(100000).nullable(),
  // AI phone minutes a month, add-on packs included.
  aiPhone: z.number().int().min(0).max(100000).nullable().optional(),
});

export async function adminUpdateSubscription(tenantId: string, values: z.input<typeof subscriptionSchema>): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = subscriptionSchema.safeParse(values);
  if (!parsed.success) return fail('Provjerite podatke pretplate.');
  const v = parsed.data;
  // Only what differs from the plan is kept as an override.
  const quota: Record<string, number> = {};
  if (v.aiScan !== null && v.aiScan !== PLANS[v.plan].ai.scan) quota.scan = v.aiScan;
  if (v.aiCopilot !== null && v.aiCopilot !== PLANS[v.plan].ai.copilot) quota.copilot = v.aiCopilot;
  if (v.aiPhone !== null && v.aiPhone !== undefined && v.aiPhone !== PLANS[v.plan].phoneCalls) quota.phone = v.aiPhone;
  const { error } = await createAdminClient()
    .from('tenants')
    .update({ plan: v.plan, billing_term: v.term, paid_until: v.paidUntil, admin_notes: v.notes || null, ai_quota: Object.keys(quota).length ? quota : null })
    .eq('id', await payer(tenantId));
  if (error) return fail(error);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// A payment moves "paid until" forward by the months paid, counted from
// today when the workshop was behind, and switches it on.
export async function adminRecordPayment(tenantId: string, amount: number, months: number, note: string | null): Promise<ActionResult<{ paidUntil: string }>> {
  const denied = await guard();
  if (denied) return denied;
  if (!(amount >= 0) || !Number.isInteger(months) || months < 1 || months > 36) return fail('Upišite iznos i broj mjeseci (1 do 36).');
  const admin = createAdminClient();
  tenantId = await payer(tenantId);
  const { data: tenant } = await admin.from('tenants').select('paid_until').eq('id', tenantId).single();
  const today = new Date().toISOString().slice(0, 10);
  const from = tenant?.paid_until && tenant.paid_until > today ? new Date(`${tenant.paid_until}T12:00:00Z`) : new Date(`${today}T12:00:00Z`);
  from.setUTCMonth(from.getUTCMonth() + months);
  const { error } = await admin.from('subscription_payments').insert({ tenant_id: tenantId, amount, months, note: note?.trim() || null });
  if (error) return fail(error);
  const paidUntil = from.toISOString().slice(0, 10);
  const { error: tenantError } = await admin.from('tenants').update({ paid_until: paidUntil, status: 'active', status_note: null }).eq('id', tenantId);
  if (tenantError) return fail(tenantError);
  await rewardReferrer(tenantId);
  revalidatePath('/admin', 'layout');
  return { ok: true, data: { paidUntil } };
}

// ---------------------------------------------------------------------
// Deleting a workshop: on request, or a year after it stopped paying
// (privacy policy). Typing its name confirms it. Files first, then the
// workshop (its rows go with it), then its people's logins; a tower
// account keeps its login. Never a shared demo workshop.
// ---------------------------------------------------------------------
export async function adminDeleteWorkshop(tenantId: string, confirmName: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const admin = createAdminClient();
  const { data: t } = await admin.from('tenants').select('id, name, settings').eq('id', tenantId).maybeSingle();
  if (!t) return fail('Radionica ne postoji.');
  if ((t.settings as { demo?: unknown } | null)?.demo === true) return fail('Demo radionica se ne briše.');
  if (confirmName.trim() !== t.name) return fail('Upišite točan naziv radionice.');
  const error = await deleteWorkshop(admin, tenantId);
  if (error) return fail(error);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ---------------------------------------------------------------------
// A new password for someone who forgot theirs (until e-mail does it):
// easy to read out and type on a phone, shown once to the tower. Never
// for the shared demo accounts or another tower account.
// ---------------------------------------------------------------------
const READABLE = 'abcdefghjkmnpqrstuvwxyz23456789';

function readablePassword(): string {
  const group = () => Array.from({ length: 4 }, () => READABLE[randomInt(READABLE.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}

export async function adminResetPassword(userId: string): Promise<ActionResult<{ password: string }>> {
  const denied = await guard();
  if (denied) return denied;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return fail('Neispravna osoba.');
  const admin = createAdminClient();
  const [{ data: person }, { data: tower }] = await Promise.all([
    admin.from('profiles').select('tenant_id, tenant:tenants(settings)').eq('id', userId).order('created_at').limit(1).maybeSingle(),
    admin.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);
  if (!person) return fail('Osoba nije pronađena.');
  if ((person.tenant as { settings?: { demo?: unknown } | null } | null)?.settings?.demo === true) return fail('Demo računi imaju zajedničku lozinku.');
  if (tower) return fail('Račun s pristupom Tornju mijenja lozinku sam.');
  const password = readablePassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return fail(error);
  return { ok: true, data: { password } };
}

// ---------------------------------------------------------------------
// AI phone: the workshop's number at Vapi (its id there, and the number
// the owner forwards to). Both empty switches it off.
// ---------------------------------------------------------------------
export async function adminSetPhoneAgent(tenantId: string, numberId: string, number: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const id = numberId.trim();
  const phone = number.trim();
  if ((id === '') !== (phone === '')) return fail('Upišite i Vapi ID broja i sam broj, ili ništa.');
  if (id && !/^[A-Za-z0-9-]{8,80}$/.test(id)) return fail('Vapi ID broja izgleda kao duga oznaka iz Vapija (Phone Numbers → ID).');
  if (phone && !/^\+\d{8,15}$/.test(phone.replace(/\s/g, ''))) return fail('Broj upišite s pozivnim, npr. +385 1 234 5678.');
  const { error } = await createAdminClient()
    .from('tenants')
    .update({ phone_agent_number_id: id || null, phone_agent_number: phone || null })
    .eq('id', tenantId);
  if (error) return fail(/duplicate|unique/i.test(error.message) ? 'Taj Vapi broj je već na drugoj radionici.' : error.message);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}

// ---------------------------------------------------------------------
// Help videos: one link per topic; an empty link removes the video
// ---------------------------------------------------------------------
export async function adminSetHelpVideo(topic: string, url: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!HELP_TOPIC_IDS.includes(topic)) return fail('Nepoznata tema.');
  const link = url.trim();
  const admin = createAdminClient();
  if (!link) {
    const { error } = await admin.from('help_videos').delete().eq('topic', topic);
    if (error) return fail(error);
  } else {
    let ok = false;
    try {
      ok = new URL(link).protocol === 'https:' && link.length <= 500;
    } catch {
      ok = false;
    }
    if (!ok) return fail('Zalijepite cijelu poveznicu koja počinje s https://');
    const { error } = await admin.from('help_videos').upsert({ topic, url: link, updated_at: new Date().toISOString() }, { onConflict: 'topic' });
    if (error) return fail(error);
  }
  revalidateTag('help-videos');
  revalidatePath('/admin/upute');
  return { ok: true };
}

// ---------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------
export async function adminSetErrorStatus(id: string, status: 'open' | 'resolved'): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const { error } = await createAdminClient()
    .from('app_errors')
    .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) return fail(error);
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
