'use client';

import { useMemo, useRef, useState } from 'react';
import { CalendarCheck, CheckCircle2, Phone } from 'lucide-react';
import { DictateButton, DictateInput } from '@/components/client-ui';
import { Button, Field, Textarea } from '@/components/ui';
import { submitBooking } from '@/lib/actions/booking';
import { cn } from '@/lib/utils';

export interface OfferedSlot {
  start: string;
  label: string;
}

const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb' }).format(new Date(iso));
const dayName = (iso: string) => new Date(iso).toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'Europe/Zagreb' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zagreb' });

// "Rezerviraj termin": pick a free slot, say what is needed, leave a name
// and a number. Everything can be said instead of typed. The workshop
// confirms the slot by message.
export function BookingForm({
  token,
  workshop,
  workshopPhone,
  field,
  identifierLabel,
  slots,
}: {
  token: string;
  workshop: string;
  workshopPhone: string | null;
  field: boolean;
  identifierLabel: string;
  slots: OfferedSlot[];
}) {
  const openedAt = useRef(Date.now());
  const [slot, setSlot] = useState<OfferedSlot | null>(null);
  const [v, setV] = useState({ name: '', phone: '', identifier: '', address: '', city: '', complaint: '', website: '' });
  const [consent, setConsent] = useState(false);
  // Three days at first, so the form is not far below on a phone.
  const [allDays, setAllDays] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ label: string; number: number; again: boolean } | null>(null);
  const set = (key: keyof typeof v) => (value: string) => setV((s) => ({ ...s, [key]: value }));

  const days = useMemo(() => {
    const map = new Map<string, OfferedSlot[]>();
    for (const s of slots) map.set(dayKey(s.start), [...(map.get(dayKey(s.start)) ?? []), s]);
    return [...map.values()];
  }, [slots]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!slot) {
      setError('Odaberite termin.');
      return;
    }
    setPending(true);
    setError(null);
    const result = await submitBooking(token, { ...v, start: slot.start, elapsedMs: Date.now() - openedAt.current }).catch(() => ({ ok: false as const, error: 'Nema veze s internetom. Pokušajte ponovno.' }));
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      if (/zauzet/.test(result.error)) setSlot(null);
      return;
    }
    setDone(result.data ?? { label: slot.label, number: 0, again: false });
  }

  if (done) {
    return (
      <div className="space-y-4 py-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-ok" />
        <h2 className="font-display text-2xl font-bold">{done.again ? 'Već imamo Vašu rezervaciju' : 'Termin je rezerviran'}</h2>
        <p className="text-muted">
          <span className="font-semibold text-fg">{done.label}</span>
          <br />
          {workshop} potvrđuje termin porukom na {v.phone}.
        </p>
        {workshopPhone ? (
          <a href={`tel:${workshopPhone.replace(/[^\d+]/g, '')}`} className="inline-flex h-12 items-center gap-2 rounded-xl border border-line px-4 font-medium">
            <Phone className="size-5 text-accent" /> {workshopPhone}
          </a>
        ) : null}
      </div>
    );
  }

  if (!slots.length) {
    return (
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="font-medium">U sljedeća dva tjedna nema slobodnog termina.</p>
        {workshopPhone ? (
          <a href={`tel:${workshopPhone.replace(/[^\d+]/g, '')}`} className="inline-flex h-12 items-center gap-2 rounded-xl border border-line px-4 font-medium">
            <Phone className="size-5 text-accent" /> Nazovite {workshopPhone}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="space-y-3" aria-label="Termin">
        <p className="text-sm font-medium">1. Odaberite termin</p>
        {(allDays ? days : days.slice(0, 3)).map((day) => (
          <div key={day[0].start}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{dayName(day[0].start)}</p>
            <div className="flex flex-wrap gap-2">
              {day.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  aria-pressed={slot?.start === s.start}
                  onClick={() => setSlot(s)}
                  className={cn('h-12 min-w-20 rounded-xl border px-4 text-base tabular-nums', slot?.start === s.start ? 'border-accent bg-accent font-semibold text-accent-fg' : 'border-line text-fg')}
                >
                  {time(s.start)}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!allDays && days.length > 3 ? (
          <Button type="button" variant="secondary" className="w-full" onClick={() => setAllDays(true)}>
            Još termina, do {dayName(days[days.length - 1][0].start)}
          </Button>
        ) : null}
      </section>

      <section className="space-y-3">
        <p className="text-sm font-medium">2. {field ? 'Što trebate?' : 'Što treba napraviti?'}</p>
        <div className="flex items-start gap-2">
          <Textarea rows={3} value={v.complaint} onChange={(e) => set('complaint')(e.target.value)} placeholder="Opišite svojim riječima ili dodirnite mikrofon i recite" />
          <DictateButton compact onText={(text) => setV((s) => ({ ...s, complaint: s.complaint ? `${s.complaint.trimEnd()} ${text}` : text }))} />
        </div>
        {field ? (
          <>
            <Field label="Adresa na koju dolazimo">
              <DictateInput value={v.address} onValue={set('address')} placeholder="Ulica i broj" autoComplete="street-address" />
            </Field>
            <Field label="Mjesto">
              <DictateInput value={v.city} onValue={set('city')} autoComplete="address-level2" />
            </Field>
          </>
        ) : (
          <Field label={`${identifierLabel} (ako znate)`}>
            <DictateInput mode="plate" value={v.identifier} onValue={set('identifier')} placeholder="npr. ZG 1234 AB" autoCapitalize="characters" />
          </Field>
        )}
      </section>

      <section className="space-y-3">
        <p className="text-sm font-medium">3. Vaši podaci</p>
        <Field label="Ime i prezime">
          <DictateInput mode="name" value={v.name} onValue={set('name')} autoComplete="name" required />
        </Field>
        <Field label="Telefon">
          <DictateInput mode="phone" type="tel" inputMode="tel" value={v.phone} onValue={set('phone')} autoComplete="tel" required />
        </Field>
      </section>

      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={v.website} onChange={(e) => set('website')(e.target.value)} />
      <label className="flex min-h-12 items-start gap-3 text-sm text-muted">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[rgb(var(--accent))]" />
        <span>Slažem se da {workshop} spremi moje podatke radi ovog posla i javi mi se.</span>
      </label>
      {error ? <p className="rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</p> : null}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending || !consent || !slot}>
        <CalendarCheck className="size-5" />
        {pending ? 'Šaljem…' : slot ? `Rezerviraj: ${slot.label}` : 'Rezerviraj termin'}
      </Button>
    </form>
  );
}
