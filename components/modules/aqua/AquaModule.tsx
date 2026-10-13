import { Droplets, Gauge } from 'lucide-react';
import { ShotButton } from '@/components/job/ShotButton';
import { Badge, Card, CardHeader, KeyValue } from '@/components/ui';
import { ENERGY_LABELS, pressureDrop } from '@/config/packages/aqua';
import type { AssetType } from '@/config/tenant.config';
import { assetTitle, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { addMonths, todayInZagreb } from '@/lib/time';
import type { ModuleProps } from '../ModuleTab';
import { Offer, foldable } from '../more';
import { DeleteRecordButton, RecordSheet } from '../kit';
import { opts } from '../options';
import { PlanCard } from '../PlanCard';

// Objects with a plate worth writing down; a pipe run or a drain has none.
const WITH_PLATE: AssetType[] = ['water_heater', 'gas_boiler', 'heating', 'pump'];
const MEDIUM = { water: 'Voda', air: 'Zrak' };

export async function AquaModule({ ctx, job, locked, extras }: ModuleProps) {
  const path = `/app/jobs/${job.id}`;
  const s = ctx.supabase;
  const [{ data: device }, { data: tests }, { data: plans }] = await Promise.all([
    s.from('aqua_equipment').select('*').eq('asset_id', job.asset.id).maybeSingle(),
    s.from('aqua_pressure_tests').select('*, technician:profiles(full_name)').eq('job_id', job.id).order('performed_at', { ascending: false }),
    s.from('maintenance_plans').select('*').eq('client_id', job.client.id).eq('active', true),
  ]);
  const plan = (plans ?? []).find((p) => p.asset_id === job.asset.id) ?? (plans ?? []).find((p) => !p.asset_id && p.site_id === job.site_id) ?? null;

  const { show, open } = foldable(extras);
  const showPlate = show('podaci uređaja', WITH_PLATE.includes(job.asset.asset_type) || Boolean(device));
  const showPlan = show('servisni plan', WITH_PLATE.includes(job.asset.asset_type) || Boolean(plan));

  // A magnesium anode lasts about two years in average water.
  const today = todayInZagreb();
  const anodeOld = device?.anode_changed_on ? addMonths(device.anode_changed_on as string, 24) <= today : false;
  const heater = job.asset.asset_type === 'water_heater';

  return (
    <div className="space-y-4">
      {/* Pressure test */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Gauge className="size-4 text-accent" /> Tlačna proba
            </span>
          }
          subtitle="Zapisnik za mušteriju: tlak, trajanje i rezultat"
          action={
            !locked ? (
              <RecordSheet
                table="aqua_pressure_tests"
                title="Tlačna proba"
                revalidate={path}
                fixed={{ job_id: job.id, asset_id: job.asset.id, performed_at: '__now__' }}
                initial={{ medium: 'water', duration_min: 30, passed: true }}
                label="Proba"
                proposeTemplate="aqua.pressure_test"
                fields={[
                  { name: 'section', label: 'Dio instalacije', placeholder: 'npr. kupaonica, hladna i topla' },
                  { name: 'test_pressure_bar', label: 'Ispitni tlak', type: 'number', suffix: 'bar', half: true, required: true },
                  { name: 'end_pressure_bar', label: 'Tlak na kraju', type: 'number', suffix: 'bar', half: true },
                  { name: 'duration_min', label: 'Trajanje', type: 'number', suffix: 'min', half: true },
                  { name: 'medium', label: 'Medij', type: 'select', options: opts(MEDIUM), half: true },
                  { name: 'passed', label: 'Instalacija drži tlak', type: 'checkbox' },
                  { name: 'note', label: 'Napomena', type: 'textarea' },
                ]}
              />
            ) : null
          }
        />
        {(tests ?? []).length ? (
          <ul className="divide-y divide-line">
            {(tests ?? []).map((t) => {
              const start = Number(t.test_pressure_bar);
              const end = t.end_pressure_bar != null ? Number(t.end_pressure_bar) : null;
              const drop = pressureDrop(start, end);
              return (
                <li key={t.id as string} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                  <span className="w-32 shrink-0 text-xs text-faint">{formatDateTime(t.performed_at as string)}</span>
                  <span className="font-medium">{(t.section as string | null) ?? 'Instalacija'}</span>
                  <span className="tabular text-muted">
                    {formatNumber(start, 2)} {end !== null ? `→ ${formatNumber(end, 2)}` : ''} bar
                    {t.duration_min ? ` · ${t.duration_min} min` : ''}
                    {drop !== null ? ` · pad ${formatNumber(drop, 2)} bar` : ''}
                  </span>
                  {t.passed === true ? <Badge tone="ok">Drži tlak</Badge> : t.passed === false ? <Badge tone="crit">Ne drži tlak</Badge> : null}
                  <span className="text-xs text-muted">{(t.technician as { full_name: string | null } | null)?.full_name ?? ''}</span>
                  {!locked ? (
                    <span className="ml-auto">
                      <DeleteRecordButton table="aqua_pressure_tests" id={t.id as string} revalidate={path} label="×" />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="space-y-3 px-4 py-4">
            <p className="text-sm text-muted">Nakon nove instalacije ili popravka upišite probu.</p>
            {!locked ? <ShotButton tenantId={ctx.tenant.id} jobId={job.id} tag="meter" caption="Manometar" label="Fotografija manometra" /> : null}
          </div>
        )}
      </Card>

      {/* Plate data */}
      {showPlate ? (
        <Offer title="Podaci uređaja" summary={device ? [device.capacity_l != null && `${formatNumber(Number(device.capacity_l), 0)} l`, device.power_kw != null && `${formatNumber(Number(device.power_kw), 1)} kW`].filter(Boolean).join(' · ') || 'Upisano' : 'Volumen, snaga, anoda'} filled={open('podaci uređaja')}>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Droplets className="size-4 text-accent" /> Podaci uređaja
              </span>
            }
            action={
              <RecordSheet
                table="aqua_equipment"
                title="Podaci uređaja"
                upsertOn="asset_id"
                revalidate={path}
                fixed={{ asset_id: job.asset.id }}
                initial={device ?? { energy: job.asset.asset_type === 'gas_boiler' ? 'gas' : 'electric' }}
                label={device ? 'Uredi' : 'Upiši'}
                scan={{ kind: 'plocica', label: 'Slikaj natpisnu pločicu', map: { capacity_l: 'capacity_l', power_kw: 'power_kw', pressure_bar: 'working_pressure_bar' } }}
                fields={[
                  { name: 'energy', label: 'Grije se na', type: 'select', options: opts(ENERGY_LABELS), half: true },
                  { name: 'capacity_l', label: 'Volumen', type: 'number', suffix: 'l', half: true },
                  { name: 'power_kw', label: 'Snaga', type: 'number', suffix: 'kW', half: true },
                  { name: 'working_pressure_bar', label: 'Najveći radni tlak', type: 'number', suffix: 'bar', half: true },
                  { name: 'anode_changed_on', label: 'Anoda mijenjana', type: 'date', half: true },
                  { name: 'descaled_on', label: 'Kamenac čišćen', type: 'date', half: true },
                  { name: 'install_date', label: 'Datum ugradnje', type: 'date', half: true, extra: true },
                  { name: 'warranty_until', label: 'Jamstvo do', type: 'date', half: true, extra: true },
                ]}
              />
            }
          />
          {device ? (
            <div className="p-4">
              {heater && anodeOld ? (
                <div className="mb-3">
                  <Badge tone="warn">Anoda starija od 2 godine: ponudite servis</Badge>
                </div>
              ) : null}
              <div className="grid gap-x-8 sm:grid-cols-2">
                <KeyValue label="Grije se na">{ENERGY_LABELS[device.energy as string] ?? '-'}</KeyValue>
                <KeyValue label="Volumen / snaga">
                  {[device.capacity_l != null && `${formatNumber(Number(device.capacity_l), 0)} l`, device.power_kw != null && `${formatNumber(Number(device.power_kw), 2)} kW`].filter(Boolean).join(' · ') || '-'}
                </KeyValue>
                <KeyValue label="Anoda / kamenac">{`${formatDate(device.anode_changed_on as string | null)} / ${formatDate(device.descaled_on as string | null)}`}</KeyValue>
                <KeyValue label="Ugradnja / jamstvo">{`${formatDate(device.install_date as string | null)} / ${formatDate(device.warranty_until as string | null)}`}</KeyValue>
              </div>
            </div>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">Upišite volumen, snagu i kad je mijenjana anoda. Pločicu možete i slikati.</p>
          )}
        </Card>
        </Offer>
      ) : null}

      {showPlan ? (
        <Offer title="Servisni plan" summary={plan ? 'Aktivan' : 'Godišnji servis'} filled={open('servisni plan')}>
          <PlanCard ctx={ctx} job={job} plan={plan} title={`Godišnji servis: ${assetTitle(job.asset)}`} templateCode={job.asset.asset_type === 'gas_boiler' ? 'aqua.boiler_service' : 'aqua.heater_service'} />
        </Offer>
      ) : null}
    </div>
  );
}
