import 'server-only';
import { defaultMeterUnit, getPackage, phaseLabel, type PackageConfig } from '@/config/tenant.config';
import { subscription } from '@/lib/billing';
import { freeSlots, readHours, slotIsFree, spokenHours, spokenSlot, type Slot } from '@/lib/calendar';
import { digitsOf, plateKey } from '@/lib/intake';
import { createAdminClient } from '@/lib/supabase/admin';
import { addDays, todayInZagreb } from '@/lib/time';
import { plateIlike } from '@/lib/utils';
import type { Tenant } from '@/types/db';

// The AI phone agent (Vapi): calls the owner does not take are forwarded
// to the workshop's AI number. Here: which workshop a call is for, who is
// calling, the free slots, and booking one as a job in Prijem. Everything
// runs with the service role, always for the one workshop the called
// number belongs to (set in the tower).

type Admin = ReturnType<typeof createAdminClient>;
export interface AgentTenant {
  tenant: Tenant;
  pkg: PackageConfig;
}

export async function tenantForNumber(admin: Admin, numberId: string | null): Promise<AgentTenant | null> {
  if (!numberId) return null;
  const { data } = await admin.from('tenants').select('*').eq('phone_agent_number_id', numberId).maybeSingle();
  if (!data) return null;
  const tenant = data as Tenant;
  return { tenant, pkg: getPackage(tenant.package) };
}

// A switched-off, unpaid or expired workshop takes no bookings by phone.
export function canBook(t: Tenant): boolean {
  if (t.status === 'suspended') return false;
  if (t.status === 'trial' && t.trial_ends_at && new Date(t.trial_ends_at) < new Date()) return false;
  return subscription(t).status !== 'overdue';
}

