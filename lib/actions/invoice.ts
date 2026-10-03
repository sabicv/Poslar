'use server';

import { revalidatePath } from 'next/cache';
import { fail, type ActionResult } from '@/lib/action-result';
import { requireWorkshop } from '@/lib/session';

// Gives the job its invoice number (once; the next one for this year,
// premises and device) with how the customer pays.
export async function issueInvoice(jobId: string, method: 'cash' | 'card' | 'transfer' | 'other' = 'transfer'): Promise<ActionResult<{ number: number; year: number }>> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Račun izdaje voditelj servisa.');
  if (!['cash', 'card', 'transfer', 'other'].includes(method)) return fail('Odaberite način plaćanja.');
  // The sample job of a real workshop must not use up a real invoice number.
  if ((ctx.tenant.settings as { demo?: unknown } | null)?.demo !== true) {
    const { data: job } = await ctx.supabase.from('jobs').select('is_demo').eq('id', jobId).maybeSingle();
    if (job?.is_demo) return fail('Ovo je primjer naloga. Račun izdajte na pravom nalogu.');
  }
  const { data, error } = await ctx.supabase.rpc('issue_invoice', { p_job_id: jobId, p_method: method });
  if (error) return fail(error);
  const row = (data as { o_number: number; o_year: number }[] | null)?.[0];
  if (!row) return fail('Broj računa nije dodijeljen.');
  revalidatePath(`/app/jobs/${jobId}/racun`);
  return { ok: true, data: { number: row.o_number, year: row.o_year } };
}

// The number of the fiscal receipt from the workshop's own till.
export async function setInvoiceFiscalRef(jobId: string, ref: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Račun uređuje voditelj servisa.');
  const value = ref.trim().slice(0, 80) || null;
  const { error } = await ctx.supabase.from('jobs').update({ invoice_fiscal_ref: value }).eq('id', jobId);
  if (error) return fail(error);
  return { ok: true };
}
