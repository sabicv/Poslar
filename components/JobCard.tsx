import Link from 'next/link';
import { CalendarCheck, CalendarClock, CalendarDays, Lock, Phone, QrCode, UserRound } from 'lucide-react';
import { Badge, Dot } from '@/components/ui';
import { PHASE_TONE, phaseLabel, type JobPhase, type PackageConfig } from '@/config/tenant.config';
import { assetTitle, clientName, daysUntil, formatDate, formatEuro, formatRelative } from '@/lib/format';
import type { Asset, Client, Job } from '@/types/db';

export type BoardJob = Pick<Job, 'id' | 'number' | 'phase' | 'complaint' | 'is_urgent' | 'promised_at' | 'payment_status' | 'locked_at' | 'updated_at' | 'assigned_to'> & {
  // 'qr': sent by the customer from the door code; 'phone': booked by the AI
  // phone; 'booking': booked by the customer on the "Rezerviraj termin" page.
  source?: string | null;
  scheduled_start?: string | null;
  client: Pick<Client, 'kind' | 'first_name' | 'last_name' | 'company_name'> | null;
  asset: Pick<Asset, 'asset_type' | 'identifier' | 'make' | 'model'> | null;
  assignee: { full_name: string | null } | null;
};

// showPhase=false inside a list already grouped under the phase name.
function cardEdge(phase: string, urgent: boolean) {
  if (urgent || phase === 'intake') return 'shadow-[inset_3px_0_0_rgb(var(--orange))]';
  if (phase === 'awaiting_approval' || phase === 'awaiting_parts') return 'shadow-[inset_3px_0_0_rgb(var(--warn))]';
  if (phase === 'collected') return '';
  return 'shadow-[inset_3px_0_0_rgb(var(--accent))]';
}

export function JobCard({ job, pkg, total, showMoney, showPhase = true }: { job: BoardJob; pkg: PackageConfig; total?: number; showMoney: boolean; showPhase?: boolean }) {
  const promised = daysUntil(job.promised_at);
  const unpaid = showMoney && !pkg.internalJobs && job.payment_status === 'unpaid' && (job.phase === 'ready' || job.phase === 'collected');
  const tone = PHASE_TONE[job.phase as JobPhase];
  return (
    <Link
      prefetch={false} href={`/app/jobs/${job.id}`}
      className={`group block rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-faint/60 active:bg-surface2 ${cardEdge(job.phase, job.is_urgent)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {job.asset?.identifier ? (
              <span className="font-mono text-base font-bold tracking-wide text-fg">{job.asset.identifier}</span>
            ) : null}
            <span className="text-xs text-faint">#{job.number}</span>
            {job.locked_at ? <Lock className="size-3.5 text-faint" /> : null}
            {showPhase ? (
              <Badge tone={tone}>
                <Dot tone={tone} />
                {phaseLabel(pkg, job.phase as JobPhase)}
              </Badge>
            ) : null}
            {job.is_urgent ? <Badge tone="crit">Hitno</Badge> : null}
          </div>
          <p className="type-name mt-1.5">{assetTitle(job.asset)}</p>
          <p className="break-words text-sm text-muted">{clientName(job.client)}</p>
        </div>
        {showMoney && total !== undefined ? <span className="shrink-0 text-sm font-medium tabular text-muted">{formatEuro(total)}</span> : null}
      </div>
      {job.complaint ? <p className="mt-3 line-clamp-2 border-t border-line pt-2.5 text-sm leading-snug text-muted">{job.complaint}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {/* Badges only tell; the whole card is the one tap target. */}
        {job.source === 'qr' && job.phase === 'intake' ? (
          <Badge tone="accent">
            <QrCode className="size-3" /> Prijava s vrata
          </Badge>
        ) : null}
        {job.source === 'phone' && job.phase === 'intake' ? (
          <Badge tone="accent">
            <Phone className="size-3" /> Dogovorio Poslar
          </Badge>
        ) : null}
        {job.source === 'booking' && job.phase === 'intake' ? (
          <Badge tone="accent">
            <CalendarCheck className="size-3" /> Rezervirao online
          </Badge>
        ) : null}
        {job.scheduled_start && job.phase !== 'collected' ? (
          <Badge tone="neutral">
            <CalendarDays className="size-3" />
            Termin{' '}
            {new Date(job.scheduled_start).toLocaleString('hr-HR', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zagreb' })}
          </Badge>
        ) : null}
        {unpaid ? <Badge tone="warn">Za naplatu</Badge> : null}
        {promised !== null && job.phase !== 'collected' ? (
          <Badge tone={promised < 0 ? 'crit' : promised === 0 ? 'warn' : 'muted'}>
            <CalendarClock className="size-3" />
            Rok {promised === 0 ? 'danas' : promised === 1 ? 'sutra' : formatDate(job.promised_at)}
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
