'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { PRICING } from '@/config/landing';
import { PLANS, PLAN_IDS, TERM_DISCOUNT } from '@/config/plans';
import { cn } from '@/lib/utils';

// The three plans with a switch between paying month by month and the
// contract with 10 % off. No button on the cards: the page has its own.
export function Pricing() {
  const [contract, setContract] = useState(false);
  const price = (p: number) => (contract ? Math.round(p * (1 - TERM_DISCOUNT)) : p);

  return (
    <>
      <div role="radiogroup" aria-label="Način plaćanja" className="mt-7 inline-flex rounded-xl border border-line bg-surface p-1 text-sm">
        {[
          { on: false, label: PRICING.monthly },
          { on: true, label: PRICING.yearly },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={contract === o.on}
            onClick={() => setContract(o.on)}
            className={cn('h-10 rounded-lg px-4 font-medium transition-colors', contract === o.on ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg')}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          const best = id === 'standard';
          return (
            <div key={id} className={cn('flex flex-col rounded-2xl border p-6', best ? 'border-accent bg-accent/10' : 'border-line bg-surface')}>
              <p className="flex items-center justify-between gap-3 font-display text-2xl font-bold">
                {plan.name}
                {best ? <span className="rounded-full bg-accent px-2.5 py-0.5 font-sans text-xs font-semibold text-accent-fg">{PRICING.best}</span> : null}
              </p>
              <p className="mt-3">
                <span className="font-display text-5xl font-bold tabular-nums">{price(plan.price)} €</span>
                <span className="text-muted"> / mjesečno</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {PRICING.plans[id].map((line, i) => (
                  <li key={line} className={cn('flex gap-2', i === 0 ? 'font-medium' : 'text-muted')}>
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" /> {line}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {contract ? <p className="mt-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">{PRICING.funding}</p> : null}
    </>
  );
}
