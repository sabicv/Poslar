import { invoiceBookCsv, invoiceFileName, invoiceUbl } from '@/lib/accounting';
import { loadIssuedInvoices } from '@/lib/invoice';
import { requireOwner } from '@/lib/session';
import { zip } from '@/lib/zip';

// GET /app/business/izvoz?mjesec=2026-09&oblik=zip|csv — the owner's
// month of issued invoices for the accountant. Prices come through the
// owner's own session (RLS), so a worker gets nothing even by URL.
export async function GET(request: Request) {
  const ctx = await requireOwner();
  const params = new URL(request.url).searchParams;
  const month = params.get('mjesec') ?? '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return new Response('Neispravan mjesec.', { status: 400 });

  const invoices = await loadIssuedInvoices(ctx.supabase, month);
  const csv = invoiceBookCsv(invoices);
  const base = `racuni-${month}`;
  const headers = (type: string, name: string) => ({
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${name}"`,
    'Cache-Control': 'private, no-store',
  });

  if (params.get('oblik') === 'csv') {
    return new Response(csv, { headers: headers('text/csv; charset=utf-8', `${base}.csv`) });
  }
  const archive = zip([
    { name: `${base}/knjiga-racuna-${month}.csv`, data: csv },
    ...invoices.map((inv) => ({ name: `${base}/${invoiceFileName(inv)}`, data: invoiceUbl(inv) })),
  ]);
  return new Response(archive, { headers: headers('application/zip', `${base}.zip`) });
}
