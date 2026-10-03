'use server';

import { revalidatePath } from 'next/cache';
import { defaultMeterUnit, DEVICE_TYPES } from '@/config/tenant.config';
import { fail, type ActionResult } from '@/lib/action-result';
import { applyTemplate } from '@/lib/actions/jobs';
import { requireWorkshop, type WorkshopContext } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

async function owner(): Promise<WorkshopContext | { error: string }> {
  const ctx = await requireWorkshop();
  return ctx.isOwner ? ctx : { error: 'Ovo uređuje voditelj servisa.' };
}

async function patchSettings(ctx: WorkshopContext, patch: Record<string, unknown>) {
  const settings = { ...((ctx.tenant.settings as Record<string, unknown> | null) ?? {}), ...patch };
  return ctx.supabase.from('tenants').update({ settings }).eq('id', ctx.tenant.id);
}

export async function hideFirstSteps(): Promise<ActionResult> {
  const ctx = await owner();
  if ('error' in ctx) return fail(ctx.error);
  const { error } = await patchSettings(ctx, { onboarding_hidden: true });
  if (error) return fail(error);
  revalidatePath('/app');
  return { ok: true };
}

// "Radim sam": the team step counts as done.
export async function markSolo(): Promise<ActionResult> {
  const ctx = await owner();
  if ('error' in ctx) return fail(ctx.error);
  const { error } = await patchSettings(ctx, { onboarding_solo: true });
  if (error) return fail(error);
  revalidatePath('/app');
  return { ok: true };
}

// One sample customer, object and job with the trade's first template, so
// a new workshop sees a full job before entering its own. Marked as demo
// data and removed in one tap; never in a demo workshop.
export async function createSample(): Promise<ActionResult<{ jobId: string }>> {
  const ctx = await owner();
  if ('error' in ctx) return fail(ctx.error);
  if ((ctx.tenant.settings as { demo?: boolean } | null)?.demo) return fail('Demo radionica već ima primjere.');
  const s = ctx.supabase;
  const tenant_id = ctx.tenant.id;
  // A second tap opens the sample that is already there.
  const { data: existing } = await s.from('jobs').select('id').eq('is_demo', true).limit(1).maybeSingle();
  if (existing) return { ok: true, data: { jobId: existing.id as string } };
  const field = ctx.pkg.sector === 'field';
  const type = ctx.pkg.defaultAssetType;
  const { data: client, error } = await s.from('clients').insert({ tenant_id, is_demo: true, kind: 'person', first_name: 'Primjer', last_name: 'Mušterija', phone: '+385 91 000 0000' }).select('id').single();
  if (error || !client) return fail(error);
  let siteId: string | null = null;
  if (field) {
    const { data: site } = await s.from('sites').insert({ tenant_id, client_id: client.id, kind: 'house', address: 'Primjer ulica 1', city: ctx.tenant.city }).select('id').single();
    siteId = (site?.id as string | undefined) ?? null;
  }
  const device = DEVICE_TYPES.includes(type);
  const { data: asset, error: assetError } = await s
    .from('assets')
    .insert({ tenant_id, client_id: client.id, is_demo: true, site_id: siteId, asset_type: type, identifier: device ? 'Primjer' : 'ZG-0000-PR', make: device ? null : 'Volkswagen', model: device ? null : 'Golf', meter_primary_unit: defaultMeterUnit(type) })
    .select('id')
    .single();
  if (assetError || !asset) return fail(assetError);
  const { data: job, error: jobError } = await s
    .from('jobs')
    .insert({
      tenant_id,
      client_id: client.id,
      asset_id: asset.id,
      is_demo: true,
      complaint: `${ctx.pkg.symptoms[0] ?? 'Pregled'} (primjer)`,
      phase: 'diagnosis',
      source: field ? 'field' : 'workshop',
      work_mode: field ? 'field' : 'workshop',
      site_id: siteId,
      meter_unit: defaultMeterUnit(type),
      created_by: ctx.user.id,
    })
    .select('id')
    .single();
  if (jobError || !job) return fail(jobError);
  const first = ctx.pkg.templates[0];
  if (first) await applyTemplate(job.id as string, first.code);
  revalidatePath('/app');
  return { ok: true, data: { jobId: job.id as string } };
}

// The sample may have been closed (a closed job is locked against the
// owner), so it goes through the server key, strictly within this
// workshop's sample rows. A sample customer the owner has since given a
// real job stays, as a real customer.
export async function deleteSample(): Promise<ActionResult> {
  const ctx = await owner();
  if ('error' in ctx) return fail(ctx.error);
  if ((ctx.tenant.settings as { demo?: boolean } | null)?.demo) return fail('U demo radionici primjeri ostaju.');
  const admin = createAdminClient();
  const tenantId = ctx.tenant.id;
  const { data: jobs } = await admin.from('jobs').select('id').eq('tenant_id', tenantId).eq('is_demo', true);
  const jobIds = (jobs ?? []).map((j) => j.id as string);
  const { data: files } = jobIds.length ? await admin.from('attachments').select('path, has_thumb').in('job_id', jobIds) : { data: [] };
  if (jobIds.length) {
    const { error } = await admin.from('jobs').delete().eq('tenant_id', tenantId).in('id', jobIds);
    if (error) return fail(error);
  }
  const paths = (files ?? []).flatMap((f) => (f.has_thumb ? [f.path as string, `${f.path}.thumb.jpg`] : [f.path as string]));
  if (paths.length) await admin.storage.from('job-files').remove(paths);
  const { data: clients } = await admin.from('clients').select('id').eq('tenant_id', tenantId).eq('is_demo', true);
  for (const c of clients ?? []) {
    const { count } = await admin.from('jobs').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('client_id', c.id);
    // Objects and places go with the customer (on delete cascade).
    const { error } = count
      ? await admin.from('clients').update({ is_demo: false }).eq('tenant_id', tenantId).eq('id', c.id)
      : await admin.from('clients').delete().eq('tenant_id', tenantId).eq('id', c.id);
    if (error) return fail(error);
    if (count) await admin.from('assets').update({ is_demo: false }).eq('tenant_id', tenantId).eq('client_id', c.id);
  }
  revalidatePath('/app');
  return { ok: true };
}
