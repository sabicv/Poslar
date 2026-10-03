'use client';

import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui';
import { submitApproval } from '@/lib/actions/public';
import { formatEuro, plural } from '@/lib/format';
import { cn } from '@/lib/utils';

const PRIORITY = {
  urgent: { label: 'Hitno, sigurnost', className: 'bg-crit/12 text-crit border-crit/30' },
  recommended: { label: 'Preporučeno', className: 'bg-warn/12 text-warn border-warn/30' },
  optional: { label: 'Po želji', className: 'bg-surface2 text-muted border-line' },
};

export function ApprovalForm({
  token,
  lines,
  alreadyApproved,
}: {
  token: string;
  lines: { id: string; description: string; qty: number; unit: string; priority: 'urgent' | 'recommended' | 'optional' | null; total: number }[];
  alreadyApproved: number;
}) {
  // Nothing is pre-selected: the customer decides every line themselves.
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'declined'>>({});
  const undecided = lines.filter((l) => !decisions[l.id]).length;
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const selected = lines.filter((l) => decisions[l.id] === 'approved').reduce((s, l) => s + l.total, 0);

  if (done) {
    return <section className="mt-5 rounded-2xl border border-ok/40 bg-ok/10 p-5 text-sm">Hvala! Odluka je poslana servisu. Možete zatvoriti ovu stranicu.</section>;
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">Servis predlaže, odaberite</h2>
        <ul className="divide-y divide-line">
          {lines.map((l) => {
            const d = decisions[l.id];
            return (
              <li key={l.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {l.priority ? <span className={cn('mb-1.5 inline-flex rounded-md border px-2 py-0.5 text-xs font-medium', PRIORITY[l.priority].className)}>{PRIORITY[l.priority].label}</span> : null}
                    <p className="text-sm">{l.description}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular">{formatEuro(l.total)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecisions((s) => ({ ...s, [l.id]: 'approved' }))}
                    className={cn('flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium', d === 'approved' ? 'border-ok bg-ok text-black' : 'border-line text-muted')}
                  >
                    <Check className="size-4" /> Odobravam
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisions((s) => ({ ...s, [l.id]: 'declined' }))}
                    className={cn('flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium', d === 'declined' ? 'border-fg bg-fg text-bg' : 'border-line text-muted')}
                  >
                    <X className="size-4" /> Ne sada
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="space-y-1 border-t border-line px-5 py-4 text-sm">
          {alreadyApproved > 0 ? (
            <div className="flex justify-between text-muted">
              <span>Već dogovoreno</span>
              <span className="tabular">{formatEuro(alreadyApproved)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-muted">
            <span>Odabrano sada</span>
            <span className="tabular">{formatEuro(selected)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base font-semibold">
            <span>Ukupno</span>
            <span className="tabular">{formatEuro(alreadyApproved + selected)}</span>
          </div>
        </div>
      </div>

      <Field label="Vaše ime i prezime (potvrda)">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </Field>
      {error ? <p className="rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</p> : null}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={pending || name.trim().length < 2 || undecided > 0}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await submitApproval(token, { signerName: name, decisions: Object.entries(decisions).map(([lineId, decision]) => ({ lineId, decision })) });
            if (!result.ok) setError(result.error);
            else setDone(true);
          })
        }
      >
        {pending ? 'Šaljem…' : undecided > 0 ? `Odaberite za još ${undecided} ${plural(undecided, 'stavku', 'stavke', 'stavki')}` : 'Pošalji odluku servisu'}
      </Button>
    </section>
  );
}
