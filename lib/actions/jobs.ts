'use server';

import { plural } from '@/lib/format';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CLIMATE_TYPES, PACKAGES, PHASE_ORDER, defaultMeterUnit, phaseLabel, type AssetType, type JobPhase, type LineKind } from '@/config/tenant.config';
import { fail, type ActionResult } from '@/lib/action-result';
import { requireWorkshop, type WorkshopContext } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getInspectionTemplates, getJobTemplates } from '@/lib/templates';
import type { InspectionStatus, LineApproval, LinePriority } from '@/types/db';

const jobPath = (id: string) => `/app/jobs/${id}`;

async function logEvent(ctx: WorkshopContext, jobId: string, type: string, message: string, metadata: Record<string, unknown> = {}) {
  await ctx.supabase.from('job_events').insert({ tenant_id: ctx.tenant.id, job_id: jobId, event_type: type, actor_id: ctx.user.id, message, metadata });
}

function actorName(ctx: WorkshopContext) {
  return ctx.profile.full_name || ctx.user.email || 'Korisnik';
}

// ---------------------------------------------------------------------
// New work order
// ---------------------------------------------------------------------
const optionalText = z.string().trim().max(200).optional().transform((v) => (v ? v : null));
const assetTypes = Object.values(PACKAGES).flatMap((p) => p.assetTypes) as [AssetType, ...AssetType[]];

const newJobSchema = z.object({
  clientId: z.string().uuid().nullable(),
  newClient: z
    .object({
      kind: z.enum(['person', 'company']),
      firstName: optionalText,
      lastName: optionalText,
      companyName: optionalText,
      phone: optionalText,
      email: optionalText,
      oib: z.string().trim().regex(/^\d{11}$/, 'OIB ima 11 znamenki.').optional().or(z.literal('')).transform((v) => v || null),
    })
    .nullable(),
  assetId: z.string().uuid().nullable(),
  newAsset: z
    .object({
      assetType: z.enum(assetTypes),
      identifier: optionalText,
      make: optionalText,
      model: optionalText,
      year: z.number().int().min(1900).max(2100).nullable(),
      vin: optionalText.transform((v) => (v ? v.toUpperCase() : null)),
    })
    .nullable(),
  complaint: z.string().trim().max(4000),
  meterIn: z.number().min(0).max(99999999).nullable(),
  templateCode: z.string().nullable(),
  isUrgent: z.boolean(),
  promisedAt: z.string().nullable(),
  source: z.enum(['workshop', 'phone', 'field']),
  // Field work: where, when and who (all optional for the workshop).
  field: z
    .object({
      siteId: z.string().uuid().nullable(),
      newSite: z
        .object({
          address: z.string().trim().min(3, 'Upišite adresu lokacije.').max(200),
          city: optionalText,
          kind: z.enum(['house', 'flat', 'apartment', 'office', 'commercial', 'other']),
          accessNotes: z.string().trim().max(500).optional().transform((v) => (v ? v : null)),
        })
        .nullable(),
      scheduledStart: z.string().nullable(),
      durationMin: z.number().int().min(15).max(720).nullable(),
      assignedTo: z.string().uuid().nullable(),
      planId: z.string().uuid().nullable(),
    })
    .nullable()
    .optional(),
});

export type NewJobInput = z.input<typeof newJobSchema>;

