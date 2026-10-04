'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { DEVICE_TYPES, PACKAGES, type AssetType } from '@/config/tenant.config';
import { fail, type ActionResult } from '@/lib/action-result';
import { requireWorkshop, type WorkshopContext } from '@/lib/session';
import { toIlike } from '@/lib/utils';
import type { Asset, Client, Site } from '@/types/db';

export interface ClientHit extends Pick<Client, 'id' | 'kind' | 'first_name' | 'last_name' | 'company_name' | 'phone'> {
  assets: Pick<Asset, 'id' | 'asset_type' | 'identifier' | 'make' | 'model' | 'meter_primary_unit' | 'site_id'>[];
  sites: Pick<Site, 'id' | 'label' | 'kind' | 'address' | 'city' | 'access_notes'>[];
}

// One box for the intake desk: plate, serial, name, company or phone.
export async function searchClients(query: string): Promise<ClientHit[]> {
  const ctx = await requireWorkshop();
  const q = query.trim();
  if (q.length < 2) return [];
  const like = toIlike(q);
  const compact = toIlike(q.replace(/[\s-]/g, ''));

  const [byClient, byAsset, bySite] = await Promise.all([
    ctx.supabase
      .from('clients')
      .select('id, kind, first_name, last_name, company_name, phone, assets(id, asset_type, identifier, make, model, meter_primary_unit, site_id), sites(id, label, kind, address, city, access_notes)')
      .or(`first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like},phone.ilike.${compact},oib.ilike.${like}`)
      .limit(8),
    ctx.supabase
      .from('assets')
      .select('client_id')
      .or(`identifier.ilike.${like},identifier.ilike.${compact},vin.ilike.${like},internal_number.ilike.${like}`)
      .limit(8),
    // Field work: "Ilica 12" finds the customer by the address of their site.
    ctx.supabase.from('sites').select('client_id').or(`address.ilike.${like},label.ilike.${like}`).limit(8),
  ]);

  const hits = new Map<string, ClientHit>((byClient.data ?? []).map((c) => [c.id as string, c as unknown as ClientHit]));
  const missing = [...(byAsset.data ?? []), ...(bySite.data ?? [])].map((a) => a.client_id as string).filter((id, i, all) => !hits.has(id) && all.indexOf(id) === i);
  if (missing.length) {
    const { data } = await ctx.supabase
      .from('clients')
      .select('id, kind, first_name, last_name, company_name, phone, assets(id, asset_type, identifier, make, model, meter_primary_unit, site_id), sites(id, label, kind, address, city, access_notes)')
      .in('id', missing);
    for (const c of data ?? []) hits.set(c.id as string, c as unknown as ClientHit);
  }
  return [...hits.values()].slice(0, 10);
}

const text = (max = 200) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

const clientSchema = z.object({
  kind: z.enum(['person', 'company']),
  first_name: text(),
  last_name: text(),
  company_name: text(),
  oib: z.string().trim().regex(/^\d{11}$/, 'OIB ima 11 znamenki.').nullable().optional().or(z.literal('')).transform((v) => v || null),
  phone: text(40),
  email: text(),
  address: text(),
  city: text(),
  notes: text(2000),
});

export async function saveClient(id: string | null, values: z.input<typeof clientSchema>): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkshop();
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite podatke.');
  const v = parsed.data;
  if (!(v.company_name || v.last_name || v.first_name)) return fail('Upišite ime ili naziv.');
  const query = id
    ? ctx.supabase.from('clients').update(v).eq('id', id).select('id').single()
    : ctx.supabase.from('clients').insert({ ...v, tenant_id: ctx.tenant.id }).select('id').single();
  const { data, error } = await query;
  if (error) return fail(error);
  revalidatePath('/app/clients');
  revalidatePath(`/app/clients/${data.id}`);
  return { ok: true, data: { id: data.id as string } };
}

// What goes with a customer or a vehicle: its jobs and their photos. An
// issued invoice must stay (its number may not leave a gap), so a customer
// or vehicle with one is not deleted.
async function filesAndInvoices(ctx: WorkshopContext, by: { client_id: string } | { asset_id: string }) {
  const column = 'client_id' in by ? 'client_id' : 'asset_id';
  const value = 'client_id' in by ? by.client_id : by.asset_id;
  const { data: jobs } = await ctx.supabase.from('jobs').select('id, invoice_number').eq(column, value);
  const invoiced = (jobs ?? []).filter((j) => j.invoice_number !== null).length;
  const jobIds = (jobs ?? []).map((j) => j.id as string);
  const assetIds = column === 'asset_id' ? [value] : ((await ctx.supabase.from('assets').select('id').eq('client_id', value)).data ?? []).map((a) => a.id as string);
  const files = [
    ...(jobIds.length ? ((await ctx.supabase.from('attachments').select('path, has_thumb').in('job_id', jobIds.slice(0, 300))).data ?? []) : []),
    ...(assetIds.length ? ((await ctx.supabase.from('attachments').select('path, has_thumb').in('asset_id', assetIds.slice(0, 300))).data ?? []) : []),
  ];
  const paths = [...new Set(files.flatMap((f) => (f.has_thumb ? [f.path as string, `${f.path}.thumb.jpg`] : [f.path as string])))];
  return { invoiced, paths };
}

