import { billingFrom } from '@/components/invoice/InvoiceDocument';
import { quotePolicy } from '@/config/tenant.config';
import { publicAppUrl } from '@/lib/qr';
import type { WorkshopContext } from '@/lib/session';
import { getJobTemplates, loadPriceBook } from '@/lib/templates';
import type { Approval, JobLine, JobLinePrice, JobWithRefs } from '@/types/db';
import { LinesEditor } from './LinesEditor';

export async function LinesTab({ ctx, job, locked }: { ctx: WorkshopContext; job: JobWithRefs; locked: boolean }) {
  const [{ data: lines }, templates, approvals, book, { data: shots }] = await Promise.all([
    ctx.supabase.from('job_lines').select('*').eq('job_id', job.id).order('sort'),
    getJobTemplates(ctx),
    ctx.supabase.from('approvals').select('*').eq('job_id', job.id).order('sent_at', { ascending: false }).limit(1),
    ctx.isOwner ? loadPriceBook(ctx.tenant.id) : Promise.resolve(null),
    ctx.supabase.from('attachments').select('zone, tag').eq('job_id', job.id).in('tag', ['part_old', 'part_new']),
  ]);
  const partShots: Record<string, { old: number; new: number }> = {};
  for (const shot of shots ?? []) {
    const zone = shot.zone as string | null;
    if (!zone) continue;
    const row = (partShots[zone] ??= { old: 0, new: 0 });
    if (shot.tag === 'part_old') row.old += 1;
    else row.new += 1;
  }

  // Prices are fetched only for the owner (and the database would return none to a worker).
  let prices: JobLinePrice[] = [];
  if (ctx.isOwner && lines?.length) {
    const { data } = await ctx.supabase.from('job_line_prices').select('*').in('job_line_id', lines.map((l) => l.id));
    prices = (data ?? []) as JobLinePrice[];
  }

  return (
    <LinesEditor
      jobId={job.id}
      lines={(lines ?? []) as JobLine[]}
      prices={Object.fromEntries(prices.map((p) => [p.job_line_id, { unit_price: Number(p.unit_price), discount_pct: Number(p.discount_pct), vat_rate: Number(p.vat_rate) }]))}
      templates={templates.map((t) => ({ code: t.code, name: t.name }))}
      isOwner={ctx.isOwner}
      locked={locked}
      approval={(approvals.data?.[0] as Approval | undefined) ?? null}
      appUrl={publicAppUrl()}
      clientPhone={job.client?.phone ?? null}
      vatRegistered={billingFrom(ctx.tenant.settings).vatRegistered}
      invoice={!ctx.pkg.internalJobs}
      quotes={quotePolicy(ctx.pkg) !== 'never'}
      phase={job.phase}
      hourlyRate={book?.hourly ?? null}
      templateName={(job.complaint ?? '').split(/[,.]/)[0].trim().slice(0, 60)}
      tenantId={ctx.tenant.id}
      partShots={partShots}
    />
  );
}
