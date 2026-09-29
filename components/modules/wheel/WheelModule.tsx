import Link from 'next/link';
import { Disc3, Gauge, QrCode, Ruler, Wrench } from 'lucide-react';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { SEASON_LABELS, TIRE_POSITIONS, TREAD_LIMITS } from '@/config/packages/wheel';
import { formatDate, formatDateTime } from '@/lib/format';
import type { ModuleProps } from '../ModuleTab';
import { DeleteRecordButton, PrivateAmountSheet, RecordButton, RecordSheet, opts } from '../kit';
import { StorageActions } from './StorageActions';

const POSITIONS = { FL: 'Prednja lijeva', FR: 'Prednja desna', RL: 'Stražnja lijeva', RR: 'Stražnja desna', SPARE: 'Rezervna' };
const DAMAGE = { none: 'Bez oštećenja', cut: 'Posjekotina', bulge: 'Ispupčenje', sidewall_cracks: 'Pukotine boka', bead_damage: 'Oštećena peta' };
const ZONE = { tread: 'Gazeći sloj', shoulder: 'Rame', sidewall: 'Bok' };
const METHOD = { plug: 'Čep', patch: 'Flaster', combo: 'Kombinirani' };
const PARAM = { toe: 'Konvergencija', total_toe: 'Ukupna konvergencija', camber: 'Nagib kotača', caster: 'Nagib osovine', thrust: 'Kut vožnje' };

export function tireSize(set: Record<string, unknown>) {
  if (!set.width) return 'Dimenzija nije upisana';
  return `${set.width}/${set.aspect ?? '—'} R${set.rim_diameter ?? '—'}${set.load_index ? ` ${set.load_index}` : ''}${set.speed_index ?? ''}`;
}

export function treadTone(season: string, mm: number | null): 'ok' | 'warn' | 'crit' | 'muted' {
  if (mm === null) return 'muted';
  const limits = TREAD_LIMITS[season as keyof typeof TREAD_LIMITS] ?? TREAD_LIMITS.summer;
  return mm < limits.crit ? 'crit' : mm < limits.warn ? 'warn' : 'ok';
}

