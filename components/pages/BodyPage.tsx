import { EmptyState } from '@/components/ui';
import { BODY_PHASES, BODY_PHASE_ORDER, nextBodyPhase, type BodyPhase } from '@/config/production';
import { assetTitle, clientName, formatRelative } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { ProductionBoard, type BoardCard, type BoardColumn } from './ProductionBoard';

const ESTIMATE = { draft: 'Procjena u izradi', sent: 'Kod osiguranja', approved: 'Odobreno', supplement: 'Dopuna', rejected: 'Odbijeno' } as const;

// Production board: where every active car is, right now.
export async function BodyPage({ ctx }: { ctx: WorkshopContext }) {
  const { data: jobs } = await ctx.supabase
    .from('jobs')
    .select('id, number, is_urgent, locked_at, promised_at, client:clients(kind, first_name, last_name, company_name), asset:assets(identifier, make, model, asset_type)')
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

  const cards = new Map<string, BoardCard[]>();
  for (const job of jobs) {
    const state = current.get(job.id as string);
    const estimate = estimateOf.get(job.id as string);
    const asset = job.asset as unknown as { identifier: string | null; make: string | null; model: string | null; asset_type: never };
    const next = nextBodyPhase(state?.phase ?? null);
    const column = state?.phase ?? 'waiting';
    const card: BoardCard = {
      id: job.id as string,
      number: job.number as number,
      identifier: asset?.identifier ?? null,
      title: assetTitle(asset),
      client: clientName(job.client as never),
      urgent: Boolean(job.is_urgent),
      badges: [
        ...(estimate ? [{ label: ESTIMATE[estimate as keyof typeof ESTIMATE], tone: estimate === 'approved' ? ('ok' as const) : estimate === 'sent' ? ('warn' as const) : ('muted' as const) }] : []),
        ...(state ? [{ label: `${state.active ? 'u radu' : 'završeno'} ${formatRelative(state.since)}`, tone: state.active ? ('accent' as const) : ('muted' as const) }] : []),
      ],
      next: job.locked_at ? null : next ? BODY_PHASES[next] : null,
    };
    cards.set(column, [...(cards.get(column) ?? []), card]);
  }

  const columns: BoardColumn[] = [
    { id: 'waiting', label: 'Čeka početak', cards: cards.get('waiting') ?? [] },
    ...BODY_PHASE_ORDER.map((phase: BodyPhase) => ({ id: phase, label: BODY_PHASES[phase], cards: cards.get(phase) ?? [] })),
  ];
  return <ProductionBoard columns={columns} />;
}
