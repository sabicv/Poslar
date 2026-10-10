import Link from 'next/link';
import { BellRing, CalendarDays, ChevronRight, ClipboardList, Flame, Search, UserRound } from 'lucide-react';
import { FieldSchedule } from '@/components/field/FieldSchedule';
import { RestoreScroll } from '@/components/nav-memory';
import { JobCard, type BoardJob } from '@/components/JobCard';
import { EmptyState, Input, PageHeader, buttonClass } from '@/components/ui';
import { PHASE_ORDER, hasFieldWork, phaseLabel, type JobPhase } from '@/config/tenant.config';
import { formatEuro } from '@/lib/format';
import { FirstSteps } from '@/components/onboarding/FirstSteps';
import { helpVideo } from '@/lib/help';
import { loadFirstSteps } from '@/lib/onboarding';
import { allRows, inChunks } from '@/lib/paged';
import { loadReminders } from '@/lib/reminders';
import { requireWorkshop } from '@/lib/session';
import { cn, plateIlike, toIlike } from '@/lib/utils';

const JOB_FIELDS =
  'id, number, phase, complaint, is_urgent, promised_at, payment_status, locked_at, updated_at, assigned_to, source, scheduled_start, client:clients(kind, first_name, last_name, company_name), asset:assets(asset_type, identifier, make, model), assignee:profiles(full_name)';

// One segment (all open, being worked on, to collect, closed) and two
// switches on top of it (urgent, mine).
type Segment = 'svi' | 'radu' | 'naplata' | 'arhiva';
const WORKING: JobPhase[] = ['diagnosis', 'awaiting_approval', 'awaiting_parts', 'in_progress', 'quality_check'];

