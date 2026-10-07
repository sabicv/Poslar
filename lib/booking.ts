import 'server-only';
import { defaultMeterUnit, getPackage, type PackageConfig } from '@/config/tenant.config';
import { subscription } from '@/lib/billing';
import { freeSlots, readHours, slotIsFree, spokenSlot, type Slot } from '@/lib/calendar';
import { digitsOf, plateKey, tidyPlate } from '@/lib/intake';
import { createAdminClient } from '@/lib/supabase/admin';
import { addDays, todayInZagreb } from '@/lib/time';
import { plateIlike } from '@/lib/utils';
import type { Tenant } from '@/types/db';

// Booking a slot as a job in Prijem, the same way for Poslar on the phone
// (lib/phone-agent.ts) and for the public booking page (/termin/<token>).
// Runs with the service role, always for the one workshop given.

type Admin = ReturnType<typeof createAdminClient>;
export interface BookingTenant {
  tenant: Tenant;
  pkg: PackageConfig;
}

// The public booking page (/termin/<intake_token>): the workshop the token
// names, if it takes bookings; otherwise its name and phone, to call.
export type BookingPage = { kind: 'ok'; at: BookingTenant } | { kind: 'missing' } | { kind: 'off'; name: string; phone: string | null };

export async function loadBookingPage(token: string): Promise<BookingPage> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { kind: 'missing' };
  const { data } = await createAdminClient().from('tenants').select('*').eq('intake_token', token).maybeSingle();
  if (!data) return { kind: 'missing' };
  const tenant = data as Tenant;
  // A demo visitor's throwaway workshop takes bookings too, to try it.
  if (tenant.booking_enabled === false || !canBook(tenant)) {
    return { kind: 'off', name: tenant.name, phone: tenant.phone ?? null };
  }
  return { kind: 'ok', at: { tenant, pkg: getPackage(tenant.package) } };
}

// A switched-off, unpaid or expired workshop takes no bookings.
export function canBook(t: Tenant): boolean {
  if (t.status === 'suspended') return false;
  if (t.status === 'trial' && t.trial_ends_at && new Date(t.trial_ends_at) < new Date()) return false;
  return subscription(t).status !== 'overdue';
}

// The same phone number is the same customer.
export async function findClientByPhone(admin: Admin, tenantId: string, phone: string) {
  if (phone.length < 8) return null;
  const tail = phone.slice(-7);
  const { data } = await admin
    .from('clients')
    .select('id, kind, first_name, last_name, company_name, phone')
    .eq('tenant_id', tenantId)
    .ilike('phone', `%${tail.slice(0, 3)}%${tail.slice(3)}%`)
    .limit(30);
  return (data ?? []).find((c) => c.phone && digitsOf(c.phone as string) === phone) ?? null;
}

// The workshop's booked times around these days.
export async function busySlots(admin: Admin, tenantId: string, fromDay: string, days: number) {
  const { data } = await admin
    .from('jobs')
    .select('scheduled_start, scheduled_end')
    .eq('tenant_id', tenantId)
    .neq('phase', 'collected')
    .gte('scheduled_start', new Date(`${addDays(fromDay, -1)}T00:00:00Z`).toISOString())
    .lt('scheduled_start', new Date(`${addDays(fromDay, days + 1)}T00:00:00Z`).toISOString())
    .limit(1000);
  return (data ?? []).map((j) => ({ start: j.scheduled_start as string, end: (j.scheduled_end as string | null) ?? null }));
}

// Free slots from a day on (today if not given or past).
export async function slotsFor(admin: Admin, at: BookingTenant, opts: { from?: string | null; days: number; limit: number }): Promise<Slot[]> {
  const from = opts.from && /^\d{4}-\d{2}-\d{2}$/.test(opts.from) && opts.from >= todayInZagreb() ? opts.from : todayInZagreb();
  return freeSlots(readHours(at.tenant.settings), await busySlots(admin, at.tenant.id, from, opts.days), { from, days: opts.days, limit: opts.limit });
}

export type BookResult = { ok: true; jobId: string; number: number; label: string } | { ok: false; message: string };

export interface BookInput {
  start: string;
  name: string;
  phone: string;
  identifier?: string;
  complaint: string;
  address?: string;
  city?: string;
  // The phone call's id: a retried tool call must not book twice.
  callId?: string | null;
}

