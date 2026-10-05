'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil } from 'lucide-react';
import { useAction } from '@/components/client-ui';
import { Button, Input } from '@/components/ui';
import { setInvoiceFiscalRef } from '@/lib/actions/invoice';

// The till's receipt number beside one invoice: typed once, saved with one
// tap (or Enter), then shown as done.
export function FiscalRef({ jobId, value }: { jobId: string; value: string | null }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(!value);
  const [ref, setRef] = useState(value ?? '');
  // Shown the moment it is saved, not only once the page re-fetches — the
  // save is instant, but a refresh can lag a beat behind it.
  const [saved, setSaved] = useState(value);

  if (!editing && saved) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-ok/40 bg-ok/10 px-3 py-2 text-sm">
        <Check className="size-4 shrink-0 text-ok" />
        <span className="flex-1">
          U blagajni: <span className="font-medium tabular">{saved}</span>
        </span>
        <button type="button" onClick={() => setEditing(true)} aria-label="Promijeni broj iz blagajne" className="flex size-9 items-center justify-center rounded-lg text-muted hover:text-fg">
          <Pencil className="size-4" />
        </button>
      </div>
    );
  }
  const save = () =>
    run(() => setInvoiceFiscalRef(jobId, ref), {
      onDone: () => {
        setSaved(ref);
        setEditing(false);
        router.refresh();
      },
    });
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (ref.trim()) save();
      }}
    >
      <Input value={ref} maxLength={80} onChange={(e) => setRef(e.target.value)} placeholder="Broj iz blagajne, npr. 123/1/1" aria-label="Broj fiskalnog računa iz blagajne" />
      <Button type="submit" variant="primary" disabled={pending || !ref.trim()} className="shrink-0">
        <Check className="size-4" /> Upisano
      </Button>
    </form>
  );
}
