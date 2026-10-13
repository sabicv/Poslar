'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarClock, Check, ChevronRight, Copy, Link2, ListChecks, Lock, LockOpen, MessageCircle, Send, Wallet } from 'lucide-react';
import { ConfirmButton, DeleteConfirm, Sheet, useAction } from '@/components/client-ui';
import { CopilotDrawer } from '@/components/copilot/CopilotDrawer';
import { Button, buttonClass } from '@/components/ui';
import type { JobPhase } from '@/config/tenant.config';
import { createApproval, deleteJob, setJobLocked, setJobPaid, setJobPhase } from '@/lib/actions/jobs';
import { copyText } from '@/lib/clipboard';
import { whatsappLink } from '@/lib/contact';
import { cn } from '@/lib/utils';

// The job's bar at the bottom of the screen, where the thumb is:
// "Stanje" on the left, one big button for the real next step, "Pitaj Poslara" on the right.
// The phone's bottom menu is hidden on this page, so the bar sits on the screen edge.
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
  scheduled = true,
  proposedCount = 0,
  quoteOut = null,
  clientPhone = null,
  appUrl = '',
  copilot,
}: {
  jobId: string;
  phase: JobPhase;
  phases: { id: JobPhase; label: string }[];
  isOwner: boolean;
  paid: boolean;
  locked: boolean;
  billing?: boolean;
  field?: boolean;
  scheduled?: boolean;
  // Proposed lines waiting to become a quote. The bar sends the link; it does not pretend it was already delivered.
  proposedCount?: number;
  quoteOut?: { href: string; label: string } | null;
  clientPhone?: string | null;
  appUrl?: string;
  copilot: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const { pending, run } = useAction();
  const index = phases.findIndex((p) => p.id === phase);
  // Waiting states are chosen on purpose from Stanje, not stepped into.
  const next = phases.slice(index + 1).find((p) => p.id !== 'awaiting_approval' && p.id !== 'awaiting_parts');
  const nextLabel = next ? nextActionLabel(next.id, next.label, field) : null;
  const markPaid = !next && billing && isOwner && !paid && phase === 'collected';
  const needsSchedule = field && !scheduled && next?.id === 'diagnosis';
  const sendQuote = isOwner && billing && proposedCount > 0 && !quoteOut;
  const iconButton = 'flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-line bg-surface2 text-xs font-medium text-muted hover:text-fg';
  const primary = 'min-w-0 flex-1 gap-1 whitespace-normal px-3 text-base';

  function pickPhase(id: JobPhase) {
    if (id === 'collected' && phase !== 'collected' && !confirmClose) {
      setConfirmClose(true);
      return;
    }
    setConfirmClose(false);
    run(() => setJobPhase(jobId, id), { onDone: () => setOpen(false) });
  }

  function send() {
    run(() => createApproval(jobId), {
      success: 'Poveznica je spremna',
      onDone: (data) => {
        if (!data?.token) return;
        const origin = appUrl || window.location.origin;
        setLink(`${origin}/approve/${data.token}`);
      },
    });
  }

  let action: ReactNode;
  if (quoteOut) {
    action = (
      <Link href={quoteOut.href} className={buttonClass('primary', 'lg', primary)}>
        <span className="text-center leading-tight">{quoteOut.label}</span>
        <ChevronRight className="size-5 shrink-0" />
      </Link>
    );
  } else if (needsSchedule) {
    action = (
      <Link
        href={`/app/jobs/${jobId}#termin`}
        className={buttonClass('primary', 'lg', primary)}
        onClick={(event) => {
          const card = document.getElementById('termin');
          if (!card) return;
          event.preventDefault();
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        <CalendarClock className="size-5 shrink-0" /> Zakaži termin
      </Link>
    );
  } else if (sendQuote) {
    action = (
      <Button size="lg" variant="primary" disabled={pending} onClick={send} className={primary}>
        <Send className="size-5 shrink-0" />
        <span className="text-center leading-tight">Pošalji ponudu ({proposedCount})</span>
      </Button>
    );
  } else if (next && nextLabel && next.id === 'collected') {
    action = (
      <ConfirmButton size="lg" variant="primary" disabled={pending} confirmLabel="Da, zatvori nalog" onConfirm={() => run(() => setJobPhase(jobId, next.id))} className={primary}>
        <span className="text-center leading-tight">{nextLabel}</span>
        <ChevronRight className="size-5 shrink-0" />
      </ConfirmButton>
    );
  } else if (next && nextLabel) {
    action = (
      <Button size="lg" variant="primary" disabled={pending} onClick={() => run(() => setJobPhase(jobId, next.id))} className={primary}>
        <span className="text-center leading-tight">{nextLabel}</span>
        <ChevronRight className="size-5 shrink-0" />
      </Button>
    );
  } else if (markPaid) {
    action = (
      <Button size="lg" variant="primary" disabled={pending} onClick={() => run(() => setJobPaid(jobId, true), { success: 'Označeno plaćeno' })} className={cn(primary, 'gap-2')}>
        <Wallet className="size-5 shrink-0" /> Označi plaćeno
      </Button>
    );
  } else {
    action = <p className="min-w-0 flex-1 px-2 text-center text-sm text-muted">{phases[index]?.label}</p>;
  }

  const quoteMessage = link ? `Poštovani, šaljemo Vam ponudu: ${link}` : '';

  return (
    <div className="hide-on-type fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 pb-safe backdrop-blur-md lg:left-60">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <Sheet
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) setConfirmClose(false);
          }}
          title="Stanje naloga"
          trigger={
            <button type="button" className={iconButton} aria-label={`Stanje naloga: ${phases[index]?.label ?? ''}`}>
              <ListChecks className="size-5" />
              Stanje
            </button>
          }
        >
          <div className="grid gap-2">
            {phases.map((p) => {
              const closing = confirmClose && p.id === 'collected' && phase !== 'collected';
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={pending}
                  onClick={() => pickPhase(p.id)}
                  className={cn(
                    'flex h-14 items-center justify-between rounded-xl border px-4 text-left text-base',
                    closing ? 'border-crit bg-crit/10 font-medium' : p.id === phase ? 'border-accent bg-accent/10 font-medium' : 'border-line hover:bg-surface2'
                  )}
                >
                  {closing ? 'Da, zatvori nalog' : p.label}
                  {p.id === phase ? <Check className="size-5 text-accent" /> : null}
                </button>
              );
            })}
          </div>
          {confirmClose ? <p className="mt-2 text-sm text-muted">Zatvaranje se ne može slučajno. Dodirnite još jednom.</p> : null}
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

        {action}

        <CopilotDrawer jobId={jobId} enabled={copilot} triggerClassName={iconButton} />
      </div>

      <Sheet open={Boolean(link)} onOpenChange={(nextOpen) => !nextOpen && setLink(null)} title="Poveznica za ponudu">
        <p className="text-sm text-muted">Ponuda još nije kod mušterije. Pošaljite joj ovu poveznicu.</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-sm">
          <Link2 className="size-4 shrink-0 text-accent" />
          <span className="truncate font-mono text-xs">{link}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() => copyText(link ?? '').then((ok) => (ok ? toast.success('Poveznica kopirana') : toast.error('Kopiranje nije uspjelo. Označite poveznicu i kopirajte.')))}
          >
            <Copy className="size-4" /> Kopiraj
          </Button>
          {clientPhone ? (
            <a href={whatsappLink(clientPhone, quoteMessage)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
