'use client';

import { useState } from 'react';
import { DictateButton, useAction } from '@/components/client-ui';
import { Button, Textarea } from '@/components/ui';
import { adminReplyTicket, adminSetTicketStatus } from '@/lib/actions/support';

export function AdminReply({ id }: { id: string }) {
  const { pending, run } = useAction();
  const [text, setText] = useState('');
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => adminReplyTicket(id, text), { success: 'Odgovor poslan. Radionica ga vidi u Postavke → Pomoć.', onDone: () => setText('') });
      }}
    >
      <div className="flex items-start gap-2">
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Odgovor radionici…" />
        <DictateButton compact onText={(t) => setText((s) => (s ? `${s.trimEnd()} ${t}` : t))} />
      </div>
      <Button type="submit" variant="primary" className="w-full" disabled={pending || text.trim().length < 3}>
        Pošalji odgovor
      </Button>
    </form>
  );
}

export function TicketStatusButtons({ id, status }: { id: string; status: 'open' | 'answered' | 'closed' }) {
  const { pending, run } = useAction();
  return status === 'closed' ? (
    <Button size="sm" disabled={pending} onClick={() => run(() => adminSetTicketStatus(id, 'open'), { success: 'Ponovno otvoreno' })}>
      Otvori ponovno
    </Button>
  ) : (
    <Button size="sm" variant="ok" disabled={pending} onClick={() => run(() => adminSetTicketStatus(id, 'closed'), { success: 'Označeno riješeno' })}>
      Riješeno
    </Button>
  );
}
