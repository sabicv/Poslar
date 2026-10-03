import { invoiceNumberLabel } from '@/components/invoice/InvoiceDocument';
import { loadArchive, readFilters } from '@/lib/archive';
import { clientName, formatDate } from '@/lib/format';
import { requireOwner } from '@/lib/session';

// The archive as a table Excel opens directly: semicolons, decimal commas,
// UTF-8 with BOM. Same filters as the page, up to 3000 jobs.
export async function GET(request: Request) {
  const ctx = await requireOwner();
  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = { ...readFilters(sp), limit: 3000 };
  const { rows } = await loadArchive(ctx, filters);
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Zatvoreno', 'Nalog', 'Račun', 'Kupac', 'Telefon', ctx.pkg.vocabulary.identifier, ctx.pkg.vocabulary.asset.one, 'Iznos', 'Plaćeno', 'Datum plaćanja', 'Opis'];
  const lines = [header.map(cell).join(';')];
  for (const j of rows) {
    lines.push(
      [
        formatDate(j.collected_at),
        j.number,
        invoiceNumberLabel({ number: j.invoice_number, year: j.invoice_year, premises: j.invoice_premises, device: j.invoice_device }) ?? '',
        clientName(j.client),
        j.client?.phone ?? '',
        j.asset?.identifier ?? '',
        [j.asset?.make, j.asset?.model].filter(Boolean).join(' '),
        j.gross.toFixed(2).replace('.', ','),
        j.payment_status === 'paid' ? 'da' : 'ne',
        j.paid_at ? formatDate(j.paid_at) : '',
        (j.complaint ?? '').replace(/\s+/g, ' ').slice(0, 200),
      ]
        .map(cell)
        .join(';')
    );
  }
  const name = `arhiva-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(`﻿${lines.join('\r\n')}\r\n`, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' },
  });
}
