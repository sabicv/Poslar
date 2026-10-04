'use client';

import { useState } from 'react';
import { useAction } from '@/components/client-ui';
import { Button, Field, Select } from '@/components/ui';
import { WEEKDAYS, type WorkHours } from '@/lib/calendar';
import { saveCalendar } from '@/lib/actions/phone';
import { cn } from '@/lib/utils';

const SLOTS = [30, 45, 60, 90, 120, 180, 240];
const LEAD = [0, 1, 2, 4, 24];

// Working hours per day, how long one appointment is, how many jobs at once.
export function CalendarForm({ hours }: { hours: WorkHours }) {
  const { pending, run } = useAction();
  const [v, setV] = useState(hours);
  const setDay = (id: keyof WorkHours['days'], value: [string, string] | null) => setV((s) => ({ ...s, days: { ...s.days, [id]: value } }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveCalendar(v), { success: 'Radno vrijeme spremljeno' });
      }}
    >
      <ul className="divide-y divide-line rounded-xl border border-line">
        {WEEKDAYS.map(({ id, name }) => {
          const d = v.days[id];
          return (
            <li key={id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <label className="flex w-36 items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(d)} onChange={(e) => setDay(id, e.target.checked ? ['08:00', '16:00'] : null)} className="size-5 accent-[rgb(var(--accent))]" />
                {name}
              </label>
              {d ? (
                <span className="flex items-center gap-1.5">
                  <input type="time" value={d[0]} onChange={(e) => setDay(id, [e.target.value, d[1]])} className="h-10 rounded-lg border border-line bg-bg px-2 text-sm" aria-label={`${name} od`} />
                  <span className="text-muted">do</span>
                  <input type="time" value={d[1]} onChange={(e) => setDay(id, [d[0], e.target.value])} className="h-10 rounded-lg border border-line bg-bg px-2 text-sm" aria-label={`${name} do`} />
                </span>
              ) : (
                <span className={cn('text-sm text-faint')}>Zatvoreno</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Jedan termin traje">
          <Select value={v.slotMinutes} onChange={(e) => setV((s) => ({ ...s, slotMinutes: Number(e.target.value) }))}>
            {SLOTS.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${m / 60} h`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Poslova u isto vrijeme">
          <Select value={v.perSlot} onChange={(e) => setV((s) => ({ ...s, perSlot: Number(e.target.value) }))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Najranije za" className="col-span-2 sm:col-span-1">
          <Select value={v.leadHours} onChange={(e) => setV((s) => ({ ...s, leadHours: Number(e.target.value) }))}>
            {LEAD.map((h) => (
              <option key={h} value={h}>
                {h === 0 ? 'odmah' : h === 24 ? 'sutra' : `${h} h`}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-xs text-faint">Na blagdane je zatvoreno. Termin je zauzet čim u njemu ima onoliko poslova koliko radite u isto vrijeme.</p>
      <Button type="submit" variant="primary" disabled={pending}>
        Spremi radno vrijeme
      </Button>
    </form>
  );
}