export async function createJob(input: NewJobInput): Promise<ActionResult<{ id: string; warning?: string }>> {
  const ctx = await requireWorkshop();
  const parsed = newJobSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite podatke.');
  const v = parsed.data;
  const tenant_id = ctx.tenant.id;

  let clientId = v.clientId;
  if (!clientId) {
    const c = v.newClient;
    if (!c || !(c.companyName || c.lastName || c.firstName)) return fail(`Upišite ime ili naziv (${ctx.pkg.vocabulary.client.one.toLowerCase()}).`);
    const { data, error } = await ctx.supabase
      .from('clients')
      .insert({ tenant_id, kind: c.kind, first_name: c.firstName, last_name: c.lastName, company_name: c.companyName, phone: c.phone, email: c.email, oib: c.oib })
      .select('id')
      .single();
    if (error) return fail(error);
    clientId = data.id as string;
  }

  // Field job: an existing site of this client, or a new one.
  const f = v.field ?? null;
  let siteId: string | null = null;
  if (f) {
    if (f.siteId) {
      const { data } = await ctx.supabase.from('sites').select('client_id').eq('id', f.siteId).single();
      if (!data || data.client_id !== clientId) return fail('Lokacija ne pripada odabranom klijentu.');
      siteId = f.siteId;
    } else if (f.newSite) {
      const { data, error } = await ctx.supabase
        .from('sites')
        .insert({ tenant_id, client_id: clientId, address: f.newSite.address, city: f.newSite.city, kind: f.newSite.kind, access_notes: f.newSite.accessNotes })
        .select('id')
        .single();
      if (error) return fail(error);
      siteId = data.id as string;
    } else {
      return fail('Odaberite ili upišite lokaciju (adresu).');
    }
  }

  let assetId = v.assetId;
  let meterUnit = 'km';
  if (!assetId) {
    const a = v.newAsset;
    if (!a) return fail(`Odaberite ili upišite: ${ctx.pkg.vocabulary.asset.one.toLowerCase()}.`);
    meterUnit = defaultMeterUnit(a.assetType);
    const { data, error } = await ctx.supabase
      .from('assets')
      .insert({ tenant_id, client_id: clientId, site_id: siteId, asset_type: a.assetType, identifier: a.identifier && !CLIMATE_TYPES.includes(a.assetType) ? a.identifier.toUpperCase() : a.identifier, make: a.make, model: a.model, year: a.year, vin: a.vin, meter_primary_unit: meterUnit })
      .select('id')
      .single();
    if (error) return fail(error);
    assetId = data.id as string;
  } else {
    const { data } = await ctx.supabase.from('assets').select('meter_primary_unit, client_id').eq('id', assetId).single();
    if (!data) return fail('Objekt nije pronađen.');
    meterUnit = data.meter_primary_unit as string;
    clientId = data.client_id as string;
  }

  const start = f?.scheduledStart ? new Date(f.scheduledStart) : null;
  if (start && Number.isNaN(start.getTime())) return fail('Neispravan termin.');
  const { data: job, error } = await ctx.supabase
    .from('jobs')
    .insert({
      tenant_id,
      client_id: clientId,
      asset_id: assetId,
      complaint: v.complaint || null,
      meter_in: v.meterIn,
      meter_unit: meterUnit,
      is_urgent: v.isUrgent,
      promised_at: v.promisedAt,
      source: f ? 'field' : v.source,
      created_by: ctx.user.id,
      assigned_to: f?.assignedTo ?? (ctx.isOwner ? null : ctx.user.id),
      work_mode: f ? 'field' : 'workshop',
      site_id: siteId,
      scheduled_start: start?.toISOString() ?? null,
      scheduled_end: start ? new Date(start.getTime() + (f?.durationMin ?? 60) * 60000).toISOString() : null,
      phase: start ? 'diagnosis' : 'intake',
      plan_id: f?.planId ?? null,
    })
    .select('id, number')
    .single();
  if (error) return fail(error);

  if (v.meterIn !== null) {
    await ctx.supabase.from('meter_readings').insert({ tenant_id, asset_id: assetId, job_id: job.id, unit: meterUnit, value: v.meterIn, source: 'intake', created_by: ctx.user.id });
  }
  await logEvent(ctx, job.id, 'created', `Nalog ${job.number} otvoren · ${actorName(ctx)}`);

  // The job exists either way; a template that fails is reported, not hidden.
  const template = v.templateCode ? await insertTemplate(ctx, job.id, v.templateCode) : null;
  const warning = template && !template.ok ? `Nalog je otvoren, ali predložak nije dodan (${template.error}). Dodajte ga u kartici Stavke.` : undefined;

  revalidatePath('/app');
  return { ok: true, data: { id: job.id as string, warning } };
}

