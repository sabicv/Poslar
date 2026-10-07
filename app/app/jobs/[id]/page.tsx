import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JobActionBar } from '@/components/job/JobActionBar';
import { JobHeader } from '@/components/job/JobHeader';
import { JobStepper } from '@/components/job/JobStepper';
import { JobTabs } from '@/components/job/JobTabs';
import { ConditionTab } from '@/components/job/ConditionTab';
import { HistoryTab } from '@/components/job/HistoryTab';
import { InspectionTab } from '@/components/job/InspectionTab';
import { LinesTab } from '@/components/job/LinesTab';
import { MessagesTab } from '@/components/job/MessagesTab';
import { OverviewTab } from '@/components/job/OverviewTab';
import { PhotosTab } from '@/components/job/PhotosTab';
import { ModuleTab } from '@/components/modules/ModuleTab';
import { PHASE_ORDER, hasModule, phaseLabel } from '@/config/tenant.config';
import { requireWorkshop } from '@/lib/session';
import type { JobWithRefs } from '@/types/db';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const ctx = await requireWorkshop();
  const { data } = await ctx.supabase.from('jobs').select('number').eq('id', id).maybeSingle();
  return { title: data ? `Nalog ${data.number}` : 'Nalog' };
}

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; vise?: string }> }) {
  const ctx = await requireWorkshop();
  const { id } = await params;
  const { tab = 'pregled', vise } = await searchParams;
  // Sections a tab folds away open with its own "Više" (?vise=1), inside the tab.
  const extras = vise === '1';
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data } = await ctx.supabase.from('jobs').select('*, client:clients(*), asset:assets(*), assignee:profiles(id, full_name), site:sites(*)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const job = data as unknown as JobWithRefs;

  // "Dnevnik" is this job's log; the object's history is its own page.
  const tabs = [
    { id: 'pregled', label: 'Pregled' },
    { id: 'stavke', label: 'Stavke' },
    { id: 'modul', label: ctx.pkg.moduleTab },
    { id: 'foto', label: 'Fotografije' },
    { id: 'poruke', label: 'Poruke' },
    { id: 'inspekcija', label: 'Inspekcija' },
    ...(hasModule(ctx.pkg, ctx.tenant.enabled_modules, 'condition_report') ? [{ id: 'zapisnik', label: 'Zapisnik' }] : []),
    { id: 'povijest', label: 'Dnevnik' },
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : 'pregled';
  const href = (tabId: string) => `/app/jobs/${id}${tabId === 'pregled' ? '' : `?tab=${tabId}`}`;
  const locked = Boolean(job.locked_at);
  const billing = !ctx.pkg.internalJobs;
  const finished = billing && (job.phase === 'ready' || job.phase === 'collected');

  return (
    <div className="pb-32">
      <JobHeader job={job} backHref="/app" backLabel={ctx.pkg.sector === 'field' ? 'Raspored' : 'Nalozi'} />
      <JobStepper pkg={ctx.pkg} phase={job.phase} payment={finished ? (job.payment_status === 'paid' ? 'paid' : 'unpaid') : null} />
      <JobTabs active={active} tabs={tabs.map((t) => ({ id: t.id, label: t.label, href: href(t.id) }))} />

      <div className="animate-fade-in">
        {active === 'pregled' ? <OverviewTab ctx={ctx} job={job} extras={extras} /> : null}
        {active === 'stavke' ? <LinesTab ctx={ctx} job={job} locked={locked} /> : null}
        {active === 'inspekcija' ? <InspectionTab ctx={ctx} job={job} locked={locked} /> : null}
        {active === 'zapisnik' ? <ConditionTab ctx={ctx} job={job} locked={locked} /> : null}
        {active === 'modul' ? <ModuleTab ctx={ctx} job={job} locked={locked} extras={extras} /> : null}
        {active === 'foto' ? <PhotosTab ctx={ctx} job={job} /> : null}
        {active === 'poruke' ? <MessagesTab ctx={ctx} job={job} /> : null}
        {active === 'povijest' ? <HistoryTab ctx={ctx} job={job} /> : null}
      </div>

      <JobActionBar
        jobId={job.id}
        phase={job.phase}
        phases={PHASE_ORDER.filter((p) => !ctx.pkg.skipPhases?.includes(p)).map((p) => ({ id: p, label: phaseLabel(ctx.pkg, p) }))}
        isOwner={ctx.isOwner}
        paid={job.payment_status === 'paid'}
        locked={locked}
        billing={billing}
        copilot={Boolean(process.env.ANTHROPIC_API_KEY)}
      />
    </div>
  );
}
