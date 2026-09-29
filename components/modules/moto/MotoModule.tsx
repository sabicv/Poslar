import Link from 'next/link';
import { Anchor, Snowflake, Sun, Warehouse } from 'lucide-react';
import { Badge, Card, CardHeader, KeyValue } from '@/components/ui';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import type { ModuleProps } from '../ModuleTab';
import { RecordButton, RecordSheet, opts } from '../kit';
import { ProtocolSheet } from './ProtocolSheet';

const HULL = { grp: 'Stakloplastika', aluminium: 'Aluminij', wood: 'Drvo', inflatable: 'Gumenjak', steel: 'Čelik', other: 'Ostalo' };
const STROKE = { '2T': 'Dvotaktni', '4T': 'Četverotaktni' };
const POSITION = { single: 'Jedan motor', port: 'Lijevi', starboard: 'Desni', center: 'Srednji' };
const BOATS = ['boat', 'jetski'];
const ENGINES = ['outboard', 'inboard', 'jetski', 'boat'];

export async function MotoModule({ ctx, job, locked }: ModuleProps) {
  const path = `/app/jobs/${job.id}`;
  const s = ctx.supabase;
  const type = job.asset.asset_type;
  const [{ data: vessel }, { data: engine }, { data: protocols }, { data: stay }, { data: locations }, { data: inspections }] = await Promise.all([
    s.from('moto_vessel_details').select('*').eq('asset_id', job.asset.id).maybeSingle(),
    s.from('moto_engine_details').select('*').eq('asset_id', job.asset.id).maybeSingle(),
    s.from('moto_seasonal_protocols').select('*').eq('job_id', job.id),
    s.from('moto_storage_stays').select('*').eq('asset_id', job.asset.id).is('released_at', null).maybeSingle(),
    s.from('moto_storage_locations').select('id, area, slot, kind').order('area').order('slot'),
    s.from('inspections').select('id, template_code, completed_at').eq('job_id', job.id),
  ]);
  const locationLabel = new Map((locations ?? []).map((l) => [l.id as string, `${l.area} · ${l.slot}`]));
  const isOutboard = type === 'outboard' || type === 'inboard';
  const protocolTemplate = (kind: string) => (kind === 'dewinterize' ? 'moto.dewinterize' : isOutboard || BOATS.includes(type) ? 'moto.winterize_outboard' : 'moto.winterize_moto');

  return (
    <div className="space-y-4">
      {/* Seasonal protocols */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Snowflake className="size-4 text-accent" /> Konzervacija i dekonzervacija
            </span>
          }
          subtitle="Protokol s kontrolnom listom, stabilizatorom goriva, akumulatorom i anodama"
          action={
            !locked ? (
              <div className="flex gap-2">
                {!(protocols ?? []).some((p) => p.kind === 'winterize') ? (
                  <RecordButton table="moto_seasonal_protocols" revalidate={path} size="sm" values={{ job_id: job.id, kind: 'winterize' }}>
                    <Snowflake className="size-4" /> Zimovanje
                  </RecordButton>
                ) : null}
                {!(protocols ?? []).some((p) => p.kind === 'dewinterize') ? (
                  <RecordButton table="moto_seasonal_protocols" revalidate={path} size="sm" values={{ job_id: job.id, kind: 'dewinterize' }}>
                    <Sun className="size-4" /> Priprema za sezonu
                  </RecordButton>
                ) : null}
              </div>
            ) : null
          }
        />
        {(protocols ?? []).length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Otvorite protokol pa prođite kontrolnu listu u kartici Inspekcija.</p>
        ) : (
          <ul className="divide-y divide-line">
            {(protocols ?? []).map((p) => {
              const anodes = (p.anodes_wear_pct as Record<string, number>) ?? {};
              const checklist = (inspections ?? []).find((i) => i.template_code === protocolTemplate(p.kind as string));
              return (
                <li key={p.id as string} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{p.kind === 'winterize' ? 'Konzervacija (zimovanje)' : 'Dekonzervacija'}</span>
                    {p.completed_at ? <Badge tone="ok">Završeno {formatDate(p.completed_at as string)}</Badge> : <Badge tone="warn">U tijeku</Badge>}
                    {p.fuel_stabilized ? <Badge tone="muted">Stabilizator ✓</Badge> : null}
                    {p.battery_maintained ? <Badge tone="muted">Akumulator ✓</Badge> : null}
                    {checklist ? (
                      <Link href={`${path}?tab=inspekcija`} className="text-xs text-accent">
                        Kontrolna lista {checklist.completed_at ? '✓' : '→'}
                      </Link>
                    ) : (
                      <Link href={`${path}?tab=inspekcija`} className="text-xs text-accent">
                        Pokreni kontrolnu listu →
                      </Link>
                    )}
                  </div>
                  {Object.keys(anodes).length ? (
                    <p className="text-sm text-muted">
                      Anode: {Object.entries(anodes).map(([k, v]) => `${k} ${v}%`).join(' · ')}
                    </p>
                  ) : null}
                  {!locked ? (
                    <div className="flex flex-wrap gap-2">
                      <ProtocolSheet
                        id={p.id as string}
                        jobId={job.id}
                        fuelStabilized={Boolean(p.fuel_stabilized)}
                        batteryMaintained={Boolean(p.battery_maintained)}
                        anodes={anodes}
                      />
                      {!p.completed_at ? (
                        <RecordButton table="moto_seasonal_protocols" id={p.id as string} revalidate={path} size="sm" variant="ok" values={{ completed_at: '__now__' }}>
                          Završi protokol
                        </RecordButton>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Vessel */}
      {BOATS.includes(type) ? (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Anchor className="size-4 text-accent" /> Plovilo
              </span>
            }
            action={
              <RecordSheet
                table="moto_vessel_details"
                title="Podaci o plovilu"
                upsertOn="asset_id"
                revalidate={path}
                fixed={{ asset_id: job.asset.id }}
                initial={vessel ?? {}}
                label={vessel ? 'Uredi' : 'Upiši'}
                fields={[
                  { name: 'vessel_name', label: 'Ime plovila', half: true },
                  { name: 'registration_mark', label: 'Registarska oznaka', half: true },
                  { name: 'length_m', label: 'Duljina', type: 'number', suffix: 'm', half: true },
                  { name: 'beam_m', label: 'Širina', type: 'number', suffix: 'm', half: true },
                  { name: 'hull_material', label: 'Trup', type: 'select', options: opts(HULL), half: true },
                  { name: 'home_port', label: 'Matična luka', half: true },
                  { name: 'berth', label: 'Vez' },
                ]}
              />
            }
          />
          {vessel ? (
            <div className="grid gap-x-8 px-4 py-1 sm:grid-cols-2">
              <KeyValue label="Ime">{(vessel.vessel_name as string | null) ?? '—'}</KeyValue>
              <KeyValue label="Oznaka">{(vessel.registration_mark as string | null) ?? '—'}</KeyValue>
              <KeyValue label="Dimenzije">{vessel.length_m ? `${formatNumber(vessel.length_m as number)} × ${formatNumber(vessel.beam_m as number)} m` : '—'}</KeyValue>
              <KeyValue label="Trup">{vessel.hull_material ? HULL[vessel.hull_material as keyof typeof HULL] : '—'}</KeyValue>
              <KeyValue label="Luka / vez">{[vessel.home_port, vessel.berth].filter(Boolean).join(' · ') || '—'}</KeyValue>
            </div>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">HIN/CIN je u podacima objekta; ovdje ime, dimenzije i vez.</p>
          )}
        </Card>
      ) : null}

      {/* Engine */}
      {ENGINES.includes(type) ? (
        <Card>
          <CardHeader
            title="Motor"
            subtitle="Serijski broj, snaga i zadnja zamjena impelera"
            action={
              <RecordSheet
                table="moto_engine_details"
                title="Podaci o motoru"
                upsertOn="asset_id"
                revalidate={path}
                fixed={{ asset_id: job.asset.id }}
                initial={engine ?? {}}
                label={engine ? 'Uredi' : 'Upiši'}
                fields={[
                  { name: 'engine_serial', label: 'Serijski broj motora' },
                  { name: 'power_hp', label: 'Snaga', type: 'number', suffix: 'KS', half: true },
                  { name: 'stroke', label: 'Takt', type: 'select', options: opts(STROKE), half: true },
                  { name: 'position', label: 'Položaj', type: 'select', options: opts(POSITION) },
                  { name: 'impeller_replaced_mth', label: 'Impeler zamijenjen na', type: 'number', suffix: 'mth', half: true },
                  { name: 'impeller_replaced_date', label: 'Impeler zamijenjen', type: 'date', half: true },
                ]}
              />
            }
          />
          {engine ? (
            <div className="grid gap-x-8 px-4 py-1 sm:grid-cols-2">
              <KeyValue label="Serijski broj">{<span className="font-mono text-xs">{(engine.engine_serial as string | null) ?? '—'}</span>}</KeyValue>
              <KeyValue label="Snaga">{engine.power_hp ? `${engine.power_hp} KS` : '—'}</KeyValue>
              <KeyValue label="Takt">{engine.stroke ? STROKE[engine.stroke as keyof typeof STROKE] : '—'}</KeyValue>
              <KeyValue label="Impeler">
                {engine.impeller_replaced_date ? `${formatDate(engine.impeller_replaced_date as string)}${engine.impeller_replaced_mth ? ` · ${engine.impeller_replaced_mth} mth` : ''}` : '—'}
              </KeyValue>
            </div>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Nema podataka o motoru.</p>
          )}
        </Card>
      ) : null}

      {/* Storage */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Warehouse className="size-4 text-accent" /> Skladištenje
            </span>
          }
          subtitle={stay ? `${locationLabel.get(stay.location_id as string) ?? ''} · od ${formatDate(stay.from_date as string)}` : 'Zimski smještaj u hali ili na otvorenom'}
          action={
            !stay && locations?.length ? (
              <RecordSheet
                table="moto_storage_stays"
                title="Smještaj"
                revalidate={path}
                fixed={{ asset_id: job.asset.id }}
                label="Smjesti"
                initial={{ from_date: new Date().toISOString().slice(0, 10) }}
                fields={[
                  { name: 'location_id', label: 'Mjesto', type: 'select', options: (locations ?? []).map((l) => ({ value: l.id as string, label: locationLabel.get(l.id as string)! })), required: true },
                  { name: 'from_date', label: 'Od', type: 'date', half: true, required: true },
                  { name: 'until_date', label: 'Do (planirano)', type: 'date', half: true },
                ]}
              />
            ) : null
          }
        />
        <div className="p-4 text-sm">
          {stay ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="ok">Na skladištu</Badge>
              {stay.until_date ? <span className="text-muted">Planirano do {formatDate(stay.until_date as string)}</span> : null}
              <RecordButton table="moto_storage_stays" id={stay.id as string} revalidate={path} size="sm" values={{ released_at: '__now__' }} success="Izdano sa skladišta">
                Izdaj sa skladišta
              </RecordButton>
            </div>
          ) : locations?.length ? (
            <p className="text-muted">Nije na skladištu.</p>
          ) : (
            <p className="text-muted">
              Dodajte mjesta u izborniku{' '}
              <Link href="/app/module" className="text-accent">
                {ctx.pkg.modulePage}
              </Link>
              .
            </p>
          )}
          {stay && ((stay.battery_checks as unknown[]) ?? []).length ? (
            <p className="mt-2 text-xs text-faint">Provjere akumulatora: {((stay.battery_checks as { at: string; v: number }[]) ?? []).map((b) => `${formatDateTime(b.at)} ${b.v} V`).join(' · ')}</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