// Template lines go in with the user's rights; their default prices come
// from the workshop's own configuration, so they are written with the
// service role even when a worker opens the job (workers can't write prices).
async function insertTemplate(ctx: WorkshopContext, jobId: string, code: string): Promise<ActionResult> {
  const template = (await getJobTemplates(ctx)).find((t) => t.code === code);
  if (!template) return fail('Predložak nije pronađen.');
  const { data: last } = await ctx.supabase.from('job_lines').select('sort').eq('job_id', jobId).order('sort', { ascending: false }).limit(1);
  const start = ((last?.[0]?.sort as number | undefined) ?? 0) + 1;

  const { data: lines, error } = await ctx.supabase
    .from('job_lines')
    .insert(
      template.lines.map((line, i) => ({
        tenant_id: ctx.tenant.id,
        job_id: jobId,
        sort: start + i,
        kind: line.kind,
        code: line.code ?? null,
        description: line.description,
        qty: line.qty,
        unit: line.unit,
        source: 'template',
        template_code: template.code,
      }))
    )
    .select('id, sort');
  if (error) return fail(error);

  const prices = (lines ?? [])
    .map((row) => ({ row, line: template.lines[(row.sort as number) - start] }))
    .filter(({ line }) => line?.price !== undefined)
    .map(({ row, line }) => ({ job_line_id: row.id, tenant_id: ctx.tenant.id, unit_price: line.price }));
  if (prices.length > 0) {
    const writer = ctx.isOwner ? ctx.supabase : createAdminClient();
    const { error: priceError } = await writer.from('job_line_prices').insert(prices);
    if (priceError) return fail(priceError);
  }
  await logEvent(ctx, jobId, 'template', `Dodan predložak: ${template.name}`);
  return { ok: true };
}

export async function applyTemplate(jobId: string, code: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const result = await insertTemplate(ctx, jobId, code);
  revalidatePath(jobPath(jobId));
  return result;
}

// ---------------------------------------------------------------------
// Job fields, phase, payment, lock
// ---------------------------------------------------------------------
const jobPatchSchema = z
  .object({
    complaint: z.string().max(4000).nullable(),
    diagnosis_notes: z.string().max(8000).nullable(),
    work_summary: z.string().max(8000).nullable(),
    meter_out: z.number().min(0).nullable(),
    promised_at: z.string().nullable(),
    bay: z.string().max(40).nullable(),
    assigned_to: z.string().uuid().nullable(),
    is_urgent: z.boolean(),
    sub_status: z.string().max(80).nullable(),
  })
  .partial();

export async function updateJob(jobId: string, patch: z.input<typeof jobPatchSchema>): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const parsed = jobPatchSchema.safeParse(patch);
  if (!parsed.success) return fail('Provjerite podatke.');
  const { error } = await ctx.supabase.from('jobs').update(parsed.data).eq('id', jobId);
  if (error) return fail(error);
  if (parsed.data.assigned_to !== undefined) {
    const { data: who } = parsed.data.assigned_to
      ? await ctx.supabase.from('profiles').select('full_name').eq('id', parsed.data.assigned_to).single()
      : { data: null };
    await logEvent(ctx, jobId, 'assigned', who ? `Dodijeljeno: ${who.full_name ?? 'radnik'}` : 'Dodjela uklonjena');
  }
  revalidatePath(jobPath(jobId));
  return { ok: true };
}

