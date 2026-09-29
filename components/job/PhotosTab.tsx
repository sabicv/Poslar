import { formatDateTime, isPdfPath } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { signPaths } from '@/lib/signed';
import type { Attachment, JobWithRefs } from '@/types/db';
import { PhotoGallery } from './PhotoGallery';

export async function PhotosTab({ ctx, job }: { ctx: WorkshopContext; job: JobWithRefs }) {
  const { data } = await ctx.supabase.from('attachments').select('*').eq('job_id', job.id).order('created_at', { ascending: false });
  const files = (data ?? []) as Attachment[];
  const signed = await signPaths(ctx.supabase, files.map((f) => f.path));

  return (
    <PhotoGallery
      tenantId={ctx.tenant.id}
      jobId={job.id}
      tags={ctx.pkg.photoTags}
      withStages={ctx.pkg.id === 'body'}
      files={files.map((f) => ({
        id: f.id,
        url: signed.get(f.path)?.url ?? '',
        thumbUrl: signed.get(f.path)?.thumbUrl ?? '',
        isPdf: isPdfPath(f.path) || f.mime === 'application/pdf',
        tag: f.tag,
        caption: f.caption,
        stage: f.stage,
        visibility: f.visibility,
        when: formatDateTime(f.taken_at ?? f.created_at),
        gpsLat: f.gps_lat,
        gpsLng: f.gps_lng,
      }))}
    />
  );
}
