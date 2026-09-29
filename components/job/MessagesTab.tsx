import { formatDateTime } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import type { JobMessage, JobWithRefs } from '@/types/db';
import { MessageThread } from './MessageThread';

export async function MessagesTab({ ctx, job }: { ctx: WorkshopContext; job: JobWithRefs }) {
  const [{ data: messages }, { data: staff }] = await Promise.all([
    ctx.supabase.from('job_messages').select('*').eq('job_id', job.id).order('created_at'),
    ctx.supabase.from('profiles').select('id, full_name, role'),
  ]);
  const names = Object.fromEntries((staff ?? []).map((s) => [s.id as string, (s.full_name as string | null) ?? 'Bez imena']));

  return (
    <MessageThread
      jobId={job.id}
      me={ctx.user.id}
      isOwner={ctx.isOwner}
      workers={(staff ?? []).filter((s) => s.id !== ctx.user.id).map((s) => ({ id: s.id as string, name: names[s.id as string] }))}
      messages={((messages ?? []) as JobMessage[]).map((m) => ({
        id: m.id,
        kind: m.kind,
        body: m.body,
        status: m.status,
        mine: m.sender_id === ctx.user.id,
        from: names[m.sender_id] ?? '—',
        to: m.receiver_id ? names[m.receiver_id] ?? '—' : null,
        forMe: m.receiver_id === ctx.user.id || (ctx.isOwner && m.kind === 'help' && m.sender_id !== ctx.user.id),
        when: formatDateTime(m.created_at),
      }))}
    />
  );
}
