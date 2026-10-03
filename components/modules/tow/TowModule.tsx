import { MapPin, Navigation, ParkingSquare, PhoneCall } from 'lucide-react';
import { Badge, Button, Card, CardHeader, KeyValue } from '@/components/ui';
import { TOW_PAYERS, TOW_SERVICES, TOW_STEPS, storageDays } from '@/config/packages/tow';
import { formatDateTime, formatNumber } from '@/lib/format';
import type { ModuleProps } from '../ModuleTab';
import { MoreSections, foldable } from '../more';
import { RecordButton, RecordSheet } from '../kit';
import { opts } from '../options';
import { StorageFeeButton, TowStep } from './TowClient';

function mapsLink(address: string | null, lat?: number | null, lng?: number | null): string | null {
  if (lat != null && lng != null) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  if (address) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  return null;
}

export async function TowModule({ ctx, job, locked, extras }: ModuleProps) {
  const path = `/app/jobs/${job.id}`;
  const s = ctx.supabase;
  const [{ data: call }, { data: stays }] = await Promise.all([
    s.from('tow_calls').select('*').eq('job_id', job.id).maybeSingle(),
    s.from('tow_storage').select('*').eq('job_id', job.id).order('in_at', { ascending: false }),
  ]);
  const stay = (stays ?? [])[0] ?? null;
  const days = stay ? storageDays(stay.in_at as string, (stay.out_at as string | null) ?? null) : 0;
  const storagePrice = ctx.pkg.templates.find((t) => t.code === 'tow.storage')?.lines[0]?.price ?? 10;

  const { show, hidden } = foldable(extras);
  const showYard = show('plac i ležarina', Boolean(stay) || job.phase === 'awaiting_parts');

  const callFields = [
    { name: 'service', label: 'Usluga', type: 'select' as const, options: opts(TOW_SERVICES), half: true, required: true },
    { name: 'payer', label: 'Plaća', type: 'select' as const, options: opts(TOW_PAYERS), half: true, required: true },
    { name: 'pickup_address', label: 'Gdje je vozilo', placeholder: 'npr. A1, 112. km prema Splitu', required: true },
    { name: 'dropoff_address', label: 'Kamo ga vozimo', placeholder: 'npr. servis, kućna adresa, naš plac' },
    { name: 'payer_name', label: 'Osiguranje / asistencija', half: true },
    { name: 'claim_no', label: 'Broj slučaja', half: true },
    { name: 'distance_km', label: 'Kilometri vuče', type: 'number' as const, suffix: 'km', half: true },
    { name: 'truck', label: 'Vučno vozilo', placeholder: 'registracija', half: true },
    { name: 'notes', label: 'Napomena', type: 'textarea' as const },
  ];

  const pickup = call ? mapsLink(call.pickup_address as string | null, call.pickup_lat as number | null, call.pickup_lng as number | null) : null;
  const dropoff = call ? mapsLink(call.dropoff_address as string | null) : null;

  return (
    <div className="space-y-4">
      {/* The call */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <PhoneCall className="size-4 text-accent" /> Poziv
            </span>
          }
          subtitle={call ? `Primljen ${formatDateTime(call.called_at as string)}` : 'Gdje je vozilo, kamo ide i tko plaća'}
          action={
            call ? (
              <RecordSheet table="tow_calls" title="Poziv" upsertOn="job_id" revalidate={path} fixed={{ job_id: job.id }} initial={call} label="Uredi" fields={callFields} />
            ) : null
          }
        />
        <div className="p-4">
          {!call ? (
            !locked ? (
              <RecordSheet
                table="tow_calls"
                title="Novi poziv"
                upsertOn="job_id"
                revalidate={path}
                fixed={{ job_id: job.id }}
                initial={{ service: 'tow', payer: 'private' }}
                fields={callFields}
                trigger={
                  <Button variant="primary" size="lg" className="w-full">
                    <PhoneCall className="size-5" /> Upiši poziv
                  </Button>
                }
              />
            ) : (
              <p className="text-sm text-muted">Poziv nije upisan.</p>
            )
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Badge tone="accent">{TOW_SERVICES[call.service as string]}</Badge>
                <Badge tone={call.payer === 'private' ? 'neutral' : 'warn'}>
                  {[TOW_PAYERS[call.payer as string], call.payer_name].filter(Boolean).join(': ')}
                  {call.claim_no ? ` · br. ${call.claim_no}` : ''}
                </Badge>
                {call.distance_km != null ? <Badge tone="neutral">{formatNumber(Number(call.distance_km), 1)} km</Badge> : null}
              </div>
              <div className="grid gap-x-8 sm:grid-cols-2">
                <KeyValue label="Preuzimanje">{(call.pickup_address as string | null) ?? '-'}</KeyValue>
                <KeyValue label="Odredište">{(call.dropoff_address as string | null) ?? '-'}</KeyValue>
                {call.truck ? <KeyValue label="Vučno vozilo">{call.truck as string}</KeyValue> : null}
                {call.notes ? <KeyValue label="Napomena">{call.notes as string}</KeyValue> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {pickup ? (
                  <a href={pickup} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium hover:bg-surface2">
                    <Navigation className="size-4 text-accent" /> Navigacija do vozila
                  </a>
                ) : null}
                {dropoff ? (
                  <a href={dropoff} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium hover:bg-surface2">
                    <MapPin className="size-4 text-accent" /> Navigacija do odredišta
                  </a>
                ) : null}
              </div>

              <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TOW_STEPS.map((step, i) => {
                  const at = call[step.key] as string | null;
                  const previousDone = i === 0 || Boolean(call[TOW_STEPS[i - 1].key]);
                  return (
                    <li key={step.key} className={`rounded-xl border p-3 ${at ? 'border-ok/40 bg-ok/5' : 'border-line'}`}>
                      <p className="text-xs text-muted">{step.label}</p>
                      {at ? (
                        <p className="mt-1 text-sm font-semibold tabular">{formatDateTime(at)}</p>
                      ) : !locked ? (
                        <TowStep jobId={job.id} column={step.key} withGps={'gps' in step} disabled={!previousDone} />
                      ) : (
                        <p className="mt-1 text-sm text-faint">-</p>
                      )}
                    </li>
                  );
                })}
              </ol>
              {call.pickup_lat != null ? <p className="mt-2 text-xs text-faint">Mjesto preuzimanja spremljeno s GPS-a pri dolasku.</p> : null}
            </>
          )}
        </div>
      </Card>

      {/* The yard */}
      {showYard ? (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ParkingSquare className="size-4 text-accent" /> Plac
              </span>
            }
            subtitle={stay ? (stay.out_at ? `Izdano ${formatDateTime(stay.out_at as string)}` : `Na placu od ${formatDateTime(stay.in_at as string)}`) : 'Vozilo koje ostaje kod nas'}
          />
          <div className="p-4">
            {!stay ? (
              !locked ? (
                <RecordButton table="tow_storage" revalidate={path} variant="primary" values={{ job_id: job.id, asset_id: job.asset.id, in_at: '__now__' }} success="Vozilo je na placu">
                  Stavi na plac
                </RecordButton>
              ) : null
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={stay.out_at ? 'muted' : days > 7 ? 'warn' : 'accent'}>
                    {days} {days === 1 ? 'dan' : 'dana'}
                  </Badge>
                  {stay.spot ? <Badge tone="neutral">Mjesto {stay.spot as string}</Badge> : null}
                  {stay.released_to ? <span className="text-sm text-muted">Preuzeo: {stay.released_to as string}</span> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!locked ? (
                    <RecordSheet
                      table="tow_storage"
                      title="Na placu"
                      id={stay.id as string}
                      revalidate={path}
                      initial={stay}
                      label="Mjesto i napomena"
                      fields={[
                        { name: 'spot', label: 'Mjesto na placu', half: true },
                        { name: 'note', label: 'Napomena', type: 'textarea' },
                      ]}
                    />
                  ) : null}
                  {!stay.out_at && !locked ? (
                    <RecordSheet
                      table="tow_storage"
                      title="Izdaj vozilo"
                      id={stay.id as string}
                      revalidate={path}
                      fixed={{ out_at: '__now__' }}
                      label="Izdaj vozilo"
                      fields={[{ name: 'released_to', label: 'Tko je preuzeo (ime, broj osobne)', required: true }]}
                    />
                  ) : null}
                  {ctx.isOwner && !locked ? <StorageFeeButton jobId={job.id} days={days} price={storagePrice} /> : null}
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : null}
      <MoreSections href={`${path}?tab=modul&vise=1`} hidden={hidden} />
    </div>
  );
}
