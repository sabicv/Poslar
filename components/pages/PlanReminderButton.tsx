'use client';

import { MessageCircle } from 'lucide-react';
import { useAction } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { markPlanReminded } from '@/lib/actions/field';
import { whatsappLink } from '@/lib/contact';

// Opens WhatsApp with the reminder written out; the owner just presses send.
export function PlanReminderButton({ planId, phone, message }: { planId: string; phone: string | null; message: string }) {
  const { pending, run } = useAction();
  return (
    <Button
      size="sm"
      disabled={pending || !phone}
      onClick={() => {
        window.open(whatsappLink(phone, message), '_blank', 'noopener');
        run(() => markPlanReminded(planId));
      }}
    >
      <MessageCircle className="size-4" /> {phone ? 'Podsjetnik' : 'Nema broja'}
    </Button>
  );
}
