'use server';

import { revalidatePath } from 'next/cache';
import { WA_TEMPLATES, type WaKind } from '@/config/whatsapp';
import { fail, type ActionResult } from '@/lib/action-result';
import { requireWorkshop } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyJob } from '@/lib/whatsapp';

// "Potvrdi termin": Poslar sends the confirmation from the shared number.
export async function confirmAppointment(jobId: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return fail('Nalog nije pronađen.');
  // Row Level Security: only a job of the caller's own workshop is found.
  const { data: job } = await ctx.supabase.from('jobs').select('id').eq('id', jobId).maybeSingle();
  if (!job) return fail('Nalog nije pronađen.');
  const result = await notifyJob(createAdminClient(), jobId, 'confirm', { actorId: ctx.user.id });
  if (!result.ok) return fail(result.message);
  revalidatePath(`/app/jobs/${jobId}`);
  return { ok: true };
}

// Postavke: which automatic messages go out.
export async function setWhatsappKind(kind: WaKind, enabled: boolean): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Poruke uključuje voditelj servisa.');
  if (!(kind in WA_TEMPLATES)) return fail('Nepoznata poruka.');
  const settings = (ctx.tenant.settings as Record<string, unknown> | null) ?? {};
  const whatsapp = { ...((settings.whatsapp as Record<string, boolean> | undefined) ?? {}), [kind]: enabled };
  const { error } = await ctx.supabase.from('tenants').update({ settings: { ...settings, whatsapp } }).eq('id', ctx.tenant.id);
  if (error) return fail(error);
  revalidatePath('/app/settings/poruke');
  return { ok: true };
}
