import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InvoiceDocument } from '@/components/invoice/InvoiceDocument';
import { loadInvoice } from '@/lib/invoice';
import { createAdminClient } from '@/lib/supabase/admin';
import { PrintButton } from './PrintButton';

export const metadata: Metadata = { title: 'Račun', robots: { index: false, follow: false } };

// The customer's copy, without signing in. Only an issued invoice opens;
// the link is a random token that belongs to this one job.
export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const invoice = await loadInvoice(createAdminClient(), { token });
  if (!invoice || invoice.number === null) notFound();

  return (
    <main className="mx-auto min-h-dvh max-w-[230mm] space-y-4 bg-neutral-100 px-4 py-6 pt-safe text-neutral-900 print:bg-white print:p-0">
      <div className="flex justify-end print:hidden">
        <PrintButton />
      </div>
      <InvoiceDocument data={invoice} />
    </main>
  );
}
