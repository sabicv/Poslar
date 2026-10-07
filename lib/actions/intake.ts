'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { defaultMeterUnit } from '@/config/tenant.config';
import { fail, type ActionResult } from '@/lib/action-result';
import { digitsOf, loadIntake, overLimit, plateKey, senderHash, tidyPlate } from '@/lib/intake';
import { createAdminClient } from '@/lib/supabase/admin';
import { plateIlike } from '@/lib/utils';

// A customer at the door (or at home, for field trades) sends a job
// request without an account. Everything is written with the service role,
// always for the one workshop the token names, after these checks:
// a hidden field and a minimum time against bots, limits per sender and
// per workshop, and the same phone twice within half an hour is one job.

const schema = z.object({
  name: z.string().trim().min(2, 'Upišite ime i prezime.').max(120),
  phone: z.string().trim().max(40),
  identifier: z.string().trim().max(20).optional().default(''),
  make: z.string().trim().max(60).optional().default(''),
  model: z.string().trim().max(80).optional().default(''),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  vin: z.string().trim().max(20).optional().default(''),
  address: z.string().trim().max(200).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  symptoms: z.array(z.string().max(80)).max(10).default([]),
  complaint: z.string().trim().max(2000).default(''),
  consent: z.literal(true, { errorMap: () => ({ message: 'Potvrdite da radionica smije spremiti Vaše podatke.' }) }),
  website: z.string().max(200),
  elapsedMs: z.number().int().min(0),
});

const GENERIC = 'Prijava nije poslana. Pokušajte ponovno za nekoliko minuta ili nazovite radionicu.';

export async function submitIntake(token: string, values: z.input<typeof schema>): Promise<ActionResult<{ number: number; again: boolean }>> {
  const state = await loadIntake(token);
  if (state.kind !== 'ok') return fail('Prijava preko ovog koda trenutno nije dostupna.');
  const t = state.tenant;
  const field = t.pkg.sector === 'field';
  const parsed = schema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite podatke.');
  const v = parsed.data;
  // Bots fill the hidden field or send faster than a person can.
  if (v.website !== '' || v.elapsedMs < 4000) return fail(GENERIC);
  const phone = digitsOf(v.phone);
  if (phone.length < 8 || phone.length > 15) return fail('Upišite broj telefona na koji Vas majstor može nazvati.');
  if (!v.complaint && v.symptoms.length === 0) return fail('Napišite ili izgovorite što ne radi.');
  if (field && v.address.length < 3) return fail('Upišite adresu na koju majstor dolazi.');
  if (await overLimit(t.id, await senderHash(), 'submit')) return fail(GENERIC);

  const admin = createAdminClient();
  const tenant_id = t.id;

  // The customer: the same phone number is the same person.
  const tail = phone.slice(-7);
  const { data: candidates } = await admin.from('clients').select('id, phone').eq('tenant_id', tenant_id).ilike('phone', `%${tail.slice(0, 3)}%${tail.slice(3)}%`).limit(30);
  let clientId = (candidates ?? []).find((c) => c.phone && digitsOf(c.phone as string) === phone)?.id as string | undefined;

  if (clientId) {
    const { data: recent } = await admin
      .from('jobs')
      .select('number')
      .eq('tenant_id', tenant_id)
      .eq('client_id', clientId)
      .eq('source', 'qr')
      .gte('created_at', new Date(Date.now() - 30 * 60000).toISOString())
      .limit(1)
      .maybeSingle();
    if (recent) return { ok: true, data: { number: recent.number as number, again: true } };
  } else {
    const parts = v.name.split(/\s+/);
    const last = parts.length > 1 ? parts.pop()! : parts[0];
    const first = parts.length ? parts.join(' ') : null;
    const { data, error } = await admin.from('clients').insert({ tenant_id, kind: 'person', first_name: first, last_name: last, phone: v.phone }).select('id').single();
    if (error || !data) return fail(GENERIC);
    clientId = data.id as string;
  }

  // Where (field trades): a new place for this customer.
  let siteId: string | null = null;
  if (field) {
    const { data, error } = await admin.from('sites').insert({ tenant_id, client_id: clientId, kind: 'other', address: v.address, city: v.city || null }).select('id').single();
    if (error || !data) return fail(GENERIC);
    siteId = data.id as string;
  }

  // The vehicle: a known plate is the known vehicle, otherwise a new one.
  let assetId: string | null = null;
  let note: string | null = null;
  const plate = !field && v.identifier ? plateKey(v.identifier) : '';
  if (plate.length >= 3) {
    const { data: found } = await admin.from('assets').select('id, client_id, identifier').eq('tenant_id', tenant_id).ilike('identifier', plateIlike(v.identifier)).limit(10);
    const same = (found ?? []).find((a) => a.identifier && plateKey(a.identifier as string) === plate);
    if (same) {
      assetId = same.id as string;
      if (same.client_id !== clientId) note = 'Vozilo je u evidenciji na drugu osobu.';
    }
  }
  const type = t.pkg.defaultAssetType;
  if (!assetId) {
    const { data, error } = await admin
      .from('assets')
      .insert({
        tenant_id,
        client_id: clientId,
        site_id: siteId,
        asset_type: type,
        identifier: plate ? tidyPlate(v.identifier) : null,
        make: v.make || null,
        model: v.model || null,
        year: v.year ?? null,
        vin: v.vin ? v.vin.toUpperCase() : null,
        meter_primary_unit: defaultMeterUnit(type),
      })
      .select('id')
      .single();
    if (error || !data) return fail(GENERIC);
    assetId = data.id as string;
  }

  const complaint = [v.symptoms.join(', '), v.complaint].filter(Boolean).join('. ');
  const { data: job, error } = await admin
    .from('jobs')
    .insert({
      tenant_id,
      client_id: clientId,
      asset_id: assetId,
      complaint,
      phase: 'intake',
      source: 'qr',
      meter_unit: defaultMeterUnit(type),
      work_mode: field ? 'field' : 'workshop',
      site_id: siteId,
    })
    .select('id, number')
    .single();
  if (error || !job) return fail(GENERIC);
  await admin.from('job_events').insert([
    { tenant_id, job_id: job.id, event_type: 'created', message: `Samoprijem preko QR koda · ${v.name}, ${v.phone}` },
    { tenant_id, job_id: job.id, event_type: 'consent', message: 'Mušterija je pristala da radionica spremi podatke radi popravka.' },
    ...(note ? [{ tenant_id, job_id: job.id, event_type: 'note', message: note }] : []),
  ]);
  revalidatePath('/app');
  return { ok: true, data: { number: job.number as number, again: false } };
}
