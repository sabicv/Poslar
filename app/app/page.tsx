import Link from 'next/link';
import { CalendarDays, ClipboardList, Search } from 'lucide-react';
import { FieldSchedule } from '@/components/field/FieldSchedule';
import { JobCard, type BoardJob } from '@/components/JobCard';
import { EmptyState, Input, PageHeader, buttonClass } from '@/components/ui';
import { PHASE_ORDER, hasFieldWork, phaseLabel, type JobPhase } from '@/config/tenant.config';
import { formatEuro } from '@/lib/format';
import { requireWorkshop } from '@/lib/session';
import { cn, toIlike } from '@/lib/utils';

const JOB_FIELDS =
  'id, number, phase, complaint, is_urgent, promised_at, payment_status, locked_at, updated_at, assigned_to, client:clients(kind, first_name, last_name, company_name), asset:assets(asset_type, identifier, make, model), assignee:profiles(full_name)';

type Filter = 'active' | 'mine' | 'urgent' | 'unpaid' | 'archive';

export default async function JobsBoard({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; view?: string; d?: string; t?: string }> }) {
  const ctx = await requireWorkshop();
  const { q = '', f, view, d, t } = await searchParams;

  // Field work: the day schedule is the start page of a field package,
  // and one tap away for a workshop that also goes out.
  const field = hasFieldWork(ctx.pkg, ctx.tenant.enabled_modules);
  const showSchedule = field && (view === 'dan' || (view !== 'faze' && !q && !f && ctx.pkg.sector === 'field'));
  // The title already names the current view; the button offers the other one.
  const viewSwitch = field ? (
    showSchedule ? (
      <Link href="/app?view=faze" className={buttonClass('secondary', 'sm')}>
        <ClipboardList className="size-4" /> Po fazama
      </Link>
    ) : (
      <Link href="/app?view=dan" className={buttonClass('secondary', 'sm')}>
        <CalendarDays className="size-4" /> Raspored
      </Link>
    )
  ) : null;
  if (showSchedule) {
    return (
      <>
        <PageHeader title="Raspored" action={viewSwitch} />
        <FieldSchedule ctx={ctx} day={d} tech={t} />
      </>
    );
  }
  const filter: Filter = (['active', 'mine', 'urgent', 'unpaid', 'archive'] as const).includes(f as Filter) ? (f as Filter) : 'active';
  const search = q.trim();

  let query = ctx.supabase.from('jobs').select(JOB_FIELDS).order('updated_at', { ascending: false });
  if (filter === 'archive') query = query.eq('phase', 'collected').limit(100);
  else if (filter === 'unpaid') query = query.in('phase', ['ready', 'collected']).eq('payment_status', 'unpaid').limit(200);
  else query = query.neq('phase', 'collected').limit(300);
  if (filter === 'mine') query = query.eq('assigned_to', ctx.user.id);
  if (filter === 'urgent') query = query.eq('is_urgent', true);

  if (search) {
    const like = toIlike(search);
    const compact = toIlike(search.replace(/[\s-]/g, ''));
    const [assets, clients] = await Promise.all([
      ctx.supabase.from('assets').select('id').or(`identifier.ilike.${like},identifier.ilike.${compact},vin.ilike.${like},make.ilike.${like},model.ilike.${like}`).limit(50),
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

  const { data } = await query;
  const jobs = (data ?? []) as unknown as BoardJob[];

  // Money only for the owner: the database returns no totals to workers anyway.
  const totals = new Map<string, number>();
  let unpaidSum = 0;
  let unpaidCount = 0;
  if (ctx.isOwner) {
    const [{ data: rows }, { data: unpaidJobs }] = await Promise.all([
      jobs.length ? ctx.supabase.from('job_totals').select('job_id, gross_total').in('job_id', jobs.map((j) => j.id)) : Promise.resolve({ data: [] }),
      ctx.supabase.from('jobs').select('id').in('phase', ['ready', 'collected']).eq('payment_status', 'unpaid'),
    ]);
    for (const row of rows ?? []) totals.set(row.job_id as string, Number(row.gross_total));
    unpaidCount = unpaidJobs?.length ?? 0;
    if (unpaidCount) {
      const { data: unpaidTotals } = await ctx.supabase.from('job_totals').select('gross_total').in('job_id', unpaidJobs!.map((j) => j.id));
      unpaidSum = (unpaidTotals ?? []).reduce((sum, r) => sum + Number(r.gross_total), 0);
    }
  }

  const grouped = PHASE_ORDER.map((phase) => ({ phase, jobs: jobs.filter((j) => j.phase === phase) })).filter((g) => g.jobs.length > 0);
  const openCount = filter === 'active' && !search ? jobs.length : null;

  // Counts live in the filter chips themselves (no separate stat tiles).
  const urgentCount = filter === 'active' && !search ? jobs.filter((j) => j.is_urgent).length : null;
  const chips: { id: Filter; label: string; count?: string | null; ownerOnly?: boolean }[] = [
    { id: 'active', label: 'U radu', count: openCount ? String(openCount) : null },
    { id: 'mine', label: 'Moji' },
    { id: 'urgent', label: 'Hitno', count: urgentCount ? String(urgentCount) : null },
    { id: 'unpaid', label: 'Za naplatu', count: unpaidCount ? formatEuro(unpaidSum) : null, ownerOnly: true },
    { id: 'archive', label: 'Arhiva' },
  ];

  return (
    <>
      <PageHeader title="Nalozi" action={viewSwitch} />

      <form className="relative mb-4" action="/app">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input name="q" defaultValue={search} placeholder={`${ctx.pkg.vocabulary.identifier}, ime, telefon ili broj naloga`} className="pl-9" />
        {filter !== 'active' ? <input type="hidden" name="f" value={filter} /> : null}
      </form>

      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {chips
          .filter((c) => !c.ownerOnly || ctx.isOwner)
          .map((chip) => (
            <Link
              key={chip.id}
              href={
                chip.id === 'active'
                  ? `/app?view=faze${search ? `&q=${encodeURIComponent(search)}` : ''}`
                  : `/app?f=${chip.id}${search ? `&q=${encodeURIComponent(search)}` : ''}`
              }
              className={cn(buttonClass(filter === chip.id ? 'primary' : 'secondary', 'sm'), 'shrink-0 rounded-full')}
            >
              {chip.label}
              {chip.count ? <span className={cn('ml-1 tabular', filter === chip.id ? 'opacity-80' : 'text-muted')}>{chip.count}</span> : null}
            </Link>
          ))}
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-8" />}
          title={search ? 'Ništa nije pronađeno' : filter === 'archive' ? 'Arhiva je prazna' : 'Nema naloga'}
          action={
            !search && filter === 'active' ? (
              <Link href="/app/jobs/new" className={buttonClass('primary')}>
                Otvori prvi nalog
              </Link>
            ) : undefined
          }
        >
          {search ? 'Pokušajte s dijelom registracije, prezimenom ili brojem telefona.' : null}
        </EmptyState>
      ) : filter === 'archive' || filter === 'unpaid' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} pkg={ctx.pkg} total={totals.get(job.id)} showMoney={ctx.isOwner} />
          ))}
        </div>
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