export async function setJobPhase(jobId: string, phase: JobPhase): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!PHASE_ORDER.includes(phase)) return fail('Nepoznata faza.');
  const { data: job } = await ctx.supabase.from('jobs').select('finished_at, collected_at, locked_at').eq('id', jobId).single();
  if (!job) return fail('Nalog nije pronađen.');
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { phase };
  if ((phase === 'ready' || phase === 'collected') && !job.finished_at) patch.finished_at = now;
  if (phase === 'collected' && !job.collected_at) patch.collected_at = now;
  if (phase !== 'collected') patch.collected_at = null;
  if (PHASE_ORDER.indexOf(phase) < PHASE_ORDER.indexOf('ready')) patch.finished_at = null;
  const { error } = await ctx.supabase.from('jobs').update(patch).eq('id', jobId);
  if (error) return fail(error);
  await logEvent(ctx, jobId, 'phase', `${phaseLabel(ctx.pkg, phase)} · ${actorName(ctx)}`, { phase });
  revalidatePath(jobPath(jobId));
  revalidatePath('/app');
  return { ok: true };
}

export async function setJobPaid(jobId: string, paid: boolean): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Samo voditelj servisa mijenja naplatu.');
  const { error } = await ctx.supabase
    .from('jobs')
    .update({ payment_status: paid ? 'paid' : 'unpaid', paid_at: paid ? new Date().toISOString() : null })
    .eq('id', jobId);
  if (error) return fail(error);
  await logEvent(ctx, jobId, 'payment', paid ? 'Označeno plaćeno' : 'Vraćeno na "Za naplatu"');
  revalidatePath(jobPath(jobId));
  revalidatePath('/app');
  return { ok: true };
}

export async function setJobLocked(jobId: string, locked: boolean): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Samo voditelj servisa zaključava i otključava nalog.');
  const { error } = await ctx.supabase.from('jobs').update({ locked_at: locked ? new Date().toISOString() : null }).eq('id', jobId);
  if (error) return fail(error);
  await logEvent(ctx, jobId, 'lock', locked ? `Zaključano · ${actorName(ctx)}` : `Otključano · ${actorName(ctx)}`);
  revalidatePath(jobPath(jobId));
  return { ok: true };
}

export async function deleteJob(jobId: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Samo voditelj servisa briše naloge.');
  const { data: files } = await ctx.supabase.from('attachments').select('path, has_thumb').eq('job_id', jobId);
  const { error, count } = await ctx.supabase.from('jobs').delete({ count: 'exact' }).eq('id', jobId);
  if (error) return fail(error);
  if (!count) return fail('Nalog nije obrisan.');
  const paths = (files ?? []).flatMap((f) => (f.has_thumb ? [f.path, `${f.path}.thumb.jpg`] : [f.path]));
  if (paths.length) await ctx.supabase.storage.from('job-files').remove(paths);
  revalidatePath('/app');
  return { ok: true };
}

// ---------------------------------------------------------------------
// Lines and prices
// ---------------------------------------------------------------------
const lineSchema = z.object({
  kind: z.enum(['labor', 'part', 'material', 'package', 'sublet', 'fee']),
  description: z.string().trim().min(1, 'Upišite opis stavke.').max(500),
  code: z.string().trim().max(80).nullable().optional(),
  qty: z.number().min(0).max(100000),
  unit: z.string().trim().min(1).max(20),
  priority: z.enum(['urgent', 'recommended', 'optional']).nullable().optional(),
  approval: z.enum(['proposed', 'approved', 'declined', 'deferred']).optional(),
  time_spent_h: z.number().min(0).max(1000).nullable().optional(),
});

const priceSchema = z.object({
  unit_price: z.number().min(0).max(1000000),
  discount_pct: z.number().min(0).max(100).default(0),
  vat_rate: z.number().min(0).max(100).default(25),
  purchase_price: z.number().min(0).nullable().optional(),
});

