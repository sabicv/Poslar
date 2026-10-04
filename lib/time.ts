// Calendar days in the workshop's time zone (Europe/Zagreb), independent of
// where the server runs.

const ZONE = 'Europe/Zagreb';

function offsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  return Math.round((asUtc - date.getTime()) / 60000);
}

// "2026-10-01" in Zagreb → the UTC instant of its midnight.
export function zagrebMidnight(day: string): Date {
  const guess = new Date(`${day}T00:00:00Z`);
  return new Date(guess.getTime() - offsetMinutes(guess) * 60000);
}

// "2026-10-07", "09:30" in Zagreb → that instant (summer and winter time).
export function zagrebInstant(day: string, time: string): Date {
  const guess = new Date(`${day}T${time}:00Z`);
  return new Date(guess.getTime() - offsetMinutes(guess) * 60000);
}

export function todayInZagreb(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(new Date());
}

export function dayOf(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(new Date(iso));
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

// Monday of the week that contains `day`.
export function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const weekday = (d.getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', timeZone: ZONE });
}

export function formatDayLabel(day: string): { weekday: string; date: string } {
  const d = new Date(`${day}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString('hr-HR', { weekday: 'short', timeZone: 'UTC' }).replace('.', ''),
    date: d.toLocaleDateString('hr-HR', { day: 'numeric', month: 'numeric', timeZone: 'UTC' }),
  };
}
