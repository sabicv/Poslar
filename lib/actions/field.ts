'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fail, type ActionResult } from '@/lib/action-result';
import { formatDateTime } from '@/lib/format';
import { randomId } from '@/lib/ids';
import { requireWorkshop, type WorkshopContext } from '@/lib/session';

// Field work: sites, appointments and the three taps on the road
// (Na putu → Stigao → Završio). Every step is stamped by the server and
// logged in the job's history; arrival also records the phone's GPS.

const jobPath = (id: string) => `/app/jobs/${id}`;

async function logEvent(ctx: WorkshopContext, jobId: string, type: string, message: string, metadata: Record<string, unknown> = {}) {
  await ctx.supabase.from('job_events').insert({ tenant_id: ctx.tenant.id, job_id: jobId, event_type: type, actor_id: ctx.user.id, message, metadata });
}

const who = (ctx: WorkshopContext) => ctx.profile.full_name || ctx.user.email || 'Korisnik';
const text = (max = 200) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

// Sites ------------------------------------------------------------------------
const siteSchema = z.object({
  client_id: z.string().uuid(),
  label: text(80),
  kind: z.enum(['house', 'flat', 'apartment', 'office', 'commercial', 'other']),
  address: z.string().trim().min(3, 'Upišite adresu.').max(200),
  city: text(80),
  postal_code: text(10),
  access_notes: text(500),
  contact_name: text(120),
  contact_phone: text(40),
});
export type SiteInput = z.input<typeof siteSchema>;

export async function saveSite(id: string | null, values: SiteInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkshop();
  const parsed = siteSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite adresu.');
  const query = id
    ? ctx.supabase.from('sites').update(parsed.data).eq('id', id).select('id').single()
    : ctx.supabase.from('sites').insert({ ...parsed.data, tenant_id: ctx.tenant.id }).select('id').single();
  const { data, error } = await query;
  if (error) return fail(error);
  revalidatePath(`/app/clients/${parsed.data.client_id}`);
  return { ok: true, data: { id: data.id as string } };
}

export async function deleteSite(id: string, clientId: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Brisanje je dopušteno voditelju servisa.');
  const { error, count } = await ctx.supabase.from('sites').delete({ count: 'exact' }).eq('id', id);
  if (error) return fail(error);
  if (!count) return fail('Nije obrisano.');
  revalidatePath(`/app/clients/${clientId}`);
  return { ok: true };
}

// Appointment -------------------------------------------------------------------
export async function scheduleJob(jobId: string, input: { start: string | null; durationMin: number | null; assignedTo: string | null }): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const start = input.start ? new Date(input.start) : null;
  if (start && Number.isNaN(start.getTime())) return fail('Neispravan termin.');
  const minutes = Math.min(Math.max(input.durationMin ?? 60, 15), 12 * 60);
  const { data: job } = await ctx.supabase.from('jobs').select('phase, work_mode').eq('id', jobId).single();
  if (!job) return fail('Nalog nije pronađen.');
  const patch: Record<string, unknown> = {
    scheduled_start: start?.toISOString() ?? null,
    scheduled_end: start ? new Date(start.getTime() + minutes * 60000).toISOString() : null,
    assigned_to: input.assignedTo,
  };
  // On the road a booked visit is "Zakazano"; a workshop job keeps its phase.
  if (start && job.phase === 'intake' && job.work_mode === 'field') patch.phase = 'diagnosis';
  const { error } = await ctx.supabase.from('jobs').update(patch).eq('id', jobId);
  if (error) return fail(error);
  let tech = '';
  if (input.assignedTo) {
    const { data } = await ctx.supabase.from('profiles').select('full_name').eq('id', input.assignedTo).single();
    tech = data?.full_name ? ` · ${data.full_name}` : '';
  }
  await logEvent(ctx, jobId, 'schedule', start ? `Zakazano ${formatDateTime(start.toISOString())}${tech}` : 'Termin uklonjen');
  revalidatePath(jobPath(jobId));
  revalidatePath('/app');
  return { ok: true };
}