export async function addLine(jobId: string, line: z.input<typeof lineSchema>, price?: z.input<typeof priceSchema>): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const parsed = lineSchema.safeParse(line);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite stavku.');
  const { data: last } = await ctx.supabase.from('job_lines').select('sort').eq('job_id', jobId).order('sort', { ascending: false }).limit(1);
  const { data, error } = await ctx.supabase
    .from('job_lines')
    .insert({ ...parsed.data, tenant_id: ctx.tenant.id, job_id: jobId, sort: ((last?.[0]?.sort as number | undefined) ?? 0) + 1, technician_id: ctx.isOwner ? null : ctx.user.id })
    .select('id')
    .single();
  if (error) return fail(error);
  if (price && ctx.isOwner) {
    const p = priceSchema.safeParse(price);
    if (p.success) {
      const { error: priceError } = await ctx.supabase.from('job_line_prices').insert({ ...p.data, job_line_id: data.id, tenant_id: ctx.tenant.id });
      if (priceError) return fail(priceError);
    }
  }
  revalidatePath(jobPath(jobId));
  return { ok: true };
}

export async function updateLine(jobId: string, lineId: string, patch: Partial<z.input<typeof lineSchema>>): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const parsed = lineSchema.partial().safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite stavku.');
  const { error } = await ctx.supabase.from('job_lines').update(parsed.data).eq('id', lineId);
  if (error) return fail(error);
  revalidatePath(jobPath(jobId));
  return { ok: true };
}

export async function setLineApproval(jobId: string, lineId: string, approval: LineApproval): Promise<ActionResult> {
  return updateLine(jobId, lineId, { approval });
}

export async function setLinePrice(jobId: string, lineId: string, price: z.input<typeof priceSchema>): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Cijene uređuje voditelj servisa.');
  const parsed = priceSchema.safeParse(price);
  if (!parsed.success) return fail('Provjerite cijenu.');
  const { error } = await ctx.supabase
    .from('job_line_prices')
    .upsert({ ...parsed.data, job_line_id: lineId, tenant_id: ctx.tenant.id, updated_at: new Date().toISOString() }, { onConflict: 'job_line_id' });
  if (error) return fail(error);
  revalidatePath(jobPath(jobId));
  return { ok: true };
}

export async function deleteLine(jobId: string, lineId: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const { error } = await ctx.supabase.from('job_lines').delete().eq('id', lineId);
  if (error) return fail(error);
  revalidatePath(jobPath(jobId));
  return { ok: true };
}

// ---------------------------------------------------------------------
// Inspections (DVI, checklists, seasonal protocols)
// ---------------------------------------------------------------------
export async function startInspection(jobId: string, templateCode: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkshop();
  const template = (await getInspectionTemplates(ctx)).find((t) => t.code === templateCode);
  if (!template) return fail('Obrazac nije pronađen.');
  const { data: job } = await ctx.supabase.from('jobs').select('meter_in').eq('id', jobId).single();
  const { data, error } = await ctx.supabase
    .from('inspections')
    .insert({ tenant_id: ctx.tenant.id, job_id: jobId, template_code: template.code, title: template.name, performed_by: ctx.user.id, meter_value: job?.meter_in ?? null })
    .select('id')
    .single();
  if (error) return fail(error);
  await logEvent(ctx, jobId, 'inspection', `Započeto: ${template.name}`);
  revalidatePath(jobPath(jobId));
  return { ok: true, data: { id: data.id as string } };
}

export async function saveInspectionResult(
  jobId: string,
  inspectionId: string,
  itemCode: string,
  patch: { status?: InspectionStatus; measure_value?: number | null; measure_unit?: string | null; note?: string | null; photo_ids?: string[] }
): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const parsed = z
    .object({
      status: z.enum(['ok', 'warn', 'crit', 'not_checked', 'na']).optional(),
      measure_value: z.number().finite().nullable().optional(),
      measure_unit: z.string().max(20).nullable().optional(),
      note: z.string().max(1000).nullable().optional(),
      photo_ids: z.array(z.string().uuid()).max(20).optional(),
    })
    .safeParse(patch);
  if (!parsed.success || !/^[\w.-]{1,40}$/.test(itemCode)) return fail('Neispravan unos.');
  const { error } = await ctx.supabase
    .from('inspection_results')
    .upsert(
      { tenant_id: ctx.tenant.id, inspection_id: inspectionId, item_code: itemCode, ...parsed.data, updated_at: new Date().toISOString() },
      { onConflict: 'inspection_id,item_code' }
    );
  if (error) return fail(error);
  return { ok: true };
}

