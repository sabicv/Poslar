import Link from 'next/link';
import { AlertTriangle, CalendarPlus, KeyRound, MapPin } from 'lucide-react';
import { Badge, Card, EmptyState, buttonClass } from '@/components/ui';
import { PHASE_TONE, hasModule, phaseLabel, type JobPhase } from '@/config/tenant.config';
import { dayRouteLink } from '@/lib/contact';
import { assetTitle, clientName, plural } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { addDays, dayOf, formatDayLabel, formatTime, todayInZagreb, weekStart, zagrebMidnight } from '@/lib/time';
import { cn } from '@/lib/utils';
import { FieldActions, ScheduleSheet } from './FieldActions';
import { ScheduleShell } from './ScheduleShell';

const VISIT_FIELDS =
  'id, number, phase, complaint, is_urgent, source, scheduled_start, scheduled_end, departed_at, arrived_at, arrived_lat, arrived_lng, left_at, customer_notified_at, report_token, report_shared_at, assigned_to, client:clients(kind, first_name, last_name, company_name, phone), asset:assets(asset_type, make, model, identifier), site:sites(label, address, city, lat, lng, access_notes, contact_phone), assignee:profiles(full_name)';

type Visit = {
  id: string;
  number: number;
  phase: JobPhase;
  complaint: string | null;
  is_urgent: boolean;
  source: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  departed_at: string | null;
  arrived_at: string | null;
  arrived_lat: number | null;
  arrived_lng: number | null;
  left_at: string | null;
  customer_notified_at: string | null;
  report_token: string;
  report_shared_at: string | null;
  assigned_to: string | null;
  client: { kind: 'person' | 'company'; first_name: string | null; last_name: string | null; company_name: string | null; phone: string | null } | null;
  asset: { asset_type: never; make: string | null; model: string | null; identifier: string | null } | null;
  site: { label: string | null; address: string; city: string | null; lat: number | null; lng: number | null; access_notes: string | null; contact_phone: string | null } | null;
  assignee: { full_name: string | null } | null;
};

