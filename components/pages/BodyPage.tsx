import Link from 'next/link';
import { Badge, EmptyState } from '@/components/ui';
import { assetTitle, clientName, formatRelative } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';

const PHASES = { disassembly: 'Rastavljanje', bodywork: 'Limarija', prep: 'Priprema', paint: 'Lakiranje', assembly: 'Sastavljanje', polish: 'Poliranje', quality: 'Kontrola', wash: 'Pranje' } as const;
const COLUMNS = ['waiting', ...Object.keys(PHASES)] as const;
const ESTIMATE = { draft: 'Procjena u izradi', sent: 'Kod osiguranja', approved: 'Odobreno', supplement: 'Dopuna', rejected: 'Odbijeno' } as const;

// Production board: where every active car is, right now.
export async function BodyPage({ ctx }: { ctx: WorkshopContext }) {
  const { data: jobs } = await ctx.supabase
    .from('jobs')
    .select('id, number, is_urgent, promised_at, client:clients(kind, first_name, last_name, company_name), asset:assets(identifier, make, model, asset_type)')
    .neq('phase', 'collected')
    .order('created_at');
  const ids = (jobs ?? []).map((j) => j.id as string);
  const [{ data: phases }, { data: estimates }] = ids.length
    ? await Promise.all([
        ctx.supabase.from('body_production_phases').select('job_id, phase, started_at, finished_at').in('job_id', ids).order('started_at'),
        ctx.supabase.from('body_estimates').select('job_id, status, version').in('job_id', ids),
      ])
    : [{ data: [] }, { data: [] }];

  const current = new Map<string, { phase: string; since: string; active: boolean }>();
  for (const p of phases ?? []) current.set(p.job_id as string, { phase: p.phase as string, since: (p.finished_at ?? p.started_at) as string, active: !p.finished_at });
  const estimateOf = new Map<string, string>();
  for (const e of estimates ?? []) estimateOf.set(e.job_id as string, e.status as string);

  if (!jobs?.length) return <EmptyState title="Nema aktivnih popravaka" />;

  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {COLUMNS.map((column) => {
        const inColumn = (jobs ?? []).filter((j) => (current.get(j.id as string)?.phase ?? 'waiting') === column);
        return (
          <section key={column} className="w-64 shrink-0">
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
              {column === 'waiting' ? 'Čeka početak' : PHASES[column as keyof typeof PHASES]}
              <span className="rounded bg-surface2 px-1.5 text-[11px] text-faint">{inColumn.length}</span>
            </h2>
            <div className="space-y-2">
              {inColumn.map((job) => {
                const state = current.get(job.id as string);
                const estimate = estimateOf.get(job.id as string);
                const asset = job.asset as unknown as { identifier: string | null; make: string | null; model: string | null; asset_type: never };
                return (
                  <Link key={job.id as string} href={`/app/jobs/${job.id}?tab=modul`} className="block rounded-xl border border-line bg-surface p-3 hover:border-faint/60">
                    <div className="flex items-center gap-2">
                      {asset?.identifier ? <span className="font-mono text-xs font-semibold">{asset.identifier}</span> : null}
                      <span className="text-xs text-faint">#{job.number as number}</span>
                      {job.is_urgent ? <Badge tone="crit">Hitno</Badge> : null}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">{assetTitle(asset)}</p>
                    <p className="truncate text-xs text-muted">{clientName(job.client as never)}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {estimate ? <Badge tone={estimate === 'approved' ? 'ok' : estimate === 'sent' ? 'warn' : 'muted'}>{ESTIMATE[estimate as keyof typeof ESTIMATE]}</Badge> : null}
                      {state ? <Badge tone={state.active ? 'accent' : 'muted'}>{state.active ? 'u radu' : 'završeno'} {formatRelative(state.since)}</Badge> : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
