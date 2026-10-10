import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/app/racun/[token]/PrintButton';
import { QuoteDocument } from '@/components/quote/QuoteDocument';
import { BackLink } from '@/components/ui';
import { loadQuotePaper, type QuoteSnapshot } from '@/lib/quote';
import { requireOwner } from '@/lib/session';

export const metadata: Metadata = { title: 'Ponuda' };

// The paper the customer will see. Before it is sent, the lines are live.
// After sending, this is the latest version that was actually sent.
export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: sent } = await ctx.supabase
    .from('approvals')
    .select('quote_number, quote_year, sent_at, expires_at, snapshot, status')
    .eq('job_id', id)
    .not('quote_number', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const paper = await loadQuotePaper(ctx.supabase, id, (sent?.snapshot as QuoteSnapshot | null) ?? null, {
    number: (sent?.quote_number as number | null) ?? null,
    year: (sent?.quote_year as number | null) ?? null,
    sentAt: (sent?.sent_at as string | null) ?? null,
    validUntil: (sent?.expires_at as string | null) ?? null,
  });
  if (!paper) notFound();

  return (
    <div className="mx-auto w-full min-w-0 max-w-[230mm] space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href={`/app/jobs/${id}?tab=stavke`}>Nalog #{paper.jobNumber}</BackLink>
        <PrintButton />
      </div>
      {!sent ? <p className="text-sm text-muted print:hidden">Ovo je pregled. Broj dobiva kad ponudu pošaljete mušteriji. Do tada se stavke mogu brisati i mijenjati.</p> : null}
      <QuoteDocument data={paper} />
    </div>
  );
}