async function findClient(admin: Admin, tenantId: string, phone: string) {
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

const nameOf = (c: { kind: string; first_name: string | null; last_name: string | null; company_name: string | null }) =>
  c.kind === 'company' && c.company_name ? c.company_name : [c.first_name, c.last_name].filter(Boolean).join(' ');

// What the agent knows about the caller before saying a word.
export async function callerContext(admin: Admin, at: AgentTenant, caller: string | null): Promise<{ text: string; name: string | null }> {
  const phone = caller ? digitsOf(caller) : '';
  const client = phone ? await findClient(admin, at.tenant.id, phone) : null;
  if (!client) return { text: 'Pozivatelj nije u evidenciji radionice.', name: null };
  const [{ data: assets }, { data: jobs }] = await Promise.all([
    admin.from('assets').select('identifier, make, model').eq('tenant_id', at.tenant.id).eq('client_id', client.id).limit(3),
    admin.from('jobs').select('number, phase, scheduled_start, asset:assets(identifier, make, model)').eq('tenant_id', at.tenant.id).eq('client_id', client.id).neq('phase', 'collected').order('created_at', { ascending: false }).limit(3),
  ]);
  const name = nameOf(client as never);
  const lines = [`Pozivatelj je postojeća mušterija: ${name}.`];
  const things = (assets ?? []).map((a) => [a.make, a.model, a.identifier].filter(Boolean).join(' ')).filter(Boolean);
  if (things.length) lines.push(`${at.pkg.vocabulary.asset.many}: ${things.join('; ')}.`);
  for (const j of jobs ?? []) {
    const termin = j.scheduled_start ? `, termin ${spokenSlot(new Date(j.scheduled_start as string))}` : '';
    lines.push(`Otvoreni nalog #${j.number}: ${phaseLabel(at.pkg, j.phase as never).toLowerCase()}${termin}.`);
  }
  return { text: lines.join(' '), name };
}

async function busy(admin: Admin, tenantId: string, fromDay: string, days: number) {
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

export async function offerSlots(admin: Admin, at: AgentTenant, preferDay?: string | null): Promise<Slot[]> {
  const from = preferDay && /^\d{4}-\d{2}-\d{2}$/.test(preferDay) && preferDay >= todayInZagreb() ? preferDay : todayInZagreb();
  const hours = readHours(at.tenant.settings);
  return freeSlots(hours, await busy(admin, at.tenant.id, from, 21), { from, days: 21, limit: 4 });
}

export function agentVariables(at: AgentTenant, caller: { text: string; name: string | null }) {
  const field = at.pkg.sector === 'field';
  const greeting = `Dobar dan, ${at.tenant.name}, ovdje virtualni asistent. Majstor se trenutno ne može javiti.${caller.name ? ` Jeste li Vi ${caller.name}?` : ' Kako Vam mogu pomoći?'}`;
  const today = spokenSlot(new Date()).split(' u ')[0];
  return {
    radionica: at.tenant.name,
    zanat: at.pkg.short,
    danas: `${today} ${new Date().getFullYear()}.`,
    radno_vrijeme: spokenHours(readHours(at.tenant.settings)),
    pozivatelj: caller.text,
    sto_pitati: field ? 'adresu na koju majstor dolazi i o kojem se uređaju radi' : `registraciju (${at.pkg.vocabulary.identifier.toLowerCase()}) i marku vozila`,
    rezervacije: canBook(at.tenant) ? 'da' : 'ne',
    pozdrav: greeting,
  };
}

export type BookResult = { ok: true; jobId: string; number: number; label: string } | { ok: false; message: string };

export async function book(
  admin: Admin,
  at: AgentTenant,
  input: { start: string; name: string; phone: string; identifier?: string; complaint: string; address?: string; city?: string; callId?: string | null }
): Promise<BookResult> {
  const t = at.tenant;
  if (!canBook(t)) return { ok: false, message: 'Radionica trenutno ne prima rezervacije telefonom. Zapiši poruku za majstora.' };
  const field = at.pkg.sector === 'field';
  const phone = digitsOf(input.phone);
  const name = input.name.trim().slice(0, 120);
  const complaint = input.complaint.trim().slice(0, 2000);
  if (name.length < 2) return { ok: false, message: 'Treba ime i prezime pozivatelja.' };
  if (phone.length < 8 || phone.length > 15) return { ok: false, message: 'Treba broj telefona na koji majstor može nazvati.' };
  if (complaint.length < 3) return { ok: false, message: 'Treba kratak opis kvara ili posla.' };
  if (field && (input.address ?? '').trim().length < 3) return { ok: false, message: 'Treba adresa na koju majstor dolazi.' };

  // A retried tool call or a second "yes" must not book twice.
  if (input.callId) {
    const { data: done } = await admin.from('phone_calls').select('job_id').eq('provider_call_id', input.callId).not('job_id', 'is', null).maybeSingle();
    if (done?.job_id) {
      const { data: j } = await admin.from('jobs').select('id, number, scheduled_start').eq('id', done.job_id).maybeSingle();
      if (j) return { ok: true, jobId: j.id as string, number: j.number as number, label: spokenSlot(new Date(j.scheduled_start as string)) };
    }
  }

  const hours = readHours(t.settings);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb' }).format(new Date(input.start));
  const slot = slotIsFree(hours, await busy(admin, t.id, day, 1), input.start);
  if (!slot) return { ok: false, message: 'Taj termin više nije slobodan ili nije u radnom vremenu. Pozovi slobodni_termini i ponudi drugi.' };

  const tenant_id = t.id;
  let client = await findClient(admin, tenant_id, phone);
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
      .insert({ tenant_id, client_id: client.id, site_id: siteId, asset_type: type, identifier: plate ? input.identifier!.toUpperCase().trim() : null, meter_primary_unit: defaultMeterUnit(type) })
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
      source: 'phone',
      meter_unit: defaultMeterUnit(type),
      work_mode: field ? 'field' : 'workshop',
      site_id: siteId,
      scheduled_start: slot.start,
      scheduled_end: slot.end,
    })
    .select('id, number')
    .single();
  if (error || !job) return { ok: false, message: 'Rezervacija nije spremljena. Zapiši poruku za majstora.' };
  await admin.from('job_events').insert({ tenant_id, job_id: job.id, event_type: 'created', message: `Termin dogovorio AI telefon: ${slot.label} · ${name}, ${input.phone}` });
  if (input.callId) {
    const { data: row } = await admin.from('phone_calls').select('id').eq('provider_call_id', input.callId).maybeSingle();
    if (row) await admin.from('phone_calls').update({ job_id: job.id }).eq('id', row.id);
    else await admin.from('phone_calls').insert({ tenant_id, provider_call_id: input.callId, caller: input.phone, job_id: job.id, started_at: new Date().toISOString() });
  }
  return { ok: true, jobId: job.id as string, number: job.number as number, label: slot.label };
}

// "Je li gotovo?": the caller's open jobs, by the number calling. No prices.
export async function openJobsText(admin: Admin, at: AgentTenant, caller: string | null): Promise<string> {
  const ctx = await callerContext(admin, at, caller);
  return ctx.name ? ctx.text : 'Za ovaj broj nema naloga u evidenciji. Pitaj pod kojim imenom ili brojem je vozilo ostavljeno i zapiši poruku za majstora.';
}

// The owner's e-mail, for the note about a new booking.
export async function ownerEmail(admin: Admin, tenantId: string): Promise<string | null> {
  const { data } = await admin.from('profiles').select('id').eq('tenant_id', tenantId).eq('role', 'owner').order('created_at').limit(1).maybeSingle();
  if (!data) return null;
  const { data: u } = await admin.auth.admin.getUserById(data.id as string);
  return u.user?.email ?? null;
}