export default async function JobsBoard({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; view?: string; d?: string; t?: string; hitno?: string; moji?: string }> }) {
  const ctx = await requireWorkshop();
  const sp = await searchParams;
  const { q = '', view, d, t } = sp;
  // The owner sees who is waiting for a reminder (tyres, service, deadlines).
  const waiting = ctx.isOwner ? (await loadReminders(ctx)).items.length : 0;
  const first = await loadFirstSteps(ctx);
  const firstSteps = first ? <FirstSteps steps={first.steps} sample={first.sample} video={await helpVideo('start')} /> : null;
  const reminderBanner = waiting ? (
    <Link href="/app/business/podsjetnici" className="mb-4 flex min-h-12 items-center gap-3 rounded-2xl border border-crit/40 bg-crit/10 px-4 py-3 text-sm">
      <BellRing className="size-5 shrink-0 text-crit" />
      <span className="flex-1">
        Podsjetnici za poslati: <span className="font-semibold">{waiting}</span>
      </span>
      <ChevronRight className="size-4 text-faint" />
    </Link>
  ) : null;

  // Field work: the day schedule is the start page of a field package,
  // and one tap away for a workshop that also goes out.
  const field = hasFieldWork(ctx.pkg, ctx.tenant.enabled_modules);
  // Every trade has the day schedule (a workshop sees its booked cars there).
  const showSchedule = view === 'dan' || (field && view !== 'faze' && !q && !sp.f && !sp.hitno && !sp.moji && ctx.pkg.sector === 'field');
  // The title already names the current view; the button offers the other one.
  const viewSwitch = (
    showSchedule ? (
      <Link href="/app?view=faze" replace className={buttonClass('secondary', 'sm')}>
        <ClipboardList className="size-4" /> Po fazama
      </Link>
    ) : (
      <Link href="/app?view=dan" replace className={buttonClass('secondary', 'sm')}>
        <CalendarDays className="size-4" /> Raspored
      </Link>
    )
  );
  if (showSchedule) {
    return (
      <>
        <RestoreScroll />
        <PageHeader title="Raspored" action={viewSwitch} />
        {firstSteps}
        {reminderBanner}
        <FieldSchedule ctx={ctx} day={d} tech={t} fieldMode={ctx.pkg.sector === 'field'} />
      </>
    );
  }
  // Deal: the jobs are the dealer's own cost, so there is nothing to collect.
  const billing = !ctx.pkg.internalJobs;
  // Older links (f=active, mine, urgent, unpaid, archive) still land in the right place.
  const legacy: Record<string, Segment> = { active: 'svi', mine: 'svi', urgent: 'svi', unpaid: 'naplata', archive: 'arhiva' };
  const asked = (legacy[sp.f ?? ''] ?? sp.f ?? 'svi') as Segment;
  const segment: Segment = (['svi', 'radu', 'naplata', 'arhiva'] as const).includes(asked) && (asked !== 'naplata' || (billing && ctx.isOwner)) ? asked : 'svi';
  const urgentOnly = sp.hitno === '1' || sp.f === 'urgent';
  const mineOnly = sp.moji === '1' || sp.f === 'mine';
  const search = q.trim();
  const filter = segment;

  // The archive in the order jobs were closed (newest first); the rest by
  // the latest change, so what was just touched is on top.
  let query =
    filter === 'arhiva'
      ? ctx.supabase.from('jobs').select(JOB_FIELDS).order('collected_at', { ascending: false, nullsFirst: false }).order('number', { ascending: false })
      : ctx.supabase.from('jobs').select(JOB_FIELDS).order('updated_at', { ascending: false });
  if (filter === 'arhiva') query = query.eq('phase', 'collected').limit(100);
  else if (filter === 'naplata') query = query.in('phase', ['ready', 'collected']).eq('payment_status', 'unpaid').limit(200);
  else if (filter === 'radu') query = query.in('phase', WORKING).limit(300);
  else query = query.neq('phase', 'collected').limit(300);
  if (mineOnly) query = query.eq('assigned_to', ctx.user.id);
  if (urgentOnly) query = query.eq('is_urgent', true);

  if (search) {
    const like = toIlike(search);
    const compact = toIlike(search.replace(/[\s-]/g, ''));
    const plate = plateIlike(search);
    const [assets, clients] = await Promise.all([
      ctx.supabase.from('assets').select('id').or(`identifier.ilike.${plate},vin.ilike.${plate},make.ilike.${like},model.ilike.${like}`).limit(50),
      ctx.supabase.from('clients').select('id').or(`first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like},phone.ilike.${compact}`).limit(50),
    ]);
    const parts = [
      ...(assets.data?.length ? [`asset_id.in.(${assets.data.map((a) => a.id).join(',')})`] : []),
      ...(clients.data?.length ? [`client_id.in.(${clients.data.map((c) => c.id).join(',')})`] : []),
      ...(/^\d+$/.test(search) ? [`number.eq.${search}`] : []),
    ];
    if (parts.length === 0) query = query.eq('id', '00000000-0000-0000-0000-000000000000');
    else query = query.or(parts.join(','));
  }

  // The counts in the segments and switches, from the open jobs at a glance.
  const [{ data }, { data: open }] = await Promise.all([query, ctx.supabase.from('jobs').select('phase, is_urgent, assigned_to').neq('phase', 'collected').limit(1000)]);
  const jobs = (data ?? []) as unknown as BoardJob[];
  const openRows = (open ?? []) as { phase: JobPhase; is_urgent: boolean; assigned_to: string | null }[];

  // Money only for the owner: the database returns no totals to workers anyway.
  const totals = new Map<string, number>();
  let unpaidSum = 0;
  let unpaidCount = 0;
  if (ctx.isOwner) {
    // In pages and chunks: unpaid jobs pile up when nobody marks them paid.
    const [rows, unpaidJobs] = await Promise.all([
      inChunks<{ job_id: string; gross_total: number }>(
        jobs.map((j) => j.id),
        (chunk) => ctx.supabase.from('job_totals').select('job_id, gross_total').in('job_id', chunk).order('job_id')
      ),
      billing
        ? allRows<{ id: string }>((a, b) => ctx.supabase.from('jobs').select('id').in('phase', ['ready', 'collected']).eq('payment_status', 'unpaid').order('id').range(a, b))
        : Promise.resolve([] as { id: string }[]),
    ]);
    for (const row of rows) totals.set(row.job_id, Number(row.gross_total));
    unpaidCount = unpaidJobs.length;
    if (unpaidCount) {
      const unpaidTotals = await inChunks<{ job_id: string; gross_total: number }>(
        unpaidJobs.map((j) => j.id),
        (chunk) => ctx.supabase.from('job_totals').select('job_id, gross_total').in('job_id', chunk).order('job_id')
      );
      unpaidSum = unpaidTotals.reduce((sum, r) => sum + Number(r.gross_total), 0);
    }
  }

  const grouped = PHASE_ORDER.map((phase) => ({ phase, jobs: jobs.filter((j) => j.phase === phase) })).filter((g) => g.jobs.length > 0);

  // The URL of a segment or switch, keeping the search and the other choices.
  const link = (next: { f?: Segment; hitno?: boolean; moji?: boolean }) => {
    const params = new URLSearchParams({ view: 'faze' });
    const f = next.f ?? segment;
    if (f !== 'svi') params.set('f', f);
    if (next.hitno ?? urgentOnly) params.set('hitno', '1');
    if (next.moji ?? mineOnly) params.set('moji', '1');
    if (search) params.set('q', search);
    return `/app?${params.toString()}`;
  };
  const segments: { id: Segment; label: string; count: string | null }[] = [
    { id: 'svi', label: 'Svi', count: String(openRows.length) },
    { id: 'radu', label: 'U radu', count: String(openRows.filter((r) => WORKING.includes(r.phase)).length) },
    ...(billing && ctx.isOwner ? [{ id: 'naplata' as const, label: 'Za naplatu', count: unpaidCount ? formatEuro(unpaidSum) : '0' }] : []),
    { id: 'arhiva', label: 'Arhiva', count: null },
  ];
  const urgentCount = openRows.filter((r) => r.is_urgent).length;
  const mineCount = openRows.filter((r) => r.assigned_to === ctx.user.id).length;

  return (
    <>
      <RestoreScroll />
      <PageHeader title="Nalozi" action={viewSwitch} />
      {firstSteps}
      {reminderBanner}

      <form className="relative mb-3" action="/app">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input name="q" defaultValue={search} placeholder={`${ctx.pkg.vocabulary.identifier}, ime, telefon ili broj naloga`} className="pl-9" />
        <input type="hidden" name="view" value="faze" />
        {segment !== 'svi' ? <input type="hidden" name="f" value={segment} /> : null}
        {urgentOnly ? <input type="hidden" name="hitno" value="1" /> : null}
        {mineOnly ? <input type="hidden" name="moji" value="1" /> : null}
      </form>

      {/* Which jobs: one segment. */}
      <nav aria-label="Nalozi" className="mb-2 grid gap-1 rounded-2xl border border-line bg-surface p-1" style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}>
        {segments.map((s) => (
          <Link
            key={s.id}
            href={link({ f: s.id })}
            replace
            aria-current={segment === s.id ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center rounded-xl px-1 text-center text-sm leading-tight transition-colors',
              segment === s.id ? 'bg-accent font-semibold text-accent-fg' : 'text-muted hover:bg-surface2 hover:text-fg'
            )}
          >
            {s.label}
            {s.count !== null ? <span className={cn('mt-0.5 text-xs tabular', segment === s.id ? 'opacity-80' : 'text-faint')}>{s.count}</span> : null}
          </Link>
        ))}
      </nav>

      {/* On top of it: only urgent, only mine. */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link href={link({ hitno: !urgentOnly })} replace aria-pressed={urgentOnly} className={cn(buttonClass('secondary', 'sm'), 'rounded-full', urgentOnly && 'border-crit/60 bg-crit/15 text-crit')}>
          <Flame className="size-4" /> Hitno
          {urgentCount ? <span className="tabular opacity-80">{urgentCount}</span> : null}
        </Link>
        <Link href={link({ moji: !mineOnly })} replace aria-pressed={mineOnly} className={cn(buttonClass('secondary', 'sm'), 'rounded-full', mineOnly && 'border-accent/60 bg-accent/15 text-fg')}>
          <UserRound className="size-4" /> Moji nalozi
          {mineCount ? <span className="tabular opacity-80">{mineCount}</span> : null}
        </Link>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-8" />}
          title={search ? 'Ništa nije pronađeno' : filter === 'arhiva' ? 'Arhiva je prazna' : urgentOnly || mineOnly ? 'Nema takvih naloga' : 'Nema naloga'}
          action={
            !search && filter === 'svi' && !urgentOnly && !mineOnly ? (
              <Link href="/app/jobs/new" className={buttonClass('primary')}>
                Otvori prvi nalog
              </Link>
            ) : undefined
          }
        >
          {search ? 'Pokušajte s dijelom registracije, prezimenom ili brojem telefona.' : null}
        </EmptyState>
      ) : filter === 'arhiva' || filter === 'naplata' ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} pkg={ctx.pkg} total={totals.get(job.id)} showMoney={ctx.isOwner} />
            ))}
          </div>
          {filter === 'arhiva' && ctx.isOwner ? (
            <Link href={`/app/business/arhiva${search ? `?q=${encodeURIComponent(search)}` : ''}`} className={cn(buttonClass('secondary'), 'mt-4 w-full')}>
              Cijela arhiva s razdobljima i iznosima <ChevronRight className="size-4" />
            </Link>
          ) : null}
        </>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.phase}>
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                {phaseLabel(ctx.pkg, group.phase as JobPhase)}
                <span className="rounded-md bg-surface2 px-1.5 py-0.5 text-[11px] text-faint">{group.jobs.length}</span>
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.jobs.map((job) => (
                  <JobCard key={job.id} job={job} pkg={ctx.pkg} total={totals.get(job.id)} showMoney={ctx.isOwner} showPhase={false} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
