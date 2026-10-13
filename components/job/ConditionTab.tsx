import { diagramFor, resolveZones } from '@/components/Diagram';
import type { WorkshopContext } from '@/lib/session';
import { signPaths } from '@/lib/signed';
import type { ConditionReport, JobWithRefs } from '@/types/db';
import { ConditionEditor } from './ConditionEditor';

// The same two rows everywhere. What they are called, and whether the
// first one starts open, follows the trade: damage IS the job for body
// and purchase, a before/after pair for detailing, arrival for a visit.
function conditionCopy(pkgId: string, field: boolean) {
  if (pkgId === 'detail') return { intake: 'Prije', handover: 'Poslije', intakeOpen: false };
  if (pkgId === 'wheel') return { intake: 'Stanje gume i naplatka', handover: 'Stanje pri predaji', intakeOpen: false };
  if (pkgId === 'tow') return { intake: 'Stanje pri utovaru', handover: 'Stanje pri istovaru', intakeOpen: false };
  if (pkgId === 'body' || pkgId === 'deal') return { intake: 'Stanje pri prijemu', handover: 'Stanje pri predaji', intakeOpen: true };
  if (field) return { intake: 'Stanje pri dolasku', handover: 'Stanje pri odlasku', intakeOpen: false };
  return { intake: 'Stanje pri prijemu', handover: 'Stanje pri predaji', intakeOpen: false };
}

export async function ConditionTab({ ctx, job, locked, part = 'both' }: { ctx: WorkshopContext; job: JobWithRefs; locked: boolean; part?: 'intake' | 'handover' | 'both' }) {
  const [{ data }, { data: shots }] = await Promise.all([
    ctx.supabase.from('condition_reports').select('*').eq('job_id', job.id),
    ctx.supabase.from('attachments').select('path, caption, tag, stage').eq('job_id', job.id).in('tag', ['damage', 'intake']).order('created_at'),
  ]);
  const reports = (data ?? []) as ConditionReport[];
  const files = (shots ?? []) as { path: string; caption: string | null; tag: string | null; stage: string | null }[];
  const signedShots = await signPaths(ctx.supabase, files.map((file) => file.path));
  const copy = conditionCopy(ctx.pkg.id, ctx.pkg.sector === 'field');
  const shotUrl = (file: (typeof files)[number]) => signedShots.get(file.path)?.thumbUrl || signedShots.get(file.path)?.url || '';
  const photos = {
    intake: files.filter((file) => file.caption === copy.intake || (file.tag === 'intake' && file.caption !== copy.handover)).map((file) => ({ url: shotUrl(file) })).filter((file) => file.url),
    handover: files.filter((file) => file.caption === copy.handover || file.stage === 'after').map((file) => ({ url: shotUrl(file) })).filter((file) => file.url),
  };

  const signatures: Record<string, string> = {};
  const paths = reports.map((r) => r.signature_path).filter((p): p is string => Boolean(p));
  if (paths.length) {
    const { data: signed } = await ctx.supabase.storage.from('job-files').createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) signatures[s.path] = s.signedUrl;
  }

  const diagram = diagramFor(job.asset.asset_type, ctx.pkg.diagram);
  const zones = resolveZones(diagram, ctx.pkg.diagram, ctx.pkg.conditionZones);
  return (
    <ConditionEditor
      jobId={job.id}
      tenantId={ctx.tenant.id}
      diagram={diagram}
      zones={zones}
      marks={ctx.pkg.marks}
      level={ctx.pkg.level ?? 'fuel'}
      equipment={ctx.pkg.equipment}
      reports={Object.fromEntries(reports.map((r) => [r.kind, { ...r, signatureUrl: r.signature_path ? signatures[r.signature_path] ?? null : null }]))}
      clientName={[job.client.first_name, job.client.last_name].filter(Boolean).join(' ') || job.client.company_name || ''}
      locked={locked}
      intakeTitle={copy.intake}
      handoverTitle={copy.handover}
      intakeOpen={copy.intakeOpen}
      photos={photos}
      silhouette={ctx.pkg.id === 'body' && diagram === 'car'}
      part={part}
    />
  );
}