export async function WheelModule({ ctx, job, locked }: ModuleProps) {
  const path = `/app/jobs/${job.id}`;
  const s = ctx.supabase;
  const [{ data: sets }, { data: locations }, { data: torque }, { data: specs }, { data: repairs }, { data: balancing }, { data: alignments }] = await Promise.all([
    s
      .from('wheel_tire_sets')
      .select('*, tires:wheel_tires(*), stays:wheel_storage_stays(id, location_id, checked_in_at, checked_out_at, season_label)')
      .eq('client_id', job.client.id)
      .neq('status', 'disposed')
      .order('created_at', { ascending: false }),
    s.from('wheel_storage_locations').select('id, sector, rack, shelf, slot').order('sector').order('rack').order('shelf').order('slot'),
    s.from('wheel_torque_records').select('*').eq('job_id', job.id).order('created_at'),
    job.asset.make ? s.from('wheel_torque_specs').select('torque_nm, bolt_size, retorque_km, model').ilike('make', job.asset.make) : Promise.resolve({ data: [] }),
    s.from('wheel_repairs').select('*').eq('job_id', job.id),
    s.from('wheel_balancing').select('*').eq('job_id', job.id),
    s.from('wheel_alignments').select('*, values:wheel_alignment_values(*)').eq('job_id', job.id).order('performed_at'),
  ]);

  const locationLabel = new Map((locations ?? []).map((l) => [l.id as string, `${l.sector}-${l.rack}-${l.shelf}-${l.slot}`]));
  const occupied = new Set(
    (sets ?? []).flatMap((set) => ((set.stays as { location_id: string; checked_out_at: string | null }[]) ?? []).filter((st) => !st.checked_out_at).map((st) => st.location_id))
  );
  const freeLocations = (locations ?? []).filter((l) => !occupied.has(l.id as string)).map((l) => ({ value: l.id as string, label: locationLabel.get(l.id as string)! }));
  const spec = (specs ?? []).find((sp) => !sp.model || (job.asset.model ?? '').toLowerCase().includes(String(sp.model).toLowerCase())) ?? specs?.[0];

  let fees = new Map<string, number>();
  if (ctx.isOwner) {
    const stayIds = (sets ?? []).flatMap((set) => ((set.stays as { id: string }[]) ?? []).map((st) => st.id));
    if (stayIds.length) {
      const { data } = await s.from('private_amounts').select('entity_id, amount').eq('entity', 'wheel_storage_stays').eq('field', 'fee').in('entity_id', stayIds);
      fees = new Map((data ?? []).map((r) => [r.entity_id as string, Number(r.amount)]));
    }
  }

  return (
    <div className="space-y-4">
      {/* Tyre sets and hotel */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Disc3 className="size-4 text-accent" /> Setovi guma — {ctx.pkg.vocabulary.client.one.toLowerCase()}
            </span>
          }
          subtitle="Šara u tri točke, DOT, lokacija u hotelu"
          action={
            <RecordSheet
              table="wheel_tire_sets"
              title="Novi set guma"
              revalidate={path}
              fixed={{ client_id: job.client.id, asset_id: job.asset.id }}
              label="Set"
              initial={{ season: 'winter', status: 'on_vehicle' }}
              fields={[
                { name: 'season', label: 'Sezona', type: 'select', options: opts(SEASON_LABELS), required: true, half: true },
                { name: 'status', label: 'Gdje je', type: 'select', options: [{ value: 'on_vehicle', label: 'Na vozilu' }, { value: 'stored', label: 'Kod nas' }], half: true, required: true },
                { name: 'width', label: 'Širina', type: 'number', placeholder: '205', half: true },
                { name: 'aspect', label: 'Visina', type: 'number', placeholder: '55', half: true },
                { name: 'rim_diameter', label: 'Promjer', type: 'number', placeholder: '16', half: true },
                { name: 'load_index', label: 'Indeks nosivosti', placeholder: '91', half: true },
                { name: 'speed_index', label: 'Indeks brzine', placeholder: 'V', half: true },
                { name: 'brand', label: 'Marka', half: true },
                { name: 'model', label: 'Model' },
                { name: 'on_rims', label: 'Na naplatcima', type: 'checkbox', half: true },
                { name: 'bolts_included', label: 'S vijcima', type: 'checkbox', half: true },
                { name: 'rim_material', label: 'Naplatci', type: 'select', options: [{ value: 'alloy', label: 'Alu' }, { value: 'steel', label: 'Čelični' }], half: true },
                { name: 'lock_key_location', label: 'Ključ sig. vijaka', placeholder: 'npr. u pretincu', half: true },
                { name: 'notes', label: 'Napomena', type: 'textarea' },
              ]}
            />
          }
        />
        {!sets?.length ? (
          <p className="px-4 py-4 text-sm text-muted">Nema setova. Dodajte set koji je na vozilu i onaj koji ostaje kod vas na čuvanju.</p>
        ) : (
          <div className="divide-y divide-line">
            {sets.map((set) => {
              const tires = (set.tires as Record<string, unknown>[]) ?? [];
              const stay = ((set.stays as { id: string; location_id: string; checked_in_at: string; checked_out_at: string | null }[]) ?? []).find((st) => !st.checked_out_at);
              return (
                <div key={set.id as string} className="px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={set.season === 'winter' ? 'accent' : 'neutral'}>{SEASON_LABELS[set.season as string]}</Badge>
                    <span className="font-mono text-sm font-semibold">{tireSize(set)}</span>
                    <span className="text-sm text-muted">{[set.brand, set.model].filter(Boolean).join(' ')}</span>
                    {stay ? <Badge tone="ok">Hotel {locationLabel.get(stay.location_id)}</Badge> : <Badge tone="muted">{set.status === 'on_vehicle' ? 'Na vozilu' : 'Izdano'}</Badge>}
                    <Link href={`/app/module/label/${set.id}`} className="ml-auto inline-flex items-center gap-1 text-xs text-accent" target="_blank">
                      <QrCode className="size-3.5" /> {set.qr_code as string}
                    </Link>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {TIRE_POSITIONS.map((pos) => {
                      const tire = tires.find((t) => t.position === pos.code);
                      const values = tire ? [tire.tread_outer_mm, tire.tread_middle_mm, tire.tread_inner_mm].map((v) => (v === null ? null : Number(v))) : [null, null, null];
                      const measured = values.filter((v): v is number => v !== null);
                      const min = measured.length ? Math.min(...measured) : null;
                      const tone = treadTone(set.season as string, min);
                      const dotAge = tire?.dot_year ? new Date().getFullYear() - Number(tire.dot_year) : null;
                      return (
                        <RecordSheet
                          key={pos.code}
                          table="wheel_tires"
                          title={`${pos.label} — mjerenje`}
                          upsertOn="set_id,position"
                          revalidate={path}
                          fixed={{ set_id: set.id, position: pos.code, measured_at: '__now__' }}
                          initial={tire ?? { damage: 'none' }}
                          trigger={
                            <button
                              type="button"
                              disabled={locked}
                              className={`rounded-xl border p-2.5 text-left ${tone === 'crit' ? 'border-crit/50 bg-crit/10' : tone === 'warn' ? 'border-warn/50 bg-warn/10' : tone === 'ok' ? 'border-ok/40 bg-ok/5' : 'border-line'}`}
                            >
                              <span className="block text-[11px] text-muted">{pos.label}</span>
                              <span className="block font-mono text-sm font-semibold tabular">{measured.length ? values.map((v) => (v === null ? '–' : v.toFixed(1))).join(' / ') : 'izmjeri'}</span>
                              <span className="block text-[11px] text-faint">
                                {tire?.dot_week ? `DOT ${String(tire.dot_week).padStart(2, '0')}${String(tire.dot_year).slice(-2)}` : 'DOT —'}
                                {dotAge !== null && dotAge >= 6 ? ` · ${dotAge} god.` : ''}
                              </span>
                            </button>
                          }
                          fields={[
                            { name: 'tread_outer_mm', label: 'Vanjski rub', type: 'number', suffix: 'mm', half: true },
                            { name: 'tread_middle_mm', label: 'Sredina', type: 'number', suffix: 'mm', half: true },
                            { name: 'tread_inner_mm', label: 'Unutarnji rub', type: 'number', suffix: 'mm', half: true },
                            { name: 'damage', label: 'Oštećenje', type: 'select', options: opts(DAMAGE), half: true },
                            { name: 'dot_week', label: 'DOT tjedan', type: 'number', placeholder: '12', half: true },
                            { name: 'dot_year', label: 'DOT godina', type: 'number', placeholder: '2022', half: true },
                          ]}
                        />
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {!locked ? (
                      <StorageActions
                        setId={set.id as string}
                        stayId={stay?.id ?? null}
                        locations={freeLocations}
                        seasonLabel={`${SEASON_LABELS[set.season as string]} ${new Date().getFullYear()}`}
                        jobId={job.id}
                      />
                    ) : null}
                    {stay ? <span className="text-xs text-muted">Zaprimljeno {formatDate(stay.checked_in_at)}</span> : null}
                    {ctx.isOwner && stay ? (
                      <span className="ml-auto flex items-center gap-2 text-xs text-muted">
                        Naknada: <PrivateAmountSheet entity="wheel_storage_stays" entityId={stay.id} field="fee" title="Naknada za čuvanje" amount={fees.get(stay.id) ?? null} revalidate={path} />
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!locations?.length ? (
          <p className="border-t border-line px-4 py-3 text-xs text-muted">
            Za hotel prvo dodajte police u izborniku{' '}
            <Link href="/app/module" className="text-accent">
              {ctx.pkg.modulePage}
            </Link>
            .
          </p>
        ) : null}
      </Card>

      {/* Torque */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Wrench className="size-4 text-accent" /> Moment pritezanja
            </span>
          }
          subtitle={spec ? `Za ${job.asset.make}: ${spec.torque_nm} Nm${spec.bolt_size ? ` · ${spec.bolt_size}` : ''} · ponovno nakon ${spec.retorque_km} km` : 'Upišite moment i datum ponovnog pritezanja'}
          action={
            !locked ? (
              <RecordSheet
                table="wheel_torque_records"
                title="Pritezanje kotača"
                revalidate={path}
                fixed={{ job_id: job.id }}
                label="Zapis"
                initial={{ applied_nm: spec?.torque_nm ?? 110, retorque_due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }}
                fields={[
                  { name: 'applied_nm', label: 'Moment', type: 'number', suffix: 'Nm', half: true, required: true },
                  { name: 'tool', label: 'Alat', placeholder: 'moment ključ', half: true },
                  { name: 'tool_calibrated_on', label: 'Alat kalibriran', type: 'date', half: true },
                  { name: 'retorque_due', label: 'Ponovno pritegnuti do', type: 'date', half: true },
                ]}
              />
            ) : null
          }
        />
        {torque?.length ? (
          <ul className="divide-y divide-line">
            {torque.map((t) => (
              <li key={t.id as string} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <Gauge className="size-4 text-faint" />
                <span className="font-semibold tabular">{t.applied_nm as number} Nm</span>
                <span className="text-muted">{t.tool as string | null}</span>
                {t.retorque_due ? <Badge tone={t.retorque_done ? 'ok' : 'warn'}>{t.retorque_done ? 'Ponovno pritegnuto' : `Ponovno do ${formatDate(t.retorque_due as string)}`}</Badge> : null}
                {!t.retorque_done && !locked ? (
                  <span className="ml-auto">
                    <RecordButton table="wheel_torque_records" id={t.id as string} revalidate={path} size="sm" values={{ retorque_done: true }}>
                      Pritegnuto
                    </RecordButton>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-4 text-sm text-muted">Nema zapisa za ovaj nalog.</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Repairs */}
        <Card>
          <CardHeader
            title="Popravak gume"
            action={
              !locked ? (
                <RecordSheet
                  table="wheel_repairs"
                  title="Popravak gume"
                  revalidate={path}
                  fixed={{ job_id: job.id }}
                  label="Dodaj"
                  fields={[
                    { name: 'position', label: 'Kotač', type: 'select', options: opts(POSITIONS), required: true, half: true },
                    { name: 'damage_zone', label: 'Mjesto oštećenja', type: 'select', options: opts(ZONE), required: true, half: true },
                    { name: 'method', label: 'Metoda', type: 'select', options: opts(METHOD) },
                  ]}
                />
              ) : null
            }
          />
          {repairs?.length ? (
            <ul className="divide-y divide-line">
              {repairs.map((r) => (
                <li key={r.id as string} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                  <span>{POSITIONS[r.position as keyof typeof POSITIONS]}</span>
                  <span className="text-muted">· {ZONE[r.damage_zone as keyof typeof ZONE]}</span>
                  {r.allowed ? <Badge tone="ok">{r.method ? METHOD[r.method as keyof typeof METHOD] : 'Dopušteno'}</Badge> : <Badge tone="crit">Nije popravljivo — nova guma</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Popravljiv je samo gazeći sloj; rame i bok znače novu gumu.</p>
          )}
        </Card>

        {/* Balancing */}
        <Card>
          <CardHeader
            title="Balansiranje"
            action={
              !locked ? (
                <RecordSheet
                  table="wheel_balancing"
                  title="Balansiranje"
                  revalidate={path}
                  fixed={{ job_id: job.id }}
                  label="Dodaj"
                  fields={[
                    { name: 'position', label: 'Kotač', type: 'select', options: opts({ FL: POSITIONS.FL, FR: POSITIONS.FR, RL: POSITIONS.RL, RR: POSITIONS.RR }), required: true },
                    { name: 'weight_inner_g', label: 'Uteg unutra', type: 'number', suffix: 'g', half: true },
                    { name: 'weight_outer_g', label: 'Uteg vani', type: 'number', suffix: 'g', half: true },
                  ]}
                />
              ) : null
            }
          />
          {balancing?.length ? (
            <ul className="divide-y divide-line">
              {balancing.map((b) => (
                <li key={b.id as string} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>{POSITIONS[b.position as keyof typeof POSITIONS]}</span>
                  <span className="tabular text-muted">
                    {(b.weight_inner_g as number | null) ?? 0} g / {(b.weight_outer_g as number | null) ?? 0} g
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Nema zapisa.</p>
          )}
        </Card>
      </div>

      {/* Alignment */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Ruler className="size-4 text-accent" /> Geometrija — prije i poslije
            </span>
          }
          action={
            !locked ? (
              <RecordSheet
                table="wheel_alignments"
                title="Mjerenje geometrije"
                revalidate={path}
                fixed={{ job_id: job.id }}
                label="Mjerenje"
                fields={[
                  { name: 'device', label: 'Uređaj', half: true },
                  { name: 'spec_source', label: 'Izvor specifikacija', half: true },
                  { name: 'steering_centered', label: 'Volan centriran', type: 'checkbox' },
                ]}
              />
            ) : null
          }
        />
        {alignments?.length ? (
          <div className="divide-y divide-line">
            {alignments.map((a) => {
              const values = ((a.values as Record<string, unknown>[]) ?? []).sort((x, y) => String(x.axle).localeCompare(String(y.axle)));
              return (
                <div key={a.id as string} className="px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm text-muted">
                      {[a.device, formatDateTime(a.performed_at as string)].filter(Boolean).join(' · ')}
                      {a.steering_centered ? ' · volan ravno' : ''}
                    </p>
                    {!locked ? (
                      <RecordSheet
                        table="wheel_alignment_values"
                        title="Vrijednost"
                        upsertOn="alignment_id,axle,wheel,parameter"
                        revalidate={path}
                        fixed={{ alignment_id: a.id }}
                        label="Vrijednost"
                        initial={{ axle: 'front', wheel: 'left', unit: 'deg' }}
                        fields={[
                          { name: 'axle', label: 'Osovina', type: 'select', options: [{ value: 'front', label: 'Prednja' }, { value: 'rear', label: 'Stražnja' }], half: true, required: true },
                          { name: 'wheel', label: 'Kotač', type: 'select', options: [{ value: 'left', label: 'Lijevi' }, { value: 'right', label: 'Desni' }, { value: 'total', label: 'Ukupno' }], half: true, required: true },
                          { name: 'parameter', label: 'Parametar', type: 'select', options: opts(PARAM), required: true },
                          { name: 'before_value', label: 'Prije', type: 'number', half: true },
                          { name: 'after_value', label: 'Poslije', type: 'number', half: true },
                          { name: 'spec_min', label: 'Spec. min', type: 'number', half: true },
                          { name: 'spec_max', label: 'Spec. max', type: 'number', half: true },
                          { name: 'unit', label: 'Jedinica', type: 'select', options: [{ value: 'deg', label: '°' }, { value: 'min', label: "'" }, { value: 'mm', label: 'mm' }], required: true },
                        ]}
                      />
                    ) : null}
                  </div>
                  {values.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-sm">
                        <thead>
                          <tr className="text-left text-xs text-faint">
                            <th className="py-1 font-normal">Parametar</th>
                            <th className="py-1 text-right font-normal">Prije</th>
                            <th className="py-1 text-right font-normal">Poslije</th>
                            <th className="py-1 text-right font-normal">Specifikacija</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {values.map((v) => {
                            const out = (val: unknown) =>
                              val !== null && ((v.spec_min !== null && Number(val) < Number(v.spec_min)) || (v.spec_max !== null && Number(val) > Number(v.spec_max)));
                            return (
                              <tr key={v.id as string}>
                                <td className="py-1.5">
                                  {PARAM[v.parameter as keyof typeof PARAM]} <span className="text-faint">· {v.axle === 'front' ? 'prednja' : 'stražnja'} {v.wheel === 'left' ? 'L' : v.wheel === 'right' ? 'D' : ''}</span>
                                </td>
                                <td className={`py-1.5 text-right tabular ${out(v.before_value) ? 'text-crit' : ''}`}>{(v.before_value as number | null) ?? '—'}</td>
                                <td className={`py-1.5 text-right tabular ${out(v.after_value) ? 'text-crit' : 'text-ok'}`}>{(v.after_value as number | null) ?? '—'}</td>
                                <td className="py-1.5 text-right tabular text-muted">
                                  {(v.spec_min as number | null) ?? '—'} … {(v.spec_max as number | null) ?? '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">Upišite vrijednosti ili fotografirajte ispis uređaja (Fotografije → Ispis geometrije).</p>
                  )}
                  {!locked ? (
                    <div className="mt-2">
                      <DeleteRecordButton table="wheel_alignments" id={a.id as string} revalidate={path} label="Obriši mjerenje" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-muted">Nema mjerenja geometrije na ovom nalogu.</p>
        )}
      </Card>

      {!sets?.length && !torque?.length ? <EmptyState title="Počnite sa setom guma">Izmjerite šaru u tri točke po gumi — boja se sama odredi prema sezoni.</EmptyState> : null}
    </div>
  );
}
