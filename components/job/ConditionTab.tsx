import { diagramFor } from '@/components/Diagram';
import type { WorkshopContext } from '@/lib/session';
import type { ConditionReport, JobWithRefs } from '@/types/db';
import { ConditionEditor } from './ConditionEditor';

export async function ConditionTab({ ctx, job, locked }: { ctx: WorkshopContext; job: JobWithRefs; locked: boolean }) {
  const { data } = await ctx.supabase.from('condition_reports').select('*').eq('job_id', job.id);
  const reports = (data ?? []) as ConditionReport[];

  const signatures: Record<string, string> = {};
  const paths = reports.map((r) => r.signature_path).filter((p): p is string => Boolean(p));
  if (paths.length) {
    const { data: signed } = await ctx.supabase.storage.from('job-files').createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) signatures[s.path] = s.signedUrl;
  }

  const diagram = diagramFor(job.asset.asset_type, ctx.pkg.diagram);
  return (
    <ConditionEditor
      jobId={job.id}
      tenantId={ctx.tenant.id}
      diagram={diagram}
      equipment={ctx.pkg.equipment}
      reports={Object.fromEntries(reports.map((r) => [r.kind, { ...r, signatureUrl: r.signature_path ? signatures[r.signature_path] ?? null : null }]))}
      clientName={[job.client.first_name, job.client.last_name].filter(Boolean).join(' ') || job.client.company_name || ''}
      locked={locked}
    />
  );
}
