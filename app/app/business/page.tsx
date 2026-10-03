import type { Metadata } from 'next';
import Link from 'next/link';
import { billingFrom } from '@/components/invoice/InvoiceDocument';
import { Card, CardHeader, EmptyState, PageHeader, Stat, buttonClass } from '@/components/ui';
import { zagrebDate } from '@/lib/invoice';
import { AccountingExport } from './AccountingExport';
import { BusinessTabs } from './BusinessTabs';
import { phaseLabel } from '@/config/tenant.config';
import { assetTitle, clientName, countJobs, formatDecimal, formatEuro, formatRelative } from '@/lib/format';
import { requireOwner } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Poslovanje' };

const RANGES = {
  this_month: 'Ovaj mjesec',
  last_month: 'Prošli mjesec',
  last_90: 'Zadnjih 90 dana',
  this_year: 'Ova godina',
} as const;
type Range = keyof typeof RANGES;

function bounds(range: Range): [Date, Date] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (range === 'last_month') return [new Date(y, m - 1, 1), new Date(y, m, 1)];
  if (range === 'last_90') return [new Date(Date.now() - 90 * 86400000), new Date(Date.now() + 86400000)];
  if (range === 'this_year') return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
  return [new Date(y, m, 1), new Date(y, m + 1, 1)];
}

const KIND_LABELS: Record<string, string> = { labor: 'Rad', part: 'Dijelovi', material: 'Materijal', package: 'Paketi', sublet: 'Vanjske usluge', fee: 'Naknade' };

