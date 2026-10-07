import 'server-only';
import { getPackage, phaseLabel } from '@/config/tenant.config';
import { bookSlot, canBook, findClientByPhone, slotsFor, type BookInput, type BookResult, type BookingTenant } from '@/lib/booking';
import { readHours, spokenHours, spokenSlot, type Slot } from '@/lib/calendar';
import { digitsOf } from '@/lib/intake';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Tenant } from '@/types/db';

// The AI phone agent (Vapi): calls the owner does not take are forwarded
// to the workshop's AI number. Here: which workshop a call is for, who is
// calling, the free slots, and booking one as a job in Prijem. Everything
// runs with the service role, always for the one workshop the called
// number belongs to (set in the tower).

type Admin = ReturnType<typeof createAdminClient>;
export type AgentTenant = BookingTenant;
export { canBook };

export async function tenantForNumber(admin: Admin, numberId: string | null): Promise<AgentTenant | null> {
  if (!numberId) return null;
  const { data } = await admin.from('tenants').select('*').eq('phone_agent_number_id', numberId).maybeSingle();
  if (!data) return null;
  const tenant = data as Tenant;
  return { tenant, pkg: getPackage(tenant.package) };
}


const nameOf = (c: { kind: string; first_name: string | null; last_name: string | null; company_name: string | null }) =>
  c.kind === 'company' && c.company_name ? c.company_name : [c.first_name, c.last_name].filter(Boolean).join(' ');

// What the agent knows about the caller before saying a word.
export async function callerContext(admin: Admin, at: AgentTenant, caller: string | null): Promise<{ text: string; name: string | null }> {
  const phone = caller ? digitsOf(caller) : '';
  const client = phone ? await findClientByPhone(admin, at.tenant.id, phone) : null;
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

// Up to four free slots for the caller, from the day asked for (if any).
export async function offerSlots(admin: Admin, at: AgentTenant, preferDay?: string | null): Promise<Slot[]> {
  return slotsFor(admin, at, { from: preferDay, days: 21, limit: 4 });
}

export function agentVariables(at: AgentTenant, caller: { text: string; name: string | null }) {
  const field = at.pkg.sector === 'field';
  const greeting = `Dobar dan, ${at.tenant.name}, ovdje Poslar. Majstor trenutno ne može, pa se javljam automatski.${caller.name ? ` Jeste li Vi ${caller.name}?` : ' Kako Vam mogu pomoći?'}`;
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

export type { BookResult };

// A booking from a call: the job is marked as Poslar's on the phone, and a
// taken slot tells the agent to fetch the free ones again.
export async function book(admin: Admin, at: AgentTenant, input: BookInput): Promise<BookResult> {
  const r = await bookSlot(admin, at, input, { source: 'phone', event: 'Termin dogovorio Poslar na telefonu' });
  return !r.ok && /nije slobodan/.test(r.message) ? { ok: false, message: "Taj termin više nije slobodan ili nije u radnom vremenu. Pozovi slobodni_termini i ponudi drugi." } : r;
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
