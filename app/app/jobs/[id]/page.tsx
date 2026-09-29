import type { Metadata } from 'next';
import Link from 'next/link';
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

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireWorkshop();
  const { id } = await params;
  const { tab = 'pregled' } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data } = await ctx.supabase.from('jobs').select('*, client:clients(*), asset:assets(*), assignee:profiles(id, full_name), site:sites(*)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const job = data as unknown as JobWithRefs;

  let total: number | null = null;
  if (ctx.isOwner) {
    const { data: t } = await ctx.supabase.from('job_totals').select('gross_total').eq('job_id', id).maybeSingle();
    total = t ? Number(t.gross_total) : 0;
  }

  const tabs = [
    { id: 'pregled', label: 'Pregled' },
    { id: 'stavke', label: 'Stavke' },
    { id: 'inspekcija', label: 'Inspekcija' },
    ...(hasModule(ctx.pkg, ctx.tenant.enabled_modules, 'condition_report') ? [{ id: 'zapisnik', label: 'Zapisnik' }] : []),
    { id: 'modul', label: ctx.pkg.moduleTab },
    { id: 'foto', label: 'Fotografije' },
    { id: 'poruke', label: 'Poruke' },
    { id: 'povijest', label: 'Povijest' },
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : 'pregled';
  const locked = Boolean(job.locked_at);

  return (
    <div className="pb-24">
      <JobHeader job={job} pkg={ctx.pkg} total={total} copilot={Boolean(process.env.ANTHROPIC_API_KEY)} />

      <nav className="no-scrollbar sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:mx-0 sm:px-0 lg:top-0">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/app/jobs/${id}${t.id === 'pregled' ? '' : `?tab=${t.id}`}`}
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
      </nav>

      <div className="animate-fade-in">
        {active === 'pregled' ? <OverviewTab ctx={ctx} job={job} /> : null}
        {active === 'stavke' ? <LinesTab ctx={ctx} job={job} locked={locked} /> : null}
        {active === 'inspekcija' ? <InspectionTab ctx={ctx} job={job} locked={locked} /> : null}
        {active === 'zapisnik' ? <ConditionTab ctx={ctx} job={job} locked={locked} /> : null}
        {active === 'modul' ? <ModuleTab ctx={ctx} job={job} locked={locked} /> : null}
        {active === 'foto' ? <PhotosTab ctx={ctx} job={job} /> : null}
        {active === 'poruke' ? <MessagesTab ctx={ctx} job={job} /> : null}
        {active === 'povijest' ? <HistoryTab ctx={ctx} job={job} /> : null}
      </div>

      <JobActionBar
        jobId={job.id}
        phase={job.phase}
        phases={PHASE_ORDER.map((p) => ({ id: p, label: phaseLabel(ctx.pkg, p) }))}
        isOwner={ctx.isOwner}
        paid={job.payment_status === 'paid'}
        locked={locked}
      />
    </div>
  );
}
