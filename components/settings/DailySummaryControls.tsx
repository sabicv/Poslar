'use client';

import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { sendTestSummary, setDailyEmail } from '@/lib/actions/settings';

// Dnevni sažetak: on and off, and a test send to the owner's own address.
export function DailySummaryControls({ enabled }: { enabled: boolean }) {
  const { pending, run } = useAction();
  return (
    <div className="space-y-3 p-4">
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line px-4 py-2">
        <span>
          <span className="block font-medium">Sažetak svaku večer</span>
          <span className="block text-xs text-muted">Novi nalozi, promet, pozivi Poslara i sutrašnji termini. Mirni dani bez e-maila.</span>
        </span>
        <input
          type="checkbox"
          className="size-6 shrink-0 accent-[rgb(var(--accent))]"
          checked={enabled}
          disabled={pending}
          onChange={(e) => run(() => setDailyEmail(e.target.checked), { success: e.target.checked ? 'Sažetak uključen' : 'Sažetak isključen' })}
        />
      </label>
      <Button variant="secondary" disabled={pending} onClick={() => run(() => sendTestSummary(), { onDone: (d) => toast.success(`Poslano na ${d?.to ?? 'Vaš e-mail'}`) })}>
        <Mail className="size-4" /> Pošalji današnji sada
      </Button>
    </div>
  );
}
