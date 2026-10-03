'use client';

import { MessageCircle } from 'lucide-react';
import { useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { markReminder } from '@/lib/actions/reminders';
import { whatsappLink } from '@/lib/contact';

type Item = { group: 'season' | 'service' | 'plan' | 'compliance'; clientId: string | null; assetId: string | null; planId?: string; title: string };

// One tap opens WhatsApp with the message written out (the owner presses
// send there) and takes the customer off the list.
export function ReminderActions({ item, phone, message }: { item: Item; phone: string | null; message: string }) {
  const { pending, run } = useAction();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="primary"
        disabled={pending || !phone}
        onClick={() => {
          window.open(whatsappLink(phone, message), '_blank', 'noopener');
          run(() => markReminder(item, 'sent'), { success: 'Označeno poslano' });
        }}
      >
        <MessageCircle className="size-4" /> {phone ? 'WhatsApp' : 'Nema broja'}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => markReminder(item, 'cancelled'), { success: 'Maknuto s popisa' })}>
        Ne treba
      </Button>
    </div>
  );
}
