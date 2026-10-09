import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PaymentInstructions } from '@/components/billing/PaymentInstructions';
import { PlanRequest } from '@/components/billing/PlanRequest';
import { BackLink, Badge, Card, CardHeader, KeyValue, PageHeader, buttonClass } from '@/components/ui';
import { AI_LABELS, FOUNDER_MONTHS, FOUNDER_SPOTS, PLANS, TERM_LABELS, aiQuota, getPlan, isFounder } from '@/config/plans';
import { aiUsageThisMonth } from '@/lib/ai-usage';
import { payee, subscription } from '@/lib/billing';
import { founderSpotsLeft } from '@/lib/founder';
import { formatDate, formatEuro } from '@/lib/format';
import { isPlayApp } from '@/lib/play';
import { AdjustPlan } from '@/components/billing/AdjustPlan';
import { CardCheckout } from '@/components/billing/CardCheckout';
import { openCardPortal } from '@/lib/actions/paddle';
import { switchWorkshop } from '@/lib/actions/workshops';
import { isGuestTenant } from '@/lib/guest';
import { paddleConfig } from '@/lib/paddle';
import { requireOwner } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
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

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ mj?: string; kartica?: string }> }) {
  const ctx = await requireOwner();
  // Plans, prices and the payment slip are web only (config/play.ts).
  if (await isPlayApp()) redirect('/app/settings');
  const t = ctx.tenant;
  const sub = subscription(t);
  const plan = getPlan(t.plan);
  const { mj, kartica } = await searchParams;
  // Card payments (Paddle), once the keys are set; never for the demos.
  const cfg = paddleConfig();
  const card = cfg && sub.status !== 'demo' && !isGuestTenant(t) && !t.sample_until ? { clientToken: cfg.clientToken, environment: cfg.environment } : null;
  const slip = payee() !== null;
  const subscribed = Boolean(t.paddle_subscription_id && ['active', 'trialing', 'past_due'].includes(t.paddle_status ?? ''));
  const months = mj === '6' ? 6 : mj === '12' ? 12 : 1;
  const founder = isFounder(t.founder_until);
  const [scans, answers, { data: openRequests }, spotsLeft] = await Promise.all([
    aiUsageThisMonth(t, 'scan'),
    aiUsageThisMonth(t, 'copilot'),
    ctx.supabase.from('support_tickets').select('id').eq('status', 'open').limit(1),
    founder ? Promise.resolve(0) : founderSpotsLeft(),
  ]);

  // A branch is paid through the main workshop: no slip of its own.
  if (t.main_tenant_id) {
    const { data: main } = await createAdminClient().from('tenants').select('id, name').eq('id', t.main_tenant_id).single();
    return (
      <>
        <PageHeader title="Pretplata" back={<BackLink href="/app/settings">Postavke</BackLink>} />
        <Card className="max-w-xl">
          <CardHeader title={`Paket ${plan.name}`} subtitle="Plaća se kroz glavnu radionicu" action={<Badge tone={STATUS[sub.status].tone}>{STATUS[sub.status].label}</Badge>} />
          <div className="divide-y divide-line px-4">
            <KeyValue label="Glavna radionica">{main?.name ?? ''}</KeyValue>
            {sub.status === 'trial' ? <KeyValue label="Proba traje do">{formatDate(t.trial_ends_at)}</KeyValue> : null}
            {sub.paidUntil ? <KeyValue label="Plaćeno do">{formatDate(sub.paidUntil)}</KeyValue> : null}
            <KeyValue label={`${AI_LABELS.scan} ovaj mjesec, sve radionice`}>{`${scans} od ${aiQuota(t.plan, t.ai_quota, 'scan')}`}</KeyValue>
            <KeyValue label={`${AI_LABELS.copilot} ovaj mjesec, sve radionice`}>{`${answers} od ${aiQuota(t.plan, t.ai_quota, 'copilot')}`}</KeyValue>
          </div>
          {main ? (
            <form action={switchWorkshop} className="border-t border-line p-4">
              <input type="hidden" name="tenant" value={main.id} />
              <button type="submit" className={buttonClass('secondary')}>
                Otvori {main.name}
              </button>
            </form>
          ) : null}
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Pretplata" back={<BackLink href="/app/settings">Postavke</BackLink>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader title={`Paket ${plan.name}`} subtitle={plan.people} action={<Badge tone={STATUS[sub.status].tone}>{STATUS[sub.status].label}</Badge>} />
            <div className="divide-y divide-line px-4">
              <KeyValue label="Cijena">{`${formatEuro(sub.monthly)} mjesečno s PDV-om`}</KeyValue>
              {founder ? (
                <KeyValue label="Osnivačka cijena do">{formatDate(t.founder_until ?? null)}</KeyValue>
              ) : (
                <KeyValue label="Način plaćanja">{TERM_LABELS[t.billing_term] ?? TERM_LABELS.monthly}</KeyValue>
              )}
              {sub.status === 'trial' ? <KeyValue label="Proba traje do">{formatDate(t.trial_ends_at)}</KeyValue> : null}
              {sub.paidUntil ? <KeyValue label="Plaćeno do">{formatDate(sub.paidUntil)}</KeyValue> : null}
              {sub.status === 'grace' ? <KeyValue label="Zaključava se">{formatDate(sub.lockOn)}</KeyValue> : null}
              {subscribed ? <KeyValue label="Plaćanje">Karticom, obnavlja se samo</KeyValue> : null}
              <KeyValue label={`${AI_LABELS.scan} ovaj mjesec`}>{`${scans} od ${aiQuota(t.plan, t.ai_quota, 'scan')}`}</KeyValue>
              <KeyValue label={`${AI_LABELS.copilot} ovaj mjesec`}>{`${answers} od ${aiQuota(t.plan, t.ai_quota, 'copilot')}`}</KeyValue>
            </div>
            <div className="border-t border-line p-4">
              <AdjustPlan
                current={plan.id}
                subscribed={subscribed}
                card={card}
                prices={cfg?.prices ?? null}
                tenantId={t.id}
                email={ctx.user.email ?? null}
                founder={founder}
                demo={sub.status === 'demo'}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Paketi"
              subtitle={
                founder
                  ? `Vaša osnivačka cijena vrijedi do ${formatDate(t.founder_until ?? null)}.`
                  : spotsLeft > 0
                    ? `Osnivačka cijena za prvih ${FOUNDER_SPOTS} radionica, ${FOUNDER_MONTHS} mjeseca. Još ${spotsLeft} mjesta.`
                    : 'Cijene s PDV-om'
              }
            />
            <ul className="divide-y divide-line">
              {Object.values(PLANS).map((p) => (
                <li key={p.id} className={cn('space-y-2 px-4 py-3', p.id === plan.id && 'bg-accent/5')}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {p.name} {p.id === plan.id ? <Badge tone="accent">Vaš paket</Badge> : null}
                    </span>
                    <span className="text-sm tabular">
                      {founder ? (
                        <>
                          {p.founderPrice} € <span className="text-muted">/ mj. · puna <span className="line-through">{p.price} €</span></span>
                        </>
                      ) : (
                        <>
                          {p.price} € <span className="text-muted">/ mj.</span>
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {p.people} · slikanje {p.ai.scan} i {p.ai.copilot} pitanja Poslaru mjesečno · {p.phoneCalls} poziva Poslar na telefonu{p.qr ? ' · QR samoprijem' : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {card && !subscribed ? (
                      <CardCheckout
                        config={card}
                        priceId={(founder && cfg!.prices[p.id].founder) || cfg!.prices[p.id].full}
                        tenantId={t.id}
                        email={ctx.user.email ?? null}
                        label={p.id === plan.id ? 'Plati karticom' : `${p.name} karticom`}
                        variant={p.id === plan.id ? 'primary' : 'secondary'}
                      />
                    ) : p.id !== plan.id ? (
                      <PlanRequest plan={p.id} term="monthly" label={`Želim ${p.name}`} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {openRequests?.length ? <p className="border-t border-line px-4 py-2.5 text-xs text-faint">Imate otvoren zahtjev; odgovor stiže u Postavke → Pomoć.</p> : null}
          </Card>
        </div>

        {subscribed ? (
          <Card className="h-fit">
            <CardHeader title="Plaćanje karticom" subtitle="Pretplata se obnavlja svaki mjesec" action={<Badge tone={t.paddle_status === 'past_due' ? 'crit' : 'ok'}>{t.paddle_status === 'past_due' ? 'Kartica odbijena' : 'Aktivno'}</Badge>} />
            <div className="space-y-3 p-4 text-sm">
              <p className="text-muted">Račun za svaku uplatu stiže e-mailom od Paddlea, našeg partnera za naplatu. Karticu mijenjate i račune preuzimate ovdje:</p>
              <form action={openCardPortal}>
                <button type="submit" className={buttonClass('secondary')}>
                  Kartica i računi
                </button>
              </form>
              {kartica === 'greska' ? <p className="text-crit">Stranica za karticu se trenutno ne otvara. Pokušajte za minutu.</p> : null}
            </div>
          </Card>
        ) : sub.status !== 'demo' ? (
          <Card>
            <CardHeader title="Uplata" subtitle={card ? (slip ? 'Karticom ili općom uplatnicom' : 'Karticom') : 'Općom uplatnicom ili u aplikaciji banke'} />
            {card ? (
              <div className={cn('space-y-2 p-4 text-sm', slip && 'border-b border-line')}>
                <p className="font-medium">Karticom: pretplata se sama obnavlja svaki mjesec.</p>
                <CardCheckout config={card} priceId={(founder && cfg!.prices[plan.id].founder) || cfg!.prices[plan.id].full} tenantId={t.id} email={ctx.user.email ?? null} />
                <p className="text-xs text-faint">Plaćanje vodi Paddle, naš partner za naplatu. Podatke kartice Poslar nikad ne vidi.</p>
              </div>
            ) : null}
            {slip || !card ? (
              <div className="p-4">
                <PaymentInstructions
                  workshop={{ name: t.name, address: t.address, city: t.city, billingRef: t.billing_ref }}
                  monthly={sub.monthly}
                  months={months}
                  linkBase="/app/settings/pretplata"
                />
              </div>
            ) : null}
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