// On the road --------------------------------------------------------------------
export async function fieldStep(jobId: string, step: 'departed' | 'arrived' | 'left', gps?: { lat: number; lng: number } | null): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const { data: job } = await ctx.supabase.from('jobs').select('phase, site_id, departed_at, arrived_at, left_at').eq('id', jobId).single();
  if (!job) return fail('Nalog nije pronađen.');
  const now = new Date().toISOString();
  const early = ['intake', 'diagnosis', 'awaiting_approval', 'awaiting_parts'].includes(job.phase as string);
  const patch: Record<string, unknown> = {};
  let message = '';

  if (step === 'departed') {
    patch.departed_at = now;
    message = `Krenuo na teren · ${who(ctx)}`;
  } else if (step === 'arrived') {
    patch.arrived_at = now;
    if (!job.departed_at) patch.departed_at = now;
    if (gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lng) && Math.abs(gps.lat) <= 90 && Math.abs(gps.lng) <= 180) {
      patch.arrived_lat = gps.lat;
      patch.arrived_lng = gps.lng;
    }
    if (early) patch.phase = 'in_progress';
    message = `Stigao na lokaciju${gps ? ' (GPS zabilježen)' : ''} · ${who(ctx)}`;
  } else {
    patch.left_at = now;
    if (!job.arrived_at) patch.arrived_at = now;
    if (early || job.phase === 'in_progress' || job.phase === 'quality_check') {
      patch.phase = 'ready';
      patch.finished_at = now;
    }
    message = `Završio na lokaciji · ${who(ctx)}`;
  }

  const { error } = await ctx.supabase.from('jobs').update(patch).eq('id', jobId);
  if (error) return fail(error);

  // The first arrival teaches the site its GPS pin (navigation gets exact).
  if (step === 'arrived' && gps && job.site_id) {
    await ctx.supabase.from('sites').update({ lat: gps.lat, lng: gps.lng }).eq('id', job.site_id).is('lat', null);
  }
  await logEvent(ctx, jobId, `field_${step}`, message, gps ? { lat: gps.lat, lng: gps.lng } : {});
  revalidatePath(jobPath(jobId));
  revalidatePath('/app');
  return { ok: true };
}

export async function markCustomerNotified(jobId: string, etaText: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const { error } = await ctx.supabase.from('jobs').update({ customer_notified_at: new Date().toISOString() }).eq('id', jobId);
  if (error) return fail(error);
  await logEvent(ctx, jobId, 'notified', `Klijent obaviješten: na putu, dolazak ${etaText.slice(0, 40)}`);
  revalidatePath(jobPath(jobId));
  return { ok: true };
}

// Customer report link ----------------------------------------------------------
export async function markReportShared(jobId: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const { error } = await ctx.supabase.from('jobs').update({ report_shared_at: new Date().toISOString() }).eq('id', jobId);
  if (error) return fail(error);
  await logEvent(ctx, jobId, 'report', `Izvještaj poslan klijentu · ${who(ctx)}`);
  revalidatePath(jobPath(jobId));
  return { ok: true };
}

// A new link makes the old one stop working (sent to the wrong number…).
export async function renewReportLink(jobId: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Novu poveznicu izrađuje voditelj servisa.');
  const { error } = await ctx.supabase.from('jobs').update({ report_token: randomId(), report_shared_at: null }).eq('id', jobId);
  if (error) return fail(error);
  await logEvent(ctx, jobId, 'report', 'Stara poveznica izvještaja poništena');
  revalidatePath(jobPath(jobId));
  return { ok: true };
}

// Maintenance plans -------------------------------------------------------------
export async function markPlanReminded(planId: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const { error } = await ctx.supabase.from('maintenance_plans').update({ last_reminded_at: new Date().toISOString() }).eq('id', planId);
  if (error) return fail(error);
  revalidatePath('/app/module');
  return { ok: true };
}
