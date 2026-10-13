import Link from 'next/link';
import { Card } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { signPaths } from '@/lib/signed';
import { isSpringTemplate, isWinterTemplate, seasonKind } from '@/lib/season';
import { getInspectionTemplates } from '@/lib/templates';
import type { Inspection, InspectionResult, JobWithRefs } from '@/types/db';
import { InspectionRunner, StartInspection } from './InspectionRunner';

function listsStay(names: string[]): string {
  if (names.length === 2) return `${names[0]} i ${names[1]} ostaju obje na nalogu. Pokretanje jedne ne zatvara drugu.`;
  const last = names[names.length - 1];
  return `${names.slice(0, -1).join(', ')} i ${last} ostaju na nalogu. Pokretanje jedne ne zatvara ostale.`;
}

export async function InspectionTab({ ctx, job, locked }: { ctx: WorkshopContext; job: JobWithRefs; locked: boolean }) {
  const [templates, { data }] = await Promise.all([
    getInspectionTemplates(ctx),
    ctx.supabase.from('inspections').select('*').eq('job_id', job.id).order('started_at'),
  ]);
  const inspections = (data ?? []) as Inspection[];
  const ids = inspections.map((inspection) => inspection.id);

  let results: InspectionResult[] = [];
  let photos: Record<string, string> = {};
  if (ids.length) {
    const { data: rows } = await ctx.supabase.from('inspection_results').select('*').in('inspection_id', ids);
    results = (rows ?? []) as InspectionResult[];
    const photoIds = results.flatMap((row) => row.photo_ids ?? []);
    if (photoIds.length) {
      const { data: files } = await ctx.supabase.from('attachments').select('id, path').in('id', photoIds);
      const signed = await signPaths(ctx.supabase, (files ?? []).map((file) => file.path as string));
      photos = Object.fromEntries((files ?? []).map((file) => [file.id as string, signed.get(file.path as string)?.thumbUrl ?? '']));
    }
  }
  const byInspection = new Map<string, InspectionResult[]>();
  for (const row of results) {
    const list = byInspection.get(row.inspection_id) ?? [];
    list.push(row);
    byInspection.set(row.inspection_id, list);
  }

  const season = seasonKind(job.complaint ?? '');
  const listed = templates.filter((item) => {
    if (item.purpose !== 'seasonal') return true;
    if (season === 'both') return true;
    if (season === 'winterize') return isWinterTemplate(item.code);
    if (season === 'dewinterize') return isSpringTemplate(item.code);
    return false;
  });
  const used = new Set(inspections.map((inspection) => inspection.template_code));
  const available = listed.filter((item) => !used.has(item.code));

  return (
    <div className="space-y-4">
      {!locked && available.length ? (
        <StartInspection jobId={job.id} templates={available.map((item) => ({ code: item.code, name: item.name }))} />
      ) : null}

      {inspections.map((inspection) => {
        const template = templates.find((item) => item.code === inspection.template_code);
        const rows = byInspection.get(inspection.id) ?? [];
        if (!template) {
          return (
            <Card key={inspection.id} className="px-4 py-3 text-sm">
              <p className="font-medium">{inspection.title}</p>
              <p className="text-xs text-faint">{formatDateTime(inspection.started_at)}</p>
            </Card>
          );
        }
        return (
          <InspectionRunner
            key={inspection.id}
            jobId={job.id}
            tenantId={ctx.tenant.id}
            inspection={{ id: inspection.id, title: inspection.title, completed: Boolean(inspection.completed_at) }}
            template={template}
            results={rows.map((row) => ({
              item_code: row.item_code,
              status: row.status,
              measure_value: row.measure_value === null ? null : Number(row.measure_value),
              note: row.note,
              photo_ids: row.photo_ids ?? [],
              job_line_id: row.job_line_id,
            }))}
            photos={photos}
            locked={locked}
            pin={inspections.length === 1}
          />
        );
      })}

      {!inspections.length && !listed.length && templates.some((item) => item.purpose === 'seasonal') ? (
        <p className="text-sm text-muted">Za ovaj nalog nema kontrolne liste. Sezonski protokol se nudi samo kad je posao konzervacija ili dekonzervacija.</p>
      ) : null}

      {!inspections.length && listed.length ? (
        <p className="text-sm text-muted">
          Nalazi označeni kao oprez ili hitno jednim dodirom postaju predložene stavke, a stranka ih odobrava putem poveznice (kartica{' '}
          <Link prefetch={false} href={`/app/jobs/${job.id}?tab=stavke`} className="text-accent">
            {ctx.isOwner && !ctx.pkg.internalJobs ? 'Radovi i cijena' : 'Radovi'}
          </Link>
          ).
        </p>
      ) : null}

      {listed.length >= 2 ? <p className="text-sm text-muted">{listsStay(listed.map((item) => item.name))}</p> : null}
    </div>
  );
}
