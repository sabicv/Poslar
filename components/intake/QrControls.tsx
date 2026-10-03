'use client';

import Link from 'next/link';
import { Copy, Printer, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmButton, useAction } from '@/components/client-ui';
import { Button, buttonClass } from '@/components/ui';
import { rotateIntakeToken, setIntakeEnabled } from '@/lib/actions/settings';

export function QrControls({ url, enabled }: { url: string; enabled: boolean }) {
  const { pending, run } = useAction();
  return (
    <div className="space-y-4">
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line px-4">
        <span>
          <span className="block font-medium">Samoprijem uključen</span>
          <span className="block text-xs text-muted">{enabled ? 'Mušterije mogu poslati prijavu.' : 'Kod pokazuje samo Vaš broj telefona.'}</span>
        </span>
        <input type="checkbox" className="size-6 accent-[rgb(var(--accent))]" checked={enabled} disabled={pending} onChange={(e) => run(() => setIntakeEnabled(e.target.checked), { success: e.target.checked ? 'Samoprijem uključen' : 'Samoprijem isključen' })} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Link href="/app/settings/qr/plakat" className={buttonClass('primary')}>
          <Printer className="size-4" /> Plakat za ispis
        </Link>
        <Button
          variant="secondary"
          onClick={() =>
            navigator.clipboard
              ?.writeText(url)
              .then(() => toast.success('Poveznica kopirana'))
              .catch(() => toast.error('Kopiranje nije uspjelo.'))
          }
        >
          <Copy className="size-4" /> Kopiraj poveznicu
        </Button>
        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass('ghost')}>
          Isprobaj
        </a>
      </div>
      <div className="border-t border-line pt-3">
        <ConfirmButton variant="ghost" confirmLabel="Da, napravi novi kod" onConfirm={() => run(() => rotateIntakeToken(), { success: 'Novi kod je spreman. Ispišite novi plakat.' })}>
          <RefreshCw className="size-4" /> Novi kod
        </ConfirmButton>
        <p className="mt-1 text-xs text-faint">Ako netko zloupotrebljava kod: stari plakati prestaju raditi, ispisuje se novi.</p>
      </div>
    </div>
  );
}

export function PrintButton() {
  return (
    <Button variant="primary" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" /> Ispiši
    </Button>
  );
}
