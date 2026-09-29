import Link from 'next/link';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { signPaths } from '@/lib/signed';
import { getInspectionTemplates } from '@/lib/templates';
import type { Inspection, InspectionResult, JobWithRefs } from '@/types/db';
import { InspectionRunner, StartInspection } from './InspectionRunner';

const PURPOSE_LABELS = { dvi: 'Digitalna inspekcija', checklist: 'Kontrolna lista', driver_check: 'Pregled vozača', seasonal: 'Sezonski protokol' } as const;

export async function InspectionTab({ ctx, job, locked }: { ctx: WorkshopContext; job: JobWithRefs; locked: boolean }) {
  const [templates, { data }] = await Promise.all([
    getInspectionTemplates(ctx),
    ctx.supabase.from('inspections').select('*').eq('job_id', job.id).order('started_at', { ascending: false }),
  ]);
  const inspections = (data ?? []) as Inspection[];
  const current = inspections[0] ?? null;

  let results: InspectionResult[] = [];
  let photos: Record<string, string> = {};
  if (current) {
    const { data: rows } = await ctx.supabase.from('inspection_results').select('*').eq('inspection_id', current.id);
    results = (rows ?? []) as InspectionResult[];
    const photoIds = results.flatMap((r) => r.photo_ids ?? []);
    if (photoIds.length) {
      const { data: files } = await ctx.supabase.from('attachments').select('id, path').in('id', photoIds);
      const signed = await signPaths(ctx.supabase, (files ?? []).map((f) => f.path as string));
      photos = Object.fromEntries((files ?? []).map((f) => [f.id as string, signed.get(f.path as string)?.thumbUrl ?? '']));
    }
  }
  const template = current ? templates.find((t) => t.code === current.template_code) : undefined;

  return (
    <div className="space-y-4">
      {current && template ? (
        <InspectionRunner
          key={current.id}
          jobId={job.id}
          tenantId={ctx.tenant.id}
          inspection={{ id: current.id, title: current.title, completed: Boolean(current.completed_at) }}
          template={template}
          results={results.map((r) => ({
            item_code: r.item_code,
            status: r.status,
            measure_value: r.measure_value === null ? null : Number(r.measure_value),
            note: r.note,
            photo_ids: r.photo_ids ?? [],
            job_line_id: r.job_line_id,
          }))}
          photos={photos}
          locked={locked}
        />
      ) : null}

      {!locked ? <StartInspection jobId={job.id} templates={templates.map((t) => ({ code: t.code, name: t.name, purpose: PURPOSE_LABELS[t.purpose] }))} hasCurrent={Boolean(current)} /> : null}

      {inspections.length > 1 ? (
        <Card>
          <CardHeader title="Ranije na ovom nalogu" />
          <ul className="divide-y divide-line">
            {inspections.slice(1).map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                {i.completed_at ? <CheckCircle2 className="size-4 text-ok" /> : <CircleDashed className="size-4 text-faint" />}
                <span className="flex-1">{i.title}</span>
                <span className="text-xs text-faint">{formatDateTime(i.started_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {!current ? (
        <p className="text-sm text-muted">
          Nalazi u žutom i crvenom jednim dodirom postaju predložene stavke, a stranka ih odobrava putem poveznice (kartica{' '}
          <Link href={`/app/jobs/${job.id}?tab=stavke`} className="text-accent">
            Stavke
          </Link>
          ).
        </p>
      ) : null}
    </div>
  );
}
