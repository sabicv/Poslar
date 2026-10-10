'use server';

import { revalidatePath } from 'next/cache';
import { fail, type ActionResult } from '@/lib/action-result';
import type { InvoiceStatus } from '@/components/invoice/InvoiceDocument';
import { requireWorkshop } from '@/lib/session';

async function invoiceJob(ctx: Awaited<ReturnType<typeof requireWorkshop>>, jobId: string) {
  const { data } = await ctx.supabase
    .from('jobs')
    .select('is_demo, invoice_number, invoice_status, invoice_fiscal_ref, invoice_sent_at')
    .eq('id', jobId)
    .maybeSingle();
  return data;
}

function refresh(jobId: string) {
  revalidatePath(`/app/jobs/${jobId}/racun`);
}

// Gives the job its invoice number (once; the next one for this year,
// premises and device) with how the customer pays.
export async function issueInvoice(jobId: string, method: 'cash' | 'card' | 'transfer' | 'other' = 'transfer'): Promise<ActionResult<{ number: number; year: number }>> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Račun izdaje voditelj servisa.');
  if (!['cash', 'card', 'transfer', 'other'].includes(method)) return fail('Odaberite način plaćanja.');
  // The sample job of a real workshop must not use up a real invoice number.
  if ((ctx.tenant.settings as { demo?: unknown } | null)?.demo !== true) {
    const job = await invoiceJob(ctx, jobId);
    if (job?.is_demo) return fail('Ovo je primjer naloga. Račun izdajte na pravom nalogu.');
    if (job?.invoice_status === 'voided') return fail('Ovaj je račun storniran. Broj ostaje iskorišten.');
  }
  const { data, error } = await ctx.supabase.rpc('issue_invoice', { p_job_id: jobId, p_method: method });
  if (error) return fail(error.message?.includes('invoice_voided') ? 'Ovaj je račun storniran. Broj ostaje iskorišten.' : error);
  const row = (data as { o_number: number; o_year: number }[] | null)?.[0];
  if (!row) return fail('Broj računa nije dodijeljen.');
  refresh(jobId);
  return { ok: true, data: { number: row.o_number, year: row.o_year } };
}

// WhatsApp or a copied link: the invoice left the workshop.
export async function markInvoiceSent(jobId: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Račun šalje voditelj servisa.');
  const job = await invoiceJob(ctx, jobId);
  if (!job?.invoice_number) return fail('Prvo izdajte račun.');
  if (job.invoice_status === 'voided') return fail('Stornirani račun se ne šalje.');
  const patch: Record<string, unknown> = { invoice_sent_at: job.invoice_sent_at ?? new Date().toISOString() };
  if (job.invoice_status === 'issued' || job.invoice_status === 'rejected') patch.invoice_status = 'sent';
  const { error } = await ctx.supabase.from('jobs').update(patch).eq('id', jobId);
  if (error) return fail(error);
  refresh(jobId);
  return { ok: true };
}

// The number of the fiscal receipt from the workshop's own till.
export async function setInvoiceFiscalRef(jobId: string, ref: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Račun uređuje voditelj servisa.');
  const job = await invoiceJob(ctx, jobId);
  if (!job?.invoice_number) return fail('Prvo izdajte račun.');
  if (job.invoice_status === 'voided') return fail('Stornirani račun se ne mijenja.');
  const value = ref.trim().slice(0, 80) || null;
  const next: InvoiceStatus = value ? 'fiscalized' : job.invoice_sent_at ? 'sent' : 'issued';
  const { error } = await ctx.supabase.from('jobs').update({ invoice_fiscal_ref: value, invoice_status: next }).eq('id', jobId);
  if (error) return fail(error);
  refresh(jobId);
  return { ok: true };
}

// The till rejected the fiscal send. The number stays; the owner resends.
export async function rejectInvoice(jobId: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Račun uređuje voditelj servisa.');
  const job = await invoiceJob(ctx, jobId);
  if (!job?.invoice_number) return fail('Prvo izdajte račun.');
  if (job.invoice_status === 'voided') return fail('Stornirani račun se ne mijenja.');
  const { error } = await ctx.supabase
    .from('jobs')
    .update({ invoice_status: 'rejected', invoice_rejected_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) return fail(error);
  refresh(jobId);
  return { ok: true };
}

// Same number, back to issued — the till gets the same invoice again.
export async function resendInvoice(jobId: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Račun uređuje voditelj servisa.');
  const job = await invoiceJob(ctx, jobId);
  if (job?.invoice_status !== 'rejected') return fail('Ponovno slanje je samo za račun koji je blagajna odbila.');
  const { error } = await ctx.supabase.from('jobs').update({ invoice_status: 'issued' }).eq('id', jobId);
  if (error) return fail(error);
  refresh(jobId);
  return { ok: true };
}

// After a storno the number stays used. The same job becomes a draft
// again, so the next issue takes the following number. Lines stay.
export async function reopenVoidedInvoice(jobId: string): Promise<ActionResult<{ number: number; year: number }>> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Račun uređuje voditelj servisa.');
  const job = await invoiceJob(ctx, jobId);
  if (job?.is_demo && (ctx.tenant.settings as { demo?: unknown } | null)?.demo !== true) return fail('Ovo je primjer naloga.');
  if (job?.invoice_status !== 'voided') return fail('Novi broj ide samo nakon storna.');
  const { data, error } = await ctx.supabase.rpc('reopen_voided_invoice', { p_job_id: jobId });
  if (error) return fail(error.message?.includes('invoice_not_voided') ? 'Novi broj ide samo nakon storna.' : error);
  const row = (data as { o_number: number; o_year: number }[] | null)?.[0];
  refresh(jobId);
  revalidatePath(`/app/jobs/${jobId}`);
  return { ok: true, data: { number: row?.o_number ?? 0, year: row?.o_year ?? 0 } };
}

// Storno: the number stays used so the yearly sequence has no gap.
export async function voidInvoice(jobId: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Račun stornira voditelj servisa.');
  const job = await invoiceJob(ctx, jobId);
  if (!job?.invoice_number) return fail('Prvo izdajte račun.');
  if (job.invoice_status === 'voided') return { ok: true };
  const { error } = await ctx.supabase
    .from('jobs')
    .update({ invoice_status: 'voided', invoice_voided_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) return fail(error);
  refresh(jobId);
  return { ok: true };
}
