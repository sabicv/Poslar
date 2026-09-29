import { Clock, Droplets, FileCheck2, Paintbrush, ScanEye } from 'lucide-react';
import { Badge, Card, CardHeader, KeyValue } from '@/components/ui';
import { BODY_OPERATIONS } from '@/config/packages/body';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import type { ModuleProps } from '../ModuleTab';
import { DeleteRecordButton, PrivateAmountSheet, RecordButton, RecordSheet } from '../kit';
import { opts } from '../options';
import { BodyDamageMap } from './BodyDamageMap';

const ESTIMATE_STATUS = { draft: 'U izradi', sent: 'Poslano osiguranju', approved: 'Odobreno', supplement: 'Dopuna', rejected: 'Odbijeno' };
const LOSS_TYPE = { collision: 'Sudar', parking: 'Parkiranje', hail: 'Tuča', wildlife: 'Divljač', vandalism: 'Vandalizam', other: 'Ostalo' };
const COAT = { single: 'Jednoslojna', two_stage: 'Dvoslojna (baza + lak)', three_stage: 'Troslojna (perla)' };
const MATCH = { recipe: 'Receptura', spectro: 'Spektrofotometar', test_panel: 'Probna pločica', tinting: 'Toniranje' };
const PHASES = { disassembly: 'Rastavljanje', bodywork: 'Limarija', prep: 'Priprema', paint: 'Lakiranje', assembly: 'Sastavljanje', polish: 'Poliranje', quality: 'Kontrola', wash: 'Pranje' } as const;
const ADAS = { front_camera: 'Prednja kamera', radar: 'Radar', parking_sensors: 'Parkirni senzori', surround_cameras: 'Kamere 360°', blind_spot: 'Mrtvi kut' };
const MATERIAL = { basecoat: 'Baza', clearcoat: 'Lak', primer: 'Temeljna', filler: 'Kit', thinner: 'Razrjeđivač', hardener: 'Otvrdnjivač', abrasive: 'Brusni materijal', masking: 'Maskiranje', other: 'Ostalo' };

