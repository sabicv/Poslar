import { tillDayCsv } from '@/lib/accounting';
import { loadInvoicesOfDay } from '@/lib/invoice';
import { requireOwner } from '@/lib/session';

// GET /app/business/racuni/csv?d=2026-10-05 — one day's invoices for the
// fiscal till, as a table Excel opens. Owner only (prices through RLS).
export async function GET(request: Request) {
  const ctx = await requireOwner();
  const day = new URL(request.url).searchParams.get('d') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Response('Neispravan datum.', { status: 400 });
  const csv = tillDayCsv(await loadInvoicesOfDay(ctx.supabase, day));
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="racuni-${day}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
