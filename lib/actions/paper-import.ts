'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { defaultMeterUnit } from '@/config/tenant.config';
import { fail, type ActionResult } from '@/lib/action-result';
import { digitsOf, plateKey, tidyPlate } from '@/lib/intake';
import { requireOwner } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { zagrebInstant } from '@/lib/time';
import { plateIlike } from '@/lib/utils';

// Uvoz s papira: an old paper job card or invoice, read from a photo and
// checked by the owner, goes into the history as a closed, paid job of
// that date, with its customer and vehicle (found or new). It never gets
// an invoice number: the paper is the document, its photo is attached.

const text = (max: number) => z.string().trim().max(max).optional().default('');
const lineSchema = z.object({
  description: z.string().trim().min(1).max(300),
  kind: z.enum(['labor', 'part', 'material', 'fee']).catch('part'),
  qty: z.number().min(0).max(100000),
  unit: text(10),
  price: z.number().min(0).max(1_000_000),
});
const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Upišite datum s papira.'),
  number: text(40),
  firstName: text(80),
  lastName: text(80),
  companyName: text(160),
  phone: text(40),
  oib: z.string().trim().regex(/^(\d{11})?$/, 'OIB ima 11 znamenki.').optional().default(''),
  address: text(200),
  city: text(80),
  identifier: text(40),
  make: text(60),
  model: text(80),
  vin: text(17),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  meter: z.number().min(0).max(10_000_000).nullable().optional(),
  work: text(4000),
  lines: z.array(lineSchema).max(80),
});