async function removeFiles(ctx: WorkshopContext, paths: string[]) {
  for (let i = 0; i < paths.length; i += 500) await ctx.supabase.storage.from('job-files').remove(paths.slice(i, i + 500));
}

export async function deleteClient(id: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Brisanje je dopušteno voditelju servisa.');
  const { invoiced, paths } = await filesAndInvoices(ctx, { client_id: id });
  if (invoiced) return fail(`Mušterija ima ${invoiced === 1 ? 'izdan račun' : 'izdane račune'}. Računi se ne smiju brisati, pa ni ona.`);
  const { error, count } = await ctx.supabase.from('clients').delete({ count: 'exact' }).eq('id', id);
  if (error) return fail(error);
  if (!count) return fail('Nije obrisano.');
  await removeFiles(ctx, paths);
  revalidatePath('/app/clients');
  return { ok: true };
}

const assetTypes = Object.values(PACKAGES).flatMap((p) => p.assetTypes) as [AssetType, ...AssetType[]];
const num = z.number().nullable().optional();

const assetSchema = z.object({
  client_id: z.string().uuid(),
  parent_asset_id: z.string().uuid().nullable().optional(),
  asset_type: z.enum(assetTypes),
  identifier: text(60),
  vin: text(40).transform((v) => (v ? v.toUpperCase() : null)),
  make: text(80),
  model: text(80),
  variant: text(80),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  engine_code: text(40),
  fuel: z.enum(['petrol', 'diesel', 'hybrid', 'plugin', 'electric', 'lpg', 'cng']).nullable().optional(),
  power_kw: num,
  internal_number: text(40),
  meter_primary_unit: z.enum(['km', 'mth']),
  meter_secondary_unit: z.enum(['km', 'mth']).nullable().optional(),
  paint_code: text(40),
  axle_config: text(20),
  gvw_t: num,
  site_id: z.string().uuid().nullable().optional(),
  notes: text(2000),
});

export async function saveAsset(id: string | null, values: z.input<typeof assetSchema>): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkshop();
  const parsed = assetSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite podatke.');
  // Plates are upper case; a climate device's label ("Dnevni boravak") is not.
  const row = {
    ...parsed.data,
    identifier: parsed.data.identifier && !DEVICE_TYPES.includes(parsed.data.asset_type) ? parsed.data.identifier.toUpperCase() : parsed.data.identifier,
  };
  const query = id
    ? ctx.supabase.from('assets').update(row).eq('id', id).select('id').single()
    : ctx.supabase.from('assets').insert({ ...row, tenant_id: ctx.tenant.id }).select('id').single();
  const { data, error } = await query;
  if (error) return fail(error);
  revalidatePath(`/app/assets/${data.id}`);
  revalidatePath(`/app/clients/${parsed.data.client_id}`);
  return { ok: true, data: { id: data.id as string } };
}

export async function deleteAsset(id: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Brisanje je dopušteno voditelju servisa.');
  const { invoiced, paths } = await filesAndInvoices(ctx, { asset_id: id });
  if (invoiced) return fail(`Ima ${invoiced === 1 ? 'izdan račun' : 'izdane račune'}. Računi se ne smiju brisati.`);
  const { error, count } = await ctx.supabase.from('assets').delete({ count: 'exact' }).eq('id', id);
  if (error) return fail(error);
  if (!count) return fail('Nije obrisano.');
  await removeFiles(ctx, paths);
  revalidatePath('/app/clients');
  return { ok: true };
}

export async function addMeterReading(assetId: string, unit: 'km' | 'mth', value: number, jobId: string | null): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!(value >= 0)) return fail('Upišite stanje brojila.');
  const { error } = await ctx.supabase
    .from('meter_readings')
    .insert({ tenant_id: ctx.tenant.id, asset_id: assetId, job_id: jobId, unit, value, source: 'manual', created_by: ctx.user.id });
  if (error) return fail(error);
  revalidatePath(`/app/assets/${assetId}`);
  return { ok: true };
}
