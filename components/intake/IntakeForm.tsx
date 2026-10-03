'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Phone } from 'lucide-react';
import { DictateButton, DictateInput } from '@/components/client-ui';
import { ScanButton } from '@/components/ScanButton';
import { Button, Field, Textarea } from '@/components/ui';
import { submitIntake } from '@/lib/actions/intake';
import { cn } from '@/lib/utils';

// The door QR page: as few fields as possible, everything can be said
// instead of typed, and a registration card photo fills the rest.
export function IntakeForm({
  token,
  workshop,
  workshopPhone,
  field,
  symptoms,
  identifierLabel,
}: {
  token: string;
  workshop: string;
  workshopPhone: string | null;
  field: boolean;
  symptoms: string[];
  identifierLabel: string;
}) {
  const openedAt = useRef(Date.now());
  const [v, setV] = useState({ name: '', phone: '', identifier: '', make: '', model: '', year: '', vin: '', address: '', city: '', complaint: '', website: '' });
  const [picked, setPicked] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ number: number; again: boolean } | null>(null);
  const set = (key: keyof typeof v) => (value: string) => setV((s) => ({ ...s, [key]: value }));

  function fromCard(d: Record<string, unknown>) {
    const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
    const name = str('company_name') || [str('first_name'), str('last_name')].filter(Boolean).join(' ');
    setV((s) => ({
      ...s,
      name: s.name || name,
      identifier: str('identifier') || s.identifier,
      make: str('make') || s.make,
      model: str('model') || s.model,
      year: typeof d.year === 'number' ? String(d.year) : s.year,
      vin: str('vin') || s.vin,
      address: s.address || [str('address')].filter(Boolean).join(''),
      city: s.city || str('city'),
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await submitIntake(token, {
      ...v,
      year: v.year ? Number(v.year) || null : null,
      symptoms: picked,
      consent: consent as true,
      elapsedMs: Date.now() - openedAt.current,
    }).catch(() => ({ ok: false as const, error: 'Nema veze s internetom. Pokušajte ponovno.' }));
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(result.data ?? { number: 0, again: false });
  }

  if (done) {
    return (
      <div className="space-y-4 py-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-ok" />
        <h2 className="font-display text-2xl font-bold">{done.again ? 'Već imamo Vašu prijavu' : 'Prijava je stigla'}</h2>
        <p className="text-muted">
          Broj prijave: <span className="font-semibold text-fg">#{done.number}</span>
          <br />
          {workshop} će Vas nazvati na {v.phone}.
        </p>
        {workshopPhone ? (
          <a href={`tel:${workshopPhone.replace(/[^\d+]/g, '')}`} className="inline-flex h-12 items-center gap-2 rounded-xl border border-line px-4 font-medium">
            <Phone className="size-5 text-accent" /> {workshopPhone}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {!field ? (
        <section className="space-y-3">
          <ScanButton variant="full" kind="prometna" label="Slikajte prometnu, podaci se upišu sami" onResult={fromCard} endpoint="/api/q/scan" extra={{ token }} hideWhenOff />
          <Field label={identifierLabel}>
            <DictateInput mode="plate" value={v.identifier} onValue={set('identifier')} placeholder="npr. ZG 1234 AB" autoCapitalize="characters" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marka">
              <DictateInput value={v.make} onValue={set('make')} />
            </Field>
            <Field label="Model">
              <DictateInput value={v.model} onValue={set('model')} />
            </Field>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <Field label="Adresa na koju dolazimo">
            <DictateInput value={v.address} onValue={set('address')} placeholder="Ulica i broj" autoComplete="street-address" />
          </Field>
          <Field label="Mjesto">
            <DictateInput value={v.city} onValue={set('city')} autoComplete="address-level2" />
          </Field>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-sm font-medium">{field ? 'Što trebate?' : 'Što ne radi?'}</p>
        <div className="flex flex-wrap gap-2">
          {symptoms.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={picked.includes(s)}
              onClick={() => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))}
              className={cn('min-h-10 rounded-full border px-3 text-sm', picked.includes(s) ? 'border-accent bg-accent/15 text-fg' : 'border-line text-muted')}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-start gap-2">
          <Textarea rows={3} value={v.complaint} onChange={(e) => set('complaint')(e.target.value)} placeholder="Opišite svojim riječima ili dodirnite mikrofon i recite" />
          <DictateButton compact onText={(text) => setV((s) => ({ ...s, complaint: s.complaint ? `${s.complaint.trimEnd()} ${text}` : text }))} />
        </div>
      </section>

      <section className="space-y-3">
        <Field label="Ime i prezime">
          <DictateInput mode="name" value={v.name} onValue={set('name')} autoComplete="name" required />
        </Field>
        <Field label="Telefon">
          <DictateInput mode="phone" type="tel" inputMode="tel" value={v.phone} onValue={set('phone')} autoComplete="tel" required />
        </Field>
      </section>

      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={v.website} onChange={(e) => set('website')(e.target.value)} />
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[rgb(var(--accent))]" />
        <span>Slažem se da {workshop} spremi moje podatke radi popravka i javi mi se.</span>
      </label>
      {error ? <p className="rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</p> : null}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending || !consent}>
        {pending ? 'Šaljem…' : 'Pošalji prijavu'}
      </Button>
    </form>
  );
}
