import type { Metadata } from 'next';
import Link from 'next/link';
import { Archive, FileSpreadsheet, Lock, Search } from 'lucide-react';
import { PeriodChips } from '@/components/business/PeriodChips';
import { invoiceNumberLabel } from '@/components/invoice/InvoiceDocument';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Stat, buttonClass } from '@/components/ui';
import { phaseLabel } from '@/config/tenant.config';
import { filterQuery, loadArchive, readFilters, type Paid } from '@/lib/archive';
import { assetTitle, clientName, formatDate, formatEuro } from '@/lib/format';
import { requireOwner } from '@/lib/session';
import { cn } from '@/lib/utils';
import { BusinessTabs } from '../BusinessTabs';

export const metadata: Metadata = { title: 'Arhiva' };

const PAID: Record<Paid, string> = { sve: 'Sve', placeno: 'Plaćeno', neplaceno: 'Neplaćeno' };

// "3. 10." this year, "3. 10. 2025." for older ones.
function shortDate(iso: string | null): string {
  const full = formatDate(iso);
  return iso && full.endsWith(`${new Date().getFullYear()}.`) ? full.replace(/ ?\d{4}\.$/, '') : full;
}

export default async function ArchivePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireOwner();
  const f = readFilters(await searchParams);
  const result = await loadArchive(ctx, f);
  const billing = !ctx.pkg.internalJobs;
  const closed = phaseLabel(ctx.pkg, 'collected');
  const chip = (active: boolean) => cn(buttonClass(active ? 'primary' : 'secondary', 'sm'), 'shrink-0 rounded-full');

  return (
    <>
      <PageHeader title="Poslovanje" />
      <BusinessTabs active="arhiva" invoices={billing} />

      <form className="mb-3 space-y-2" action="/app/business/arhiva">
        {/* Search and the export side by side, at the top where the thumb finds them. */}
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input name="q" defaultValue={f.q} placeholder={`${ctx.pkg.vocabulary.identifier}, ime, telefon, OIB, broj naloga ili računa`} className="pl-9" />
          </div>
          <a href={`/app/business/arhiva/csv${filterQuery(f)}`} className={cn(buttonClass('primary'), 'shrink-0')} aria-label="Izvezi popis za Excel (CSV)">
            <FileSpreadsheet className="size-5" /> <span className="hidden min-[380px]:inline">Izvezi CSV</span>
          </a>
        </div>
        {/* Custom period: both dates optional. */}
        <details className="text-sm" open={f.period === 'od-do'}>
          <summary className="cursor-pointer select-none text-muted">Razdoblje od do</summary>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted">
              Od
              <Input type="date" name="od" defaultValue={f.from ?? ''} className="mt-1 w-40" />
            </label>
            <label className="text-xs text-muted">
              Do
              <Input type="date" name="do" defaultValue={f.to ?? ''} className="mt-1 w-40" />
            </label>
            <Button type="submit" size="sm">
              Prikaži
            </Button>
          </div>
        </details>
        {f.paid !== 'sve' ? <input type="hidden" name="p" value={f.paid} /> : null}
        {f.period !== 'od-do' && f.period !== 'godina' ? <input type="hidden" name="r" value={f.period} /> : null}
      </form>

      <PeriodChips active={f.period} href={(key) => `/app/business/arhiva${filterQuery(f, { r: key === 'godina' ? null : key })}`} />
      {billing ? (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {(Object.keys(PAID) as Paid[]).map((key) => (
            <Link key={key} href={`/app/business/arhiva${filterQuery(f, { p: key === 'sve' ? null : key })}`} className={chip(f.paid === key)}>
              {PAID[key]}
            </Link>
          ))}
        </div>
      ) : (
        <div className="mb-5" />
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Naloga" value={result.count} hint={result.capped ? 'prikazano prvih 3000' : undefined} />
        <Stat label={billing ? 'Ukupno' : 'Troškovi pripreme'} value={formatEuro(result.total)} />
        {billing ? <Stat label="Plaćeno" value={formatEuro(result.paid)} tone="ok" /> : null}
        {billing ? <Stat label="Neplaćeno" value={formatEuro(result.unpaid)} tone={result.unpaid > 0 ? 'warn' : undefined} /> : null}
      </div>

      {result.rows.length === 0 ? (
        <EmptyState icon={<Archive className="size-8" />} title={f.q ? 'Ništa nije pronađeno' : 'Nema zatvorenih naloga u tom razdoblju'}>
          {f.q ? 'Pokušajte s dijelom registracije, prezimenom, brojem naloga ili računa (npr. 12/2026).' : `Ovdje su nalozi u fazi „${closed}”.`}
        </EmptyState>
      ) : (
        <>
          <Card>
            <ul className="divide-y divide-line">
              {result.rows.map((j) => (
                <li key={j.id}>
                  <Link prefetch={false} href={`/app/jobs/${j.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-surface2">
                    <span className="w-16 shrink-0 pt-0.5 text-xs tabular text-faint">{shortDate(j.collected_at)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="break-words">{clientName(j.client)}</span>
                        {j.locked_at ? <Lock className="size-3 shrink-0 text-faint" aria-label="Zaključano" /> : null}
                      </span>
                      <span className="block break-words text-xs text-muted">
                        {[j.asset?.identifier, assetTitle(j.asset)].filter(Boolean).join(' · ')}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-faint">
                        Nalog #{j.number}
                        {j.invoice_number ? <Badge tone="neutral">Račun {invoiceNumberLabel({ number: j.invoice_number, year: j.invoice_year, premises: j.invoice_premises, device: j.invoice_device })}</Badge> : null}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular">{formatEuro(j.gross)}</span>
                      {billing ? <Badge tone={j.payment_status === 'paid' ? 'ok' : 'warn'}>{j.payment_status === 'paid' ? 'Plaćeno' : 'Neplaćeno'}</Badge> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <div className="mt-4">
            {result.rows.length < result.count ? (
              <Link href={`/app/business/arhiva${filterQuery(f, { n: String(f.limit + 100) })}`} scroll={false} className={cn(buttonClass('secondary'), 'w-full')}>
                Prikaži još ({result.count - result.rows.length})
              </Link>
            ) : (
              <span className="text-xs text-faint">Prikazano svih {result.rows.length}.</span>
            )}
          </div>
        </>
      )}
    </>
  );
}
