'use client';

import { toast } from 'sonner';
import { useAction } from '@/components/client-ui';
import { sendTestSummary, setDailyEmail } from '@/lib/actions/settings';

// Dnevni sažetak: on and off, and a test send to the owner's own address.
export function DailySummaryControls({ enabled }: { enabled: boolean }) {
  const { pending, run } = useAction();
  return (
    <div className="px-4 py-3">
      <label className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">Dnevni sažetak</span>
          <span className="mt-0.5 block text-xs text-muted">Svaku večer na e-mail: nalozi, promet i sutrašnji termini.</span>
        </span>
        <input
          type="checkbox"
          className="size-5 shrink-0 accent-[rgb(var(--accent))]"
          checked={enabled}
          disabled={pending}
          onChange={(e) => run(() => setDailyEmail(e.target.checked), { success: e.target.checked ? 'Sažetak uključen' : 'Sažetak isključen' })}
        />
      </label>
      {enabled ? (
        <button
          type="button"
          disabled={pending}
          className="mt-2 text-xs font-medium text-accent hover:underline disabled:opacity-50"
          onClick={() => run(() => sendTestSummary(), { onDone: (d) => toast.success(`Poslano na ${d?.to ?? 'Vaš e-mail'}`) })}
        >
          Pošalji današnji sada
        </button>
      ) : null}
    </div>
  );
}
