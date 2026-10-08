import type { Metadata } from 'next';
import Link from 'next/link';
import { billingFrom } from '@/components/invoice/InvoiceDocument';
import { PeriodChips, type PeriodKey } from '@/components/business/PeriodChips';
import { Card, CardHeader, EmptyState, PageHeader, Stat, buttonClass } from '@/components/ui';
import { zagrebDate } from '@/lib/invoice';
import { AccountingExport } from './AccountingExport';
import { BusinessTabs } from './BusinessTabs';
import { phaseLabel } from '@/config/tenant.config';
import { assetTitle, clientName, countJobs, formatDecimal, formatEuro, formatRelative } from '@/lib/format';
import { helpVideo } from '@/lib/help';
import { PERIODS, periodBounds } from '@/lib/archive';
import { allRows, inChunks } from '@/lib/paged';
import { requireOwner } from '@/lib/session';
import { cn } from '@/lib/utils';
import { accountantOf } from '@/lib/accountant';
import { groupRevenue } from '@/lib/group-revenue';
import { myWorkshops } from '@/lib/workshops';

export const metadata: Metadata = { title: 'Poslovanje' };

// The same periods as Arhiva (components/business/PeriodChips). Older links
// with ?range= still land on the right one.
const OLD_RANGES: Record<string, PeriodKey> = { this_month: 'mjesec', last_month: 'prosli', last_90: '90', this_year: 'godina' };

const KIND_LABELS: Record<string, string> = { labor: 'Rad', part: 'Dijelovi', material: 'Materijal', package: 'Paketi', sublet: 'Vanjske usluge', fee: 'Naknade' };

// Owner only (requireOwner redirects workers; the database hides amounts anyway).
export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ r?: string; range?: string }> }) {
  const ctx = await requireOwner();
  const sp = await searchParams;
  const asked = sp.r ?? (sp.range ? OLD_RANGES[sp.range] : undefined);
  const period: PeriodKey = asked && asked in PERIODS ? (asked as PeriodKey) : 'mjesec';
  // [from, to) in Zagreb time; null = open ("Sve").
  const [from, to] = periodBounds({ period, from: null, to: null, paid: 'sve', q: '', limit: 0 });
  const closed = phaseLabel(ctx.pkg, 'collected');
  const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);

  const yearAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 12, 1);
  type Row = Record<string, unknown>;
  const db = ctx.supabase;
  // Read a page at a time: a busy workshop passes the API's 1000 rows.
  const [done, unpaid, { data: staff }, history, issued] = await Promise.all([
    allRows<Row>((a, b) => {
      let q = db.from('jobs').select('id, created_at, finished_at, collected_at, payment_status, assigned_to').not('collected_at', 'is', null);
      if (from) q = q.gte('collected_at', from);
      if (to) q = q.lt('collected_at', to);
      return q.order('id').range(a, b);
    }),
    allRows<Row>((a, b) =>
      db
        .from('jobs')
        .select('id, number, finished_at, client:clients(kind, first_name, last_name, company_name, phone), asset:assets(identifier, make, model, asset_type)')
        .in('phase', ['ready', 'collected'])
        .eq('payment_status', 'unpaid')
        .order('finished_at')
        .order('id')
        .range(a, b)
    ),
    db.from('profiles').select('id, full_name'),
    allRows<Row>((a, b) => db.from('jobs').select('id, collected_at').gte('collected_at', sixMonthsAgo.toISOString()).order('id').range(a, b)),
    allRows<Row>((a, b) => db.from('jobs').select('invoice_issued_at').not('invoice_number', 'is', null).gte('invoice_issued_at', yearAgo.toISOString()).order('id').range(a, b)),
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
  const [totals, lines] = await Promise.all([
    inChunks<Row>(allIds, (chunk) => db.from('job_totals').select('job_id, net_total, gross_total').in('job_id', chunk).order('job_id')),
    inChunks<Row>(doneIds, (chunk) => db.from('job_lines').select('id, kind, qty, job_id, time_spent_h, technician_id').in('job_id', chunk).eq('approval', 'approved').order('id')),
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
  const prices = await inChunks<Row>(lineIds, (chunk) => db.from('job_line_prices').select('job_line_id, unit_price, discount_pct').in('job_line_id', chunk).order('job_line_id'));
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
  // Zbirni promet: an owner of several workshops sees them side by side.
  const own = await myWorkshops(ctx);
  const group = own.length > 1 ? await groupRevenue(own, from, to) : [];

  return (
    <>
      <PageHeader title="Poslovanje" />
      <BusinessTabs active="pregled" invoices={!ctx.pkg.internalJobs} />
      <PeriodChips active={period} href={(key) => (key === 'mjesec' ? '/app/business' : `/app/business?r=${key}`)} />

      {/* The unpaid total heads its own list below instead of a tile of its own.
          Phone: one tile per row, so long amounts never squeeze. */}
      <div className="mb-5 mt-2 grid gap-3 sm:grid-cols-3">
        <Stat label={`Promet (${closed.toLowerCase()})`} value={formatEuro(revenue)} hint={countJobs(doneIds.length)} />
        <Stat label="Naplaćeno" value={formatEuro(paid)} tone="ok" />
        <Stat label="Prosječno trajanje" value={avgLead === null ? '-' : `${formatDecimal(avgLead, 1)} d`} hint="od prijema do gotovog" />
      </div>

      {group.length ? (
        <Card className="mb-4">
          <CardHeader title="Sve radionice" subtitle={`${PERIODS[period]} · s PDV-om`} action={<span className="text-sm font-semibold tabular">{formatEuro(group.reduce((s, w) => s + w.revenue, 0))}</span>} />
          <ul className="divide-y divide-line">
            {group.map((w) => (
              <li key={w.id} className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-sm', w.active && 'bg-accent/5')}>
                <span className="min-w-0 break-words font-medium">
                  {w.name}
                  {w.active ? <span className="font-normal text-faint"> · otvorena</span> : null}
                </span>
                <span className="tabular text-muted">
                  {countJobs(w.jobs)} · <span className="text-fg">{formatEuro(w.revenue)}</span>
                  {w.outstanding > 0 ? <span className="text-warn"> · za naplatu {formatEuro(w.outstanding)}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

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
          <CardHeader title="Po djelatniku" subtitle="Bez PDV-a" />
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
                        <span className="block break-words text-sm">
                          {clientName(j.client as never)} <span className="text-faint">· #{j.number as number}</span>
                        </span>
                        <span className="block break-words text-xs text-muted">
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

        <AccountingExport perMonth={invoicesPerMonth} today={zagrebDate(new Date().toISOString())} video={await helpVideo('accountant')} accountant={accountantOf(ctx.tenant.settings)} />
      </div>
    </>
  );
}
