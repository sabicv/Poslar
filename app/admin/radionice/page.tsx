import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { ProductMark } from '@/components/ProductMark';
import { Badge, Card, EmptyState, Input, PageHeader } from '@/components/ui';
import { getPlan, type BillingTerm, type PlanId } from '@/config/plans';
import { accentStyle, getPackage } from '@/config/tenant.config';
import { formatDate, formatEuro, formatRelative } from '@/lib/format';
import { loadWorkshops, requireTower, type TowerWorkshop } from '@/lib/tower';
import { cn } from '@/lib/utils';
import { CreateWorkshop } from '../AdminForms';
import { WorkshopSheet } from '../WorkshopSheet';

export const metadata: Metadata = { title: 'Radionice' };

const FILTERS = [
  { id: 'sve', label: 'Sve', test: () => true },
  { id: 'placaju', label: 'Plaćaju', test: (w: TowerWorkshop) => w.tenant.status === 'active' },
  { id: 'proba', label: 'Proba', test: (w: TowerWorkshop) => w.tenant.status === 'trial' },
  { id: 'istjece', label: 'Proba istječe', test: (w: TowerWorkshop) => w.trialLeft !== null && w.trialLeft <= 7 },
  { id: 'kasni', label: 'Kasni', test: (w: TowerWorkshop) => w.overdue },
  { id: 'gasi', label: 'Gasi se', test: (w: TowerWorkshop) => w.quiet },
  { id: 'iskljucene', label: 'Isključene', test: (w: TowerWorkshop) => w.tenant.status === 'suspended' },
] as const;

function statusBadge(w: TowerWorkshop) {
  if (w.tenant.status === 'suspended') return <Badge tone="crit">Isključena</Badge>;
  if (w.tenant.status === 'trial') return <Badge tone={w.trialLeft !== null && w.trialLeft < 0 ? 'crit' : 'warn'}>{w.trialLeft !== null && w.trialLeft < 0 ? 'Proba istekla' : `Proba · ${w.trialLeft ?? '?'} d`}</Badge>;
  if (w.overdue) return <Badge tone="crit">Kasni od {formatDate(w.tenant.paid_until)}</Badge>;
  return <Badge tone="ok">{w.tenant.paid_until ? `Plaćeno do ${formatDate(w.tenant.paid_until)}` : 'Aktivna'}</Badge>;
}

