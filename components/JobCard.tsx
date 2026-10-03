import Link from 'next/link';
import { CalendarClock, Lock, UserRound } from 'lucide-react';
import { Badge, Dot } from '@/components/ui';
import { PHASE_TONE, phaseLabel, type JobPhase, type PackageConfig } from '@/config/tenant.config';
import { assetTitle, clientName, daysUntil, formatDate, formatEuro, formatRelative } from '@/lib/format';
import type { Asset, Client, Job } from '@/types/db';

export type BoardJob = Pick<Job, 'id' | 'number' | 'phase' | 'complaint' | 'is_urgent' | 'promised_at' | 'payment_status' | 'locked_at' | 'updated_at' | 'assigned_to'> & {
  // 'qr': sent by the customer from the door code.
  source?: string | null;
  client: Pick<Client, 'kind' | 'first_name' | 'last_name' | 'company_name'> | null;
  asset: Pick<Asset, 'asset_type' | 'identifier' | 'make' | 'model'> | null;
  assignee: { full_name: string | null } | null;
};

// showPhase=false inside a list already grouped under the phase name.
export function JobCard({ job, pkg, total, showMoney, showPhase = true }: { job: BoardJob; pkg: PackageConfig; total?: number; showMoney: boolean; showPhase?: boolean }) {
  const promised = daysUntil(job.promised_at);
  const unpaid = showMoney && !pkg.internalJobs && job.payment_status === 'unpaid' && (job.phase === 'ready' || job.phase === 'collected');
  return (
    <Link
      prefetch={false} href={`/app/jobs/${job.id}`}
      className="group block rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-faint/60 active:bg-surface2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {job.asset?.identifier ? (
              <span className="rounded-md border border-line bg-bg px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide">{job.asset.identifier}</span>
            ) : null}
            <span className="text-xs text-faint">#{job.number}</span>
            {job.locked_at ? <Lock className="size-3.5 text-faint" /> : null}
          </div>
          <p className="mt-1.5 truncate text-[15px] font-medium">{assetTitle(job.asset)}</p>
          <p className="truncate text-sm text-muted">{clientName(job.client)}</p>
        </div>
        {showMoney && total !== undefined ? <span className="shrink-0 text-sm font-medium tabular text-muted">{formatEuro(total)}</span> : null}
      </div>
      {job.complaint ? <p className="mt-2 line-clamp-2 text-sm text-muted">{job.complaint}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {showPhase ? (
          <Badge tone={PHASE_TONE[job.phase as JobPhase]}>
            <Dot tone={PHASE_TONE[job.phase as JobPhase]} />
            {phaseLabel(pkg, job.phase as JobPhase)}
          </Badge>
        ) : null}
        {job.is_urgent ? <Badge tone="crit">Hitno</Badge> : null}
        {job.source === 'qr' && job.phase === 'intake' ? <Badge tone="accent">S vrata</Badge> : null}
        {unpaid ? <Badge tone="warn">Za naplatu</Badge> : null}
        {promised !== null && job.phase !== 'collected' ? (
          <Badge tone={promised < 0 ? 'crit' : promised === 0 ? 'warn' : 'muted'}>
            <CalendarClock className="size-3" />
            {promised === 0 ? 'Danas' : promised === 1 ? 'Sutra' : formatDate(job.promised_at)}
          </Badge>
        ) : null}
        {job.assignee?.full_name ? (
          <Badge tone="muted">
            <UserRound className="size-3" />
            {job.assignee.full_name.split(' ')[0]}
          </Badge>
        ) : null}
        <span className="ml-auto text-xs text-faint">{formatRelative(job.updated_at)}</span>
      </div>
    </Link>
  );
}
