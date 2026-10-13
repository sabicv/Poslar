import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JobActionBar } from '@/components/job/JobActionBar';
import { JobHeader } from '@/components/job/JobHeader';
import { JobStepper } from '@/components/job/JobStepper';
import { JobTabs } from '@/components/job/JobTabs';
import { HistoryTab } from '@/components/job/HistoryTab';
import { InspectionTab } from '@/components/job/InspectionTab';
import { LinesTab } from '@/components/job/LinesTab';
import { OverviewTab } from '@/components/job/OverviewTab';
import { ModuleTab } from '@/components/modules/ModuleTab';
import { PHASE_ORDER, phaseLabel, quotePolicy } from '@/config/tenant.config';
import { publicAppUrl } from '@/lib/qr';
import { requireWorkshop } from '@/lib/session';
import type { JobWithRefs } from '@/types/db';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const ctx = await requireWorkshop();
  const { data } = await ctx.supabase.from('jobs').select('number').eq('id', id).maybeSingle();
  return { title: data ? `Nalog ${data.number}` : 'Nalog' };
}

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; vise?: string; otvori?: string }> }) {
  const ctx = await requireWorkshop();
  const { id } = await params;
  const { tab: rawTab = 'pregled', otvori } = await searchParams;
  // Old links: the photo drawer and the messages tab now live in the trail.
  const tab = rawTab === 'zapisnik' ? 'pregled' : rawTab === 'foto' || rawTab === 'poruke' ? 'povijest' : rawTab;
  const trailOpen = otvori ?? (rawTab === 'poruke' ? 'poruke' : rawTab === 'foto' ? 'foto' : undefined);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data } = await ctx.supabase.from('jobs').select('*, client:clients(*), asset:assets(*), assignee:profiles(id, full_name), site:sites(*)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const job = data as unknown as JobWithRefs;

  // Tijek radova is this job's log, messages and photographs. The object's history is its own page.
  const quotes = quotePolicy(ctx.pkg) !== 'never' && !ctx.pkg.internalJobs;
  const [{ count: proposed }, { data: openQuote }, appUrl] = await Promise.all([
    quotes && ctx.isOwner
      ? ctx.supabase.from('job_lines').select('id', { count: 'exact', head: true }).eq('job_id', id).eq('approval', 'proposed')
      : Promise.resolve({ count: 0 }),
    quotes
      ? ctx.supabase.from('approvals').select('quote_number, quote_year').eq('job_id', id).in('status', ['sent', 'viewed']).order('sent_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    publicAppUrl(),
  ]);
  const quoteLabel = openQuote?.quote_number && openQuote.quote_year ? `Ponuda ${openQuote.quote_number}/${openQuote.quote_year}` : 'Ponuda je kod mušterije';
  // A worker never sees prices, and a dealer's own job is not a bill.
  const linesLabel = quotes && ctx.isOwner ? 'Radovi i cijena' : 'Radovi';
  const tabs = [
    { id: 'pregled', label: 'Pregled' },
    { id: 'stavke', label: linesLabel },
    { id: 'modul', label: ctx.pkg.moduleTab },
    { id: 'inspekcija', label: 'Kontrolna lista' },
    { id: 'povijest', label: 'Tijek radova' },
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : 'pregled';
  const href = (tabId: string) => `/app/jobs/${id}${tabId === 'pregled' ? '' : `?tab=${tabId}`}`;
  const locked = Boolean(job.locked_at);
  const billing = !ctx.pkg.internalJobs;
  const finished = billing && (job.phase === 'ready' || job.phase === 'collected');

  return (
    <div className="pb-28">
      <JobHeader job={job} backHref="/app" backLabel={ctx.pkg.sector === 'field' ? 'Raspored' : 'Nalozi'} />
      <JobStepper pkg={ctx.pkg} phase={job.phase} payment={finished ? (job.payment_status === 'paid' ? 'paid' : 'unpaid') : null} />
      <JobTabs active={active} tabs={tabs.map((t) => ({ id: t.id, label: t.label, href: href(t.id) }))} />

      <div className="animate-fade-in">
        {active === 'pregled' ? <OverviewTab ctx={ctx} job={job} /> : null}
        {active === 'stavke' ? <LinesTab ctx={ctx} job={job} locked={locked} /> : null}
        {active === 'inspekcija' ? <InspectionTab ctx={ctx} job={job} locked={locked} /> : null}
        {active === 'modul' ? <ModuleTab ctx={ctx} job={job} locked={locked} /> : null}
        {active === 'povijest' ? <HistoryTab ctx={ctx} job={job} open={trailOpen} /> : null}
      </div>

      <JobActionBar
        jobId={job.id}
        phase={job.phase}
        phases={PHASE_ORDER.filter((p) => !ctx.pkg.skipPhases?.includes(p)).map((p) => ({ id: p, label: phaseLabel(ctx.pkg, p) }))}
        isOwner={ctx.isOwner}
        paid={job.payment_status === 'paid'}
        locked={locked}
        billing={billing}
        field={ctx.pkg.sector === 'field'}
        scheduled={Boolean(job.scheduled_start)}
        proposedCount={proposed ?? 0}
        quoteOut={ctx.isOwner && openQuote ? { href: `/app/jobs/${id}/ponuda`, label: quoteLabel } : null}
        clientPhone={job.client?.phone ?? null}
        appUrl={appUrl}
        copilot={Boolean(process.env.ANTHROPIC_API_KEY)}
      />
    </div>
  );
}
