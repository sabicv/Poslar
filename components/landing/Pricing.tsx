import { Check } from 'lucide-react';
import { PRICING } from '@/config/landing';
import { FOUNDER_MONTHS, FOUNDER_SPOTS, PLANS, PLAN_IDS } from '@/config/plans';
import { cn } from '@/lib/utils';

// The three plans. While founder spots are left, the big number is the
// founder price and the full price stands under it; after that, the full
// price only. No button on the cards: the page has its own.
export function Pricing({ spotsLeft }: { spotsLeft: number }) {
  const founder = spotsLeft > 0;
  return (
    <>
      {founder ? (
        <p className="mt-7 rounded-2xl border border-accent/50 bg-accent/10 px-4 py-3 text-sm">
          <span className="font-semibold">{PRICING.founder}:</span> {PRICING.founderNote(FOUNDER_SPOTS, FOUNDER_MONTHS)}{' '}
          <span className="font-semibold tabular-nums">{PRICING.spotsLeft(spotsLeft, FOUNDER_SPOTS)}</span>
        </p>
      ) : null}
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
              {founder ? <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-accent">{PRICING.founder}</p> : null}
              <p className={founder ? 'mt-1' : 'mt-3'}>
                <span className="font-display text-5xl font-bold tabular-nums">{founder ? plan.founderPrice : plan.price} €</span>
                <span className="text-muted"> / mjesečno</span>
              </p>
              {founder ? (
                <p className="mt-1 text-sm text-muted">
                  {PRICING.full} <span className="tabular-nums line-through">{plan.price} €</span>
                </p>
              ) : null}
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
      <p className="mt-4 text-sm text-muted">{PRICING.yearly}</p>
      <p className="mt-2 text-sm text-muted">{PRICING.funding}</p>
    </>
  );
}
