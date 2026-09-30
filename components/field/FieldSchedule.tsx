import Link from 'next/link';
import { AlertTriangle, CalendarPlus, KeyRound, MapPin, Route } from 'lucide-react';
import { Badge, Card, EmptyState, buttonClass } from '@/components/ui';
import { PHASE_TONE, hasModule, phaseLabel, type JobPhase } from '@/config/tenant.config';
import { dayRouteLink } from '@/lib/contact';
import { assetTitle, clientName, plural } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { addDays, dayOf, formatDayLabel, formatTime, todayInZagreb, weekStart, zagrebMidnight } from '@/lib/time';
import { cn } from '@/lib/utils';
import { FieldActions, ScheduleSheet } from './FieldActions';

const VISIT_FIELDS =
  'id, number, phase, complaint, is_urgent, scheduled_start, scheduled_end, departed_at, arrived_at, arrived_lat, arrived_lng, left_at, customer_notified_at, report_token, report_shared_at, assigned_to, client:clients(kind, first_name, last_name, company_name, phone), asset:assets(asset_type, make, model, identifier), site:sites(label, address, city, lat, lng, access_notes, contact_phone), assignee:profiles(full_name)';

type Visit = {
  id: string;
  number: number;
  phase: JobPhase;
  complaint: string | null;
  is_urgent: boolean;
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

// The field technician's day: who, where, when — and the next tap.
export async function FieldSchedule({ ctx, day: requested, tech: requestedTech }: { ctx: WorkshopContext; day?: string; tech?: string }) {
  const today = todayInZagreb();
  const day = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  const monday = weekStart(day);
  const tech = requestedTech ?? (ctx.isOwner ? 'all' : 'me');
  const techId = tech === 'me' ? ctx.user.id : tech === 'all' ? null : tech;

  let weekQuery = ctx.supabase
    .from('jobs')
    .select('scheduled_start')
    .eq('work_mode', 'field')
    .gte('scheduled_start', zagrebMidnight(monday).toISOString())
    .lt('scheduled_start', zagrebMidnight(addDays(monday, 7)).toISOString());
  let dayQuery = ctx.supabase
    .from('jobs')
    .select(VISIT_FIELDS)
    .eq('work_mode', 'field')
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
    ctx.supabase
      .from('jobs')
      .select(VISIT_FIELDS)
      .eq('work_mode', 'field')
      .is('scheduled_start', null)
      .not('phase', 'in', '(ready,collected)')
      .order('created_at')
      .limit(30),
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
  const href = (params: { d?: string; t?: string }) => {
    const q = new URLSearchParams({ view: 'dan', d: params.d ?? day, t: params.t ?? tech });
    return `/app?${q.toString()}`;
  };
  const fieldCtx = (v: Visit) => ({
    workshopName: ctx.tenant.name,
    techName: v.assignee?.full_name ?? ctx.profile.full_name ?? 'Tehničar',
    clientFirstName: v.client?.kind === 'person' ? v.client.first_name : null,
    clientPhone: v.client?.phone ?? null,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
    isOwner: ctx.isOwner,
  });

  return (
    <div className="space-y-5">
      {/* Week strip */}
      <div className="flex items-center gap-2">
        <Link href={href({ d: addDays(monday, -7) })} className={buttonClass('ghost', 'sm', 'px-2')} aria-label="Prethodni tjedan">
          ←
        </Link>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d) => {
            const label = formatDayLabel(d);
            const n = counts.get(d) ?? 0;
            return (
              <Link
                key={d}
                href={href({ d })}
                className={cn(
                  'flex flex-col items-center rounded-xl border py-1.5 text-xs transition-colors',
                  d === day ? 'border-accent bg-accent/15 text-fg' : 'border-line text-muted hover:text-fg',
                  d === today && d !== day && 'border-faint/60'
                )}
              >
                <span className="uppercase">{label.weekday}</span>
                <span className="font-semibold tabular">{label.date}</span>
                <span className={cn('mt-0.5 h-4 text-[10px] tabular', n ? 'text-accent' : 'text-transparent')}>{n || 0}</span>
              </Link>
            );
          })}
        </div>
        <Link href={href({ d: addDays(monday, 7) })} className={buttonClass('ghost', 'sm', 'px-2')} aria-label="Sljedeći tjedan">
          →
        </Link>
      </div>

      {/* Technician filter + day actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="no-scrollbar -mx-4 flex flex-1 gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {[{ id: 'all', name: 'Svi' }, { id: 'me', name: 'Moji' }, ...(ctx.isOwner ? staffList.filter((s) => s.id !== ctx.user.id) : [])].map((s) => (
            <Link key={s.id} href={href({ t: s.id })} className={cn(buttonClass(tech === s.id ? 'primary' : 'secondary', 'sm'), 'shrink-0 rounded-full')}>
              {s.name.split(' ')[0]}
            </Link>
          ))}
        </div>
        {route ? (
          <a href={route} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
            <Route className="size-4" /> Ruta dana ({open.length})
          </a>
        ) : null}
      </div>

      {showPlans && (plans as { count: number | null }).count ? (
        <Link href="/app/module" className="flex items-center gap-2 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
          <CalendarPlus className="size-4 text-warn" />
          <span className="flex-1">{(plans as { count: number }).count} {plural((plans as { count: number }).count, 'servis dospijeva', 'servisa dospijevaju', 'servisa dospijeva')} u sljedećih 30 dana — zakažite ih</span>
          <span aria-hidden>→</span>
        </Link>
      ) : null}

      {/* The day */}
      {list.length === 0 ? (
        <EmptyState title={day === today ? 'Danas nema zakazanih posjeta' : 'Nema zakazanih posjeta'}>Posjeti se zakazuju pri otvaranju naloga ili iz popisa „Nezakazano”.</EmptyState>
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
                      <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted">
                        <MapPin className="size-3.5 shrink-0" /> {[v.site.address, v.site.city].filter(Boolean).join(', ')}
                      </p>
                    ) : null}
                    <p className="truncate text-sm text-muted">
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
                <div className="mt-3">
                  <FieldActions job={v} site={v.site} ctx={fieldCtx(v)} />
                </div>
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
                  <p className="truncate text-sm font-medium">{clientName(v.client)}</p>
                  <p className="truncate text-xs text-muted">
                    {[v.site?.address, v.site?.city].filter(Boolean).join(', ') || 'bez adrese'} · {v.complaint ?? assetTitle(v.asset)}
                  </p>
                </Link>
                <ScheduleSheet jobId={v.id} current={{ start: null, end: null, assignedTo: v.assigned_to }} staff={staffList} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