export async function completeInspection(jobId: string, inspectionId: string, done: boolean): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const { error } = await ctx.supabase.from('inspections').update({ completed_at: done ? new Date().toISOString() : null }).eq('id', inspectionId);
  if (error) return fail(error);
  if (done) await logEvent(ctx, jobId, 'inspection', `Inspekcija završena · ${actorName(ctx)}`);
  revalidatePath(jobPath(jobId));
  return { ok: true };
}

export async function deleteInspection(jobId: string, inspectionId: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const { error } = await ctx.supabase.from('inspections').delete().eq('id', inspectionId);
  if (error) return fail(error);
  revalidatePath(jobPath(jobId));
  return { ok: true };
}

// Every yellow and red finding becomes a proposed line the customer can
// approve by link: red → Hitno, yellow → Preporučeno.
export async function linesFromInspection(jobId: string, inspectionId: string): Promise<ActionResult<{ count: number }>> {
  const ctx = await requireWorkshop();
  const { data: inspection } = await ctx.supabase.from('inspections').select('template_code').eq('id', inspectionId).single();
  if (!inspection) return fail('Inspekcija nije pronađena.');
  const template = (await getInspectionTemplates(ctx)).find((t) => t.code === inspection.template_code);
  const labels = new Map(template?.sections.flatMap((s) => s.items.map((i) => [i.code, i.label] as const)) ?? []);

  const { data: results } = await ctx.supabase
    .from('inspection_results')
    .select('id, item_code, status, note, measure_value, measure_unit')
    .eq('inspection_id', inspectionId)
    .in('status', ['warn', 'crit'])
    .is('job_line_id', null);
  if (!results?.length) return { ok: true, data: { count: 0 } };

  const { data: last } = await ctx.supabase.from('job_lines').select('sort').eq('job_id', jobId).order('sort', { ascending: false }).limit(1);
  const start = ((last?.[0]?.sort as number | undefined) ?? 0) + 1;

  // One insert for all findings; each line carries its inspection_result_id,
  // which is how the results are linked back below.
  const { data: inserted, error } = await ctx.supabase
    .from('job_lines')
    .insert(
      results.map((r, i) => {
        const label = labels.get(r.item_code as string) ?? (r.item_code as string);
        const measure = r.measure_value !== null ? ` (${r.measure_value} ${r.measure_unit ?? ''})`.replace(' )', ')') : '';
        return {
          tenant_id: ctx.tenant.id,
          job_id: jobId,
          sort: start + i,
          kind: 'labor' as LineKind,
          description: `${label}${measure}${r.note ? `: ${r.note}` : ''}`,
          qty: 1,
          unit: 'kom',
          priority: (r.status === 'crit' ? 'urgent' : 'recommended') as LinePriority,
          approval: 'proposed',
          source: 'inspection',
          inspection_result_id: r.id,
        };
      })
    )
    .select('id, inspection_result_id');
  if (error) return fail(error);
  const links = await Promise.all(
    (inserted ?? []).map((line) => ctx.supabase.from('inspection_results').update({ job_line_id: line.id }).eq('id', line.inspection_result_id))
  );
  if (links.some((l) => l.error)) return fail('Stavke su dodane, ali dio nalaza nije povezan. Osvježite stranicu.');
  await logEvent(ctx, jobId, 'inspection', `Iz inspekcije predloženo: ${results.length} ${plural(results.length, 'stavka', 'stavke', 'stavki')}`);
  revalidatePath(jobPath(jobId));
  return { ok: true, data: { count: results.length } };
}

