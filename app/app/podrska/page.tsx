import type { Metadata } from 'next';
import { LifeBuoy } from 'lucide-react';
import { SupportButton, TicketReply } from '@/components/SupportButton';
import { Badge, BackLink, Card, EmptyState, PageHeader } from '@/components/ui';
import { markSupportRead } from '@/lib/actions/support';
import { formatDateTime } from '@/lib/format';
import { requireWorkshop } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Pomoć' };

const STATUS = { open: { label: 'Poslano', tone: 'warn' }, answered: { label: 'Odgovoreno', tone: 'ok' }, closed: { label: 'Riješeno', tone: 'muted' } } as const;

export default async function SupportPage() {
  const ctx = await requireWorkshop();
  const { data: tickets } = await ctx.supabase
    .from('support_tickets')
    .select('id, status, tenant_unread, created_at, last_message_at, user_id, messages:support_messages(id, body, from_admin, created_at, author_id)')
    .order('last_message_at', { ascending: false })
    .limit(30);
  await markSupportRead();

  type Row = { id: string; status: keyof typeof STATUS; tenant_unread: boolean; created_at: string; user_id: string | null; messages: { id: string; body: string; from_admin: boolean; created_at: string; author_id: string | null }[] };
  const rows = (tickets ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Pomoć" subtitle="Vaše prijave i odgovori TaktiX podrške" back={<BackLink href="/app/settings">Postavke</BackLink>} action={<SupportButton after="stay" />} />
      {rows.length === 0 ? (
        <EmptyState icon={<LifeBuoy className="size-8" />} title="Nema prijava">
          Ako nešto ne radi ili Vam nešto treba, dodirnite „Javi problem”. Odgovor stiže ovdje.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {rows.map((t) => (
            <Card key={t.id} className={cn(t.tenant_unread && 'border-accent/60')}>
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
                {t.tenant_unread ? <Badge tone="accent">Novi odgovor</Badge> : null}
                <span className="ml-auto text-xs text-faint">{formatDateTime(t.created_at)}</span>
              </div>
              <ul className="space-y-3 p-4">
                {[...t.messages]
                  .sort((a, b) => a.created_at.localeCompare(b.created_at))
                  .map((m) => (
                    <li key={m.id} className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm', m.from_admin ? 'bg-accent/15' : 'ml-auto bg-surface2')}>
                      <p className="mb-0.5 text-xs text-muted">
                        {m.from_admin ? 'TaktiX podrška' : m.author_id === ctx.user.id ? 'Vi' : 'Vaš tim'} · {formatDateTime(m.created_at)}
                      </p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </li>
                  ))}
              </ul>
              {t.status !== 'closed' ? (
                <div className="border-t border-line p-3">
                  <TicketReply ticketId={t.id} />
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
