import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductMark } from '@/components/ProductMark';
import { Badge, Card, CardHeader, Stat } from '@/components/ui';
import { PLANS, aiCost } from '@/config/plans';
import { PACKAGES, TRADE_GROUPS, accentStyle } from '@/config/tenant.config';
import { formatEuro, formatNumber, formatRelative } from '@/lib/format';
import { todayInZagreb, zagrebMidnight } from '@/lib/time';
import { loadWorkshops, requireTower } from '@/lib/tower';

export const metadata: Metadata = { title: 'Pregled' };

const DAY = 86400000;

// The business at a glance: money, who signs up, who works, who is going
// quiet, what AI costs, and what needs an answer.
export default async function TowerOverview() {
  const admin = await requireTower();
  const monthStart = zagrebMidnight(`${todayInZagreb().slice(0, 7)}-01`).toISOString();
  const [all, { data: tokens }, { count: openTickets }, { count: openErrors }, { count: newErrors }] = await Promise.all([
    loadWorkshops(),
    admin.from('ai_usage').select('kind, input_tokens, output_tokens').gte('created_at', monthStart).limit(50000),
    admin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    admin.from('app_errors').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    admin.from('app_errors').select('id', { count: 'exact', head: true }).eq('status', 'open').gte('last_seen', new Date(Date.now() - DAY).toISOString()),
  ]);
  // Demo workshops never count as business.
  const real = all.filter((w) => !w.demo);
  const paying = real.filter((w) => w.tenant.status === 'active');
  const trial = real.filter((w) => w.tenant.status === 'trial');
  const mrr = paying.reduce((s, w) => s + w.monthly, 0);
  const expiring = trial.filter((w) => w.trialLeft !== null && w.trialLeft >= 0 && w.trialLeft <= 7);
  const overdue = paying.filter((w) => w.overdue);
  const noPayment = paying.filter((w) => !w.tenant.paid_until);
  const active7 = real.filter((w) => w.lastActivity && Date.now() - new Date(w.lastActivity).getTime() < 7 * DAY);
  const quiet = real.filter((w) => w.quiet && w.tenant.status !== 'suspended');

  // Sign-ups per week, the last 8 weeks (oldest left).
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = Date.now() - i * 7 * DAY;
    return real.filter((w) => {
      const at = new Date(w.tenant.created_at).getTime();
      return at <= end && at > end - 7 * DAY;
    }).length;
  }).reverse();
  const weekMax = Math.max(1, ...weeks);

  const aiScan = (tokens ?? []).filter((t) => t.kind === 'scan');
  const aiCopilot = (tokens ?? []).filter((t) => t.kind === 'copilot');
  const cost = (tokens ?? []).reduce((s, t) => s + aiCost(Number(t.input_tokens), Number(t.output_tokens)), 0);
  const nearQuota = all.filter((w) => w.ai.scan >= w.ai.scanQuota * 0.8 || w.ai.copilot >= w.ai.copilotQuota * 0.8);
  const topAi = [...all].sort((a, b) => b.ai.cost - a.ai.cost).filter((w) => w.ai.scan + w.ai.copilot > 0).slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Mjesečni prihod" value={formatEuro(mrr)} hint={`${formatEuro(mrr * 12)} godišnje, s PDV-om`} tone="ok" />
        <Stat label="Plaćaju" value={paying.length} hint={noPayment.length ? `${noPayment.length} bez upisane uplate` : undefined} />
        <Stat label="Na probi" value={trial.length} hint={expiring.length ? `${expiring.length} istječe u 7 dana` : undefined} tone={expiring.length ? 'warn' : undefined} />
        <Stat label="Kasne s plaćanjem" value={overdue.length} tone={overdue.length ? 'crit' : undefined} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Nove radionice" subtitle="Po tjednima, zadnjih 8" />
          <div className="flex h-36 items-end gap-2 px-4 pb-3 pt-4">
            {weeks.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs tabular text-muted">{n}</span>
                <div className="w-full rounded-t-md bg-accent/70" style={{ height: `${(n / weekMax) * 88}px`, minHeight: n ? 6 : 2 }} />
              </div>
            ))}
          </div>
          <p className="border-t border-line px-4 py-2.5 text-xs text-faint">
            Aktivno u zadnjih 7 dana: {active7.length} od {real.length}
          </p>
        </Card>

        <Card>
          <CardHeader title="Po paketu" subtitle="Plaćaju i na probi" />
          <ul className="divide-y divide-line">
            {Object.values(PLANS).map((p) => {
              const on = real.filter((w) => w.tenant.plan === p.id && w.tenant.status !== 'suspended');
              const money = on.filter((w) => w.tenant.status === 'active').reduce((s, w) => s + w.monthly, 0);
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-24 font-medium">{p.name}</span>
                  <span className="text-muted">{on.length} radionica</span>
                  <span className="ml-auto tabular">{formatEuro(money)} / mj.</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Po zanatu" />
        <div className="space-y-4 p-4">
          {TRADE_GROUPS.map((g) => (
            <div key={g.id}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{g.name}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {g.packages.map((id) => PACKAGES[id]).map((p) => (
                  <div key={p.id} className="accent-scope flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2" style={accentStyle(p)}>
                    <ProductMark id={p.id} className="size-6" />
                    <span className="text-sm">{p.short}</span>
                    <span className="ml-auto text-sm font-semibold tabular">{real.filter((w) => w.tenant.package === p.id).length}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tko se gasi" subtitle="Dva tjedna bez naloga, ili se prijavio i nije počeo" />
          {quiet.length ? (
            <ul className="divide-y divide-line">
              {quiet.slice(0, 12).map((w) => (
                <li key={w.tenant.id}>
                  <Link href={`/admin/radionice?q=${encodeURIComponent(w.tenant.name)}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface2">
                    <ProductMark id={w.tenant.package} className="size-6" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{w.tenant.name}</span>
                      <span className="block truncate text-xs text-muted">{[w.owner?.name, w.owner?.phone].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="text-xs text-faint">{w.lastActivity ? formatRelative(w.lastActivity) : 'nikad'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Sve radionice rade.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="AI ovaj mjesec" subtitle="Slikanje i Kopilot, procjena troška" />
          <div className="grid grid-cols-3 gap-px border-b border-line bg-line">
            <div className="bg-surface p-3">
              <p className="text-xs text-muted">Slikanja</p>
              <p className="text-lg font-semibold tabular">{aiScan.length}</p>
            </div>
            <div className="bg-surface p-3">
              <p className="text-xs text-muted">Kopilot</p>
              <p className="text-lg font-semibold tabular">{aiCopilot.length}</p>
            </div>
            <div className="bg-surface p-3">
              <p className="text-xs text-muted">Trošak oko</p>
              <p className="text-lg font-semibold tabular">{formatEuro(cost)}</p>
            </div>
          </div>
          {topAi.length ? (
            <ul className="divide-y divide-line">
              {topAi.map((w) => (
                <li key={w.tenant.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{w.tenant.name}</span>
                  <span className="text-xs tabular text-muted">
                    {w.ai.scan}/{w.ai.scanQuota} slika · {w.ai.copilot}/{w.ai.copilotQuota} kopilot
                  </span>
                  <span className="w-16 text-right text-xs tabular">{formatEuro(w.ai.cost)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Ovaj mjesec još nitko nije koristio AI.</p>
          )}
          {nearQuota.length ? <p className="border-t border-line px-4 py-2.5 text-xs text-warn">Blizu kvote: {nearQuota.map((w) => w.tenant.name).join(', ')}</p> : null}
          <p className="border-t border-line px-4 py-2.5 text-xs text-faint">Procjena po cijeni tokena ({formatNumber(cost * 100, 0)} centi). Točan iznos je na računu Anthropica.</p>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/admin/podrska" className="rounded-2xl border border-line bg-surface p-4 hover:border-accent/60">
          <p className="text-sm text-muted">Podrška</p>
          <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
            {openTickets ?? 0} čeka odgovor {openTickets ? <Badge tone="warn">odgovori</Badge> : null}
          </p>
        </Link>
        <Link href="/admin/greske" className="rounded-2xl border border-line bg-surface p-4 hover:border-accent/60">
          <p className="text-sm text-muted">Greške</p>
          <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
            {openErrors ?? 0} otvoreno {newErrors ? <Badge tone="crit">{newErrors} u zadnja 24 h</Badge> : null}
          </p>
        </Link>
      </div>
    </div>
  );
}
