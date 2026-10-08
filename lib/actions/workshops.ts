'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { PACKAGE_IDS, type PackageId } from '@/config/tenant.config';
import { fail, type ActionResult } from '@/lib/action-result';
import { getAuth, requireWorkshop } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { branchesAllowed, groupId, groupTenantIds, MAX_WORKSHOPS } from '@/lib/workshops';
import type { Tenant } from '@/types/db';

// Više radionica: open another of one's workshops, or add one (Premium).

// The owner taps a workshop in the list: it opens on every device.
export async function switchWorkshop(formData: FormData) {
  const tenantId = String(formData.get('tenant') ?? '');
  const { user } = await getAuth();
  if (!user) redirect('/login');
  if (/^[0-9a-f-]{36}$/i.test(tenantId)) {
    const admin = createAdminClient();
    const { data } = await admin.from('profiles').select('role').eq('id', user.id).eq('tenant_id', tenantId).maybeSingle();
    if (data?.role === 'owner') await admin.from('active_workshops').upsert({ user_id: user.id, tenant_id: tenantId, updated_at: new Date().toISOString() });
  }
  revalidatePath('/app', 'layout');
  redirect('/app');
}

const schema = z.object({
  name: z.string().trim().min(2, 'Upišite naziv radionice.').max(120),
  package: z.enum(PACKAGE_IDS as [PackageId, ...PackageId[]]),
  city: z.string().trim().max(80).optional().default(''),
  address: z.string().trim().max(200).optional().default(''),
});

// A branch: a workshop of its own (customers, jobs, invoices, people),
// paid through the main one. The owner lands in it.
export async function addWorkshop(values: z.input<typeof schema>): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Radionicu dodaje vlasnik.');
  const parsed = schema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite podatke.');
  const v = parsed.data;
  const admin = createAdminClient();
  const mainId = groupId(ctx.tenant);
  const { data: mainRow } = await admin.from('tenants').select('*').eq('id', mainId).single();
  const main = mainRow as Tenant | null;
  if (!main) return fail('Glavna radionica nije pronađena.');
  const allowed = branchesAllowed(main);
  if (allowed === 'demo') return fail('U demo verziji ne dodajete radionice. U svojoj radionici, uz paket Premium, imate do tri.');
  if (allowed === 'plan') return fail('Više radionica dolazi uz paket Premium.');
  const { data: mine } = await admin.from('profiles').select('role').eq('id', ctx.user.id).eq('tenant_id', mainId).maybeSingle();
  if (mine?.role !== 'owner') return fail('Radionicu dodaje vlasnik glavne radionice.');
  if ((await groupTenantIds(admin, main)).length >= MAX_WORKSHOPS) return fail(`Premium pokriva do ${MAX_WORKSHOPS} radionice. Za više se javite kroz „Javi problem”.`);

  const { data: tenantId, error } = await admin.rpc('register_workshop', {
    p_user_id: ctx.user.id,
    p_full_name: ctx.profile.full_name ?? '',
    p_workshop_name: v.name,
    p_package: v.package,
    p_oib: main.oib,
    p_phone: null,
    p_city: v.city || null,
    p_status: main.status,
    p_trial_days: 30,
  });
  if (error || !tenantId) return fail('Radionica nije stvorena. Pokušajte ponovno.');
  // The same firm: invoice details and hours come along; the fiscal marks
  // do not (every premises has its own).
  const s = (main.settings as Record<string, unknown> | null) ?? {};
  const settings = Object.fromEntries(Object.entries({ iban: s.iban, vat_registered: s.vat_registered, invoice_note: s.invoice_note, calendar: s.calendar }).filter(([, x]) => x !== undefined));
  const { error: patchError } = await admin
    .from('tenants')
    .update({
      main_tenant_id: main.id,
      status: main.status,
      status_note: main.status_note,
      trial_ends_at: main.trial_ends_at,
      plan: main.plan,
      billing_term: main.billing_term,
      paid_until: main.paid_until,
      founder_until: main.founder_until ?? null,
      ai_quota: main.ai_quota,
      terms_accepted_at: main.terms_accepted_at,
      terms_version: main.terms_version,
      email: main.email,
      address: v.address || null,
      settings,
    })
    .eq('id', tenantId as string);
  if (patchError) {
    await admin.from('tenants').delete().eq('id', tenantId as string);
    return fail(patchError);
  }
  await admin.from('active_workshops').upsert({ user_id: ctx.user.id, tenant_id: tenantId as string, updated_at: new Date().toISOString() });
  revalidatePath('/app', 'layout');
  return { ok: true };
}
