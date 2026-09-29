import Link from 'next/link';
import { Lock, Phone } from 'lucide-react';
import { Badge, BackLink, Dot } from '@/components/ui';
import { ASSET_TYPE_LABELS, PHASE_TONE, phaseLabel, type PackageConfig } from '@/config/tenant.config';
import { assetTitle, clientName, formatDateTime, formatEuro, formatMeter } from '@/lib/format';
import type { JobWithRefs } from '@/types/db';

export function JobHeader({ job, pkg, total }: { job: JobWithRefs; pkg: PackageConfig; total: number | null }) {
  const tone = PHASE_TONE[job.phase];
  return (
    <header className="mb-4">
      <BackLink href="/app">Nalozi</BackLink>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-faint">Nalog #{job.number}</span>
            <Badge tone={tone}>
              <Dot tone={tone} />
              {phaseLabel(pkg, job.phase)}
            </Badge>
            {job.is_urgent ? <Badge tone="crit">Hitno</Badge> : null}
            {job.locked_at ? (
              <Badge tone="muted">
                <Lock className="size-3" /> Zaključano
              </Badge>
            ) : null}
            {total !== null ? <Badge tone={job.payment_status === 'paid' ? 'ok' : 'warn'}>{job.payment_status === 'paid' ? 'Plaćeno' : 'Za naplatu'}</Badge> : null}
          </div>
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            <Link href={`/app/assets/${job.asset.id}`} className="hover:underline">
              {assetTitle(job.asset)}
            </Link>
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {job.asset.identifier ? <span className="rounded-md border border-line bg-surface px-1.5 font-mono text-xs font-semibold text-fg">{job.asset.identifier}</span> : null}
            <span>{ASSET_TYPE_LABELS[job.asset.asset_type]}</span>
            {job.meter_in !== null ? <span>{formatMeter(job.meter_in, job.meter_unit)}</span> : null}
            <Link href={`/app/clients/${job.client.id}`} className="hover:text-fg hover:underline">
              {clientName(job.client)}
            </Link>
            {job.client.phone ? (
              <a href={`tel:${job.client.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-accent">
                <Phone className="size-3.5" /> {job.client.phone}
              </a>
            ) : null}
          </div>
        </div>
        {total !== null ? (
          <div className="text-right">
            <p className="text-xs text-muted">Ukupno s PDV-om</p>
            <p className="text-2xl font-semibold tabular tracking-tight">{formatEuro(total)}</p>
            {job.promised_at ? <p className="text-xs text-faint">Obećano {formatDateTime(job.promised_at)}</p> : null}
          </div>
        ) : job.promised_at ? (
          <p className="text-sm text-muted">Obećano {formatDateTime(job.promised_at)}</p>
        ) : null}
      </div>
    </header>
  );
}
