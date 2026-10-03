import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageThread } from '@/components/job/MessageThread';
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { requireWorkshop } from '@/lib/session';
import type { JobMessage } from '@/types/db';

export const metadata: Metadata = { title: 'Poruke' };

// Everything addressed to me across all jobs, plus a general channel.
export default async function InboxPage() {
  const ctx = await requireWorkshop();
  const [{ data }, { data: staff }] = await Promise.all([
    ctx.supabase.from('job_messages').select('*, job:jobs(id, number)').order('created_at', { ascending: false }).limit(200),
    ctx.supabase.from('profiles').select('id, full_name'),
  ]);
  const names = Object.fromEntries((staff ?? []).map((s) => [s.id as string, (s.full_name as string | null) ?? 'Bez imena']));
  const messages = (data ?? []) as (JobMessage & { job: { id: string; number: number } | null })[];
  const open = messages.filter((m) => m.status !== 'done');
  const general = messages.filter((m) => !m.job_id).reverse();

  const view = (m: JobMessage) => ({
    id: m.id,
    kind: m.kind,
    body: m.body,
    status: m.status,
    mine: m.sender_id === ctx.user.id,
    from: names[m.sender_id] ?? '-',
    to: m.receiver_id ? names[m.receiver_id] ?? '-' : null,
    forMe: m.receiver_id === ctx.user.id || (ctx.isOwner && m.kind === 'help' && m.sender_id !== ctx.user.id),
    when: formatDateTime(m.created_at),
  });

  return (
    <>
      <PageHeader title="Poruke" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Otvoreno na nalozima" />
          {open.filter((m) => m.job).length ? (
            <ul className="divide-y divide-line">
              {open
                .filter((m) => m.job)
                .map((m) => (
                  <li key={m.id}>
                    <Link prefetch={false} href={`/app/jobs/${m.job!.id}?tab=poruke`} className="block px-4 py-3 hover:bg-surface2">
                      <p className="text-xs text-muted">
                        Nalog #{m.job!.number} · {names[m.sender_id]} · {formatDateTime(m.created_at)}
                      </p>
                      <p className={`mt-0.5 text-sm ${m.kind === 'help' ? 'text-crit' : ''}`}>{m.body}</p>
                    </Link>
                  </li>
                ))}
            </ul>
          ) : (
            <div className="p-4">
              <EmptyState title="Nema otvorenih poruka" />
            </div>
          )}
        </Card>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Opće poruke (bez naloga)</p>
          <MessageThread
            jobId={null}
            me={ctx.user.id}
            isOwner={ctx.isOwner}
            workers={(staff ?? []).filter((s) => s.id !== ctx.user.id).map((s) => ({ id: s.id as string, name: names[s.id as string] }))}
            messages={general.map(view)}
          />
        </div>
      </div>
    </>
  );
}
