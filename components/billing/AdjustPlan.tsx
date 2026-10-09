'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, useAction } from '@/components/client-ui';
import { Badge, Button } from '@/components/ui';
import { CardCheckout } from '@/components/billing/CardCheckout';
import { PlanRequest } from '@/components/billing/PlanRequest';
import { PLANS, type PlanId } from '@/config/plans';
import { changePlan, previewPlanChange, type PlanChangePreview } from '@/lib/actions/paddle';
import { formatDate, formatEuro } from '@/lib/format';
import { cn } from '@/lib/utils';

type Card = { clientToken: string; environment: string };

export function AdjustPlan({
  current,
  subscribed,
  card,
  prices,
  tenantId,
  email,
  founder,
  demo,
}: {
  current: PlanId;
  subscribed: boolean;
  card: Card | null;
  prices: Record<PlanId, { full: string; founder: string | null }> | null;
  tenantId: string;
  email: string | null;
  founder: boolean;
  demo?: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PlanChangePreview | null>(null);

  function close() {
    setOpen(false);
    setPreview(null);
  }

  function pick(id: PlanId) {
    if (id === current || pending) return;
    if (!subscribed) return;
    run(() => previewPlanChange(id), {
      onDone: (data) => {
        if (data) setPreview(data);
      },
    });
  }

  function confirm() {
    if (!preview) return;
    run(() => changePlan(preview.plan), {
      success: `Paket je sada ${preview.name}.`,
      onDone: () => {
        close();
        router.refresh();
      },
    });
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())} title="Prilagodi plan" trigger={<Button>Prilagodi plan</Button>}>
      {preview ? (
        <div className="space-y-4">
          <p className="text-sm">
            {preview.upgrade
              ? `Prelazite na ${preview.name}. Razlika se naplaćuje odmah, novi paket vrijedi odmah.`
              : `Prelazite na ${preview.name}. Nova cijena ide od sljedeće naplate. Razlika se ne vraća.`}
          </p>
          <dl className="divide-y divide-line rounded-xl border border-line text-sm">
            {preview.upgrade && preview.chargeNow !== null ? (
              <div className="flex justify-between gap-3 px-3 py-2.5">
                <dt className="text-muted">Danas</dt>
                <dd className="tabular font-medium">{formatEuro(preview.chargeNow)}</dd>
              </div>
            ) : null}
            {preview.recurring !== null ? (
              <div className="flex justify-between gap-3 px-3 py-2.5">
                <dt className="text-muted">Zatim mjesečno</dt>
                <dd className="tabular font-medium">{formatEuro(preview.recurring)}</dd>
              </div>
            ) : null}
            {preview.nextBilledAt ? (
              <div className="flex justify-between gap-3 px-3 py-2.5">
                <dt className="text-muted">Sljedeća naplata</dt>
                <dd className="tabular">{formatDate(preview.nextBilledAt)}</dd>
              </div>
            ) : null}
          </dl>
          <div className="flex flex-col gap-2">
            <Button variant="primary" disabled={pending} onClick={confirm}>
              Potvrdi {preview.name}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setPreview(null)}>
              Natrag
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {demo ? <p className="text-sm text-muted">U demo radionici paket se ne mijenja. U svojoj radionici ovdje birate drugi paket.</p> : null}
          <ul className="space-y-2">
          {Object.values(PLANS).map((p) => {
            const active = p.id === current;
            const priceId = prices ? (founder && prices[p.id].founder) || prices[p.id].full : null;
            return (
              <li key={p.id} className={cn('rounded-xl border border-line p-3', active && 'border-accent/50 bg-accent/5')}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {p.name} {active ? <Badge tone="accent">Vaš paket</Badge> : null}
                  </span>
                  <span className="text-sm tabular">{founder ? p.founderPrice : p.price} €</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {p.people} · slikanje {p.ai.scan} i {p.ai.copilot} pitanja Poslaru
                </p>
                {active || demo ? null : subscribed ? (
                  <Button size="sm" className="mt-3" disabled={pending} onClick={() => pick(p.id)}>
                    Prijeđi na {p.name}
                  </Button>
                ) : card && priceId ? (
                  <div className="mt-3">
                    <CardCheckout config={card} priceId={priceId} tenantId={tenantId} email={email} label={`${p.name} karticom`} variant="secondary" />
                  </div>
                ) : (
                  <div className="mt-3">
                    <PlanRequest plan={p.id} term="monthly" label={`Želim ${p.name}`} />
                  </div>
                )}
              </li>
            );
          })}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
