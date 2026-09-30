import { assetTitle, clientName, formatDate, formatEuro } from '@/lib/format';
import type { Asset, Client } from '@/types/db';

export interface InvoiceLine {
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  discount_pct: number;
  vat_rate: number;
}

export interface InvoiceBilling {
  iban: string | null;
  vatRegistered: boolean;
  note: string | null;
}

export interface InvoiceData {
  workshop: { name: string; address: string | null; city: string | null; oib: string | null; phone: string | null; email: string | null; logoUrl: string | null };
  billing: InvoiceBilling;
  number: number | null;
  year: number | null;
  issuedAt: string | null;
  fiscalRef: string | null;
  jobNumber: number;
  client: Pick<Client, 'kind' | 'first_name' | 'last_name' | 'company_name' | 'oib' | 'address' | 'city'>;
  asset: Pick<Asset, 'make' | 'model' | 'asset_type' | 'identifier'>;
  assetLabel: string;
  workSummary: string | null;
  lines: InvoiceLine[];
}

// "HR12 1001 0051 8630 0016 0" — easier to copy into a banking app.
const groupIban = (iban: string) => iban.replace(/\s/g, '').replace(/(.{4})(?=.)/g, '$1 ');

// The workshop's billing details live in tenants.settings (owner-editable).
export function billingFrom(settings: unknown): InvoiceBilling {
  const s = (settings ?? {}) as { iban?: string; vat_registered?: boolean; invoice_note?: string };
  return { iban: s.iban?.trim() || null, vatRegistered: s.vat_registered !== false, note: s.invoice_note?.trim() || null };
}

export function invoiceTotals(lines: InvoiceLine[], vatRegistered: boolean) {
  const byRate = new Map<number, { base: number; vat: number }>();
  let net = 0;
  for (const l of lines) {
    const amount = l.qty * l.unit_price * (1 - l.discount_pct / 100);
    net += amount;
    const rate = vatRegistered ? l.vat_rate : 0;
    const row = byRate.get(rate) ?? { base: 0, vat: 0 };
    row.base += amount;
    row.vat += (amount * rate) / 100;
    byRate.set(rate, row);
  }
  const vat = [...byRate.values()].reduce((s, r) => s + r.vat, 0);
  return { net, vat, gross: net + vat, byRate: [...byRate.entries()].filter(([rate]) => rate > 0).sort((a, b) => b[0] - a[0]) };
}

// A plain A4 page: always black on white, on screen and on paper.
export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const { workshop: w, billing } = data;
  const totals = invoiceTotals(data.lines, billing.vatRegistered);
  // Before issuing the page is a preview; the number comes with "Izdaj račun".
  const title = data.number ? `Račun br. ${data.number}/${data.year}` : 'Račun br. —';
  const reference = data.number ? `${data.number}-${data.year}` : null;
  const client = data.client;

  return (
    <article className="invoice mx-auto w-full max-w-[210mm] rounded-2xl bg-white p-6 text-[13px] leading-relaxed text-neutral-900 shadow-sm print:rounded-none print:p-0 print:shadow-none sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-200 pb-5">
        <div className="min-w-0">
          {w.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.logoUrl} alt="" className="mb-2 h-12 w-auto object-contain" />
          ) : null}
          <p className="text-base font-semibold">{w.name}</p>
          <p className="text-neutral-600">{[w.address, w.city].filter(Boolean).join(', ')}</p>
          <p className="text-neutral-600">{[w.oib && `OIB ${w.oib}`, w.phone, w.email].filter(Boolean).join(' · ')}</p>
          {billing.iban ? <p className="text-neutral-600">IBAN {groupIban(billing.iban)}</p> : null}
        </div>
        <div className="sm:text-right">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-neutral-600">Datum: {formatDate(data.issuedAt ?? new Date().toISOString())}</p>
          <p className="text-neutral-600">Radni nalog #{data.jobNumber}</p>
        </div>
      </header>

      <section className="grid gap-4 border-b border-neutral-200 py-5 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Kupac</p>
          <p className="font-medium">{clientName(client)}</p>
          {client.address || client.city ? <p className="text-neutral-600">{[client.address, client.city].filter(Boolean).join(', ')}</p> : null}
          {client.oib ? <p className="text-neutral-600">OIB {client.oib}</p> : null}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{data.assetLabel}</p>
          <p className="font-medium">{assetTitle(data.asset)}</p>
          {data.asset.identifier ? <p className="font-mono text-neutral-600">{data.asset.identifier}</p> : null}
        </div>
      </section>

      {/* Two columns so it reads on a phone without scrolling sideways:
          what was done (with quantity × price under it) and the amount. */}
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
              <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums">{formatEuro(l.qty * l.unit_price * (1 - l.discount_pct / 100))}</td>
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
          <span>Ukupno za platiti</span>
          <span>{formatEuro(totals.gross)}</span>
        </div>
      </section>

      {data.workSummary ? (
        <section className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Obavljeni radovi</p>
          <p className="whitespace-pre-line">{data.workSummary}</p>
        </section>
      ) : null}

      <footer className="mt-8 space-y-1 border-t border-neutral-200 pt-4 text-[11px] text-neutral-500">
        {billing.iban && reference ? (
          <p>
            Plaćanje na IBAN <span className="whitespace-nowrap">{groupIban(billing.iban)}</span>, poziv na broj <span className="whitespace-nowrap">{reference}</span>.
          </p>
        ) : null}
        {!billing.vatRegistered ? <p>PDV nije obračunat temeljem čl. 90. Zakona o PDV-u (obveznik nije u sustavu PDV-a).</p> : null}
        {billing.note ? <p>{billing.note}</p> : null}
        <p>{data.fiscalRef ? `Fiskalizirani račun iz blagajne br. ${data.fiscalRef}.` : 'Fiskalizirani račun izdaje se u blagajni obrta.'}</p>
      </footer>
    </article>
  );
}
