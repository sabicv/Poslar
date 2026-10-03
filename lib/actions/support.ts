'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fail, type ActionResult } from '@/lib/action-result';
import { isPlatformAdmin, requireWorkshop } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

// "Javi problem": written from the app, answered from the tower. Rows are
// written with the service role after the checks here; the app only reads
// its own tickets (RLS: the author and the owner).

const body = z.string().trim().min(3, 'Napišite što se dogodilo.').max(4000, 'Poruka je preduga.');

export async function createTicket(text: string, pageUrl: string | null): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkshop();
  const parsed = body.safeParse(text);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite poruku.');
  const admin = createAdminClient();
  // A stuck button can't flood the tower.
  const { count } = await admin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('user_id', ctx.user.id).gte('created_at', new Date(Date.now() - 86400000).toISOString());
  if ((count ?? 0) >= 10) return fail('Danas ste već poslali puno prijava. Dopišite u postojeću.');
  const agent = (await headers()).get('user-agent');
  const { data: ticket, error } = await admin
    .from('support_tickets')
    .insert({ tenant_id: ctx.tenant.id, user_id: ctx.user.id, page_url: pageUrl?.slice(0, 500) ?? null, user_agent: agent?.slice(0, 300) ?? null })
    .select('id')
    .single();
  if (error || !ticket) return fail(error);
  const { error: msgError } = await admin.from('support_messages').insert({ ticket_id: ticket.id, tenant_id: ctx.tenant.id, author_id: ctx.user.id, body: parsed.data });
  if (msgError) return fail(msgError);
  revalidatePath('/app/podrska');
  return { ok: true, data: { id: ticket.id } };
}

export async function replyToTicket(ticketId: string, text: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const parsed = body.safeParse(text);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite poruku.');
  // Reading through RLS proves the ticket is this person's (or the owner's).
  const { data: ticket } = await ctx.supabase.from('support_tickets').select('id').eq('id', ticketId).maybeSingle();
  if (!ticket) return fail('Prijava nije pronađena.');
  const admin = createAdminClient();
  const { error } = await admin.from('support_messages').insert({ ticket_id: ticketId, tenant_id: ctx.tenant.id, author_id: ctx.user.id, body: parsed.data });
  if (error) return fail(error);
  await admin.from('support_tickets').update({ status: 'open', last_message_at: new Date().toISOString(), tenant_unread: false }).eq('id', ticketId);
  revalidatePath('/app/podrska');
  return { ok: true };
}

// Opening the support page marks the answers as seen.
export async function markSupportRead(): Promise<void> {
  const ctx = await requireWorkshop();
  const { data } = await ctx.supabase.from('support_tickets').select('id').eq('tenant_unread', true);
  const ids = (data ?? []).map((t) => t.id as string);
  if (ids.length) await createAdminClient().from('support_tickets').update({ tenant_unread: false }).in('id', ids);
}

// ---------------------------------------------------------------------
// The tower
// ---------------------------------------------------------------------
async function guard() {
  return (await isPlatformAdmin()) ? null : fail('Samo administrator platforme.');
}

export async function adminReplyTicket(ticketId: string, text: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = body.safeParse(text);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite poruku.');
  const admin = createAdminClient();
  const { data: ticket } = await admin.from('support_tickets').select('tenant_id').eq('id', ticketId).maybeSingle();
  if (!ticket) return fail('Prijava nije pronađena.');
  const { getAuth } = await import('@/lib/session');
  const { user } = await getAuth();
  const { error } = await admin.from('support_messages').insert({ ticket_id: ticketId, tenant_id: ticket.tenant_id, author_id: user?.id ?? null, from_admin: true, body: parsed.data });
  if (error) return fail(error);
  await admin.from('support_tickets').update({ status: 'answered', last_message_at: new Date().toISOString(), tenant_unread: true }).eq('id', ticketId);
  revalidatePath('/admin/podrska');
  revalidatePath(`/admin/podrska/${ticketId}`);
  return { ok: true };
}

export async function adminSetTicketStatus(ticketId: string, status: 'open' | 'answered' | 'closed'): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const { error } = await createAdminClient().from('support_tickets').update({ status }).eq('id', ticketId);
  if (error) return fail(error);
  revalidatePath('/admin/podrska');
  revalidatePath(`/admin/podrska/${ticketId}`);
  return { ok: true };
}

// "Želim ovaj paket": a request the tower answers (plans change there).
export async function requestPlan(plan: 'basic' | 'standard' | 'premium', term: 'monthly' | '24m'): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Paket mijenja voditelj servisa.');
  const names = { basic: 'Basic', standard: 'Standard', premium: 'Premium' } as const;
  if (!(plan in names)) return fail('Nepoznat paket.');
  return createTicket(`Želim paket ${names[plan]}${term === '24m' ? ', ugovor na 24 mjeseca' : ', mjesečno'}.`, '/app/settings/pretplata');
}