export default async function TowerWorkshops({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; demo?: string }> }) {
  await requireTower();
  const { f = 'sve', q = '', demo } = await searchParams;
  const showDemo = demo === '1';
  const all = (await loadWorkshops()).filter((w) => showDemo || !w.demo);
  const filter = FILTERS.find((x) => x.id === f) ?? FILTERS[0];
  const needle = q.trim().toLowerCase();
  const list = all
    .filter(filter.test)
    .filter((w) => !needle || [w.tenant.name, w.tenant.city, w.tenant.oib, w.owner?.name, w.owner?.email, w.owner?.phone, String(w.tenant.billing_ref)].some((v) => v?.toLowerCase().includes(needle)));
  const href = (params: { f?: string; demo?: boolean }) => {
    const sp = new URLSearchParams();
    const nf = params.f ?? f;
    if (nf !== 'sve') sp.set('f', nf);
    if (q) sp.set('q', q);
    if (params.demo ?? showDemo) sp.set('demo', '1');
    const s = sp.toString();
    return `/admin/radionice${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <PageHeader title="Radionice" subtitle={`${list.length} od ${all.length}`} action={<CreateWorkshop />} />
      <form className="relative mb-3" action="/admin/radionice">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input name="q" defaultValue={q} placeholder="Naziv, vlasnik, e-mail, telefon, grad, OIB ili poziv na broj" className="pl-9" />
        {f !== 'sve' ? <input type="hidden" name="f" value={f} /> : null}
        {showDemo ? <input type="hidden" name="demo" value="1" /> : null}
      </form>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4">
        {FILTERS.map((x) => (
          <Link
            key={x.id}
            href={href({ f: x.id })}
            className={cn('flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm', x.id === filter.id ? 'border-accent bg-accent/15 text-fg' : 'border-line text-muted')}
          >
            {x.label}
            <span className="text-xs text-faint">{all.filter(x.test).length}</span>
          </Link>
        ))}
        <Link href={href({ demo: !showDemo })} className={cn('flex h-9 shrink-0 items-center rounded-full border px-3 text-sm', showDemo ? 'border-accent text-fg' : 'border-dashed border-line text-faint')}>
          {showDemo ? 'Sakrij demo' : 'Prikaži demo'}
        </Link>
      </div>

      {list.length === 0 ? (
        <EmptyState title="Nema radionica za taj odabir" />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {list.map((w) => {
              const t = w.tenant;
              const plan = getPlan(t.plan);
              return (
                <li key={t.id} className="accent-scope space-y-2 px-4 py-3" style={accentStyle(getPackage(t.package))}>
                  <div className="flex items-start gap-3">
                    <ProductMark id={t.package} className="mt-0.5 size-8" />
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-2 font-medium">
                        <span className="truncate">{t.name}</span>
                        {w.demo ? (
                          <Badge tone="muted" className="shrink-0">
                            demo
                          </Badge>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted">{[w.owner?.name, w.owner?.phone, w.owner?.email].filter(Boolean).join(' · ')}</p>
                      <p className="truncate text-xs text-faint">{[t.city, t.oib && `OIB ${t.oib}`, `poziv na broj ${t.billing_ref}`, `od ${formatDate(t.created_at)}`].filter(Boolean).join(' · ')}</p>
                      {w.referredBy ? (
                        <p className="truncate text-xs text-accent">
                          Preporuka: {w.referredBy}
                          {t.referral_rewarded_at ? ', mjesec gratis dodijeljen' : ''}
                        </p>
                      ) : null}
                    </div>
                    <WorkshopSheet
                      w={{
                        id: t.id,
                        name: t.name,
                        status: t.status,
                        pkg: t.package,
                        statusNote: t.status_note,
                        plan: (t.plan ?? 'basic') as PlanId,
                        term: (t.billing_term ?? 'monthly') as BillingTerm,
                        paidUntil: t.paid_until,
                        notes: t.admin_notes,
                        aiScan: w.ai.scanQuota,
                        aiCopilot: w.ai.copilotQuota,
                        monthly: w.monthly,
                        payments: w.payments,
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pl-11">
                    {statusBadge(w)}
                    <Badge tone="neutral">
                      {plan.name} · {formatEuro(w.monthly)}
                      {t.billing_term === '24m' ? ' (24 mj.)' : ''}
                    </Badge>
                    <Badge tone={w.overLimit ? 'crit' : 'muted'}>
                      {w.people} {w.people === 1 ? 'korisnik' : 'korisnika'} / {plan.workers + 1}
                    </Badge>
                    <Badge tone={w.quiet ? 'warn' : 'muted'}>{w.lastActivity ? `rad ${formatRelative(w.lastActivity)}` : 'još bez naloga'}</Badge>
                    {w.jobs30 ? <Badge tone="muted">{w.jobs30} naloga / 30 d</Badge> : null}
                    {w.ai.scan + w.ai.copilot > 0 ? (
                      <Badge tone={w.ai.scan >= w.ai.scanQuota || w.ai.copilot >= w.ai.copilotQuota ? 'crit' : 'muted'}>
                        AI {w.ai.scan}/{w.ai.scanQuota} · {w.ai.copilot}/{w.ai.copilotQuota}
                      </Badge>
                    ) : null}
                  </div>
                  {t.admin_notes || t.status_note ? <p className="pl-11 text-xs text-muted">{[t.status_note && `Isključeno: ${t.status_note}`, t.admin_notes].filter(Boolean).join(' · ')}</p> : null}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
