'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, FileCheck2, FileCode2, MessageCircle, Printer, RotateCcw, Undo2 } from 'lucide-react';
import { ConfirmButton, Segmented, useAction } from '@/components/client-ui';
import { INVOICE_STATUS_LABELS, PAYMENT_METHODS, type InvoiceStatus, type PaymentMethod } from '@/components/invoice/InvoiceDocument';
import { Badge, Button, Field, Input, buttonClass } from '@/components/ui';
import { issueInvoice, markInvoiceSent, rejectInvoice, resendInvoice, setInvoiceFiscalRef, voidInvoice } from '@/lib/actions/invoice';
import { copyText } from '@/lib/clipboard';
import { vocativeHR } from '@/lib/format';
import { whatsappLink } from '@/lib/contact';

const STATUS_TONE: Record<InvoiceStatus, 'neutral' | 'accent' | 'ok' | 'warn' | 'crit' | 'muted'> = {
  draft: 'muted',
  issued: 'accent',
  sent: 'ok',
  fiscalized: 'ok',
  rejected: 'warn',
  voided: 'crit',
};

export function InvoiceActions({
  jobId,
  issued,
  status,
  title,
  link,
  workshopName,
  clientPhone,
  clientFirstName,
  fiscalRef,
  empty,
  sample = false,
  defaultMethod = 'cash',
}: {
  jobId: string;
  issued: boolean;
  status: InvoiceStatus;
  title: string;
  link: string;
  workshopName: string;
  clientPhone: string | null;
  clientFirstName: string | null;
  fiscalRef: string | null;
  empty: boolean;
  sample?: boolean;
  defaultMethod?: PaymentMethod;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [ref, setRef] = useState(fiscalRef ?? '');
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod);
  const greeting = clientFirstName ? `Poštovani ${vocativeHR(clientFirstName)}, ` : 'Poštovani, ';
  const message = `${greeting}šaljemo ${title.toLowerCase()}: ${link}\n\n${workshopName}`;
  const refresh = { onDone: () => router.refresh() };

  // The sample job must not use up a real invoice number.
  if (!issued && sample) {
    return (
      <p className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
        Ovo je primjer naloga. Ovako izgleda račun. Broj računa dobiva tek pravi nalog.
      </p>
    );
  }

  if (!issued) {
    return (
      <div className="space-y-3">
        <Badge tone={STATUS_TONE.draft}>{INVOICE_STATUS_LABELS.draft}</Badge>
        <div>
          <p className="mb-1.5 text-sm font-medium">Kako mušterija plaća?</p>
          <Segmented
            value={method}
            onChange={setMethod}
            options={(['cash', 'card', 'transfer'] as PaymentMethod[]).map((m) => ({ value: m, label: m === 'transfer' ? 'Na račun' : PAYMENT_METHODS[m] }))}
          />
        </div>
        <Button variant="primary" size="lg" className="w-full sm:w-auto" disabled={pending || empty} onClick={() => run(() => issueInvoice(jobId, method), { success: 'Račun izdan', ...refresh })}>
          <FileCheck2 className="size-5" /> Izdaj račun
        </Button>
        <p className="text-xs text-muted">{empty ? 'Na nalogu nema stavki za naplatu.' : 'Račun dobiva sljedeći broj. Stavke se mogu mijenjati i nakon izdavanja.'}</p>
      </div>
    );
  }

  function markSent() {
    run(() => markInvoiceSent(jobId), { quiet: true, ...refresh });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>
        {status === 'rejected' ? <p className="text-sm text-warn">Broj ostaje. Pošaljite isti račun ponovo u blagajnu.</p> : null}
        {status === 'voided' ? <p className="text-sm text-muted">Broj je iskorišten. Novi račun ide na novi nalog.</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="size-4" /> Ispiši / PDF
        </Button>
        {status !== 'voided' && clientPhone ? (
          <a
            href={whatsappLink(clientPhone, message)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass('secondary')}
            onClick={markSent}
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        ) : null}
        {status !== 'voided' ? (
          <Button
            onClick={() =>
              copyText(link).then((ok) => {
                if (!ok) return toast.error('Kopiranje nije uspjelo');
                toast.success('Poveznica kopirana');
                markSent();
              })
            }
          >
            <Copy className="size-4" /> Kopiraj poveznicu
          </Button>
        ) : null}
        <a href={`/app/jobs/${jobId}/racun/xml`} download className={buttonClass('secondary')}>
          <FileCode2 className="size-4" /> e-Račun (XML)
        </a>
      </div>
      {status !== 'voided' ? (
        <Field label="Broj fiskalnog računa iz blagajne (nije obavezno)">
          <Input
            value={ref}
            maxLength={80}
            onChange={(e) => setRef(e.target.value)}
            onBlur={() => ref !== (fiscalRef ?? '') && run(() => setInvoiceFiscalRef(jobId, ref), { quiet: true, ...refresh })}
            placeholder="npr. 123/1/1"
          />
        </Field>
      ) : null}
      {status !== 'voided' ? (
        <div className="flex flex-wrap gap-2">
          {status === 'rejected' ? (
            <Button disabled={pending} onClick={() => run(() => resendInvoice(jobId), { success: 'Isti broj, spreman za blagajnu', ...refresh })}>
              <RotateCcw className="size-4" /> Pošalji ponovo
            </Button>
          ) : (
            <Button variant="ghost" disabled={pending} onClick={() => run(() => rejectInvoice(jobId), { success: 'Označeno: blagajna odbila', ...refresh })}>
              Blagajna odbila
            </Button>
          )}
          <ConfirmButton disabled={pending} confirmLabel="Stornirati ovaj broj?" onConfirm={() => run(() => voidInvoice(jobId), { success: 'Račun storniran', ...refresh })}>
            <Undo2 className="size-4" /> Storno
          </ConfirmButton>
        </div>
      ) : null}
    </div>
  );
}