// Owner only (requireOwner redirects workers; the database hides amounts anyway).
export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const ctx = await requireOwner();
  const { range: r } = await searchParams;
  const range: Range = r && r in RANGES ? (r as Range) : 'this_month';
  const [from, to] = bounds(range);
  const closed = phaseLabel(ctx.pkg, 'collected');
  const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);

  const yearAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 12, 1);
  const [{ data: done }, { data: unpaid }, { data: staff }, { data: history }, { data: issued }] = await Promise.all([
    ctx.supabase
      .from('jobs')
      .select('id, created_at, finished_at, collected_at, payment_status, assigned_to')
      .gte('collected_at', from.toISOString())
      .lt('collected_at', to.toISOString()),
    ctx.supabase
      .from('jobs')
      .select('id, number, finished_at, client:clients(kind, first_name, last_name, company_name, phone), asset:assets(identifier, make, model, asset_type)')
      .in('phase', ['ready', 'collected'])
      .eq('payment_status', 'unpaid')
      .order('finished_at'),
    ctx.supabase.from('profiles').select('id, full_name'),
    ctx.supabase.from('jobs').select('id, collected_at').gte('collected_at', sixMonthsAgo.toISOString()),
    ctx.supabase.from('jobs').select('invoice_issued_at').not('invoice_number', 'is', null).gte('invoice_issued_at', yearAgo.toISOString()),
  ]);
  // Issued invoices per month, for the accountant's export.
  const invoicesPerMonth: Record<string, number> = {};
  for (const j of issued ?? []) {
    const month = zagrebDate(j.invoice_issued_at as string).slice(0, 7);
    invoicesPerMonth[month] = (invoicesPerMonth[month] ?? 0) + 1;
  }

  const doneIds = (done ?? []).map((j) => j.id as string);
  const unpaidIds = (unpaid ?? []).map((j) => j.id as string);
  const historyIds = (history ?? []).map((j) => j.id as string);
  const allIds = [...new Set([...doneIds, ...unpaidIds, ...historyIds])];
  const [{ data: totals }, { data: lines }] = await Promise.all([
    allIds.length ? ctx.supabase.from('job_totals').select('job_id, net_total, gross_total').in('job_id', allIds) : Promise.resolve({ data: [] }),
    doneIds.length
      ? ctx.supabase.from('job_lines').select('id, kind, qty, job_id, time_spent_h, technician_id').in('job_id', doneIds).eq('approval', 'approved')
      : Promise.resolve({ data: [] }),
  ]);
  const gross = new Map((totals ?? []).map((t) => [t.job_id as string, Number(t.gross_total)]));
  const net = new Map((totals ?? []).map((t) => [t.job_id as string, Number(t.net_total)]));

  const revenue = doneIds.reduce((s, id) => s + (gross.get(id) ?? 0), 0);
  const paid = (done ?? []).filter((j) => j.payment_status === 'paid').reduce((s, j) => s + (gross.get(j.id as string) ?? 0), 0);
  const outstanding = unpaidIds.reduce((s, id) => s + (gross.get(id) ?? 0), 0);
  const leadTimes = (done ?? []).filter((j) => j.finished_at).map((j) => (new Date(j.finished_at as string).getTime() - new Date(j.created_at as string).getTime()) / 86400000);
  const avgLead = leadTimes.length ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null;

  // Split by line kind (net, from line prices).
  const lineIds = (lines ?? []).map((l) => l.id as string);
  const { data: prices } = lineIds.length ? await ctx.supabase.from('job_line_prices').select('job_line_id, unit_price, discount_pct').in('job_line_id', lineIds) : { data: [] };
  const priceOf = new Map((prices ?? []).map((p) => [p.job_line_id as string, Number(p.unit_price) * (1 - Number(p.discount_pct) / 100)]));
  const byKind = new Map<string, number>();
  for (const l of lines ?? []) byKind.set(l.kind as string, (byKind.get(l.kind as string) ?? 0) + Number(l.qty) * (priceOf.get(l.id as string) ?? 0));
  const kindTotal = [...byKind.values()].reduce((a, b) => a + b, 0);

  const names = new Map((staff ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? '-']));
  const perWorker = new Map<string, { jobs: number; revenue: number }>();
  for (const j of done ?? []) {
    const key = (j.assigned_to as string | null) ?? '_';
    const row = perWorker.get(key) ?? { jobs: 0, revenue: 0 };
    row.jobs++;
    row.revenue += net.get(j.id as string) ?? 0;
    perWorker.set(key, row);
  }

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('hr-HR', { month: 'short' }), value: 0 };
  });
  for (const j of history ?? []) {
    const d = new Date(j.collected_at as string);
    const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (m) m.value += gross.get(j.id as string) ?? 0;
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.value));

  return (
    <>
      <PageHeader title="Poslovanje" />
      <BusinessTabs active="pregled" />
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {(Object.keys(RANGES) as Range[]).map((key) => (
          <Link key={key} href={`/app/business?range=${key}`} className={cn(buttonClass(range === key ? 'primary' : 'secondary', 'sm'), 'shrink-0 rounded-full')}>
            {RANGES[key]}
          </Link>
        ))}
      </div>

      {/* The unpaid total heads its own list below instead of a tile of its own. */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label={`Promet (${closed.toLowerCase()})`} value={formatEuro(revenue)} hint={countJobs(doneIds.length)} />
        <Stat label="Naplaćeno" value={formatEuro(paid)} tone="ok" />
        <div className="col-span-2 lg:col-span-1">
          <Stat label="Prosječno trajanje" value={avgLead === null ? '-' : `${formatDecimal(avgLead, 1)} d`} hint="od prijema do gotovog" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Promet po mjesecima" subtitle={billingFrom(ctx.tenant.settings).vatRegistered ? 'S PDV-om' : undefined} />
          <div className="flex h-44 items-end gap-3 p-4">
            {months.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] tabular text-faint">{m.value ? `${formatDecimal(m.value / 1000, 1)}k` : ''}</span>
                <div className="w-full rounded-t-md bg-accent/80" style={{ height: `${Math.max(2, (m.value / maxMonth) * 110)}px` }} />
                <span className="text-xs text-muted">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Struktura prometa" subtitle="Bez PDV-a" />
          {kindTotal > 0 ? (
            <ul className="space-y-3 p-4">
              {[...byKind.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([kind, value]) => (
                  <li key={kind}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{KIND_LABELS[kind] ?? kind}</span>
                      <span className="tabular text-muted">
                        {formatEuro(value)} · {Math.round((value / kindTotal) * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
                      <div className="h-full bg-accent" style={{ width: `${(value / kindTotal) * 100}%` }} />
                    </div>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Nema zatvorenih naloga u razdoblju.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Po djelatniku"  />
          {perWorker.size ? (
            <ul className="divide-y divide-line">
              {[...perWorker.entries()]
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .map(([id, row]) => (
                  <li key={id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{id === '_' ? 'Nije dodijeljeno' : names.get(id)}</span>
                    <span className="tabular text-muted">
                      {countJobs(row.jobs)} · {formatEuro(row.revenue)}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Nema podataka.</p>
          )}
        </Card>

        {/* Deal: the jobs are the dealer's own cost, nothing to collect. */}
        {!ctx.pkg.internalJobs ? (
          <Card>
            <CardHeader title="Za naplatu" action={unpaidIds.length ? <span className="text-sm font-semibold tabular text-warn">{formatEuro(outstanding)}</span> : null} />
            {(unpaid ?? []).length ? (
              <ul className="divide-y divide-line">
                {(unpaid ?? []).map((j) => (
                  <li key={j.id as string}>
                    <Link prefetch={false} href={`/app/jobs/${j.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {clientName(j.client as never)} <span className="text-faint">· #{j.number as number}</span>
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {assetTitle(j.asset as never)} · gotovo {formatRelative(j.finished_at as string | null)}
                        </span>
                      </span>
                      <span className="text-sm font-medium tabular">{formatEuro(gross.get(j.id as string))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4">
                <EmptyState title="Sve je naplaćeno" />
              </div>
            )}
          </Card>
        ) : null}

        <AccountingExport perMonth={invoicesPerMonth} today={zagrebDate(new Date().toISOString())} />
      </div>
    </>
  );
}
