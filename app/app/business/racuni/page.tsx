import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download, ReceiptText } from 'lucide-react';
import { INVOICE_STATUS_LABELS, PAYMENT_METHODS, invoiceNumberLabel, invoiceTotals, lineAmount, type PaymentMethod } from '@/components/invoice/InvoiceDocument';
import { Badge, Card, EmptyState, Input, PageHeader, Stat, buttonClass } from '@/components/ui';
import { TILL_RATES } from '@/lib/accounting';
import { assetTitle, clientName, formatDate, formatEuro, formatNumber } from '@/lib/format';
import { loadInvoicesOfDay } from '@/lib/invoice';
import { requireOwner } from '@/lib/session';
import { addDays, formatTime, todayInZagreb } from '@/lib/time';
import { cn } from '@/lib/utils';
import { BusinessTabs } from '../BusinessTabs';
import { FiscalRef } from './FiscalRef';

export const metadata: Metadata = { title: 'Računi danas' };

// "Računi danas" (Vedran's fiscal question, step 1): every invoice issued
// today in the order it was issued, with what the fiscal till asks for
// (base and VAT per rate, payment method), so the owner types them in at
// the end of the day and notes each till number with one tap. The whole
// day also goes out as a table (CSV). Step 2, sending them to the tax
// office through a provider, waits for the accountant's choice.
export default async function TillDayPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const ctx = await requireOwner();
  // A workshop's own jobs (Auto plac) have no invoices.
  if (ctx.pkg.internalJobs) redirect('/app/business');
  const today = todayInZagreb();
  const { d } = await searchParams;
  const day = d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today ? d : today;
  const invoices = await loadInvoicesOfDay(ctx.supabase, day);

  const rows = invoices.map((inv) => ({ inv, totals: invoiceTotals(inv.lines, inv.billing.vatRegistered) }));
  const gross = rows.reduce((s, r) => s + r.totals.gross, 0);
  const waiting = invoices.filter((inv) => !inv.fiscalRef && inv.status !== 'voided').length;
  // By payment method and by VAT rate, as the till's day report shows them.
  const byMethod = new Map<PaymentMethod | 'none', number>();
  for (const r of rows) byMethod.set(r.inv.paymentMethod ?? 'none', (byMethod.get(r.inv.paymentMethod ?? 'none') ?? 0) + r.totals.gross);
  const byRate = new Map<number, { base: number; vat: number }>();
  for (const r of rows)
    for (const [rate, x] of r.totals.allRates) {
      const sum = byRate.get(rate) ?? { base: 0, vat: 0 };
      byRate.set(rate, { base: sum.base + x.base, vat: sum.vat + x.vat });
    }
  const isToday = day === today;

  return (
    <>
      <PageHeader title="Poslovanje" />
      <BusinessTabs active="racuni" count={isToday ? waiting : undefined} />

      {/* The day: back, forward, or any date. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/app/business/racuni?d=${addDays(day, -1)}`} aria-label="Dan prije" className={buttonClass('secondary', 'sm')}>
          <ChevronLeft className="size-4" />
        </Link>
        <span className="min-w-[8rem] text-center text-sm font-medium">{isToday ? `Danas, ${formatDate(`${day}T12:00:00Z`)}` : formatDate(`${day}T12:00:00Z`)}</span>
        {isToday ? (
          <span className={cn(buttonClass('secondary', 'sm'), 'pointer-events-none opacity-40')} aria-hidden>
            <ChevronRight className="size-4" />
          </span>
        ) : (
          <Link href={`/app/business/racuni?d=${addDays(day, 1)}`} aria-label="Dan poslije" className={buttonClass('secondary', 'sm')}>
            <ChevronRight className="size-4" />
          </Link>
        )}
        <form action="/app/business/racuni" className="flex items-center gap-2">
          <Input type="date" name="d" defaultValue={day} max={today} className="h-9 w-40" aria-label="Datum" />
          <button type="submit" className={buttonClass('ghost', 'sm')}>
            Prikaži
          </button>
        </form>
        {invoices.length ? (
          <a href={`/app/business/racuni/csv?d=${day}`} className={cn(buttonClass('secondary', 'sm'), 'ml-auto')}>
            <Download className="size-4" /> Tablica (CSV)
          </a>
        ) : null}
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={<ReceiptText className="size-8" />} title={isToday ? 'Danas još nema izdanih računa.' : 'Taj dan nema izdanih računa.'}>
          Račun izdajete na nalogu: Radovi i cijena, pa Račun.
        </EmptyState>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Izdano računa" value={invoices.length} />
            <Stat label="Ukupno" value={formatEuro(gross)} />
            <Stat label="Čeka upis u blagajnu" value={waiting} tone={waiting ? 'warn' : 'ok'} hint={waiting ? undefined : 'Sve je upisano.'} />
          </section>

          <Card className="mt-3 divide-y divide-line text-sm">
            <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-3">
              {[...byMethod.entries()].map(([method, sum]) => (
                <span key={method}>
                  <span className="text-muted">{method === 'none' ? 'Bez načina plaćanja' : PAYMENT_METHODS[method]}:</span> <span className="font-medium tabular">{formatEuro(sum)}</span>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-3">
              {[...byRate.entries()]
                .sort((a, b) => b[0] - a[0])
                .map(([rate, x]) =>
                  rate > 0 ? (
                    <span key={rate}>
                      <span className="text-muted">Osnovica {rate} %:</span> <span className="tabular">{formatEuro(x.base)}</span> <span className="text-muted">· PDV:</span>{' '}
                      <span className="tabular">{formatEuro(x.vat)}</span>
                    </span>
                  ) : (
                    <span key={rate}>
                      <span className="text-muted">Bez PDV-a:</span> <span className="tabular">{formatEuro(x.base)}</span>
                    </span>
                  )
                )}
            </div>
          </Card>

          <p className="mb-3 mt-6 text-sm text-muted">Prepišite svaki račun u blagajnu i upišite broj koji blagajna izda.</p>
          <ol className="space-y-3">
            {rows.map(({ inv, totals }) => (
              <li key={inv.jobId}>
                <Card className={cn('p-4', !inv.fiscalRef && 'border-warn/40')}>
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        Račun {invoiceNumberLabel(inv)} <span className="font-normal text-muted">· {formatTime(inv.issuedAt)}</span>
                      </p>
                      <p className="break-words text-sm text-muted">
                        {[clientName(inv.client as never), inv.client?.oib ? `OIB ${inv.client.oib}` : null, inv.asset?.identifier ?? (inv.asset ? assetTitle(inv.asset) : null)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold tabular">{formatEuro(totals.gross)}</p>
                      <div className="flex flex-wrap justify-end gap-1">
                        {inv.status === 'voided' || inv.status === 'rejected' || inv.status === 'fiscalized' || inv.status === 'sent' ? (
                          <Badge tone={inv.status === 'voided' ? 'crit' : inv.status === 'rejected' ? 'warn' : 'ok'}>{INVOICE_STATUS_LABELS[inv.status]}</Badge>
                        ) : null}
                        {inv.paymentMethod ? <Badge>{PAYMENT_METHODS[inv.paymentMethod]}</Badge> : null}
                      </div>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                    {inv.lines.map((l, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="min-w-0 flex-1">{l.description}</span>
                        <span className="shrink-0 text-muted tabular">
                          {formatNumber(l.qty, 2)} {l.unit} × {formatEuro(l.unit_price)}
                          {l.discount_pct ? ` −${formatNumber(l.discount_pct, 1)} %` : ''}
                        </span>
                        <span className="w-20 shrink-0 text-right tabular">{formatEuro(lineAmount(l))}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 flex flex-wrap justify-end gap-x-4 text-xs text-muted">
                    {inv.billing.vatRegistered
                      ? totals.allRates.map(([rate, x]) => (
                          <span key={rate} className="tabular">
                            {TILL_RATES.includes(rate) ? `Osnovica ${rate} % ${formatEuro(x.base)} · PDV ${formatEuro(x.vat)}` : `Bez PDV-a ${formatEuro(x.base)}`}
                          </span>
                        ))
                      : 'Nije u sustavu PDV-a'}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {inv.status !== 'voided' ? (
                      <div className="min-w-[14rem] flex-1">
                        <FiscalRef jobId={inv.jobId} value={inv.fiscalRef} />
                      </div>
                    ) : null}
                    <Link href={`/app/jobs/${inv.jobId}/racun`} className={buttonClass('ghost', 'sm')}>
                      Otvori račun
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
