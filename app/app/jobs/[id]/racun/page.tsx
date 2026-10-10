import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HelpVideo } from '@/components/help/HelpVideo';
import { JobDossier } from '@/components/job/JobDossier';
import { InvoiceDocument, invoiceNumberLabel } from '@/components/invoice/InvoiceDocument';
import { BackLink } from '@/components/ui';
import { loadDossier } from '@/lib/dossier';
import { loadInvoice } from '@/lib/invoice';
import { publicAppUrl } from '@/lib/qr';
import { requireOwner } from '@/lib/session';
import { InvoiceActions } from './InvoiceActions';

export const metadata: Metadata = { title: 'Račun' };

// The owner turns a job into an invoice: issue (number), print or save as
// PDF, send the customer a link. The fiscal receipt itself comes from the
// workshop's own till; its number can be written here.
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [invoice, dossier] = await Promise.all([loadInvoice(ctx.supabase, { id }), loadDossier(ctx.supabase, id)]);
  if (!invoice) notFound();

  const appUrl = publicAppUrl();
  const title = invoice.number ? `Račun br. ${invoiceNumberLabel(invoice)}` : 'Račun';
  const missingPrices = invoice.lines.some((l) => !l.unit_price);

  return (
    <div className="space-y-5 pb-10">
      <div className="space-y-4 print:hidden">
        <div className="flex items-center justify-between gap-3">
          <BackLink href={`/app/jobs/${id}?tab=stavke`}>Nalog #{invoice.jobNumber}</BackLink>
          <HelpVideo topic="invoice" />
        </div>
        <InvoiceActions
          jobId={id}
          issued={invoice.number !== null}
          status={invoice.status}
          title={title}
          link={`${appUrl}/racun/${invoice.token}`}
          workshopName={invoice.workshop.name}
          clientPhone={invoice.clientPhone}
          clientFirstName={invoice.clientFirstName}
          fiscalRef={invoice.fiscalRef}
          empty={invoice.lines.length === 0}
          sample={invoice.sample}
          // A company usually pays to the account, a person in cash or by card.
          defaultMethod={invoice.client?.kind === 'company' ? 'transfer' : 'cash'}
        />
        {missingPrices ? <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">Neke stavke nemaju cijenu. Upišite je u kartici Radovi i cijena.</p> : null}
        {!invoice.billing.iban || !invoice.workshop.oib ? (
          <p className="text-xs text-muted">OIB i IBAN obrta upisuju se u Postavke → Radionica; tada se sami pojave na računu.</p>
        ) : null}
        <p className="text-xs text-muted">
          Ispis uključuje zapisnik naloga na sljedećoj stranici.{' '}
          <a href={`/app/jobs/${id}/zapisnik`} className="text-accent">
            Otvori zapisnik
          </a>
        </p>
      </div>
      <InvoiceDocument data={invoice} />
      {dossier ? (
        <div className="print:break-before-page" style={{ breakBefore: 'page' }}>
          <JobDossier data={dossier} />
        </div>
      ) : null}
    </div>
  );
}