export async function BodyModule({ ctx, job, locked }: ModuleProps) {
  const path = `/app/jobs/${job.id}`;
  const s = ctx.supabase;
  const [{ data: estimates }, { data: insurers }, { data: paint }, { data: phases }, { data: adas }, { data: materials }, { data: staff }] = await Promise.all([
    s.from('body_estimates').select('*').eq('job_id', job.id).order('version', { ascending: false }),
    s.from('insurers').select('id, name').order('name'),
    s.from('body_paint_jobs').select('*, mix:body_paint_mix_lines(id, sort, component_code, target_g, actual_g)').eq('job_id', job.id).maybeSingle(),
    s.from('body_production_phases').select('*').eq('job_id', job.id).order('started_at'),
    s.from('body_adas_calibrations').select('*').eq('job_id', job.id).order('performed_at'),
    s.from('body_material_usage').select('*').eq('job_id', job.id).order('created_at'),
    s.from('profiles').select('id, full_name'),
  ]);
  const estimate = estimates?.[0] ?? null;
  const { data: damages } = estimate ? await s.from('body_panel_damages').select('*').eq('estimate_id', estimate.id) : { data: [] };
  let approvedAmount: number | null = null;
  if (ctx.isOwner && estimate) {
    const { data } = await s.from('private_amounts').select('amount').eq('entity', 'body_estimates').eq('entity_id', estimate.id).eq('field', 'approved_amount').maybeSingle();
    approvedAmount = data ? Number(data.amount) : null;
  }
  const insurerOptions = (insurers ?? []).map((i) => ({ value: i.id as string, label: i.name as string }));
  const insurerName = new Map(insurerOptions.map((o) => [o.value, o.label]));
  const names = new Map((staff ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? '']));
  const hours = (damages ?? []).reduce(
    (acc, d) => ({ body: acc.body + Number(d.hours_body), prep: acc.prep + Number(d.hours_prep), paint: acc.paint + Number(d.hours_paint), assembly: acc.assembly + Number(d.hours_assembly) }),
    { body: 0, prep: 0, paint: 0, assembly: 0 }
  );
  const openPhase = (phases ?? []).find((p) => !p.finished_at);
  const mix = ((paint?.mix as { id: string; sort: number; component_code: string; target_g: number | null; actual_g: number | null }[] | undefined) ?? []).sort((a, b) => a.sort - b.sort);

  const estimateFields = [
    { name: 'insurer_id', label: 'Osiguranje', type: 'select' as const, options: insurerOptions },
    { name: 'claim_number', label: 'Broj štete', half: true },
    { name: 'policy_number', label: 'Broj police', half: true },
    { name: 'loss_date', label: 'Datum štete', type: 'date' as const, half: true },
    { name: 'loss_type', label: 'Vrsta štete', type: 'select' as const, options: opts(LOSS_TYPE), half: true },
    { name: 'assessor_name', label: 'Procjenitelj', half: true },
    { name: 'inspected_at', label: 'Očevid', type: 'datetime' as const, half: true },
    { name: 'status', label: 'Status', type: 'select' as const, options: opts(ESTIMATE_STATUS), required: true },
  ];

  return (
    <div className="space-y-4">
      {/* Insurance estimate */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <FileCheck2 className="size-4 text-accent" /> Procjena štete {estimate ? `· verzija ${estimate.version}` : ''}
            </span>
          }
          subtitle={estimate ? ESTIMATE_STATUS[estimate.status as keyof typeof ESTIMATE_STATUS] : 'Za osiguranje ili privatnu procjenu'}
          action={
            <div className="flex gap-2">
              <RecordSheet
                table="insurers"
                title="Novo osiguranje"
                revalidate={path}
                label="Osiguranje"
                fields={[
                  { name: 'name', label: 'Naziv', required: true },
                  { name: 'contact', label: 'Kontakt', half: true },
                  { name: 'phone', label: 'Telefon', half: true },
                  { name: 'email', label: 'E-mail' },
                ]}
              />
              {!locked ? (
                estimate ? (
                  <RecordSheet table="body_estimates" title="Procjena" id={estimate.id as string} revalidate={path} initial={estimate} label="Uredi" fields={estimateFields} />
                ) : (
                  <RecordSheet table="body_estimates" title="Nova procjena" revalidate={path} fixed={{ job_id: job.id, version: 1 }} initial={{ status: 'draft' }} label="Procjena" fields={estimateFields} />
                )
              ) : null}
            </div>
          }
        />
        {estimate ? (
          <div className="grid gap-x-8 px-4 py-1 sm:grid-cols-2">
            <KeyValue label="Osiguranje">{estimate.insurer_id ? insurerName.get(estimate.insurer_id as string) : '—'}</KeyValue>
            <KeyValue label="Broj štete">{(estimate.claim_number as string | null) ?? '—'}</KeyValue>
            <KeyValue label="Datum štete">{formatDate(estimate.loss_date as string | null)}</KeyValue>
            <KeyValue label="Vrsta">{estimate.loss_type ? LOSS_TYPE[estimate.loss_type as keyof typeof LOSS_TYPE] : '—'}</KeyValue>
            <KeyValue label="Procjenitelj">{(estimate.assessor_name as string | null) ?? '—'}</KeyValue>
            {ctx.isOwner ? (
              <KeyValue label="Odobreni iznos">
                <PrivateAmountSheet entity="body_estimates" entityId={estimate.id as string} field="approved_amount" title="Iznos koji je odobrilo osiguranje" amount={approvedAmount} revalidate={path} />
              </KeyValue>
            ) : null}
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-muted">Otvorite procjenu pa na mapi označite oštećene dijelove, operacije i sate.</p>
        )}
        {estimate && !locked && estimate.status === 'approved' ? (
          <div className="border-t border-line px-4 py-3">
            <RecordButton table="body_estimates" revalidate={path} size="sm" values={{ job_id: job.id, version: Number(estimate.version) + 1, status: 'supplement', insurer_id: estimate.insurer_id, claim_number: estimate.claim_number, policy_number: estimate.policy_number, loss_date: estimate.loss_date, loss_type: estimate.loss_type }}>
              Dopuna procjene (verzija {Number(estimate.version) + 1})
            </RecordButton>
          </div>
        ) : null}
      </Card>

      {/* Damage map */}
      {estimate ? (
        <Card>
          <CardHeader title="Mapa oštećenja" subtitle="Dodirnite dio vozila: vrsta oštećenja, operacija i sati po fazi" />
          <div className="p-4">
            <BodyDamageMap
              estimateId={estimate.id as string}
              jobId={job.id}
              readOnly={locked}
              damages={(damages ?? []).map((d) => ({
                id: d.id as string,
                zone: d.zone as string,
                damage_type: d.damage_type as string | null,
                size: d.size as string | null,
                operation: d.operation as string,
                hours_body: Number(d.hours_body),
                hours_prep: Number(d.hours_prep),
                hours_paint: Number(d.hours_paint),
                hours_assembly: Number(d.hours_assembly),
                note: d.note as string | null,
              }))}
            />
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {(
                [
                  ['Limarija', hours.body],
                  ['Priprema', hours.prep],
                  ['Lakiranje', hours.paint],
                  ['Sastavljanje', hours.assembly],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-line bg-bg px-3 py-2">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="font-semibold tabular">{formatNumber(value)} h</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-faint">
              Operacije: {Object.values(BODY_OPERATIONS).join(' · ')}
            </p>
          </div>
        </Card>
      ) : null}

      {/* Paint shop */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Paintbrush className="size-4 text-accent" /> Lakirnica
            </span>
          }
          subtitle={paint ? [paint.paint_code, paint.paint_name, paint.paint_system].filter(Boolean).join(' · ') : 'Šifra boje, receptura i uvjeti u kabini'}
          action={
            !locked ? (
              <RecordSheet
                table="body_paint_jobs"
                title="Boja"
                upsertOn="job_id"
                revalidate={path}
                fixed={{ job_id: job.id }}
                initial={paint ?? { paint_code: job.asset.paint_code }}
                label={paint ? 'Uredi' : 'Boja'}
                fields={[
                  { name: 'paint_code', label: 'Šifra boje', half: true },
                  { name: 'paint_name', label: 'Naziv boje', half: true },
                  { name: 'paint_system', label: 'Sustav (proizvođač)', half: true },
                  { name: 'variant', label: 'Varijanta', half: true },
                  { name: 'coat_structure', label: 'Struktura', type: 'select', options: opts(COAT), half: true },
                  { name: 'color_match', label: 'Pogađanje nijanse', type: 'select', options: opts(MATCH), half: true },
                  { name: 'booth_temp_c', label: 'Kabina — temperatura', type: 'number', suffix: '°C', half: true },
                  { name: 'booth_humidity_pct', label: 'Kabina — vlaga', type: 'number', suffix: '%', half: true },
                ]}
              />
            ) : null
          }
        />
        {paint ? (
          <div className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Receptura</p>
              {!locked ? (
                <RecordSheet
                  table="body_paint_mix_lines"
                  title="Komponenta"
                  revalidate={path}
                  fixed={{ paint_job_id: paint.id, sort: mix.length + 1 }}
                  label="Komponenta"
                  fields={[
                    { name: 'component_code', label: 'Šifra komponente', required: true },
                    { name: 'target_g', label: 'Cilj', type: 'number', suffix: 'g', half: true },
                    { name: 'actual_g', label: 'Stvarno', type: 'number', suffix: 'g', half: true },
                  ]}
                />
              ) : null}
            </div>
            {mix.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-faint">
                    <th className="py-1 font-normal">Komponenta</th>
                    <th className="py-1 text-right font-normal">Cilj g</th>
                    <th className="py-1 text-right font-normal">Stvarno g</th>
                    <th className="py-1 text-right font-normal">Odstupanje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {mix.map((m) => {
                    const dev = m.target_g && m.actual_g !== null ? ((Number(m.actual_g) - Number(m.target_g)) / Number(m.target_g)) * 100 : null;
                    return (
                      <tr key={m.id}>
                        <td className="py-1.5 font-mono">{m.component_code}</td>
                        <td className="py-1.5 text-right tabular">{formatNumber(m.target_g)}</td>
                        <td className="py-1.5 text-right tabular">{formatNumber(m.actual_g)}</td>
                        <td className={`py-1.5 text-right tabular ${dev !== null && Math.abs(dev) > 2 ? 'text-crit' : 'text-muted'}`}>{dev === null ? '—' : `${dev > 0 ? '+' : ''}${dev.toFixed(1)} %`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted">Upišite komponente s vage: cilj i stvarno.</p>
            )}
          </div>
        ) : null}
      </Card>

      {/* Production phases */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Clock className="size-4 text-accent" /> Proizvodnja
            </span>
          }
          subtitle={openPhase ? `Sada: ${PHASES[openPhase.phase as keyof typeof PHASES]} od ${formatDateTime(openPhase.started_at as string)}` : 'Tko je radio koju fazu i koliko dugo'}
        />
        <div className="p-4">
          {!locked ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(PHASES) as (keyof typeof PHASES)[]).map((phase) =>
                openPhase?.phase === phase ? (
                  <RecordButton key={phase} table="body_production_phases" id={openPhase.id as string} revalidate={path} variant="ok" values={{ finished_at: '__now__' }}>
                    Završi: {PHASES[phase]}
                  </RecordButton>
                ) : (
                  <RecordButton key={phase} table="body_production_phases" revalidate={path} disabled={Boolean(openPhase)} values={{ job_id: job.id, phase, worker_id: ctx.user.id, started_at: '__now__' }}>
                    {PHASES[phase]}
                  </RecordButton>
                )
              )}
            </div>
          ) : null}
          {phases?.length ? (
            <ul className="mt-4 divide-y divide-line text-sm">
              {phases.map((p) => {
                const minutes = p.finished_at ? Math.round((new Date(p.finished_at as string).getTime() - new Date(p.started_at as string).getTime()) / 60000) : null;
                return (
                  <li key={p.id as string} className="flex items-center justify-between py-2">
                    <span>
                      {PHASES[p.phase as keyof typeof PHASES]} <span className="text-faint">· {names.get(p.worker_id as string) ?? '—'}</span>
                    </span>
                    <span className="tabular text-muted">{minutes === null ? 'u tijeku' : `${Math.floor(minutes / 60)} h ${minutes % 60} min`}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ScanEye className="size-4 text-accent" /> ADAS kalibracija
              </span>
            }
            action={
              !locked ? (
                <RecordSheet
                  table="body_adas_calibrations"
                  title="Kalibracija"
                  revalidate={path}
                  fixed={{ job_id: job.id }}
                  label="Dodaj"
                  fields={[
                    { name: 'system', label: 'Sustav', type: 'select', options: opts(ADAS), required: true },
                    { name: 'procedure', label: 'Postupak', type: 'select', options: [{ value: 'static', label: 'Statička' }, { value: 'dynamic', label: 'Dinamička' }], half: true },
                    { name: 'result', label: 'Rezultat', type: 'select', options: [{ value: 'success', label: 'Uspješno' }, { value: 'failed', label: 'Neuspješno' }], half: true },
                  ]}
                />
              ) : null
            }
          />
          {adas?.length ? (
            <ul className="divide-y divide-line">
              {adas.map((a) => (
                <li key={a.id as string} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{ADAS[a.system as keyof typeof ADAS]}</span>
                  {a.result ? <Badge tone={a.result === 'success' ? 'ok' : 'crit'}>{a.result === 'success' ? 'Uspješno' : 'Neuspješno'}</Badge> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Nakon zamjene vjetrobrana, branika ili geometrije: kalibracija kamera i radara.</p>
          )}
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Droplets className="size-4 text-accent" /> Utrošak materijala
              </span>
            }
            action={
              !locked ? (
                <RecordSheet
                  table="body_material_usage"
                  title="Materijal"
                  revalidate={path}
                  fixed={{ job_id: job.id }}
                  label="Dodaj"
                  initial={{ unit: 'g' }}
                  fields={[
                    { name: 'material', label: 'Materijal', type: 'select', options: opts(MATERIAL), required: true },
                    { name: 'qty', label: 'Količina', type: 'number', half: true, required: true },
                    { name: 'unit', label: 'Jedinica', type: 'select', options: [{ value: 'g', label: 'g' }, { value: 'ml', label: 'ml' }, { value: 'kom', label: 'kom' }], half: true, required: true },
                  ]}
                />
              ) : null
            }
          />
          {materials?.length ? (
            <ul className="divide-y divide-line">
              {materials.map((m) => (
                <li key={m.id as string} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>{MATERIAL[m.material as keyof typeof MATERIAL]}</span>
                  <span className="flex items-center gap-2 tabular text-muted">
                    {formatNumber(m.qty as number)} {m.unit as string}
                    {!locked ? <DeleteRecordButton table="body_material_usage" id={m.id as string} revalidate={path} label="×" /> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Nema zapisa.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
