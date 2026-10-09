'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, ListChecks, Lock, LockOpen, Wallet } from 'lucide-react';
import { DeleteConfirm, Sheet, useAction } from '@/components/client-ui';
import { CopilotDrawer } from '@/components/copilot/CopilotDrawer';
import { Button } from '@/components/ui';
import type { JobPhase } from '@/config/tenant.config';
import { deleteJob, setJobLocked, setJobPaid, setJobPhase } from '@/lib/actions/jobs';
import { cn } from '@/lib/utils';

// The job's bar at the bottom of the screen, where the thumb is:
// "Stanje" (every phase, payment, lock, delete) on the left, one big button
// for the next step in the middle, and "Pitaj Poslara" on the right.
function nextActionLabel(id: JobPhase, label: string, field: boolean): string {
  if (id === 'ready') return label === 'Gotovo' ? 'Gotovo je' : label;
  if (id === 'collected') {
    if (label === 'Preuzeto') return field ? 'Zatvoreno' : 'Mušterija preuzela';
    return label;
  }
  if (id === 'diagnosis' && label === 'Dijagnostika') return 'Na dijagnostiku';
  if (id === 'in_progress' && label === 'Popravak u tijeku') return 'U rad';
  if (id === 'quality_check' && label === 'Kontrola') return 'Na kontrolu';
  if (id === 'awaiting_approval' && label === 'Čeka odobrenje') return 'Na odobrenje';
  if (id === 'awaiting_parts' && label === 'Čeka dijelove') return 'Čeka dijelove';
  return label;
}

export function JobActionBar({
  jobId,
  phase,
  phases,
  isOwner,
  paid,
  locked,
  billing = true,
  field = false,
  copilot,
}: {
  jobId: string;
  phase: JobPhase;
  phases: { id: JobPhase; label: string }[];
  isOwner: boolean;
  paid: boolean;
  locked: boolean;
  // False when the job is the business's own cost (Deal): nothing to collect.
  billing?: boolean;
  field?: boolean;
  copilot: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction();
  const index = phases.findIndex((p) => p.id === phase);
  // "Next" skips the waiting states: they are chosen on purpose, not stepped into.
  const next = phases.slice(index + 1).find((p) => p.id !== 'awaiting_approval' && p.id !== 'awaiting_parts');
  const nextLabel = next ? nextActionLabel(next.id, next.label, field) : null;
  // Collected but not paid: the owner's next step is the money.
  const markPaid = !next && billing && isOwner && !paid && phase === 'collected';
  const iconButton = 'flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-line bg-surface2 text-[11px] font-medium text-muted hover:text-fg';

  return (
    <div className="hide-on-type fixed inset-x-0 bottom-16 z-20 border-t border-line bg-bg/95 backdrop-blur-md lg:bottom-0 lg:left-60">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <Sheet
          open={open}
          onOpenChange={setOpen}
          title="Stanje naloga"
          trigger={
            <button type="button" className={iconButton} aria-label={`Stanje naloga: ${phases[index]?.label ?? ''}`}>
              <ListChecks className="size-5" />
              Stanje
            </button>
          }
        >
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
              {billing ? (
                <Button
                  size="lg"
                  variant={paid ? 'ok' : 'secondary'}
                  disabled={pending}
                  onClick={() => run(() => setJobPaid(jobId, !paid), { success: paid ? 'Vraćeno na „Za naplatu”' : 'Označeno plaćeno' })}
                  className="justify-start"
                >
                  <Wallet className="size-5" /> {paid ? 'Plaćeno. Vrati na „Za naplatu”' : 'Označi plaćeno'}
                </Button>
              ) : null}
              <Button
                size="lg"
                variant={locked ? 'danger' : 'secondary'}
                disabled={pending}
                onClick={() => run(() => setJobLocked(jobId, !locked), { success: locked ? 'Nalog otključan' : 'Nalog zaključan' })}
                className="justify-start"
              >
                {locked ? <LockOpen className="size-5" /> : <Lock className="size-5" />} {locked ? 'Otključaj nalog' : 'Zaključaj nalog'}
              </Button>
              <DeleteConfirm
                label="Obriši nalog"
                question="Obrisati ovaj nalog?"
                detail="Brišu se i stavke, slike i poruke naloga. To se ne može vratiti. Nalog s izdanim računom se ne briše."
                disabled={pending}
                onConfirm={() => run(() => deleteJob(jobId), { success: 'Nalog obrisan', onDone: () => router.replace('/app') })}
              />
            </div>
          ) : null}
        </Sheet>

        {next && nextLabel ? (
          <Button size="lg" variant="primary" disabled={pending} onClick={() => run(() => setJobPhase(jobId, next.id))} className="min-w-0 flex-1 gap-1 whitespace-normal px-3 text-base">
            <span className="text-center leading-tight">{nextLabel}</span>
            <ChevronRight className="size-5 shrink-0" />
          </Button>
        ) : markPaid ? (
          <Button size="lg" variant="primary" disabled={pending} onClick={() => run(() => setJobPaid(jobId, true), { success: 'Označeno plaćeno' })} className="min-w-0 flex-1 gap-2 whitespace-normal px-3 text-base">
            <Wallet className="size-5 shrink-0" /> Označi plaćeno
          </Button>
        ) : (
          <p className="min-w-0 flex-1 px-2 text-center text-sm text-muted">{phases[index]?.label}</p>
        )}

        <CopilotDrawer jobId={jobId} enabled={copilot} triggerClassName={iconButton} />
      </div>
    </div>
  );
}
