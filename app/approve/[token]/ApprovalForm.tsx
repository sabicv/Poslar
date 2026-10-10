'use client';

import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { submitApproval } from '@/lib/actions/public';
import { formatEuro, plural } from '@/lib/format';
import { cn } from '@/lib/utils';

const PRIORITY = {
  urgent: { label: 'Hitno, sigurnost', className: 'bg-crit/12 text-crit border-crit/30' },
  recommended: { label: 'Preporučeno', className: 'bg-warn/12 text-warn border-warn/30' },
  optional: { label: 'Po želji', className: 'border-neutral-300 bg-neutral-100 text-neutral-600' },
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
    return <section className="mx-auto mt-4 max-w-[210mm] rounded-2xl bg-white p-5 text-sm text-neutral-900 shadow-sm print:hidden">Hvala. Odluka je poslana. Ovu stranicu možete zatvoriti.</section>;
  }

  return (
    <section className="mx-auto mt-4 max-w-[210mm] space-y-4 print:hidden">
      <div className="rounded-2xl bg-white text-neutral-900 shadow-sm">
        <h2 className="border-b border-neutral-200 px-5 py-3 text-sm font-semibold">Vaša odluka</h2>
        <ul className="divide-y divide-neutral-200">
          {lines.map((l) => {
            const d = decisions[l.id];
            return (
              <li key={l.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {l.priority ? <span className={cn('mb-1.5 inline-flex rounded-md border px-2 py-0.5 text-xs font-medium', PRIORITY[l.priority].className)}>{PRIORITY[l.priority].label}</span> : null}
                    <p className="text-sm">{l.description}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatEuro(l.total)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecisions((s) => ({ ...s, [l.id]: 'approved' }))}
                    className={cn('flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium', d === 'approved' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-300 text-neutral-700')}
                  >
                    <Check className="size-4" /> Odobravam
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisions((s) => ({ ...s, [l.id]: 'declined' }))}
                    className={cn('flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium', d === 'declined' ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-700')}
                  >
                    <X className="size-4" /> Ne sada
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="space-y-1 border-t border-neutral-200 px-5 py-4 text-sm">
          {alreadyApproved > 0 ? (
            <div className="flex justify-between text-neutral-500">
              <span>Već dogovoreno</span>
              <span className="tabular-nums">{formatEuro(alreadyApproved)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-neutral-500">
            <span>Odabrano sada</span>
            <span className="tabular-nums">{formatEuro(selected)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base font-semibold">
            <span>Ukupno</span>
            <span className="tabular-nums">{formatEuro(alreadyApproved + selected)}</span>
          </div>
        </div>
      </div>

      <label className="block text-sm text-neutral-700">
        Vaše ime i prezime
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="mt-1 h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-neutral-900" />
      </label>
      {error ? <p className="rounded-xl bg-white px-3 py-2 text-sm text-red-700 shadow-sm">{error}</p> : null}
      <button
        type="button"
        className="h-12 w-full rounded-xl bg-neutral-900 text-sm font-medium text-white disabled:opacity-40"
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
        {pending ? 'Šaljem…' : undecided > 0 ? `Odaberite za još ${undecided} ${plural(undecided, 'stavku', 'stavke', 'stavki')}` : 'Pošalji odluku'}
      </button>
    </section>
  );
}