// The day's appointments. On the field: who, where, when, and the next tap.
// In a workshop (fieldMode false): the cars booked for the day, by the AI
// phone or by hand.
export async function FieldSchedule({ ctx, day: requested, tech: requestedTech, fieldMode = true }: { ctx: WorkshopContext; day?: string; tech?: string; fieldMode?: boolean }) {
  const today = todayInZagreb();
  const day = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  const monday = weekStart(day);
  const tech = requestedTech ?? (ctx.isOwner ? 'all' : 'me');
  const techId = tech === 'me' ? ctx.user.id : tech === 'all' ? null : tech;

  let weekQuery = ctx.supabase
    .from('jobs')
    .select('scheduled_start')
    .in('work_mode', fieldMode ? ['field'] : ['field', 'workshop'])
    .gte('scheduled_start', zagrebMidnight(monday).toISOString())
    .lt('scheduled_start', zagrebMidnight(addDays(monday, 7)).toISOString());
  let dayQuery = ctx.supabase
    .from('jobs')
    .select(VISIT_FIELDS)
    .in('work_mode', fieldMode ? ['field'] : ['field', 'workshop'])
    .gte('scheduled_start', zagrebMidnight(day).toISOString())
    .lt('scheduled_start', zagrebMidnight(addDays(day, 1)).toISOString())
    .order('scheduled_start');
  if (techId) {
    weekQuery = weekQuery.eq('assigned_to', techId);
    dayQuery = dayQuery.eq('assigned_to', techId);
  }
  const showPlans = ctx.isOwner && hasModule(ctx.pkg, ctx.tenant.enabled_modules, 'maintenance_plans');
  const [{ data: week }, { data: visits }, { data: unscheduled }, { data: staff }, plans] = await Promise.all([
    weekQuery,
    dayQuery,
    fieldMode
      ? ctx.supabase.from('jobs').select(VISIT_FIELDS).eq('work_mode', 'field').is('scheduled_start', null).not('phase', 'in', '(ready,collected)').order('created_at').limit(30)
      : Promise.resolve({ data: [] }),
    ctx.supabase.from('profiles').select('id, full_name').order('full_name'),
    showPlans
      ? ctx.supabase.from('maintenance_plans').select('id', { count: 'exact', head: true }).eq('active', true).lte('next_due_date', addDays(today, 30))
      : Promise.resolve({ count: 0 }),
  ]);

  const counts = new Map<string, number>();
  for (const row of week ?? []) {
    const d = dayOf(row.scheduled_start as string);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const list = (visits ?? []) as unknown as Visit[];
  const open = list.filter((v) => !v.left_at && v.site);
  const route = dayRouteLink(open.map((v) => v.site!));
  const staffList = (staff ?? []).map((s) => ({ id: s.id as string, name: (s.full_name as string | null) ?? 'Bez imena' }));
  const fieldCtx = (v: Visit) => ({
    workshopName: ctx.tenant.name,
    techName: v.assignee?.full_name ?? ctx.profile.full_name ?? 'Tehničar',
    clientFirstName: v.client?.kind === 'person' ? v.client.first_name : null,
    clientPhone: v.client?.phone ?? null,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
    isOwner: ctx.isOwner,
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const monthName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('hr-HR', { month: 'long', timeZone: 'UTC' });
  const [firstMonth, lastMonth] = [monthName(weekDays[0]), monthName(weekDays[6])];
  const monthLabel = `${firstMonth === lastMonth ? firstMonth : `${firstMonth} – ${lastMonth}`} ${weekDays[6].slice(0, 4)}.`;
  const dayTitle = new Date(`${day}T12:00:00Z`).toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  return (
    <ScheduleShell
      days={weekDays.map((d) => ({ d, weekday: formatDayLabel(d).weekday, num: Number(d.slice(8, 10)), count: counts.get(d) ?? 0 }))}
      day={day}
      today={today}
      monthLabel={monthLabel}
      prevWeek={addDays(monday, -7)}
      nextWeek={addDays(monday, 7)}
      techs={[{ id: 'all', name: 'Svi' }, { id: 'me', name: 'Moji' }, ...(ctx.isOwner ? staffList.filter((s) => s.id !== ctx.user.id) : [])].map((s) => ({ id: s.id, name: s.name.split(' ')[0] }))}
      tech={tech}
      routeLink={route}
      routeCount={open.length}
    >
    <div className="space-y-5">
      <h2 className="flex items-baseline justify-between gap-2">
        <span className="text-lg font-semibold first-letter:uppercase">{day === today ? `Danas, ${dayTitle.split(', ')[1] ?? dayTitle}` : dayTitle}</span>
        <span className="text-sm text-muted">
          {list.length} {plural(list.length, 'posjet', 'posjeta', 'posjeta')}
        </span>
      </h2>

      {showPlans && (plans as { count: number | null }).count ? (
        <Link href="/app/module" className="flex items-center gap-2 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
          <CalendarPlus className="size-4 text-warn" />
          <span className="flex-1">{(plans as { count: number }).count} {plural((plans as { count: number }).count, 'servis dospijeva', 'servisa dospijevaju', 'servisa dospijeva')} u sljedećih 30 dana. Zakažite ih.</span>
          <span aria-hidden>→</span>
        </Link>
      ) : null}

      {/* Book for the day on screen */}
      <Link prefetch={false} href={`/app/jobs/new?d=${day}`} className={buttonClass('secondary', 'md', 'w-full')}>
        <CalendarPlus className="size-4" /> {fieldMode ? 'Zakaži posjet' : 'Zakaži termin'} za {day === today ? 'danas' : dayTitle}
      </Link>

      {/* The day */}
      {list.length === 0 ? (
        <EmptyState title={day === today ? (fieldMode ? 'Danas nema zakazanih posjeta' : 'Danas nema termina') : fieldMode ? 'Nema zakazanih posjeta' : 'Nema termina'}>
          {fieldMode ? 'Dodirnite „Zakaži posjet” iznad ili zakažite iz popisa „Nezakazano”.' : 'Dodirnite „Zakaži termin” iznad. Termine upisuje i Poslar s telefona.'}
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {list.map((v) => (
            <li key={v.id}>
              <Card className={cn('p-4', v.left_at && 'opacity-70')}>
                <div className="flex items-start gap-3">
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-base font-semibold tabular">{formatTime(v.scheduled_start)}</p>
                    <p className="text-[11px] text-faint tabular">{formatTime(v.scheduled_end)}</p>
                  </div>
                  <Link prefetch={false} href={`/app/jobs/${v.id}`} className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-medium">
                      {clientName(v.client)}
                      {v.is_urgent ? <Badge tone="crit">Hitno</Badge> : null}
                      <Badge tone={PHASE_TONE[v.phase]}>{phaseLabel(ctx.pkg, v.phase)}</Badge>
                    </p>
                    {v.site ? (
                      <p className="mt-0.5 flex items-center gap-1 break-words text-sm text-muted">
                        <MapPin className="size-3.5 shrink-0" /> {[v.site.address, v.site.city].filter(Boolean).join(', ')}
                      </p>
                    ) : null}
                    {!fieldMode && (v.source === 'phone' || v.source === 'booking') ? (
                      <p className="mt-0.5">
                        <Badge tone="warn">{v.source === 'phone' ? 'Poslar' : 'Online'}</Badge>
                      </p>
                    ) : null}
                    <p className="break-words text-sm text-muted">
                      {!fieldMode && v.asset?.identifier ? `${v.asset.identifier} · ` : ''}
                      {assetTitle(v.asset)}
                      {v.complaint ? ` · ${v.complaint}` : ''}
                    </p>
                    {v.site?.access_notes ? (
                      <p className="mt-1 flex items-start gap-1 text-xs text-warn">
                        <KeyRound className="mt-0.5 size-3 shrink-0" /> {v.site.access_notes}
                      </p>
                    ) : null}
                    {ctx.isOwner && tech === 'all' && v.assignee?.full_name ? <p className="mt-1 text-xs text-faint">{v.assignee.full_name}</p> : null}
                  </Link>
                </div>
                {v.site ? (
                  <div className="mt-3">
                    <FieldActions job={v} site={v.site} ctx={fieldCtx(v)} />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ol>
      )}

      {/* Waiting for a date */}
      {(unscheduled ?? []).length ? (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
            <AlertTriangle className="size-3.5 text-warn" /> Nezakazano
            <span className="rounded bg-surface2 px-1.5 text-[11px] text-faint">{(unscheduled ?? []).length}</span>
          </h2>
          <ul className="space-y-2">
            {((unscheduled ?? []) as unknown as Visit[]).map((v) => (
              <li key={v.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <Link prefetch={false} href={`/app/jobs/${v.id}`} className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{clientName(v.client)}</p>
                  <p className="break-words text-xs text-muted">
                    {[v.site?.address, v.site?.city].filter(Boolean).join(', ') || 'bez adrese'} · {v.complaint ?? assetTitle(v.asset)}
                  </p>
                </Link>
                <ScheduleSheet jobId={v.id} current={{ start: null, end: null, assignedTo: v.assigned_to }} staff={staffList} defaultDate={day} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
    </ScheduleShell>
  );
}