export async function importPaperJob(values: z.input<typeof schema>): Promise<ActionResult<{ jobId: string; number: number; tenantId: string }>> {
  const ctx = await requireOwner();
  const parsed = schema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite podatke.');
  const v = parsed.data;
  if (!v.lastName && !v.firstName && !v.companyName) return fail('Upišite ime mušterije ili naziv tvrtke.');
  if (v.date > new Date().toISOString().slice(0, 10)) return fail('Datum je u budućnosti. Provjerite datum s papira.');
  const admin = createAdminClient();
  const tenant_id = ctx.tenant.id;
  const field = ctx.pkg.sector === 'field';

  // The customer: same phone, OIB or name as one already there, else new.
  const phone = digitsOf(v.phone);
  let clientId: string | null = null;
  if (phone.length >= 8) {
    const { data } = await admin.from('clients').select('id, phone').eq('tenant_id', tenant_id).not('phone', 'is', null).ilike('phone', `%${phone.slice(-6)}%`).limit(20);
    clientId = ((data ?? []).find((c) => digitsOf(c.phone as string).slice(-8) === phone.slice(-8))?.id as string | undefined) ?? null;
  }
  if (!clientId && v.oib) {
    const { data } = await admin.from('clients').select('id').eq('tenant_id', tenant_id).eq('oib', v.oib).limit(1).maybeSingle();
    clientId = (data?.id as string | undefined) ?? null;
  }
  if (!clientId && (v.lastName || v.companyName)) {
    let q = admin.from('clients').select('id').eq('tenant_id', tenant_id);
    q = v.companyName ? q.ilike('company_name', v.companyName) : q.ilike('last_name', v.lastName).ilike('first_name', v.firstName || '%');
    const { data } = await q.limit(2);
    if (data?.length === 1) clientId = data[0].id as string;
  }
  if (!clientId) {
    const { data, error } = await admin
      .from('clients')
      .insert({
        tenant_id,
        kind: v.companyName ? 'company' : 'person',
        first_name: v.companyName ? null : v.firstName || null,
        last_name: v.companyName ? null : v.lastName || v.firstName,
        company_name: v.companyName || null,
        phone: v.phone || null,
        oib: v.oib || null,
        address: v.address || null,
        city: v.city || null,
      })
      .select('id')
      .single();
    if (error || !data) return fail(error ?? 'Mušterija nije spremljena.');
    clientId = data.id as string;
  }

  // On the field the address is the place of work.
  let siteId: string | null = null;
  if (field && v.address) {
    const { data: found } = await admin.from('sites').select('id').eq('tenant_id', tenant_id).eq('client_id', clientId).ilike('address', v.address).limit(1).maybeSingle();
    siteId = (found?.id as string | undefined) ?? null;
    if (!siteId) {
      const { data } = await admin.from('sites').insert({ tenant_id, client_id: clientId, kind: 'other', address: v.address, city: v.city || null }).select('id').single();
      siteId = (data?.id as string | undefined) ?? null;
    }
  }

  // The vehicle or device: by plate or mark, else new.
  const type = ctx.pkg.defaultAssetType;
  let assetId: string | null = null;
  const key = v.identifier ? plateKey(v.identifier) : '';
  if (key.length >= 3) {
    const { data } = await admin.from('assets').select('id, identifier').eq('tenant_id', tenant_id).ilike('identifier', plateIlike(v.identifier)).limit(10);
    assetId = ((data ?? []).find((a) => a.identifier && plateKey(a.identifier as string) === key)?.id as string | undefined) ?? null;
  }
  if (!assetId && !key) {
    const { data } = await admin.from('assets').select('id').eq('tenant_id', tenant_id).eq('client_id', clientId).limit(2);
    if (data?.length === 1) assetId = data[0].id as string;
  }
  if (!assetId) {
    const { data, error } = await admin
      .from('assets')
      .insert({
        tenant_id,
        client_id: clientId,
        site_id: siteId,
        asset_type: type,
        identifier: key ? (field ? v.identifier.toUpperCase() : tidyPlate(v.identifier)) : null,
        make: v.make || null,
        model: v.model || null,
        vin: v.vin.length === 17 ? v.vin.toUpperCase() : null,
        year: v.year ?? null,
        meter_primary_unit: defaultMeterUnit(type),
      })
      .select('id')
      .single();
    if (error || !data) return fail(error ?? 'Vozilo nije spremljeno.');
    assetId = data.id as string;
  }

  const opened = zagrebInstant(v.date, '08:00').toISOString();
  const closed = zagrebInstant(v.date, '16:00').toISOString();
  const { data: job, error } = await admin
    .from('jobs')
    .insert({
      tenant_id,
      client_id: clientId,
      asset_id: assetId,
      site_id: siteId,
      work_mode: field ? 'field' : 'workshop',
      complaint: v.work || 'Uvezeno s papira',
      work_summary: v.number ? `Papirnati dokument br. ${v.number}` : 'Papirnati dokument',
      meter_in: v.meter ?? null,
      meter_out: v.meter ?? null,
      meter_unit: defaultMeterUnit(type),
      phase: 'collected',
      payment_status: 'paid',
      created_at: opened,
      finished_at: closed,
      collected_at: closed,
      paid_at: closed,
    })
    .select('id, number')
    .single();
  if (error || !job) return fail(error ?? 'Nalog nije spremljen.');

  for (const [i, l] of v.lines.entries()) {
    const { data: line } = await admin
      .from('job_lines')
      .insert({ tenant_id, job_id: job.id, kind: l.kind, description: l.description, qty: l.qty, unit: l.unit || (l.kind === 'labor' ? 'h' : 'kom'), sort: i })
      .select('id')
      .single();
    if (line) await admin.from('job_line_prices').insert({ job_line_id: line.id, tenant_id, unit_price: l.price });
  }
  await admin.from('job_events').insert({ tenant_id, job_id: job.id, actor_id: ctx.user.id, event_type: 'created', message: `Uvezeno s papira${v.number ? ` (br. ${v.number})` : ''}, datum ${v.date}` });
  revalidatePath('/app/clients');
  return { ok: true, data: { jobId: job.id as string, number: job.number as number, tenantId: tenant_id } };
}
