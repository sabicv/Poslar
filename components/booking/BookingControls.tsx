'use client';

import { Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAction } from '@/components/client-ui';
import { Button, buttonClass } from '@/components/ui';
import { setBookingEnabled } from '@/lib/actions/settings';

// The owner's controls for "Rezerviraj termin": on and off, copy the link,
// send it on WhatsApp (for the status, a group or the automatic reply) and
// try it as a customer sees it.
export function BookingControls({ url, enabled, workshop }: { url: string; enabled: boolean; workshop: string }) {
  const { pending, run } = useAction();
  const share = `https://wa.me/?text=${encodeURIComponent(`Termin u radionici ${workshop} rezervirajte ovdje: ${url}`)}`;
  return (
    <div className="space-y-4">
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line px-4 py-2">
        <span>
          <span className="block font-medium">Rezervacije uključene</span>
          <span className="block text-xs text-muted">{enabled ? 'Mušterije same biraju slobodan termin.' : 'Poveznica pokazuje samo Vaš broj telefona.'}</span>
        </span>
        <input type="checkbox" className="size-6 accent-[rgb(var(--accent))]" checked={enabled} disabled={pending} onChange={(e) => run(() => setBookingEnabled(e.target.checked), { success: e.target.checked ? 'Rezervacije uključene' : 'Rezervacije isključene' })} />
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          variant="primary"
          onClick={() =>
            navigator.clipboard
              ?.writeText(url)
              .then(() => toast.success('Poveznica kopirana'))
              .catch(() => toast.error('Kopiranje nije uspjelo.'))
          }
        >
          <Copy className="size-4" /> Kopiraj poveznicu
        </Button>
        <a href={share} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
          <MessageCircle className="size-4" /> Pošalji na WhatsApp
        </a>
        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
          <ExternalLink className="size-4" /> Isprobaj
        </a>
      </div>
    </div>
  );
}
