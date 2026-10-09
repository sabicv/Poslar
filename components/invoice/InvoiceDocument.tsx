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
  status: InvoiceStatus;
  sentAt: string | null;
  voidedAt: string | null;
  // Fiscal marks, set when the invoice is issued.
  paymentMethod: PaymentMethod | null;
  premises: string | null;
  device: string | null;
  operator: string | null;
  jobNumber: number;
  client: Pick<Client, 'kind' | 'first_name' | 'last_name' | 'company_name' | 'oib' | 'address' | 'city'>;
  asset: Pick<Asset, 'make' | 'model' | 'asset_type' | 'identifier'>;
  assetLabel: string;
  workSummary: string | null;
  lines: InvoiceLine[];
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';
export const PAYMENT_METHODS: Record<PaymentMethod, string> = { cash: 'Gotovina', card: 'Kartica', transfer: 'Transakcijski račun', other: 'Ostalo' };

export type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'fiscalized' | 'rejected' | 'voided';
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Nacrt',
  issued: 'Izdan',
  sent: 'Poslan',
  fiscalized: 'Fiskaliziran',
  rejected: 'Blagajna odbila',
  voided: 'Storniran',
};

// "12/PP1/1" once the workshop has its premises and device marks, else "12/2026".
export function invoiceNumberLabel(d: { number: number | null; year: number | null; premises: string | null; device: string | null }): string | null {
  if (!d.number) return null;
  return d.premises && d.device ? `${d.number}/${d.premises}/${d.device}` : `${d.number}/${d.year}`;
}

// "HR12 1001 0051 8630 0016 0" — easier to copy into a banking app.
const groupIban = (iban: string) => iban.replace(/\s/g, '').replace(/(.{4})(?=.)/g, '$1 ');

// The workshop's billing details live in tenants.settings (owner-editable).
export function billingFrom(settings: unknown): InvoiceBilling {
  const s = (settings ?? {}) as { iban?: string; vat_registered?: boolean; invoice_note?: string };
  return { iban: s.iban?.trim() || null, vatRegistered: s.vat_registered !== false, note: s.invoice_note?.trim() || null };
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Each line to the cent, VAT once per rate on the sum of its lines — the
// way accounting and e-Račun count it, so the PDF and the export agree.
export function lineAmount(l: InvoiceLine) {
  return round2(l.qty * l.unit_price * (1 - l.discount_pct / 100));
}

export function invoiceTotals(lines: InvoiceLine[], vatRegistered: boolean) {
  const bases = new Map<number, number>();
  for (const l of lines) {
    const rate = vatRegistered ? l.vat_rate : 0;
    bases.set(rate, round2((bases.get(rate) ?? 0) + lineAmount(l)));
  }
  const rates = [...bases.entries()].map(([rate, base]) => [rate, { base, vat: round2((base * rate) / 100) }] as [number, { base: number; vat: number }]);
  const net = round2(rates.reduce((s, [, r]) => s + r.base, 0));
  const vat = round2(rates.reduce((s, [, r]) => s + r.vat, 0));
  return { net, vat, gross: round2(net + vat), allRates: rates, byRate: rates.filter(([rate]) => rate > 0).sort((a, b) => b[0] - a[0]) };
}

// A plain A4 page: always black on white, on screen and on paper.
export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const { workshop: w, billing } = data;
  const totals = invoiceTotals(data.lines, billing.vatRegistered);
  // Before issuing the page is a preview; the number comes with "Izdaj račun".
  const label = invoiceNumberLabel(data);
  const title = data.status === 'voided' && label ? `Storno računa br. ${label}` : label ? `Račun br. ${label}` : 'Račun (još nije izdan)';
  const reference = data.number ? `${data.number}-${data.year}` : null;
  const client = data.client;

  return (
    <article className="invoice relative mx-auto w-full max-w-[210mm] overflow-hidden rounded-2xl bg-white p-6 text-[13px] leading-relaxed text-neutral-900 shadow-sm print:rounded-none print:p-0 print:shadow-none sm:p-10">
      {data.status === 'voided' ? (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-bold uppercase tracking-widest text-red-600/20 print:text-red-600/30" aria-hidden>
          <span className="-rotate-12">Storno</span>
        </p>
      ) : null}
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
          <p className="text-neutral-600">
            Datum: {formatDate(data.issuedAt ?? new Date().toISOString())}
            {data.issuedAt ? `, ${new Date(data.issuedAt).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zagreb' })}` : ''}
          </p>
          {data.paymentMethod ? <p className="text-neutral-600">Način plaćanja: {PAYMENT_METHODS[data.paymentMethod]}</p> : null}
          {data.operator ? <p className="text-neutral-600">Izdao: {data.operator}</p> : null}
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
        {billing.iban && reference && (data.paymentMethod ?? 'transfer') === 'transfer' ? (
          <p>
            Plaćanje na IBAN <span className="whitespace-nowrap">{groupIban(billing.iban)}</span>, poziv na broj <span className="whitespace-nowrap">{reference}</span>.
          </p>
        ) : null}
        {!billing.vatRegistered ? <p>PDV nije obračunat temeljem čl. 90. Zakona o PDV-u (obveznik nije u sustavu PDV-a).</p> : null}
        {billing.note ? <p>{billing.note}</p> : null}
        {data.status === 'voided' ? <p>Ovaj je račun storniran{data.voidedAt ? ` ${formatDate(data.voidedAt)}` : ''}.</p> : null}
        {data.fiscalRef ? (
          <p>Fiskalizirani račun iz blagajne br. {data.fiscalRef}.</p>
        ) : data.status !== 'voided' && (data.paymentMethod === 'cash' || data.paymentMethod === 'card' || !data.paymentMethod) ? (
          <p>Fiskalizirani račun izdaje se u blagajni obrta.</p>
        ) : null}
      </footer>
    </article>
  );
}
