'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { LifeBuoy } from 'lucide-react';
import { DictateButton, Sheet, useAction } from '@/components/client-ui';
import { Button, Textarea } from '@/components/ui';
import { createTicket, replyToTicket } from '@/lib/actions/support';

// "Javi problem": one sentence (said or typed) goes to Poslar with the
// page it came from. The answer arrives in Postavke → Pomoć.
export function SupportButton({ prefill = '', trigger, after }: { prefill?: string; trigger?: ReactNode; after?: 'podrska' | 'stay' }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(prefill);

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Javi problem"
      trigger={
        trigger ?? (
          <Button variant="secondary">
            <LifeBuoy className="size-4" /> Javi problem
          </Button>
        )
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createTicket(text, typeof location !== 'undefined' ? location.pathname + location.search : null), {
            success: 'Poslano. Odgovor stiže u Postavke → Pomoć.',
            onDone: () => {
              setOpen(false);
              setText('');
              if (after !== 'stay') router.push('/app/podrska');
            },
          });
        }}
      >
        <p className="text-sm text-muted">Napišite ili izgovorite što ne radi ili što Vam treba. Stranica na kojoj ste šalje se sama.</p>
        <div className="flex items-start gap-2">
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="npr. Kod spremanja naloga javlja grešku." />
          <DictateButton compact onText={(t) => setText((s) => (s ? `${s.trimEnd()} ${t}` : t))} />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending || text.trim().length < 3}>
          {pending ? 'Šaljem…' : 'Pošalji'}
        </Button>
      </form>
    </Sheet>
  );
}

export function TicketReply({ ticketId }: { ticketId: string }) {
  const { pending, run } = useAction();
  const [text, setText] = useState('');
  return (
    <form
      className="flex items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => replyToTicket(ticketId, text), { success: 'Poslano', onDone: () => setText('') });
      }}
    >
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Dopišite…" />
      <DictateButton compact onText={(t) => setText((s) => (s ? `${s.trimEnd()} ${t}` : t))} />
      <Button type="submit" variant="primary" disabled={pending || text.trim().length < 3}>
        Pošalji
      </Button>
    </form>
  );
}
