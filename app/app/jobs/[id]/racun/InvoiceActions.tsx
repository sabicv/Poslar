'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, FileCheck2, MessageCircle, Printer } from 'lucide-react';
import { useAction } from '@/components/client-ui';
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
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [ref, setRef] = useState(fiscalRef ?? '');
  const greeting = clientFirstName ? `Poštovani ${vocativeHR(clientFirstName)}, ` : 'Poštovani, ';
  const message = `${greeting}šaljemo ${title.toLowerCase()}: ${link} — ${workshopName}`;

  if (!issued) {
    return (
      <div className="space-y-2">
        <Button variant="primary" size="lg" className="w-full sm:w-auto" disabled={pending || empty} onClick={() => run(() => issueInvoice(jobId), { success: 'Račun izdan', onDone: () => router.refresh() })}>
          <FileCheck2 className="size-5" /> Izdaj račun
        </Button>
        <p className="text-xs text-muted">{empty ? 'Na nalogu nema stavki za naplatu.' : 'Račun dobiva sljedeći broj za ovu godinu. Stavke se mogu mijenjati i nakon izdavanja.'}</p>
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
