'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, Lock, LockOpen, Wallet } from 'lucide-react';
import { ConfirmButton, Sheet, useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import type { JobPhase } from '@/config/tenant.config';
import { deleteJob, setJobLocked, setJobPaid, setJobPhase } from '@/lib/actions/jobs';
import { cn } from '@/lib/utils';

export function JobActionBar({
  jobId,
  phase,
  phases,
  isOwner,
  paid,
  locked,
}: {
  jobId: string;
  phase: JobPhase;
  phases: { id: JobPhase; label: string }[];
  isOwner: boolean;
  paid: boolean;
  locked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction();
  const index = phases.findIndex((p) => p.id === phase);
  // "Next" skips the waiting states — they are chosen on purpose, not stepped into.
  const next = phases.slice(index + 1).find((p) => p.id !== 'awaiting_approval' && p.id !== 'awaiting_parts');

  return (
    <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-bg/90 backdrop-blur-md lg:bottom-0 lg:left-60">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <Sheet
          open={open}
          onOpenChange={setOpen}
          title="Nalog"
          trigger={
            <Button size="lg" className="min-w-0 flex-1 justify-between gap-1 whitespace-normal px-3 text-sm sm:flex-none sm:justify-center sm:px-5">
              <span className="line-clamp-2 text-left leading-tight">{phases[index]?.label}</span>
              <ChevronRight className="size-4 shrink-0 rotate-90 text-faint" />
            </Button>
          }
        >
          <p className="mb-2 text-xs font-medium text-muted">Faza</p>
          <div className="grid gap-2">
            {phases.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={pending}
                onClick={() => run(() => setJobPhase(jobId, p.id), { onDone: () => setOpen(false) })}
                className={cn(
                  'flex h-14 items-center justify-between rounded-xl border px-4 text-left text-base',
                  p.id === phase ? 'border-accent bg-accent/10 font-medium' : 'border-line hover:bg-surface2'
                )}
              >
                {p.label}
                {p.id === phase ? <Check className="size-5 text-accent" /> : null}
              </button>
            ))}
          </div>
          {isOwner ? (
            <div className="mt-6 grid gap-2 border-t border-line pt-4">
              {/* Payment and lock live here, not as extra icons on the bar:
                  the bar keeps two big buttons with full phase names. */}
              <Button
                size="lg"
                variant={paid ? 'ok' : 'secondary'}
                disabled={pending}
                onClick={() => run(() => setJobPaid(jobId, !paid), { success: paid ? 'Vraćeno na „Za naplatu”' : 'Označeno plaćeno' })}
                className="justify-start"
              >
                <Wallet className="size-5" /> {paid ? 'Plaćeno — vrati na „Za naplatu”' : 'Označi plaćeno'}
              </Button>
              <Button
                size="lg"
                variant={locked ? 'danger' : 'secondary'}
                disabled={pending}
                onClick={() => run(() => setJobLocked(jobId, !locked), { success: locked ? 'Nalog otključan' : 'Nalog zaključan' })}
                className="justify-start"
              >
                {locked ? <LockOpen className="size-5" /> : <Lock className="size-5" />} {locked ? 'Otključaj nalog' : 'Zaključaj nalog'}
              </Button>
              <ConfirmButton size="lg" confirmLabel="Da, obriši nalog trajno" onConfirm={() => run(() => deleteJob(jobId), { success: 'Nalog obrisan', onDone: () => router.replace('/app') })}>
                Obriši nalog
              </ConfirmButton>
            </div>
          ) : null}
        </Sheet>

        {next ? (
          <Button
            size="lg"
            variant="primary"
            disabled={pending}
            onClick={() => run(() => setJobPhase(jobId, next.id))}
            className="min-w-0 flex-1 gap-1 whitespace-normal px-3 text-sm sm:flex-none sm:px-5"
          >
            <span className="line-clamp-2 text-center leading-tight">{next.label}</span>
            <ChevronRight className="size-4 shrink-0" />
          </Button>
        ) : null}

      </div>
    </div>
  );
}
