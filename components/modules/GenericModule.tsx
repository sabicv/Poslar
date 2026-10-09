import Link from 'next/link';
import { History } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components/ui';
import { PHASE_TONE, phaseLabel, type JobPhase } from '@/config/tenant.config';
import { assetTitle, formatDate } from '@/lib/format';
import type { ModuleProps } from './ModuleTab';
import { PlanCard } from './PlanCard';

// Trades without tables of their own (Auto kozmetika, Električar, Kućanski
// aparati, Bravar, Bazeni, Apartmani): the earlier work on this object and the recurring
// service the trade offers (pkg.plan).
export async function GenericModule({ ctx, job }: ModuleProps) {
  const s = ctx.supabase;
  const [{ data: earlier }, { data: plans }] = await Promise.all([
    s.from('jobs').select('id, number, phase, complaint, work_summary, created_at').eq('asset_id', job.asset.id).neq('id', job.id).order('created_at', { ascending: false }).limit(10),
    ctx.pkg.plan ? s.from('maintenance_plans').select('*').eq('client_id', job.client.id).eq('active', true) : Promise.resolve({ data: [] }),
  ]);
  const plan = (plans ?? []).find((p) => p.asset_id === job.asset.id) ?? (plans ?? []).find((p) => !p.asset_id && job.site_id && p.site_id === job.site_id) ?? null;
  return (
    <div className="space-y-4">
      {ctx.pkg.plan ? <PlanCard ctx={ctx} job={job} plan={plan} title={`${ctx.pkg.plan.title}: ${assetTitle(job.asset)}`} templateCode={ctx.pkg.plan.template} /> : null}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <History className="size-4 text-accent" /> Povijest
            </span>
          }
          subtitle={`Raniji nalozi: ${assetTitle(job.asset)}`}
        />
        {(earlier ?? []).length ? (
          <ul className="divide-y divide-line">
            {(earlier ?? []).map((j) => (
              <li key={j.id as string}>
                <Link href={`/app/jobs/${j.id}`} className="flex items-start justify-between gap-3 px-4 py-3 text-sm hover:bg-surface2">
                  <span className="min-w-0">
                    <span className="block break-words font-medium">
                      #{j.number as number} · {(j.complaint as string | null) ?? 'Nalog'}
                    </span>
                    {j.work_summary ? <span className="block break-words text-xs text-muted">{j.work_summary as string}</span> : null}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-faint">{formatDate(j.created_at as string)}</span>
                    <Badge tone={PHASE_TONE[j.phase as JobPhase]}>{phaseLabel(ctx.pkg, j.phase as JobPhase)}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-4 text-sm text-muted">Ovo je prvi nalog za {assetTitle(job.asset)}. Raniji radovi pojavit će se ovdje.</p>
        )}
      </Card>
    </div>
  );
}
