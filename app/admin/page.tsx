import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductMark } from '@/components/ProductMark';
import { Badge, Card, CardHeader, Stat } from '@/components/ui';
import { PLANS, aiCost } from '@/config/plans';
import { PACKAGES, TRADE_GROUPS, accentStyle } from '@/config/tenant.config';
import { formatEuro, formatNumber, formatRelative } from '@/lib/format';
import { allRows } from '@/lib/paged';
import { todayInZagreb, zagrebMidnight } from '@/lib/time';
import { loadWorkshops, requireTower } from '@/lib/tower';

export const metadata: Metadata = { title: 'Pregled' };

const DAY = 86400000;

// The business at a glance: money, who signs up, who works, who is going
// quiet, what AI costs, and what needs an answer.
export default async function TowerOverview() {
  const admin = await requireTower();
  const monthStart = zagrebMidnight(`${todayInZagreb().slice(0, 7)}-01`).toISOString();
  const [all, tokens, { count: openTickets }, { count: openErrors }, { count: newErrors }, realJobs, { data: reviews }] = await Promise.all([
    loadWorkshops(),
    allRows<{ kind: string; input_tokens: number; output_tokens: number }>((a, b) =>
      admin.from('ai_usage').select('kind, input_tokens, output_tokens').gte('created_at', monthStart).order('id').range(a, b)
    ),
    admin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    admin.from('app_errors').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    admin.from('app_errors').select('id', { count: 'exact', head: true }).eq('status', 'open').gte('last_seen', new Date(Date.now() - DAY).toISOString()),
    // Real jobs (sample jobs left out) of the last 90 days, for the funnel:
    // its workshops signed up within them, so none of their jobs is older.
    allRows<{ tenant_id: string }>((a, b) =>
      admin.from('jobs').select('tenant_id').eq('is_demo', false).gte('created_at', new Date(Date.now() - 90 * DAY).toISOString()).order('id').range(a, b)
    ),
    // What those who left after the 24-hour trial told us.
    admin.from('trial_feedback').select('*').order('created_at', { ascending: false }).limit(20),
  ]);
  // Demo workshops never count as business.
  const real = all.filter((w) => !w.demo);
  // Funnel over the last 90 days of sign-ups: signed up → first job → 10 jobs → pays.
  const jobCount = new Map<string, number>();
  for (const j of realJobs ?? []) jobCount.set(j.tenant_id as string, (jobCount.get(j.tenant_id as string) ?? 0) + 1);
  const cohort = real.filter((w) => Date.now() - new Date(w.tenant.created_at).getTime() < 90 * DAY);
  const funnel = [
    { label: 'Registrirali se', n: cohort.length },
    { label: 'Otvorili prvi nalog', n: cohort.filter((w) => (jobCount.get(w.tenant.id) ?? 0) >= 1).length },
    { label: '10 naloga i više', n: cohort.filter((w) => (jobCount.get(w.tenant.id) ?? 0) >= 10).length },
    { label: 'Plaćaju', n: cohort.filter((w) => w.tenant.status === 'active').length },
  ];
  const funnelTop = Math.max(1, funnel[0].n);
  // A branch is paid through its main workshop: counted once.
  const paying = real.filter((w) => w.tenant.status === 'active' && w.branchOf === null);
  const trial = real.filter((w) => w.tenant.status === 'trial' && w.branchOf === null);
  // On the 24-hour trial with examples, or past it and not yet decided.
  const sampleDay = trial.filter((w) => w.tenant.sample_until);
  // Who asked for news about new features (at registration).
  const newsEmails = real.filter((w) => w.tenant.news_consent_at && w.owner?.email).map((w) => w.owner!.email as string);
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
  // Open demos of visitors (no clock; the AI taste is 5 per login).
  const guests = all.filter((w) => w.guest);
  const guestsToday = guests.filter((w) => Date.now() - new Date(w.tenant.created_at).getTime() < DAY).length;

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
        <Stat
          label="Na probi"
          value={trial.length}
          hint={[sampleDay.length ? `${sampleDay.length} na probnom danu` : null, expiring.length ? `${expiring.length} istječe u 7 dana` : null].filter(Boolean).join(' · ') || undefined}
          tone={expiring.length ? 'warn' : undefined}
        />
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
            Aktivno u zadnjih 7 dana: {active7.length} od {real.length} · Otvoreni demo u zadnja 24 sata: {guestsToday}
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
        <CardHeader title="Lijevak" subtitle="Radionice registrirane u zadnjih 90 dana: gdje odustaju" />
        <ul className="space-y-3 p-4">
          {funnel.map((step, i) => {
            const prev = i ? funnel[i - 1].n : step.n;
            return (
              <li key={step.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{step.label}</span>
                  <span className="tabular text-muted">
                    {step.n}
                    {i && prev ? <span className="ml-2 text-xs text-faint">{Math.round((step.n / prev) * 100)} % od prethodnog</span> : null}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface2">
                  <div className="h-full bg-accent" style={{ width: `${(step.n / funnelTop) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

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
          <CardHeader title="AI ovaj mjesec" subtitle="Slikanje i Pitaj Poslara, procjena troška" />
          <div className="grid grid-cols-3 gap-px border-b border-line bg-line">
            <div className="bg-surface p-3">
              <p className="text-xs text-muted">Slikanja</p>
              <p className="text-lg font-semibold tabular">{aiScan.length}</p>
            </div>
            <div className="bg-surface p-3">
              <p className="text-xs text-muted">Pitaj Poslara</p>
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
                    {w.ai.scan}/{w.ai.scanQuota} slika · {w.ai.copilot}/{w.ai.copilotQuota} pitanja
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

      <Card>
        <CardHeader
          title="Nakon probnog dana"
          subtitle={reviews?.length ? `Odustali i ostavili ocjenu: prosjek ${formatNumber(reviews.reduce((s, r) => s + Number(r.stars), 0) / reviews.length, 1)} od 5` : 'Ocjene onih koji su odustali iz demo verzije'}
        />
        {reviews?.length ? (
          <ul className="divide-y divide-line">
            {reviews.map((r) => (
              <li key={r.id as string} className="px-4 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-warn" aria-label={`${r.stars} od 5`}>
                    {'★'.repeat(Number(r.stars))}
                    <span className="text-faint">{'★'.repeat(5 - Number(r.stars))}</span>
                  </span>
                  <span className="font-medium">{r.workshop as string}</span>
                  {r.package ? <span className="text-muted">{PACKAGES[r.package as keyof typeof PACKAGES]?.short}</span> : null}
                  {r.may_publish ? <Badge tone="ok">smije se objaviti</Badge> : null}
                  <span className="ml-auto text-xs text-faint">{formatRelative(r.created_at as string)}</span>
                </p>
                {r.body ? <p className="mt-1.5 whitespace-pre-line text-muted">{r.body as string}</p> : null}
                <p className="mt-1 text-xs text-faint">{[r.owner_name, r.email, r.news_consent ? 'želi obavijesti' : null].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-4 text-sm text-muted">Još nitko nije odustao nakon probnog dana.</p>
        )}
        <p className="border-t border-line px-4 py-2.5 text-xs text-faint">
          Žele obavijesti o novostima ({newsEmails.length}): {newsEmails.length ? newsEmails.join(', ') : 'nitko još'}
        </p>
      </Card>

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
