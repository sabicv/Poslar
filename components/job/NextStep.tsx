import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { quotePolicy, type PackageConfig } from '@/config/tenant.config';
import type { WorkshopContext } from '@/lib/session';
import type { JobWithRefs } from '@/types/db';

function Step({ href, children }: { href?: string; children: string }) {
  if (!href) return <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm">{children}</p>;
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm hover:bg-surface2">
      <span>{children}</span>
      <ChevronRight className="size-4 shrink-0 text-muted" />
    </Link>
  );
}

function tabHref(jobId: string, tab: NonNullable<PackageConfig['opening']>['tab']) {
  if (!tab) return undefined;
  return `/app/jobs/${jobId}?tab=${tab}`;
}

function openingStep(jobId: string, opening: NonNullable<PackageConfig['opening']>, phase: JobWithRefs['phase']) {
  const text = phase === 'diagnosis' && opening.diagnosis ? opening.diagnosis : opening.intake;
  const tab = phase === 'diagnosis' && opening.diagnosisTab ? opening.diagnosisTab : opening.tab;
  return <Step href={tabHref(jobId, tab)}>{text}</Step>;
}

// One sentence for this trade's own start. Not a new phase.
export async function NextStep({ ctx, job }: { ctx: WorkshopContext; job: JobWithRefs }) {
  if (job.locked_at) return null;
  const opening = ctx.pkg.opening;
  const early = job.phase === 'intake' || job.phase === 'diagnosis';
  if (ctx.pkg.internalJobs) {
    if (!early || !opening) return null;
    return openingStep(job.id, opening, job.phase);
  }

  const policy = quotePolicy(ctx.pkg);
  const [{ count: proposed }, { data: open }, { data: anyQuote }] = await Promise.all([
    ctx.supabase.from('job_lines').select('id', { count: 'exact', head: true }).eq('job_id', job.id).eq('approval', 'proposed'),
    ctx.supabase.from('approvals').select('quote_number, quote_year').eq('job_id', job.id).in('status', ['sent', 'viewed']).order('sent_at', { ascending: false }).limit(1).maybeSingle(),
    ctx.supabase.from('approvals').select('id').eq('job_id', job.id).in('status', ['sent', 'viewed', 'decided']).limit(1).maybeSingle(),
  ]);

  if (open) {
    const number = open.quote_number && open.quote_year ? `Ponuda ${open.quote_number}/${open.quote_year}` : 'Ponuda';
    return <Step href={`/app/jobs/${job.id}/ponuda`}>{`${number} je kod mušterije.`}</Step>;
  }
  if ((proposed ?? 0) > 0 && policy !== 'never' && ctx.isOwner) {
    return <Step href={`/app/jobs/${job.id}?tab=stavke`}>Sljedeće: pošaljite ponudu.</Step>;
  }
  if (policy === 'first' && early && !anyQuote && opening) {
    return <Step href={`/app/jobs/${job.id}?tab=stavke`}>{opening.intake}</Step>;
  }
  if (!early || !opening) return null;
  if (ctx.pkg.sector === 'field' && !job.scheduled_start) return null;
  if (job.phase === 'diagnosis' && ctx.pkg.sector !== 'field' && !opening.diagnosis) return null;
  return openingStep(job.id, opening, job.phase);
}
