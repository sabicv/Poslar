import type { Metadata } from 'next';
import { PaymentInstructions } from '@/components/billing/PaymentInstructions';
import { PlanRequest } from '@/components/billing/PlanRequest';
import { BackLink, Badge, Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';
import { AI_LABELS, PLANS, TERM_DISCOUNT, TERM_LABELS, aiQuota, getPlan } from '@/config/plans';
import { aiUsageThisMonth } from '@/lib/ai-usage';
import { subscription } from '@/lib/billing';
import { formatDate, formatEuro } from '@/lib/format';
import { requireOwner } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Pretplata' };

const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'crit' | 'muted' | 'neutral' }> = {
  demo: { label: 'Demo', tone: 'muted' },
  trial: { label: 'Probno razdoblje', tone: 'warn' },
  manual: { label: 'Aktivna', tone: 'ok' },
  paid: { label: 'Plaćeno', tone: 'ok' },
  due_soon: { label: 'Uskoro ističe', tone: 'warn' },
  grace: { label: 'Istekla, uplatite', tone: 'crit' },
  overdue: { label: 'Neplaćeno', tone: 'crit' },
  suspended: { label: 'Isključena', tone: 'crit' },
};

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ mj?: string }> }) {
  const ctx = await requireOwner();
  const t = ctx.tenant;
  const sub = subscription(t);
  const plan = getPlan(t.plan);
  const { mj } = await searchParams;
  const months = mj === '6' ? 6 : mj === '12' ? 12 : 1;
  const [scans, answers, { data: openRequests }] = await Promise.all([
    aiUsageThisMonth(t.id, 'scan'),
    aiUsageThisMonth(t.id, 'copilot'),
    ctx.supabase.from('support_tickets').select('id').eq('status', 'open').limit(1),
  ]);

  return (
    <>
      <PageHeader title="Pretplata" back={<BackLink href="/app/settings">Postavke</BackLink>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader title={`Paket ${plan.name}`} subtitle={plan.people} action={<Badge tone={STATUS[sub.status].tone}>{STATUS[sub.status].label}</Badge>} />
            <div className="divide-y divide-line px-4">
              <KeyValue label="Cijena">{`${formatEuro(sub.monthly)} mjesečno s PDV-om`}</KeyValue>
              <KeyValue label="Način plaćanja">{TERM_LABELS[t.billing_term] ?? TERM_LABELS.monthly}</KeyValue>
              {sub.status === 'trial' ? <KeyValue label="Proba traje do">{formatDate(t.trial_ends_at)}</KeyValue> : null}
              {sub.paidUntil ? <KeyValue label="Plaćeno do">{formatDate(sub.paidUntil)}</KeyValue> : null}
              {sub.status === 'grace' ? <KeyValue label="Zaključava se">{formatDate(sub.lockOn)}</KeyValue> : null}
              <KeyValue label={`${AI_LABELS.scan} ovaj mjesec`}>{`${scans} od ${aiQuota(t.plan, t.ai_quota, 'scan')}`}</KeyValue>
              <KeyValue label={`${AI_LABELS.copilot} ovaj mjesec`}>{`${answers} od ${aiQuota(t.plan, t.ai_quota, 'copilot')}`}</KeyValue>
            </div>
          </Card>

          <Card>
            <CardHeader title="Paketi" subtitle={`Ugovor na 24 mjeseca: ${Math.round(TERM_DISCOUNT * 100)} % manje`} />
            <ul className="divide-y divide-line">
              {Object.values(PLANS).map((p) => (
                <li key={p.id} className={cn('space-y-2 px-4 py-3', p.id === plan.id && 'bg-accent/5')}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {p.name} {p.id === plan.id ? <Badge tone="accent">Vaš paket</Badge> : null}
                    </span>
                    <span className="text-sm tabular">
                      {p.price} € <span className="text-muted">/ mj. · uz 24 mj. {Math.round(p.price * (1 - TERM_DISCOUNT))} €</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {p.people} · slikanje {p.ai.scan} i Kopilot {p.ai.copilot} mjesečno{p.qr ? ' · QR samoprijem' : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {p.id !== plan.id ? <PlanRequest plan={p.id} term="monthly" label={`Želim ${p.name}`} /> : null}
                    <PlanRequest plan={p.id} term="24m" label={`${p.name} na 24 mjeseca`} />
                  </div>
                </li>
              ))}
            </ul>
            {openRequests?.length ? <p className="border-t border-line px-4 py-2.5 text-xs text-faint">Imate otvoren zahtjev; odgovor stiže u Postavke → Pomoć.</p> : null}
          </Card>
        </div>

        {sub.status !== 'demo' ? (
          <Card>
            <CardHeader title="Uplata" subtitle="Općom uplatnicom ili u aplikaciji banke" />
            <div className="p-4">
              <PaymentInstructions
                workshop={{ name: t.name, address: t.address, city: t.city, billingRef: t.billing_ref }}
                monthly={sub.monthly}
                months={months}
                linkBase="/app/settings/pretplata"
              />
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Uplata" />
            <p className="p-4 text-sm text-muted">Ovo je demo radionica, ovdje se ništa ne plaća.</p>
          </Card>
        )}
      </div>
    </>
  );
}