export async function bookSlot(admin: Admin, at: BookingTenant, input: BookInput, how: { source: 'phone' | 'booking'; event: string }): Promise<BookResult> {
  const t = at.tenant;
  if (!canBook(t)) return { ok: false, message: 'Radionica trenutno ne prima rezervacije. Zapiši poruku za majstora.' };
  const field = at.pkg.sector === 'field';
  const phone = digitsOf(input.phone);
  const name = input.name.trim().slice(0, 120);
  const complaint = input.complaint.trim().slice(0, 2000);
  if (name.length < 2) return { ok: false, message: 'Treba ime i prezime.' };
  if (phone.length < 8 || phone.length > 15) return { ok: false, message: 'Treba broj telefona na koji majstor može nazvati.' };
  if (complaint.length < 3) return { ok: false, message: 'Treba kratak opis kvara ili posla.' };
  if (field && (input.address ?? '').trim().length < 3) return { ok: false, message: 'Treba adresa na koju majstor dolazi.' };

  if (input.callId) {
    const { data: done } = await admin.from('phone_calls').select('job_id').eq('provider_call_id', input.callId).not('job_id', 'is', null).maybeSingle();
    if (done?.job_id) {
      const { data: j } = await admin.from('jobs').select('id, number, scheduled_start').eq('id', done.job_id).maybeSingle();
      if (j) return { ok: true, jobId: j.id as string, number: j.number as number, label: spokenSlot(new Date(j.scheduled_start as string)) };
    }
  }

  const hours = readHours(t.settings);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb' }).format(new Date(input.start));
  const slot = slotIsFree(hours, await busySlots(admin, t.id, day, 1), input.start);
  if (!slot) return { ok: false, message: 'Taj termin više nije slobodan ili nije u radnom vremenu. Odaberi drugi.' };

  const tenant_id = t.id;
  let client = await findClientByPhone(admin, tenant_id, phone);
  if (!client) {
    const parts = name.split(/\s+/);
    const last = parts.length > 1 ? parts.pop()! : parts[0];
    const first = parts.length ? parts.join(' ') : null;
    const { data, error } = await admin.from('clients').insert({ tenant_id, kind: 'person', first_name: first, last_name: last, phone: input.phone }).select('id, kind, first_name, last_name, company_name, phone').single();
    if (error || !data) return { ok: false, message: 'Rezervacija nije spremljena. Zapiši poruku za majstora.' };
    client = data;
  }

  let siteId: string | null = null;
  if (field) {
    const { data } = await admin.from('sites').insert({ tenant_id, client_id: client.id, kind: 'other', address: input.address!.trim(), city: input.city?.trim() || null }).select('id').single();
    siteId = (data?.id as string | undefined) ?? null;
  }

  const type = at.pkg.defaultAssetType;
  let assetId: string | null = null;
  const plate = !field && input.identifier ? plateKey(input.identifier) : '';
  if (plate.length >= 3) {
    const { data: found } = await admin.from('assets').select('id, identifier').eq('tenant_id', tenant_id).ilike('identifier', plateIlike(input.identifier!)).limit(10);
    assetId = ((found ?? []).find((a) => a.identifier && plateKey(a.identifier as string) === plate)?.id as string | undefined) ?? null;
  }
  if (!assetId) {
    const { data: own } = !plate ? await admin.from('assets').select('id').eq('tenant_id', tenant_id).eq('client_id', client.id).limit(2) : { data: null };
    // A known customer with exactly one vehicle or device: that one.
    if (own && own.length === 1) assetId = own[0].id as string;
  }
  if (!assetId) {
    const { data, error } = await admin
      .from('assets')
      .insert({ tenant_id, client_id: client.id, site_id: siteId, asset_type: type, identifier: plate ? tidyPlate(input.identifier!) : null, meter_primary_unit: defaultMeterUnit(type) })
      .select('id')
      .single();
    if (error || !data) return { ok: false, message: 'Rezervacija nije spremljena. Zapiši poruku za majstora.' };
    assetId = data.id as string;
  }

  const { data: job, error } = await admin
    .from('jobs')
    .insert({
      tenant_id,
      client_id: client.id,
      asset_id: assetId,
      complaint,
      phase: 'intake',
      source: how.source,
      meter_unit: defaultMeterUnit(type),
      work_mode: field ? 'field' : 'workshop',
      site_id: siteId,
      scheduled_start: slot.start,
      scheduled_end: slot.end,
    })
    .select('id, number')
    .single();
  if (error || !job) return { ok: false, message: 'Rezervacija nije spremljena. Zapiši poruku za majstora.' };
  await admin.from('job_events').insert({ tenant_id, job_id: job.id, event_type: 'created', message: `${how.event}: ${slot.label} · ${name}, ${input.phone}` });
  if (input.callId) {
    const { data: row } = await admin.from('phone_calls').select('id').eq('provider_call_id', input.callId).maybeSingle();
    if (row) await admin.from('phone_calls').update({ job_id: job.id }).eq('id', row.id);
    else await admin.from('phone_calls').insert({ tenant_id, provider_call_id: input.callId, caller: input.phone, job_id: job.id, started_at: new Date().toISOString() });
  }
  return { ok: true, jobId: job.id as string, number: job.number as number, label: slot.label };
}