// ---------------------------------------------------------------------
// Condition report (intake / handover)
// ---------------------------------------------------------------------
const reportSchema = z.object({
  diagram: z.enum(['car', 'truck', 'moto', 'atv', 'boat']),
  marks: z.array(z.object({ zone: z.string().max(60), code: z.enum(['O', 'U', 'P', 'K', 'L', 'N']), note: z.string().max(200).optional() })).max(200),
  equipment: z.array(z.object({ item: z.string().max(80), present: z.boolean() })).max(60),
  fuel_level: z.enum(['0', '1/4', '1/2', '3/4', '1']).nullable(),
});

export async function saveConditionReport(jobId: string, kind: 'intake' | 'handover', report: z.input<typeof reportSchema>): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const parsed = reportSchema.safeParse(report);
  if (!parsed.success) return fail('Provjerite zapisnik.');
  const { error } = await ctx.supabase
    .from('condition_reports')
    .upsert({ ...parsed.data, tenant_id: ctx.tenant.id, job_id: jobId, kind, staff_id: ctx.user.id, updated_at: new Date().toISOString() }, { onConflict: 'job_id,kind' });
  if (error) return fail(error);
  revalidatePath(jobPath(jobId));
  return { ok: true };
}

export async function signConditionReport(jobId: string, kind: 'intake' | 'handover', signerName: string, signaturePath: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!signaturePath.startsWith(`${ctx.tenant.id}/`)) return fail('Neispravan potpis.');
  const { error } = await ctx.supabase
    .from('condition_reports')
    .update({ signer_name: signerName.trim() || null, signature_path: signaturePath, signed_at: new Date().toISOString() })
    .eq('job_id', jobId)
    .eq('kind', kind);
  if (error) return fail(error);
  await logEvent(ctx, jobId, 'signature', `Zapisnik (${kind === 'intake' ? 'prijem' : 'predaja'}) potpisan · ${signerName || 'stranka'}`);
  revalidatePath(jobPath(jobId));
  return { ok: true };
}

// ---------------------------------------------------------------------
// Photos and files
// ---------------------------------------------------------------------
const attachmentSchema = z.object({
  jobId: z.string().uuid().nullable(),
  assetId: z.string().uuid().nullable(),
  path: z.string().min(10).max(400),
  mime: z.string().max(100).nullable(),
  sizeBytes: z.number().int().min(0).nullable(),
  tag: z.string().max(40).nullable(),
  caption: z.string().max(500).nullable(),
  stage: z.enum(['before', 'during', 'after']).nullable(),
  zone: z.string().max(60).nullable(),
  hasThumb: z.boolean(),
  takenAt: z.string().nullable(),
  gpsLat: z.number().nullable(),
  gpsLng: z.number().nullable(),
  sha256: z.string().max(80).nullable(),
});

export async function registerAttachment(input: z.input<typeof attachmentSchema>): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkshop();
  const parsed = attachmentSchema.safeParse(input);
  if (!parsed.success) return fail('Neispravna datoteka.');
  const a = parsed.data;
  if (!a.path.startsWith(`${ctx.tenant.id}/`)) return fail('Neispravna putanja datoteke.');
  const { data, error } = await ctx.supabase
    .from('attachments')
    .insert({
      tenant_id: ctx.tenant.id,
      job_id: a.jobId,
      asset_id: a.assetId,
      path: a.path,
      mime: a.mime,
      size_bytes: a.sizeBytes,
      tag: a.tag,
      caption: a.caption,
      stage: a.stage,
      zone: a.zone,
      has_thumb: a.hasThumb,
      taken_at: a.takenAt,
      gps_lat: a.gpsLat,
      gps_lng: a.gpsLng,
      sha256: a.sha256,
      created_by: ctx.user.id,
    })
    .select('id')
    .single();
  if (error) return fail(error);
  if (a.jobId) revalidatePath(jobPath(a.jobId));
  return { ok: true, data: { id: data.id as string } };
}

