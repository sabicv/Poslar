'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fail, type ActionResult } from '@/lib/action-result';
import { endSampleDay } from '@/lib/sample-day';
import { getAuth, getWorkshop } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteWorkshop } from '@/lib/workshop-delete';

// The owner of a workshop on its 24-hour trial, during it or after it.
async function sampleOwner(): Promise<string | null> {
  const state = await getWorkshop();
  if (state.kind === 'active') return state.isOwner && state.tenant.sample_until ? state.tenant.id : null;
  if (state.kind === 'locked' && state.reason === 'sample_ended' && state.role === 'owner' && state.tenantId) return state.tenantId;
  return null;
}

// "Krenite 30 dana besplatno" / "Pređite na prave poslove".
export async function moveToRealWork(): Promise<ActionResult> {
  const tenantId = await sampleOwner();
  if (!tenantId) return fail('Ovo odlučuje voditelj radionice.');
  const error = await endSampleDay(createAdminClient(), tenantId);
  if (error) return fail(error);
  revalidatePath('/app', 'layout');
  return { ok: true };
}

const feedbackSchema = z.object({
  stars: z.number().int().min(1, 'Odaberite ocjenu.').max(5),
  body: z.string().trim().max(4000).optional(),
  mayPublish: z.boolean(),
});

// "Ukloni podatke i ostavi povratnu informaciju": the review is kept for
// TaktiX, the workshop and its logins are deleted, the owner signed out.
export async function leaveAfterTrial(values: z.input<typeof feedbackSchema>): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite unos.');
  const tenantId = await sampleOwner();
  if (!tenantId) return fail('Ovo odlučuje voditelj radionice.');
  const admin = createAdminClient();
  const { supabase, user } = await getAuth();
  const [{ data: t }, { data: owner }] = await Promise.all([
    admin.from('tenants').select('name, package, news_consent_at, settings').eq('id', tenantId).maybeSingle(),
    admin.from('profiles').select('full_name').eq('id', user!.id).maybeSingle(),
  ]);
  if (!t || (t.settings as { demo?: unknown } | null)?.demo === true) return fail('Radionica ne postoji.');
  const { error } = await admin.from('trial_feedback').insert({
    workshop: t.name,
    owner_name: owner?.full_name ?? null,
    email: user!.email ?? null,
    package: t.package,
    stars: parsed.data.stars,
    body: parsed.data.body || null,
    may_publish: parsed.data.mayPublish,
    news_consent: Boolean(t.news_consent_at),
  });
  if (error) return fail(error);
  await supabase.auth.signOut({ scope: 'local' });
  const deleteError = await deleteWorkshop(admin, tenantId);
  if (deleteError) return fail(deleteError);
  return { ok: true };
}
