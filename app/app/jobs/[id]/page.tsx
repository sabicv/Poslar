import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { notFound } from 'next/navigation';
import { JobActionBar } from '@/components/job/JobActionBar';
import { JobHeader } from '@/components/job/JobHeader';
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
import { cn } from '@/lib/utils';
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
  // One "Više" for the whole job: the extra tabs, and the extra sections inside tabs.
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
    { id: 'inspekcija', label: 'Inspekcija', extra: true },
    ...(hasModule(ctx.pkg, ctx.tenant.enabled_modules, 'condition_report') ? [{ id: 'zapisnik', label: 'Zapisnik', extra: true }] : []),
    { id: 'povijest', label: 'Dnevnik', extra: true },
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : 'pregled';
  // An extra tab opened by a link stays visible even with "Više" closed.
  const visible = tabs.filter((t) => !t.extra || extras || t.id === active);
  const href = (tabId: string, more = extras) => {
    const q = new URLSearchParams();
    if (tabId !== 'pregled') q.set('tab', tabId);
    if (more) q.set('vise', '1');
    const qs = q.toString();
    return `/app/jobs/${id}${qs ? `?${qs}` : ''}`;
  };
  const activeIsExtra = tabs.find((t) => t.id === active)?.extra ?? false;
  const locked = Boolean(job.locked_at);

  return (
    <div className="pb-24">
      <JobHeader job={job} backHref="/app" backLabel={ctx.pkg.sector === 'field' ? 'Raspored' : 'Nalozi'} copilot={Boolean(process.env.ANTHROPIC_API_KEY)} billing={!ctx.pkg.internalJobs} />

      {/* The tabs scroll sideways; "Više" stays pinned on the right so it is always in sight. */}
      <nav className="sticky top-[var(--shell-top)] z-20 -mx-4 mb-5 flex border-b border-line bg-bg/90 pl-4 backdrop-blur-md sm:mx-0 sm:pl-0 lg:top-0">
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {visible.map((t) => (
            <Link
              key={t.id}
              prefetch={false}
              href={href(t.id)}
              replace
              scroll={false}
              className={cn(
                'relative flex h-11 shrink-0 items-center px-3 text-sm transition-colors',
                active === t.id ? 'font-medium text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent' : 'text-muted hover:text-fg'
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <Link
          prefetch={false}
          href={extras ? href(activeIsExtra ? 'pregled' : active, false) : href(active, true)}
          replace
          scroll={false}
          className="flex h-11 shrink-0 items-center gap-1 border-l border-line px-3 text-sm font-medium text-accent"
        >
          {extras ? 'Manje' : 'Više'}
          <ChevronDown className={cn('size-4', extras && 'rotate-180')} />
        </Link>
      </nav>

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
        billing={!ctx.pkg.internalJobs}
      />
    </div>
  );
}
