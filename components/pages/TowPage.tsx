import Link from 'next/link';
import { Navigation, PhoneCall } from 'lucide-react';
import { Badge, Card, CardHeader, EmptyState, Stat, buttonClass } from '@/components/ui';
import { TOW_PAYERS, TOW_SERVICES, TOW_STEPS, storageDays } from '@/config/packages/tow';
import { assetTitle, clientName, formatDateTime, formatEuro, formatNumber, formatRelative } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { templateLinePrice } from '@/lib/templates';
import { todayInZagreb, zagrebMidnight } from '@/lib/time';

type JobRef = {
  id: string;
  number: number;
  client: { kind: 'person' | 'company'; first_name: string | null; last_name: string | null; company_name: string | null; phone: string | null } | null;
  asset: { asset_type: never; identifier: string | null; make: string | null; model: string | null } | null;
};

// Tow Files: calls still on the road, cars on the yard, this month in numbers.
export async function TowPage({ ctx }: { ctx: WorkshopContext }) {
  const monthStart = zagrebMidnight(`${todayInZagreb().slice(0, 7)}-01`).toISOString();
  const jobRef = 'job:jobs(id, number, client:clients(kind, first_name, last_name, company_name, phone), asset:assets(asset_type, identifier, make, model))';
  const [{ data: open }, { data: yard }, { data: month }] = await Promise.all([
    ctx.supabase.from('tow_calls').select(`*, ${jobRef}`).is('delivered_at', null).order('called_at', { ascending: false }).limit(50),
    ctx.supabase.from('tow_storage').select(`id, in_at, spot, ${jobRef}`).is('out_at', null).order('in_at'),
    ctx.supabase.from('tow_calls').select('payer, distance_km').gte('called_at', monthStart),
  ]);
  const calls = (open ?? []) as unknown as (Record<string, unknown> & { job: JobRef | null })[];
  const parked = (yard ?? []) as unknown as { id: string; in_at: string; spot: string | null; job: JobRef | null }[];
  // The owner's own storage price (Cjenik), never shown to a worker.
  const storagePrice = ctx.isOwner ? await templateLinePrice(ctx, 'tow.storage', 0, 10) : 0;
  const km = (month ?? []).reduce((s, c) => s + Number(c.distance_km ?? 0), 0);
  const viaPartners = (month ?? []).filter((c) => c.payer === 'insurance' || c.payer === 'assistance').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pozivi ovaj mjesec" value={(month ?? []).length} />
        <Stat label="Kilometri vuče" value={formatNumber(km, 0)} />
        <Stat label="Preko osiguranja i asistencije" value={viaPartners} />
        <Stat label="Vozila na placu" value={parked.length} tone={parked.length ? 'accent' : undefined} />
      </div>

      <Card>
        <CardHeader title="Na cesti" subtitle="Pozivi koji još nisu predani" action={<Link href="/app/jobs/new" className={buttonClass('primary', 'sm')}><PhoneCall className="size-4" /> Novi poziv</Link>} />
        {calls.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Nema otvorenih poziva" />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {calls.map((c) => {
              const step = [...TOW_STEPS].reverse().find((s) => c[s.key]);
              const destination = c.pickup_lat != null ? `${c.pickup_lat},${c.pickup_lng}` : (c.pickup_address as string | null);
              return (
                <li key={c.job_id as string} className="space-y-2 px-4 py-3">
                  <Link href={c.job ? `/app/jobs/${c.job.id}?tab=modul` : '#'} className="block">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono font-semibold">{c.job?.asset?.identifier ?? '-'}</span>
                      <span className="text-muted">{assetTitle(c.job?.asset)}</span>
                      <Badge tone="accent">{TOW_SERVICES[c.service as string]}</Badge>
                      <Badge tone={step ? 'ok' : 'warn'}>{step ? step.label : `Primljen ${formatRelative(c.called_at as string)}`}</Badge>
                    </div>
                    <p className="mt-1 text-sm">{(c.pickup_address as string | null) ?? 'Lokacija nije upisana'}</p>
                    <p className="text-xs text-faint">
                      {clientName(c.job?.client)} · {TOW_PAYERS[c.payer as string]}
                      {c.payer_name ? `: ${c.payer_name}` : ''}
                    </p>
                  </Link>
                  {destination ? (
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
                      <Navigation className="size-4" /> Navigacija
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Na placu" subtitle={ctx.isOwner ? `Ležarina po ${formatEuro(storagePrice)} na dan` : 'Vozila koja čekaju vlasnika'} />
        {parked.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Plac je prazan.</p>
        ) : (
          <ul className="divide-y divide-line">
            {parked.map((p) => {
              const days = storageDays(p.in_at, null);
              return (
                <li key={p.id}>
                  <Link href={p.job ? `/app/jobs/${p.job.id}?tab=modul` : '#'} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm hover:bg-surface2">
                    <span className="font-mono font-semibold">{p.job?.asset?.identifier ?? '-'}</span>
                    <span className="text-muted">{assetTitle(p.job?.asset)}</span>
                    {p.spot ? <Badge tone="neutral">Mjesto {p.spot}</Badge> : null}
                    <span className="w-full text-xs text-faint sm:w-auto">Od {formatDateTime(p.in_at)} · {clientName(p.job?.client)}</span>
                    <span className="ml-auto flex items-center gap-2">
                      {ctx.isOwner ? <span className="text-xs tabular text-muted">{formatEuro(days * storagePrice)}</span> : null}
                      <Badge tone={days > 7 ? 'warn' : 'accent'}>
                        {days} {days === 1 ? 'dan' : 'dana'}
                      </Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
