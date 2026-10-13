import { Card, CardHeader, EmptyState } from '@/components/ui';
import { formatDateTime, isPdfPath, plural } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { signPaths } from '@/lib/signed';
import type { Attachment, JobEvent, JobMessage, JobWithRefs } from '@/types/db';
import { MessageThread } from './MessageThread';
import { PhotoGallery } from './PhotoGallery';
import { ScrollInto } from './ScrollInto';

// The job's trail: what happened, what was said, and the photographs.
// Pictures are taken on the function (condition, meter, part). This is where they stay.
export async function HistoryTab({ ctx, job, open }: { ctx: WorkshopContext; job: JobWithRefs; open?: string }) {
  const [{ data: events }, { data: messages }, { data: staff }, { data: files }] = await Promise.all([
    ctx.supabase.from('job_events').select('*').eq('job_id', job.id).order('created_at', { ascending: false }).limit(300),
    ctx.supabase.from('job_messages').select('*').eq('job_id', job.id).order('created_at'),
    ctx.supabase.from('profiles').select('id, full_name, role'),
    ctx.supabase.from('attachments').select('*').eq('job_id', job.id).order('created_at', { ascending: false }),
  ]);
  const log = (events ?? []) as JobEvent[];
  const thread = (messages ?? []) as JobMessage[];
  const photos = (files ?? []) as Attachment[];
  const names = Object.fromEntries((staff ?? []).map((person) => [person.id as string, (person.full_name as string | null) ?? 'Bez imena']));
  const signed = await signPaths(ctx.supabase, photos.map((file) => file.path));
  const when = (value: string) => {
    const date = new Date(value);
    if (date.getFullYear() === new Date().getFullYear()) return formatDateTime(value);
    return date.toLocaleString('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zagreb' });
  };

  return (
    <div className="space-y-4">
      <ScrollInto id={open === 'poruke' || open === 'foto' ? open : undefined} />
      <Card id="poruke" className="scroll-mt-28">
        <CardHeader title="Poruke radnicima" subtitle={thread.length ? `${thread.length} ${plural(thread.length, 'poruka', 'poruke', 'poruka')}` : 'Zadatak na ovom nalogu ili molba za pomoć'} />
        <div className="p-4">
          <MessageThread
            jobId={job.id}
            me={ctx.user.id}
            isOwner={ctx.isOwner}
            workers={(staff ?? []).filter((person) => person.id !== ctx.user.id).map((person) => ({ id: person.id as string, name: names[person.id as string] }))}
            messages={thread.map((message) => ({
              id: message.id,
              kind: message.kind,
              body: message.body,
              status: message.status,
              mine: message.sender_id === ctx.user.id,
              from: names[message.sender_id] ?? '-',
              to: message.receiver_id ? names[message.receiver_id] ?? '-' : null,
              forMe: message.receiver_id === ctx.user.id || (ctx.isOwner && message.kind === 'help' && message.sender_id !== ctx.user.id),
              when: when(message.created_at),
            }))}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Zapisi" subtitle="Ovaj popis se ne može mijenjati ni brisati." />
        {log.length ? (
          <ol className="relative px-4 py-3">
            {log.map((event) => (
              <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent/70" />
                <div className="min-w-0">
                  <p className="text-sm">{event.message}</p>
                  <p className="text-xs text-faint">{when(event.created_at)}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="Još nema zapisa" />
        )}
      </Card>

      <Card id="foto" className="scroll-mt-28">
        <CardHeader title="Fotografije" subtitle={photos.length ? `${photos.length} ${plural(photos.length, 'datoteka', 'datoteke', 'datoteka')}` : 'Ostaju ovdje nakon snimanja'} />
        <div className="p-4">
          <PhotoGallery
            archive
            tenantId={ctx.tenant.id}
            jobId={job.id}
            tags={ctx.pkg.photoTags}
            withStages={ctx.pkg.id === 'body'}
            files={photos.map((file) => ({
              id: file.id,
              url: signed.get(file.path)?.url ?? '',
              thumbUrl: signed.get(file.path)?.thumbUrl ?? '',
              isPdf: isPdfPath(file.path) || file.mime === 'application/pdf',
              tag: file.tag,
              caption: file.caption,
              stage: file.stage,
              visibility: file.visibility,
              when: when(file.taken_at ?? file.created_at),
              gpsLat: file.gps_lat,
              gpsLng: file.gps_lng,
            }))}
          />
        </div>
      </Card>
    </div>
  );
}
