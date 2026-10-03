'use client';

import { Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonClass } from '@/components/ui';
import { copyText } from '@/lib/clipboard';

// The owner's referral link: copy it or send it on WhatsApp in one tap.
export function ReferralShare({ link, workshop }: { link: string; workshop: string }) {
  const message = `Ja vodim radionicu u TaktiX aplikaciji: nalozi, slike i računi iz mobitela. Probaj 30 dana besplatno: ${link}\n\n${workshop}`;
  return (
    <div className="space-y-3">
      <p className="break-all rounded-xl border border-line bg-bg px-3 py-2 font-mono text-xs">{link}</p>
      <div className="flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'sm')}>
          <MessageCircle className="size-4" /> Pošalji na WhatsApp
        </a>
        <Button size="sm" onClick={() => copyText(link).then((ok) => (ok ? toast.success('Poveznica kopirana') : toast.error('Kopiranje nije uspjelo')))}>
          <Copy className="size-4" /> Kopiraj
        </Button>
      </div>
    </div>
  );
}
