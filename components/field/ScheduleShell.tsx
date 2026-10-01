'use client';

import { useOptimistic, useRef, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Route } from 'lucide-react';
import { buttonClass } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface ScheduleDay {
  d: string;
  weekday: string;
  num: number;
  count: number;
}

// The schedule's controls: a week of big day buttons, today, any date from
// the phone's own calendar, and the technician filter. A tap answers at
// once — the chosen day lights up and the list fades — while the new day
// loads, so it never feels stuck.
export function ScheduleShell({
  days,
  day,
  today,
  monthLabel,
  prevWeek,
  nextWeek,
  techs,
  tech,
  routeLink,
  routeCount,
  children,
}: {
  days: ScheduleDay[];
  day: string;
  today: string;
  monthLabel: string;
  prevWeek: string;
  nextWeek: string;
  techs: { id: string; name: string }[];
  tech: string;
  routeLink: string | null;
  routeCount: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [shownDay, setShownDay] = useOptimistic(day);
  const [shownTech, setShownTech] = useOptimistic(tech);
  const picker = useRef<HTMLInputElement>(null);

  const go = (params: { d?: string; t?: string }) =>
    start(() => {
      if (params.d) setShownDay(params.d);
      if (params.t) setShownTech(params.t);
      const q = new URLSearchParams({ view: 'dan', d: params.d ?? day, t: params.t ?? tech });
      router.push(`/app?${q.toString()}`, { scroll: false });
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted first-letter:uppercase">{monthLabel}</p>
        <div className="flex items-center gap-1">
          {shownDay !== today ? (
            <button type="button" onClick={() => go({ d: today })} className={buttonClass('secondary', 'sm')}>
              Danas
            </button>
          ) : null}
          <button type="button" onClick={() => picker.current?.showPicker?.() ?? picker.current?.click()} className={buttonClass('secondary', 'sm')} aria-label="Odaberi datum">
            <CalendarDays className="size-4" /> Datum
          </button>
          <input
            ref={picker}
            type="date"
            value={shownDay}
            onChange={(e) => e.target.value && go({ d: e.target.value })}
            className="pointer-events-none absolute size-0 opacity-0"
            tabIndex={-1}
            aria-hidden
          />
        </div>
      </div>

      <div className="flex items-stretch gap-1">
        <button type="button" onClick={() => go({ d: prevWeek })} className="flex w-8 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface2" aria-label="Prethodni tjedan">
          <ChevronLeft className="size-5" />
        </button>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {days.map((x) => {
            const selected = x.d === shownDay;
            return (
              <button
                key={x.d}
                type="button"
                onClick={() => go({ d: x.d })}
                aria-pressed={selected}
                className={cn(
                  'flex h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors',
                  selected ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface text-fg',
                  !selected && x.d === today && 'border-accent/60',
                  selected && pending && 'animate-pulse'
                )}
              >
                <span className={cn('text-[11px] uppercase', selected ? 'text-accent-fg/80' : 'text-muted')}>{x.weekday}</span>
                <span className="text-lg font-semibold leading-none tabular">{x.num}</span>
                <span
                  className={cn(
                    'mt-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular',
                    x.count ? (selected ? 'bg-accent-fg/20 text-accent-fg' : 'bg-accent/20 text-accent') : 'opacity-0'
                  )}
                >
                  {x.count}
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => go({ d: nextWeek })} className="flex w-8 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface2" aria-label="Sljedeći tjedan">
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="no-scrollbar -mx-4 flex flex-1 gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {techs.map((s) => (
            <button key={s.id} type="button" onClick={() => go({ t: s.id })} className={cn(buttonClass(shownTech === s.id ? 'primary' : 'secondary', 'sm'), 'shrink-0 rounded-full')}>
              {s.name}
            </button>
          ))}
        </div>
        {routeLink ? (
          <a href={routeLink} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
            <Route className="size-4" /> Ruta dana ({routeCount})
          </a>
        ) : null}
      </div>

      <div className={cn('transition-opacity', pending && 'pointer-events-none opacity-40')} aria-busy={pending}>
        {children}
      </div>
    </div>
  );
}
