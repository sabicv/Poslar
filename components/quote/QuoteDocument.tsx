import { assetTitle, clientName, formatDate, formatEuro } from '@/lib/format';
import type { Asset, Client } from '@/types/db';
import { invoiceTotals, lineAmount, round2, type InvoiceBilling, type InvoiceLine } from '@/components/invoice/InvoiceDocument';

export interface QuoteDocumentData {
  workshop: { name: string; address: string | null; city: string | null; oib: string | null; phone: string | null; email: string | null; logoUrl: string | null };
  billing: InvoiceBilling;
  number: number | null;
  year: number | null;
  sentAt: string | null;
  validUntil: string | null;
  jobNumber: number;
  client: Pick<Client, 'kind' | 'first_name' | 'last_name' | 'company_name' | 'oib' | 'address' | 'city'> | null;
  asset: Pick<Asset, 'make' | 'model' | 'asset_type' | 'identifier'> | null;
  assetLabel: string;
  place: string | null;
  request: string | null;
  finding: string | null;
  lines: InvoiceLine[];
  note: string | null;
}

export function quoteNumberLabel(number: number | null, year: number | null) {
  return number && year ? `${number}/${year}` : null;
}

// The customer's quote, on the same paper as the invoice. Not a bill.
export function QuoteDocument({ data }: { data: QuoteDocumentData }) {
  const { workshop: w, billing } = data;
  const totals = invoiceTotals(data.lines, billing.vatRegistered);
  const label = quoteNumberLabel(data.number, data.year);
  const client = data.client;

  return (
    <article className="invoice relative mx-auto w-full max-w-[210mm] overflow-x-hidden rounded-2xl bg-white p-6 text-[13px] leading-relaxed text-neutral-900 shadow-sm print:rounded-none print:p-0 print:shadow-none sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-200 pb-5">
        <div className="min-w-0">
          {w.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.logoUrl} alt="" className="mb-2 h-12 w-auto object-contain" />
          ) : null}
          <p className="text-base font-semibold">{w.name}</p>
          <p className="text-neutral-600">{[w.address, w.city].filter(Boolean).join(', ')}</p>
          <p className="text-neutral-600">{[w.oib && `OIB ${w.oib}`, w.phone, w.email].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Ponuda</p>
          <h1 className="text-lg font-semibold">{label ? `br. ${label}` : 'Pregled prije slanja'}</h1>
          <p className="text-neutral-600">Datum: {formatDate(data.sentAt ?? new Date().toISOString())}</p>
          {data.validUntil ? <p className="text-neutral-600">Vrijedi do {formatDate(data.validUntil)}</p> : <p className="text-neutral-600">Vrijedi 14 dana od slanja</p>}
          <p className="text-neutral-600">Radni nalog #{data.jobNumber}</p>
        </div>
      </header>

      <section className="grid gap-4 border-b border-neutral-200 py-5 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Za</p>
          <p className="font-medium">{clientName(client)}</p>
          {client?.address || client?.city ? <p className="text-neutral-600">{[client.address, client.city].filter(Boolean).join(', ')}</p> : null}
          {client?.oib ? <p className="text-neutral-600">OIB {client.oib}</p> : null}
          {data.place ? <p className="text-neutral-600">{data.place}</p> : null}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{data.assetLabel}</p>
          <p className="font-medium">{assetTitle(data.asset)}</p>
          {data.asset?.identifier ? <p className="font-mono text-neutral-600">{data.asset.identifier}</p> : null}
        </div>
      </section>

      {data.request ? (
        <section className="border-b border-neutral-200 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Vaš zahtjev</p>
          <p className="whitespace-pre-line">{data.request}</p>
        </section>
      ) : null}
      {data.finding ? (
        <section className="border-b border-neutral-200 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Nalaz</p>
          <p className="whitespace-pre-line">{data.finding}</p>
        </section>
      ) : null}

      {data.lines.length ? (
        <>
          <table className="my-4 w-full border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                <th className="py-2 pr-2 font-semibold">Opis</th>
                <th className="py-2 pl-2 text-right font-semibold">Iznos</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l, i) => (
                <tr key={i} className="border-b border-neutral-100 align-top">
                  <td className="py-2 pr-2">
                    <p>{l.description}</p>
                    <p className="tabular-nums text-neutral-500">
                      {l.qty.toLocaleString('hr-HR')} {l.unit} × {formatEuro(l.unit_price)}
                      {l.discount_pct ? ` − ${l.discount_pct} %` : ''}
                    </p>
                  </td>
                  <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums">{formatEuro(lineAmount(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="ml-auto w-full max-w-xs space-y-1 tabular-nums">
            {billing.vatRegistered ? (
              <>
                <div className="flex justify-between text-neutral-600">
                  <span>Osnovica</span>
                  <span>{formatEuro(totals.net)}</span>
                </div>
                {totals.byRate.map(([rate, r]) => (
                  <div key={rate} className="flex justify-between text-neutral-600">
                    <span>PDV {rate} %</span>
                    <span>{formatEuro(r.vat)}</span>
                  </div>
                ))}
              </>
            ) : null}
            <div className="flex justify-between border-t border-neutral-300 pt-2 text-base font-semibold">
              <span>Ukupno</span>
              <span>{formatEuro(totals.gross)}</span>
            </div>
          </section>
        </>
      ) : (
        <p className="border-b border-neutral-200 py-6 text-neutral-500">Stavke još nisu na ponudi. Dodajte ih u nalogu i označite kao prijedlog.</p>
      )}

      {data.note ? <p className="mt-6 whitespace-pre-line text-neutral-700">{data.note}</p> : null}

      <footer className="mt-8 space-y-1 border-t border-neutral-200 pt-4 text-[11px] text-neutral-500">
        <p>Ovo je ponuda, nije račun. Račun slijedi nakon obavljenog posla.</p>
        {!billing.vatRegistered ? <p>PDV nije obračunat temeljem čl. 90. Zakona o PDV-u (obveznik nije u sustavu PDV-a).</p> : null}
        {billing.note ? <p>{billing.note}</p> : null}
      </footer>
    </article>
  );
}

export function quoteGross(lines: InvoiceLine[], vatRegistered: boolean) {
  return round2(invoiceTotals(lines, vatRegistered).gross);
}
