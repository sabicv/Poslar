import 'server-only';

import type { InspectionTemplate, JobTemplate, TemplateLine } from '@/config/tenant.config';
import type { WorkshopContext } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

// Job templates: the package's own (config) plus the workshop's, from the
// templates table (owner edits, everyone reads). A row with a package
// template's code changes or hides that template. Prices never live in
// that table: the owner's prices are in template_prices (owner only).

export interface TemplateEntry extends JobTemplate {
  kind: 'package' | 'own';
  // A package template the owner has changed (name, lines or checklist).
  changed: boolean;
  hidden: boolean;
}

const strip = (lines: TemplateLine[]) => lines.map(({ kind, description, code, qty, unit, kpd }) => ({ kind, description, ...(code ? { code } : {}), qty: Number(qty), unit, ...(kpd ? { kpd } : {}) }));
export const sameLines = (a: TemplateLine[], b: TemplateLine[]) => JSON.stringify(strip(a)) === JSON.stringify(strip(b));

export async function listTemplates(ctx: WorkshopContext, { includeHidden = false } = {}): Promise<TemplateEntry[]> {
  const { data } = await ctx.supabase.from('templates').select('code, name, lines, inspection_template_code, hidden').eq('package', ctx.pkg.id).order('created_at');
  const byCode = new Map<string, TemplateEntry>(ctx.pkg.templates.map((t) => [t.code, { ...t, kind: 'package', changed: false, hidden: false }]));
  for (const row of data ?? []) {
    const lines = (row.lines ?? []) as TemplateLine[];
    const inspection = (row.inspection_template_code as string | null) ?? undefined;
    const hidden = Boolean(row.hidden);
    const base = ctx.pkg.templates.find((t) => t.code === row.code);
    if (base) {
      const changed = row.name !== base.name || inspection !== base.inspection || !sameLines(lines, base.lines);
      byCode.set(base.code, changed ? { code: base.code, name: row.name as string, lines: strip(lines), inspection, kind: 'package', changed: true, hidden } : { ...base, kind: 'package', changed: false, hidden });
    } else {
      byCode.set(row.code as string, { code: row.code as string, name: row.name as string, lines: strip(lines), inspection, kind: 'own', changed: false, hidden });
    }
  }
  // Alphabetical, the way a workshop looks for a job (č, ć, š, ž in place).
  const all = [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, 'hr', { sensitivity: 'base' }));
  return includeHidden ? all : all.filter((t) => !t.hidden);
}

// What the job forms offer: every template the workshop has not hidden.
export async function getJobTemplates(ctx: WorkshopContext): Promise<TemplateEntry[]> {
  return listTemplates(ctx);
}

// The owner's prices. Read with the service role, because a worker who
// adds a template to a job must get the owner's prices on its lines
// without ever being able to read them.
export interface PriceBook {
  hourly: number | null;
  lines: Map<string, number>;
}

export async function loadPriceBook(tenantId: string): Promise<PriceBook> {
  const admin = createAdminClient();
  const [{ data: list }, { data: prices }] = await Promise.all([
    admin.from('price_lists').select('labor_rates').eq('tenant_id', tenantId).eq('is_default', true).maybeSingle(),
    admin.from('template_prices').select('template_code, line_no, price').eq('tenant_id', tenantId),
  ]);
  const hourly = (list?.labor_rates as { hourly?: unknown } | null)?.hourly;
  return {
    hourly: typeof hourly === 'number' && hourly > 0 ? hourly : null,
    lines: new Map((prices ?? []).map((p) => [`${p.template_code}#${p.line_no}`, Number(p.price)])),
  };
}

// The price a template line goes onto a job with: the owner's own price for
// that line, else his hourly rate for work by the hour, else the package
// default (only while the package template is unchanged).
export function linePrice(t: TemplateEntry, index: number, book: PriceBook): number | undefined {
  const own = book.lines.get(`${t.code}#${index}`);
  if (own !== undefined) return own;
  return defaultLinePrice(t, index, book);
}

// Without the owner's own line price: what an empty price field falls back to.
export function defaultLinePrice(t: TemplateEntry, index: number, book: PriceBook): number | undefined {
  const line = t.lines[index];
  if (!line) return undefined;
  if (line.kind === 'labor' && line.unit === 'h' && book.hourly !== null) return book.hourly;
  return t.kind === 'package' && !t.changed ? line.price : undefined;
}

export async function getInspectionTemplates(ctx: WorkshopContext): Promise<InspectionTemplate[]> {
  const { data } = await ctx.supabase.from('inspection_templates').select('code, name, sections').eq('package', ctx.pkg.id);
  const byCode = new Map<string, InspectionTemplate>(ctx.pkg.inspections.map((t) => [t.code, t]));
  for (const row of data ?? []) {
    byCode.set(row.code as string, { code: row.code as string, name: row.name as string, purpose: 'checklist', sections: row.sections as InspectionTemplate['sections'] });
  }
  return [...byCode.values()];
}

// One template line's price as the owner set it (for buttons such as
// "Obračunaj ležarinu"), with a fallback when the template is gone.
export async function templateLinePrice(ctx: WorkshopContext, code: string, index: number, fallback: number): Promise<number> {
  const [templates, book] = await Promise.all([listTemplates(ctx, { includeHidden: true }), loadPriceBook(ctx.tenant.id)]);
  const t = templates.find((x) => x.code === code);
  return (t && linePrice(t, index, book)) ?? fallback;
}
