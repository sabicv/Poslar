import { invoiceFileName, invoiceUbl } from '@/lib/accounting';
import { loadInvoice } from '@/lib/invoice';
import { requireOwner } from '@/lib/session';

// GET /app/jobs/:id/racun/xml — one issued invoice as e-Račun (UBL 2.1).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Nije pronađeno.', { status: 404 });
  const invoice = await loadInvoice(ctx.supabase, { id });
  if (!invoice?.number) return new Response('Račun još nije izdan.', { status: 404 });
  return new Response(invoiceUbl(invoice), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${invoiceFileName(invoice)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
