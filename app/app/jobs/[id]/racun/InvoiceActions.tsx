'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, FileCheck2, FileCode2, MessageCircle, Printer } from 'lucide-react';
import { Segmented, useAction } from '@/components/client-ui';
import { PAYMENT_METHODS, type PaymentMethod } from '@/components/invoice/InvoiceDocument';
import { Button, Field, Input, buttonClass } from '@/components/ui';
import { issueInvoice, setInvoiceFiscalRef } from '@/lib/actions/invoice';
import { copyText } from '@/lib/clipboard';
import { vocativeHR } from '@/lib/format';
import { whatsappLink } from '@/lib/contact';

export function InvoiceActions({
  jobId,
  issued,
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
        <div>
          <p className="mb-1.5 text-sm font-medium">Kako mušterija plaća?</p>
          <Segmented
            value={method}
            onChange={setMethod}
            options={(['cash', 'card', 'transfer'] as PaymentMethod[]).map((m) => ({ value: m, label: m === 'transfer' ? 'Na račun' : PAYMENT_METHODS[m] }))}
          />
        </div>
        <Button variant="primary" size="lg" className="w-full sm:w-auto" disabled={pending || empty} onClick={() => run(() => issueInvoice(jobId, method), { success: 'Račun izdan', onDone: () => router.refresh() })}>
          <FileCheck2 className="size-5" /> Izdaj račun
        </Button>
        <p className="text-xs text-muted">{empty ? 'Na nalogu nema stavki za naplatu.' : 'Račun dobiva sljedeći broj. Stavke se mogu mijenjati i nakon izdavanja.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="size-4" /> Ispiši / PDF
        </Button>
        {clientPhone ? (
          <a href={whatsappLink(clientPhone, message)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        ) : null}
        <Button onClick={() => copyText(link).then((ok) => (ok ? toast.success('Poveznica kopirana') : toast.error('Kopiranje nije uspjelo')))}>
          <Copy className="size-4" /> Kopiraj poveznicu
        </Button>
        <a href={`/app/jobs/${jobId}/racun/xml`} download className={buttonClass('secondary')}>
          <FileCode2 className="size-4" /> e-Račun (XML)
        </a>
      </div>
      <Field label="Broj fiskalnog računa iz blagajne (nije obavezno)">
        <Input
          value={ref}
          maxLength={80}
          onChange={(e) => setRef(e.target.value)}
          onBlur={() => ref !== (fiscalRef ?? '') && run(() => setInvoiceFiscalRef(jobId, ref), { quiet: true, onDone: () => router.refresh() })}
          placeholder="npr. 123/1/1"
        />
      </Field>
    </div>
  );
}
