import { Badge } from '@/components/ui';
import { PHASE_TONE, phaseLabel, type JobPhase, type PackageConfig } from '@/config/tenant.config';
import { cn } from '@/lib/utils';

// Where the job is, at a glance: four steps (in, being worked on, done,
// collected), the exact phase as a badge under it ("Čeka dijelove") and
// the money once the work is done. Only shows; the phase changes in the
// bottom bar.
const STEPS: { label: (pkg: PackageConfig) => string; phases: JobPhase[] }[] = [
  { label: (pkg) => phaseLabel(pkg, 'intake'), phases: ['intake'] },
  { label: () => 'U radu', phases: ['diagnosis', 'awaiting_approval', 'awaiting_parts', 'in_progress', 'quality_check'] },
  { label: (pkg) => phaseLabel(pkg, 'ready'), phases: ['ready'] },
  { label: (pkg) => phaseLabel(pkg, 'collected'), phases: ['collected'] },
];

export function JobStepper({ pkg, phase, payment }: { pkg: PackageConfig; phase: JobPhase; payment: 'paid' | 'unpaid' | null }) {
  const current = STEPS.findIndex((s) => s.phases.includes(phase));
  return (
    <section aria-label="Stanje naloga" className="mb-4">
      <ol className="grid grid-cols-4 gap-1.5">
        {STEPS.map((step, i) => (
          <li key={i} className="min-w-0" aria-current={i === current ? 'step' : undefined}>
            <span className={cn('block h-1.5 rounded-full', i < current ? 'bg-accent/60' : i === current ? 'bg-accent' : 'bg-surface2')} />
            <span className={cn('mt-1.5 block text-[11px] leading-tight', i === current ? 'font-semibold text-fg' : i < current ? 'text-muted' : 'text-faint')}>{step.label(pkg)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone={PHASE_TONE[phase]}>Sada: {phaseLabel(pkg, phase)}</Badge>
        {payment ? <Badge tone={payment === 'paid' ? 'ok' : 'warn'}>{payment === 'paid' ? 'Plaćeno' : 'Za naplatu'}</Badge> : null}
      </div>
    </section>
  );
}
