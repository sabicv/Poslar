import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/app/racun/[token]/PrintButton';
import { billingFrom, invoiceTotals, lineAmount, round2, type InvoiceLine } from '@/components/invoice/InvoiceDocument';
import { QuoteDocument } from '@/components/quote/QuoteDocument';
import { formatDateTime } from '@/lib/format';
import { linesFromSnapshot, loadQuotePaper, type QuoteSnapshot } from '@/lib/quote';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApprovalForm } from './ApprovalForm';

export const metadata: Metadata = { title: 'Ponuda', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// The quote, as paper. The customer accepts or declines under it.
export default async function ApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const admin = createAdminClient();
  const { data: approval } = await admin.from('approvals').select('*').eq('token', token).maybeSingle();
  if (!approval) notFound();

  const { data: tenant } = await admin.from('tenants').select('name, phone, address, city, package, settings').eq('id', approval.tenant_id).single();
  if (!tenant) notFound();

  const snapshot = (approval.snapshot as QuoteSnapshot | null) ?? null;
  const expired = approval.status === 'expired' || new Date(approval.expires_at as string) < new Date();
  const { data: newer } = expired
    ? await admin.from('approvals').select('id').eq('job_id', approval.job_id).gt('sent_at', approval.sent_at as string).limit(1).maybeSingle()
    : { data: null };

  const paper = await loadQuotePaper(admin, approval.job_id as string, snapshot, {
    number: (approval.quote_number as number | null) ?? null,
    year: (approval.quote_year as number | null) ?? null,
    sentAt: approval.sent_at as string,
    validUntil: approval.expires_at as string,
  });
  if (!paper) notFound();

  const replaced = Boolean(newer);
  const closed = approval.status === 'decided' || expired || replaced;
  const { vatRegistered } = billingFrom(tenant.settings);
  const grossOf = (line: InvoiceLine) => round2(lineAmount(line) * (vatRegistered ? 1 + line.vat_rate / 100 : 1));
  let proposed = snapshot?.lines.filter((l) => l.approval === 'proposed') ?? [];
  if (!snapshot && !closed) {
    const { data: live } = await admin.from('job_lines').select('id, description, qty, unit').eq('job_id', approval.job_id).eq('approval', 'proposed');
    const ids = (live ?? []).map((l) => l.id as string);
    const { data: prices } = ids.length ? await admin.from('job_line_prices').select('job_line_id, unit_price, discount_pct, vat_rate').in('job_line_id', ids) : { data: [] };
    const priceOf = new Map((prices ?? []).map((p) => [p.job_line_id as string, p]));
    proposed = (live ?? []).map((l) => {
      const price = priceOf.get(l.id as string);
      return {
        id: l.id as string,
        description: l.description as string,
        qty: Number(l.qty),
        unit: l.unit as string,
        approval: 'proposed' as const,
        unit_price: Number(price?.unit_price ?? 0),
        discount_pct: Number(price?.discount_pct ?? 0),
        vat_rate: Number(price?.vat_rate ?? 25),
      };
    });
  }
  let changed = false;
  if (snapshot && !closed) {
    const { data: live } = await admin.from('job_lines').select('id').eq('job_id', approval.job_id as string).eq('approval', 'proposed');
    const liveKey = (live ?? []).map((l) => l.id as string).sort().join(',');
    const snapKey = proposed.map((l) => l.id).sort().join(',');
    changed = liveKey !== snapKey;
  }
  const formLines = proposed.map((l) => ({
    id: l.id,
    description: l.description,
    qty: Number(l.qty),
    unit: l.unit,
    priority: null as 'urgent' | 'recommended' | 'optional' | null,
    total: grossOf({ description: l.description, qty: l.qty, unit: l.unit, unit_price: l.unit_price, discount_pct: l.discount_pct, vat_rate: l.vat_rate }),
  }));
  const agreed = invoiceTotals(
    linesFromSnapshot({ complaint: null, diagnosis: null, lines: (snapshot?.lines ?? []).filter((l) => l.approval === 'approved') }),
    vatRegistered
  ).gross;

  return (
    <main className="mx-auto min-h-dvh max-w-[230mm] space-y-4 bg-neutral-100 px-4 py-6 pt-safe text-neutral-900 print:bg-white print:p-0">
      <div className="flex justify-end print:hidden">
        <PrintButton />
      </div>
      {closed ? (
        <p className="rounded-2xl bg-white px-5 py-3 text-sm text-neutral-600 shadow-sm print:hidden">
          {approval.status === 'decided'
            ? `Odluka je zaprimljena ${formatDateTime(approval.decided_at as string)}${approval.signer_name ? ` · ${approval.signer_name}` : ''}.`
            : replaced
              ? 'Ova je ponuda zamijenjena novijom. Za novu poveznicu javite se radionici.'
              : `Rok ponude je prošao. Nazovite ${tenant.phone ? tenant.phone : 'radionicu'}.`}
        </p>
      ) : null}
      <QuoteDocument data={paper} />
      {!closed && changed ? (
        <p className="rounded-2xl bg-white px-5 py-4 text-sm text-neutral-600 shadow-sm print:hidden">Ponuda je promijenjena nakon slanja. Tražite novu poveznicu od radionice.</p>
      ) : null}
      {!closed && !changed && formLines.length ? <ApprovalForm token={token} lines={formLines} alreadyApproved={agreed} /> : null}
      {!closed && !changed && !formLines.length && !paper.lines.length ? (
        <p className="rounded-2xl bg-white px-5 py-4 text-sm text-neutral-600 shadow-sm">Na ovoj ponudi nema stavki za odluku. Javite se radionici{tenant.phone ? ` na ${tenant.phone}` : ''}.</p>
      ) : null}
    </main>
  );
}
