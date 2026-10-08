'use client';

import { CheckCheck, MessageCircle } from 'lucide-react';
import { useAction } from '@/components/client-ui';
import { Button, buttonClass } from '@/components/ui';
import { confirmAppointment } from '@/lib/actions/whatsapp';

// "Potvrdi termin na WhatsApp". With the Poslar number connected the
// message goes by itself; otherwise the owner's WhatsApp opens with the
// text ready. Once sent, the time it went is shown and it can go again.
export function ConfirmAppointment({ jobId, auto, link, sentAt }: { jobId: string; auto: boolean; link: string; sentAt: string | null }) {
  const { pending, run } = useAction();
  const when = sentAt ? new Date(sentAt).toLocaleString('hr-HR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zagreb' }) : null;
  return (
    <div className="space-y-2">
      {auto ? (
        <Button variant={when ? 'secondary' : 'primary'} disabled={pending} onClick={() => run(() => confirmAppointment(jobId), { success: 'Potvrda poslana mušteriji' })}>
          <MessageCircle className="size-4" /> {when ? 'Pošalji potvrdu ponovno' : 'Potvrdi termin na WhatsApp'}
        </Button>
      ) : (
        <a href={link} target="_blank" rel="noopener noreferrer" className={buttonClass('primary')}>
          <MessageCircle className="size-4" /> Potvrdi termin na WhatsApp
        </a>
      )}
      {when ? (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <CheckCheck className="size-4 text-accent" /> Potvrda poslana {when}
        </p>
      ) : null}
    </div>
  );
}
