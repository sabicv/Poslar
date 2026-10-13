import Link from 'next/link';
import { KeyRound, Lock, MapPin, Phone } from 'lucide-react';
import { Badge, BackLink } from '@/components/ui';
import { ASSET_TYPE_LABELS } from '@/config/tenant.config';
import { assetTitle, clientName, formatDateTime } from '@/lib/format';
import type { JobWithRefs } from '@/types/db';

// Everything about the job exactly once: the phase and the money show in
// the stepper under the header and change in the bottom bar (with "Pitaj
// Poslara"), the amount in Stavke, "promised by" in Pregled, client details on
// the client page (the name here links there). On a field visit the
// call and navigation buttons sit in the visit card, so the header only
// names the address.
export function JobHeader({ job, backHref, backLabel }: { job: JobWithRefs; backHref: string; backLabel: string }) {
  const field = job.work_mode === 'field';
  return (
    <header className="mb-4">
      <BackLink href={backHref}>{backLabel}</BackLink>
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-sm text-faint">Nalog #{job.number}</span>
          {job.is_urgent ? <Badge tone="crit">Hitno</Badge> : null}
          {job.locked_at ? (
            <Badge tone="muted">
              <Lock className="size-3" /> Zaključano
            </Badge>
          ) : null}
        </div>
        <h1 className="type-page">
          <Link prefetch={false} href={`/app/assets/${job.asset.id}`} className="hover:underline">
            {assetTitle(job.asset)}
          </Link>
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {job.asset.identifier ? <span className="rounded-md border border-line bg-surface px-1.5 font-mono text-xs font-semibold text-fg">{job.asset.identifier}</span> : null}
          <span>{ASSET_TYPE_LABELS[job.asset.asset_type]}</span>
          {/* 48 px tall to the thumb, but no taller in the line (negative margin). */}
          <Link prefetch={false} href={`/app/clients/${job.client.id}`} className="-my-3.5 inline-flex min-h-12 items-center hover:text-fg hover:underline">
            {clientName(job.client)}
          </Link>
          {!field && job.client.phone ? (
            <a href={`tel:${job.client.phone.replace(/\s/g, '')}`} className="-my-3.5 inline-flex min-h-12 items-center gap-1 text-accent">
              <Phone className="size-3.5" /> {job.client.phone}
            </a>
          ) : null}
        </div>
        {/* When it happened: never shown elsewhere on the job, so it goes here. */}
        <p className="mt-1.5 text-sm">
          <span className="text-muted">Radnik</span> <span className="font-medium text-fg">{job.assignee?.full_name || 'nije dodijeljen'}</span>
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-faint">
          <span>Primljeno {formatDateTime(job.created_at)}</span>
          {job.finished_at ? <span>Gotovo {formatDateTime(job.finished_at)}</span> : null}
          {job.collected_at ? <span>Preuzeto {formatDateTime(job.collected_at)}</span> : null}
          {job.payment_status === 'paid' && job.paid_at ? <span>Plaćeno {formatDateTime(job.paid_at)}</span> : null}
        </p>
        {field && job.site ? (
          <div className="mt-2 space-y-1 text-sm">
            <p className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0 text-accent" />
              {[job.site.label, job.site.address, job.site.city].filter(Boolean).join(', ')}
            </p>
            {job.site.access_notes ? (
              <p className="flex items-start gap-1.5 text-warn">
                <KeyRound className="mt-0.5 size-3.5 shrink-0" /> {job.site.access_notes}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