export async function updateAttachment(id: string, jobId: string | null, patch: { tag?: string | null; caption?: string | null; visibility?: 'internal' | 'customer' | 'insurer'; stage?: 'before' | 'during' | 'after' | null }): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const { error } = await ctx.supabase.from('attachments').update(patch).eq('id', id);
  if (error) return fail(error);
  if (jobId) revalidatePath(jobPath(jobId));
  return { ok: true };
}

export async function deleteAttachment(id: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const { data: row } = await ctx.supabase.from('attachments').select('path, has_thumb, job_id').eq('id', id).single();
  if (!row) return fail('Datoteka nije pronađena.');
  const { error } = await ctx.supabase.from('attachments').delete().eq('id', id);
  if (error) return fail(error);
  await ctx.supabase.storage.from('job-files').remove(row.has_thumb ? [row.path, `${row.path}.thumb.jpg`] : [row.path]);
  if (row.job_id) revalidatePath(jobPath(row.job_id as string));
  return { ok: true };
}

// ---------------------------------------------------------------------
// Internal messages: task (owner → worker) and help (worker → owners)
// ---------------------------------------------------------------------
export async function sendMessage(jobId: string | null, kind: 'task' | 'help', body: string, receiverId: string | null): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const text = body.trim();
  if (!text) return fail('Upišite poruku.');
  if (kind === 'task' && !receiverId) return fail('Odaberite radnika.');
  const { error } = await ctx.supabase
    .from('job_messages')
    .insert({ tenant_id: ctx.tenant.id, job_id: jobId, sender_id: ctx.user.id, receiver_id: receiverId, kind, body: text.slice(0, 2000) });
  if (error) return fail(error);
  if (jobId) {
    await logEvent(ctx, jobId, 'message', kind === 'help' ? `Traži pomoć: ${actorName(ctx)}` : `Zadatak poslan · ${actorName(ctx)}`);
  }
  // Layout-wide: the bell counter in the menu changes too.
  revalidatePath('/app', 'layout');
  return { ok: true };
}

export async function setMessageStatus(id: string, jobId: string | null, status: 'open' | 'taken' | 'done'): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const { error } = await ctx.supabase.from('job_messages').update({ status }).eq('id', id);
  if (error) return fail(error);
  revalidatePath('/app', 'layout');
  return { ok: true };
}

// ---------------------------------------------------------------------
// Customer approval link
// ---------------------------------------------------------------------
export async function createApproval(jobId: string): Promise<ActionResult<{ token: string }>> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Odobrenje šalje voditelj servisa.');
  const { count } = await ctx.supabase.from('job_lines').select('id', { count: 'exact', head: true }).eq('job_id', jobId).eq('approval', 'proposed');
  if (!count) return fail('Nema predloženih stavki za odobrenje.');
  await ctx.supabase.from('approvals').update({ status: 'expired' }).eq('job_id', jobId).in('status', ['sent', 'viewed']);
  const { data, error } = await ctx.supabase
    .from('approvals')
    .insert({ tenant_id: ctx.tenant.id, job_id: jobId, sent_via: 'link', created_by: ctx.user.id })
    .select('token')
    .single();
  if (error) return fail(error);
  await ctx.supabase.from('jobs').update({ phase: 'awaiting_approval' }).eq('id', jobId).in('phase', ['intake', 'diagnosis']);
  await logEvent(ctx, jobId, 'approval', `Poslano na odobrenje: ${count} ${plural(count, 'stavka', 'stavke', 'stavki')}`);
  revalidatePath(jobPath(jobId));
  return { ok: true, data: { token: data.token as string } };
}
