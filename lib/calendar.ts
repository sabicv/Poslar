// The workshop's calendar for appointments: working hours (Postavke → AI
// telefon), Croatian public holidays, and the free slots the phone agent
// may offer. A slot is taken by every job scheduled into it, up to the
// number of jobs the workshop does at the same time.

import { addDays, todayInZagreb, zagrebInstant } from '@/lib/time';

export type Weekday = '1' | '2' | '3' | '4' | '5' | '6' | '7';
export interface WorkHours {
  // Monday = 1 … Sunday = 7: [from, to] as "08:00", or null when closed.
  days: Record<Weekday, [string, string] | null>;
  slotMinutes: number;
  perSlot: number;
  // The earliest a caller can come: so many hours from now.
  leadHours: number;
}

export const WEEKDAYS: { id: Weekday; name: string }[] = [
  { id: '1', name: 'Ponedjeljak' },
  { id: '2', name: 'Utorak' },
  { id: '3', name: 'Srijeda' },
  { id: '4', name: 'Četvrtak' },
  { id: '5', name: 'Petak' },
  { id: '6', name: 'Subota' },
  { id: '7', name: 'Nedjelja' },
];

export const DEFAULT_HOURS: WorkHours = {
  days: { '1': ['08:00', '16:00'], '2': ['08:00', '16:00'], '3': ['08:00', '16:00'], '4': ['08:00', '16:00'], '5': ['08:00', '16:00'], '6': ['08:00', '12:00'], '7': null },
  slotMinutes: 60,
  perSlot: 1,
  leadHours: 2,
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function readHours(settings: unknown): WorkHours {
  const raw = (settings as { calendar?: Partial<WorkHours> } | null)?.calendar;
  if (!raw) return DEFAULT_HOURS;
  const days = { ...DEFAULT_HOURS.days };
  for (const { id } of WEEKDAYS) {
    const d = raw.days?.[id];
    if (d === null) days[id] = null;
    else if (Array.isArray(d) && TIME.test(d[0]) && TIME.test(d[1]) && d[0] < d[1]) days[id] = [d[0], d[1]];
  }
  const clamp = (n: unknown, min: number, max: number, fallback: number) => (typeof n === 'number' && n >= min && n <= max ? Math.round(n) : fallback);
  return {
    days,
    slotMinutes: clamp(raw.slotMinutes, 15, 480, DEFAULT_HOURS.slotMinutes),
    perSlot: clamp(raw.perSlot, 1, 20, DEFAULT_HOURS.perSlot),
    leadHours: clamp(raw.leadHours, 0, 72, DEFAULT_HOURS.leadHours),
  };
}

// Croatian public holidays (Zakon o blagdanima): fixed dates, Easter Monday
// and Corpus Christi. Easter Sunday is a Sunday anyway.
function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isHoliday(day: string): boolean {
  const year = Number(day.slice(0, 4));
  const fixed = ['01-01', '01-06', '05-01', '05-30', '06-22', '08-05', '08-15', '11-01', '11-18', '12-25', '12-26'];
  if (fixed.includes(day.slice(5))) return true;
  const e = easter(year);
  return day === addDays(e, 1) || day === addDays(e, 60);
}

export function weekdayOf(day: string): Weekday {
  const w = new Date(`${day}T12:00:00Z`).getUTCDay();
  return String(w === 0 ? 7 : w) as Weekday;
}

const DAY_NAMES = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];
const MONTHS = ['siječnja', 'veljače', 'ožujka', 'travnja', 'svibnja', 'lipnja', 'srpnja', 'kolovoza', 'rujna', 'listopada', 'studenoga', 'prosinca'];

// "utorak, 7. listopada u 9:00": how a person says it on the phone.
export function spokenSlot(start: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(start);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  const weekday = DAY_NAMES[new Date(`${day}T12:00:00Z`).getUTCDay()];
  return `${weekday}, ${Number(get('day'))}. ${MONTHS[Number(get('month')) - 1]} u ${Number(get('hour'))}:${get('minute')}`;
}

export function spokenHours(h: WorkHours): string {
  const parts: string[] = [];
  for (const { id, name } of WEEKDAYS) {
    const d = h.days[id];
    parts.push(`${name.toLowerCase()} ${d ? `${d[0]} do ${d[1]}` : 'zatvoreno'}`);
  }
  return `${parts.join(', ')}; na blagdane zatvoreno`;
}

export interface Slot {
  start: string;
  end: string;
  label: string;
}

// Free slots from `from` on, for `days` days, at most `limit`. `busy` are
// the workshop's scheduled jobs (start, and end if known).
export function freeSlots(h: WorkHours, busy: { start: string; end: string | null }[], opts: { now?: Date; from?: string; days?: number; limit?: number } = {}): Slot[] {
  const now = opts.now ?? new Date();
  const earliest = now.getTime() + h.leadHours * 3600_000;
  const first = opts.from && opts.from > todayInZagreb() ? opts.from : todayInZagreb();
  const out: Slot[] = [];
  const spans = busy.map((b) => {
    const s = new Date(b.start).getTime();
    return { s, e: b.end ? new Date(b.end).getTime() : s + h.slotMinutes * 60000 };
  });
  for (let i = 0; i < (opts.days ?? 14) && out.length < (opts.limit ?? 6); i++) {
    const day = addDays(first, i);
    const hours = h.days[weekdayOf(day)];
    if (!hours || isHoliday(day)) continue;
    const close = zagrebInstant(day, hours[1]).getTime();
    for (let t = zagrebInstant(day, hours[0]).getTime(); t + h.slotMinutes * 60000 <= close && out.length < (opts.limit ?? 6); t += h.slotMinutes * 60000) {
      if (t < earliest) continue;
      const end = t + h.slotMinutes * 60000;
      const taken = spans.filter((b) => b.s < end && b.e > t).length;
      if (taken < h.perSlot) out.push({ start: new Date(t).toISOString(), end: new Date(end).toISOString(), label: spokenSlot(new Date(t)) });
    }
  }
  return out;
}

// Is this start one of the slots the calendar allows (a real slot start,
// in working hours, not taken)?
export function slotIsFree(h: WorkHours, busy: { start: string; end: string | null }[], start: string, now = new Date()): Slot | null {
  const at = new Date(start);
  if (Number.isNaN(at.getTime())) return null;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb' }).format(at);
  return freeSlots(h, busy, { now, from: day, days: 1, limit: 200 }).find((s) => s.start === at.toISOString()) ?? null;
}
