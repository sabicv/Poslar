'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fail, type ActionResult } from '@/lib/action-result';
import { requireWorkshop, type WorkshopContext } from '@/lib/session';
import { sameLines } from '@/lib/templates';

// The owner's price list: hourly rate, his own templates and his own price
// on any template line. Templates (without prices) go to `templates`,
// which everyone reads; prices go to `template_prices`, owner only.

async function owner(): Promise<WorkshopContext | { error: string }> {
  const ctx = await requireWorkshop();
  return ctx.isOwner ? ctx : { error: 'Cjenik uređuje voditelj servisa.' };
}

function done() {
  revalidatePath('/app/settings/cjenik');
  revalidatePath('/app/settings');
}

export async function saveHourlyRate(rate: number | null): Promise<ActionResult> {
  const ctx = await owner();
  if ('error' in ctx) return fail(ctx.error);
  if (rate !== null && !(rate > 0 && rate <= 1000)) return fail('Upišite satnicu u eurima, npr. 45.');
  const { data: list } = await ctx.supabase.from('price_lists').select('id, labor_rates').eq('is_default', true).maybeSingle();
  const rates = { ...((list?.labor_rates as Record<string, unknown> | null) ?? {}) };
  if (rate === null) delete rates.hourly;
  else rates.hourly = Math.round(rate * 100) / 100;
  const { error } = list
    ? await ctx.supabase.from('price_lists').update({ labor_rates: rates }).eq('id', list.id)
    : await ctx.supabase.from('price_lists').insert({ tenant_id: ctx.tenant.id, name: 'Osnovni cjenik', is_default: true, labor_rates: rates });
  if (error) return fail(error);
  done();
  return { ok: true };
}

const lineSchema = z.object({
  kind: z.enum(['labor', 'part', 'material', 'package', 'sublet', 'fee']),
  description: z.string().trim().min(1, 'Svaka stavka treba opis.').max(300),
  qty: z.number().min(0).max(100000),
  unit: z.string().trim().min(1).max(20),
  // Empty = the default (hourly rate for work by the hour, else the package price).
  price: z.number().min(0).max(1000000).nullable(),
});
const templateSchema = z.object({
  code: z.string().max(80).nullable(),
  name: z.string().trim().min(2, 'Upišite naziv predloška.').max(120),
  inspection: z.string().max(80).nullable(),
  lines: z.array(lineSchema).min(1, 'Dodajte barem jednu stavku.').max(30),
});

export async function saveTemplate(values: z.input<typeof templateSchema>): Promise<ActionResult<{ code: string }>> {
  const ctx = await owner();
  if ('error' in ctx) return fail(ctx.error);
  const parsed = templateSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite predložak.');
  const v = parsed.data;
  const base = v.code ? ctx.pkg.templates.find((t) => t.code === v.code) : undefined;
  if (v.code && !base && !v.code.startsWith('own.')) return fail('Nepoznat predložak.');
  if (v.inspection && !ctx.pkg.inspections.some((i) => i.code === v.inspection)) return fail('Nepoznata kontrolna lista.');
  const code = v.code ?? `own.${randomUUID().slice(0, 8)}`;
  const lines = v.lines.map(({ kind, description, qty, unit }) => ({ kind, description, qty, unit }));

  const { data: existing } = await ctx.supabase.from('templates').select('id, hidden').eq('code', code).maybeSingle();
  // A package template saved unchanged keeps no row of its own (unless it is hidden).
  const unchanged = base && base.name === v.name && (base.inspection ?? null) === v.inspection && sameLines(lines, base.lines);
  if (unchanged && !existing?.hidden) {
    if (existing) await ctx.supabase.from('templates').delete().eq('id', existing.id);
  } else {
    const row = { tenant_id: ctx.tenant.id, package: ctx.pkg.id, code, name: v.name, lines, inspection_template_code: v.inspection, updated_at: new Date().toISOString() };
    const { error } = existing ? await ctx.supabase.from('templates').update(row).eq('id', existing.id) : await ctx.supabase.from('templates').insert(row);
    if (error) return fail(error);
  }

  // Prices: replaced as a whole, one row per line that has the owner's own price.
  const { error: delError } = await ctx.supabase.from('template_prices').delete().eq('template_code', code);
  if (delError) return fail(delError);
  const prices = v.lines.flatMap((l, i) => (l.price === null ? [] : [{ tenant_id: ctx.tenant.id, template_code: code, line_no: i, price: l.price }]));
  if (prices.length) {
    const { error } = await ctx.supabase.from('template_prices').insert(prices);
    if (error) return fail(error);
  }
  done();
  return { ok: true, data: { code } };
}

// Own template: gone. Package template: back to how the package has it.
export async function deleteTemplate(code: string): Promise<ActionResult> {
  const ctx = await owner();
  if ('error' in ctx) return fail(ctx.error);
  await ctx.supabase.from('templates').delete().eq('code', code);
  const { error } = await ctx.supabase.from('template_prices').delete().eq('template_code', code);
  if (error) return fail(error);
  done();
  return { ok: true };
}

// A package template the workshop doesn't do drops out of the job forms.
export async function setTemplateHidden(code: string, hidden: boolean): Promise<ActionResult> {
  const ctx = await owner();
  if ('error' in ctx) return fail(ctx.error);
  const { data: existing } = await ctx.supabase.from('templates').select('id').eq('code', code).maybeSingle();
  if (existing) {
    const { error } = await ctx.supabase.from('templates').update({ hidden }).eq('id', existing.id);
    if (error) return fail(error);
  } else {
    const base = ctx.pkg.templates.find((t) => t.code === code);
    if (!base) return fail('Nepoznat predložak.');
    const lines = base.lines.map(({ kind, description, qty, unit }) => ({ kind, description, qty, unit }));
    const { error } = await ctx.supabase
      .from('templates')
      .insert({ tenant_id: ctx.tenant.id, package: ctx.pkg.id, code, name: base.name, lines, inspection_template_code: base.inspection ?? null, hidden });
    if (error) return fail(error);
  }
  done();
  return { ok: true };
}

// "Spremi kao predložak": the job's approved lines, with the owner's
// prices on them, become a template of his own.
export async function saveJobAsTemplate(jobId: string, name: string): Promise<ActionResult<{ code: string }>> {
  const ctx = await owner();
  if ('error' in ctx) return fail(ctx.error);
  const { data: lines } = await ctx.supabase.from('job_lines').select('id, kind, description, qty, unit').eq('job_id', jobId).eq('approval', 'approved').order('sort');
  if (!lines?.length) return fail('Na nalogu nema odobrenih stavki.');
  const { data: prices } = await ctx.supabase.from('job_line_prices').select('job_line_id, unit_price').in('job_line_id', lines.map((l) => l.id));
  const price = new Map((prices ?? []).map((p) => [p.job_line_id as string, Number(p.unit_price)]));
  return saveTemplate({
    code: null,
    name,
    inspection: null,
    lines: lines.slice(0, 30).map((l) => ({ kind: l.kind as z.infer<typeof lineSchema>['kind'], description: l.description as string, qty: Number(l.qty), unit: l.unit as string, price: price.get(l.id as string) ?? null })),
  });
}
