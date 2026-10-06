import Link from 'next/link';
import { CarFront } from 'lucide-react';
import { billingFrom } from '@/components/invoice/InvoiceDocument';
import { Badge, Card, CardHeader, EmptyState, Stat, buttonClass } from '@/components/ui';
import { daysOnLot, dealMargin, stockTone } from '@/config/packages/deal';
import { phaseLabel, type JobPhase } from '@/config/tenant.config';
import { assetTitle, formatDate, formatEuro } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { addDays, todayInZagreb } from '@/lib/time';

type StockRow = {
  job_id: string;
  purchased_on: string;
  sold_on: string | null;
  asking_price: number | null;
  reserved_by: string | null;
  listed_on: string | null;
  buyer_name: string | null;
  job: { phase: JobPhase; number: number } | null;
  asset: { asset_type: never; identifier: string | null; make: string | null; model: string | null; year: number | null } | null;
};

// Poslar Auto plac: the lot. Oldest car first, because the days standing are
// what costs a dealer money; the owner also sees what each car earns.
export async function DealPage({ ctx }: { ctx: WorkshopContext }) {
  const today = todayInZagreb();
  const select = 'job_id, purchased_on, sold_on, asking_price, reserved_by, listed_on, buyer_name, job:jobs(phase, number), asset:assets(asset_type, identifier, make, model, year)';
  const [{ data: lot }, { data: sold }] = await Promise.all([
    ctx.supabase.from('deal_stock').select(select).is('sold_on', null).order('purchased_on'),
    ctx.supabase.from('deal_stock').select(select).gte('sold_on', addDays(today, -90)).order('sold_on', { ascending: false }),
  ]);
  const stock = (lot ?? []) as unknown as StockRow[];
  const recent = (sold ?? []) as unknown as StockRow[];

  // Owner only: purchase and sale prices, and what each car cost to prepare.
  const ids = [...stock, ...recent].map((r) => r.job_id);
  const money = new Map<string, { purchase: number | null; sale: number | null; costs: number }>();
  if (ctx.isOwner && ids.length) {
    const vat = billingFrom(ctx.tenant.settings).vatRegistered;
    const [{ data: amounts }, { data: totals }] = await Promise.all([
      ctx.supabase.from('private_amounts').select('entity_id, field, amount').eq('entity', 'deal_stock').in('entity_id', ids),
      ctx.supabase.from('job_totals').select('job_id, net_total, gross_total').in('job_id', ids),
    ]);
    for (const id of ids) {
      const pick = (field: string) => {
        const row = (amounts ?? []).find((a) => a.entity_id === id && a.field === field);
        return row ? Number(row.amount) : null;
      };
      const t = (totals ?? []).find((x) => x.job_id === id);
      money.set(id, { purchase: pick('purchase'), sale: pick('sale'), costs: t ? Number(vat ? t.net_total : t.gross_total) : 0 });
    }
  }

  const ages = stock.map((r) => daysOnLot(r.purchased_on, null, today));
  const averageDays = ages.length ? Math.round(ages.reduce((s, d) => s + d, 0) / ages.length) : 0;
  const tiedUp = stock.reduce((s, r) => s + (money.get(r.job_id)?.purchase ?? 0) + (money.get(r.job_id)?.costs ?? 0), 0);
  // The last 30 days, so the numbers mean something on the 2nd of the month too.
  const monthSold = recent.filter((r) => r.sold_on && r.sold_on >= addDays(today, -30));
  const monthMargin = monthSold.reduce((s, r) => {
    const m = money.get(r.job_id);
    return s + (m ? (dealMargin(m.sale, m.purchase, m.costs) ?? 0) : 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Vozila na placu" value={stock.length} />
        <Stat label="Prosječno stoji" value={`${averageDays} dana`} tone={averageDays > 60 ? 'warn' : undefined} />
        <Stat label="Prodano u 30 dana" value={monthSold.length} />
        {ctx.isOwner ? <Stat label="Zarada u 30 dana" value={formatEuro(monthMargin)} hint={`U vozilima: ${formatEuro(tiedUp)}`} tone={monthMargin < 0 ? 'crit' : 'ok'} /> : null}
      </div>

      <Card>
        <CardHeader title="Na placu" subtitle="Najstarije prvo" action={<Link href="/app/jobs/new" className={buttonClass('primary', 'sm')}><CarFront className="size-4" /> Otkup</Link>} />
        {stock.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Plac je prazan">Otkupljeno vozilo upisuje se kao novi nalog, pa u kartici „Otkup i prodaja”.</EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {stock.map((r) => {
              const days = daysOnLot(r.purchased_on, null, today);
              const m = money.get(r.job_id);
              const expected = m && r.asking_price != null ? dealMargin(Number(r.asking_price), m.purchase, m.costs) : null;
              return (
                <li key={r.job_id}>
                  <Link href={`/app/jobs/${r.job_id}?tab=modul`} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm hover:bg-surface2">
                    <span className="font-medium">
                      {assetTitle(r.asset)}
                      {r.asset?.year ? ` (${r.asset.year})` : ''}
                    </span>
                    {r.asset?.identifier ? <span className="font-mono text-xs text-muted">{r.asset.identifier}</span> : null}
                    {r.job ? <Badge tone="neutral">{phaseLabel(ctx.pkg, r.job.phase)}</Badge> : null}
                    {r.reserved_by ? <Badge tone="warn">Rezervirano</Badge> : null}
                    {!r.listed_on ? <Badge tone="muted">Bez oglasa</Badge> : null}
                    <span className="ml-auto flex items-center gap-2">
                      {r.asking_price != null ? <span className="tabular">{formatEuro(Number(r.asking_price))}</span> : null}
                      {ctx.isOwner && expected !== null ? <span className={`text-xs tabular ${expected < 0 ? 'text-crit' : 'text-ok'}`}>+{formatEuro(expected)}</span> : null}
                      <Badge tone={stockTone(days)}>
                        {days} {days === 1 ? 'dan' : 'dana'}
                      </Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Prodano u zadnjih 90 dana" />
        {recent.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Još nema prodanih vozila.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((r) => {
              const m = money.get(r.job_id);
              const margin = m ? dealMargin(m.sale, m.purchase, m.costs) : null;
              return (
                <li key={r.job_id}>
                  <Link href={`/app/jobs/${r.job_id}?tab=modul`} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm hover:bg-surface2">
                    <span className="font-medium">{assetTitle(r.asset)}</span>
                    <span className="text-xs text-faint">
                      {formatDate(r.sold_on)} · {r.buyer_name ?? ''} · {daysOnLot(r.purchased_on, r.sold_on, today)} dana na placu
                    </span>
                    {ctx.isOwner && margin !== null ? <span className={`ml-auto text-sm font-medium tabular ${margin < 0 ? 'text-crit' : 'text-ok'}`}>{formatEuro(margin)}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
