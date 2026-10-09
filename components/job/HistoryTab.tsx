import { Card, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import type { JobEvent, JobWithRefs } from '@/types/db';

// Append-only: nobody can edit or delete these rows (see 0005_rls.sql).
export async function HistoryTab({ ctx, job }: { ctx: WorkshopContext; job: JobWithRefs }) {
  const { data } = await ctx.supabase.from('job_events').select('*').eq('job_id', job.id).order('created_at', { ascending: false }).limit(300);
  const events = (data ?? []) as JobEvent[];
  if (!events.length) return <EmptyState title="Još nema zapisa" />;
  return (
    <Card>
      <ol className="relative px-4 py-3">
        {events.map((event) => (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent/70" />
            <div className="min-w-0">
              <p className="text-sm">{event.message}</p>
              <p className="text-xs text-faint">{formatDateTime(event.created_at)}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t border-line px-4 py-2.5 text-xs text-faint">Ovaj popis se ne može mijenjati ni brisati.</p>
    </Card>
  );
}
