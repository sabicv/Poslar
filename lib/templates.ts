import 'server-only';

import type { InspectionTemplate, JobTemplate, TemplateLine } from '@/config/tenant.config';
import type { WorkshopContext } from '@/lib/session';

// Package templates from config, overridden or extended by the workshop's
// own (templates / inspection_templates tables, edited by the owner).
export async function getJobTemplates(ctx: WorkshopContext): Promise<JobTemplate[]> {
  const { data } = await ctx.supabase.from('templates').select('code, name, lines, inspection_template_code').eq('package', ctx.pkg.id);
  const own = (data ?? []).map((row) => ({
    code: row.code as string,
    name: row.name as string,
    lines: (row.lines ?? []) as TemplateLine[],
    inspection: (row.inspection_template_code as string | null) ?? undefined,
  }));
  const byCode = new Map<string, JobTemplate>(ctx.pkg.templates.map((t) => [t.code, t]));
  for (const t of own) byCode.set(t.code, t);
  return [...byCode.values()];
}

export async function getInspectionTemplates(ctx: WorkshopContext): Promise<InspectionTemplate[]> {
  const { data } = await ctx.supabase.from('inspection_templates').select('code, name, sections').eq('package', ctx.pkg.id);
  const byCode = new Map<string, InspectionTemplate>(ctx.pkg.inspections.map((t) => [t.code, t]));
  for (const row of data ?? []) {
    byCode.set(row.code as string, { code: row.code as string, name: row.name as string, purpose: 'checklist', sections: row.sections as InspectionTemplate['sections'] });
  }
  return [...byCode.values()];
}
