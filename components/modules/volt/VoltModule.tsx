import { Battery, Cpu, KeyRound, ScanLine, Zap } from 'lucide-react';
import { ShotButton } from '@/components/job/ShotButton';
import { Badge, Card, CardHeader } from '@/components/ui';
import { DTC_CATEGORY_HINTS, findDtcCode } from '@/config/packages/volt-dtc';
import { formatDateTime } from '@/lib/format';
import type { ModuleProps } from '../ModuleTab';
import { Offer, foldable } from '../more';
import { DeleteRecordButton, RecordSheet } from '../kit';
import { opts } from '../options';
import { DrainChart } from './DrainChart';
import { DtcFindingSheet } from './DtcFindingSheet';

const SCAN_KIND = { initial: 'Početno', intermediate: 'Međukorak', control: 'Kontrolno' };
const FINDING_STATUS = { active: 'Aktivan', stored: 'Memoriran', intermittent: 'Povremen', pending: 'Na čekanju' };
const BATTERY_TYPE = { lead: 'Olovni', efb: 'EFB', agm: 'AGM', lithium: 'Litij' };
const BATTERY_RESULT = { good: 'Dobar', recharge: 'Napuniti', replace: 'Zamijeniti' };
const CHARGING_RESULT = { ok: 'Ispravno', regulator: 'Regulator', diodes: 'Diode', replace: 'Zamijeniti alternator' };
const ALTERNATOR = { classic: 'Klasični', lin: 'LIN / BSS', start_stop: 'Start-stop' };
const DRAIN_METHOD = { clamp: 'Strujna kliješta', ammeter: 'Ampermetar u seriji', fuse_voltage_drop: 'Pad napona na osiguračima' };
const INTERVENTION = {
  coding: 'Kodiranje',
  adaptation: 'Adaptacija',
  software_update: 'Ažuriranje softvera',
  programming: 'Programiranje modula',
  remap: 'Remap (izmjena kalibracije)',
  immo_key: 'IMMO / ključ',
  dpf_service_regen: 'DPF servisna regeneracija',
  dpf_sensor_adaptation: 'Adaptacija senzora DPF-a',
  egr_adaptation: 'Adaptacija EGR-a',
  service_reset: 'Reset servisa',
  calibration: 'Kalibracija',
};
const INTERVENTION_RESULT = { success: 'Uspješno', partial: 'Djelomično', reverted: 'Vraćeno na original' };
const KEY_TYPE = { remote: 'Daljinski', flip: 'Preklopni', keyless: 'Keyless', card: 'Kartica', mechanical: 'Mehanički' };
const KEY_METHOD = { obd: 'OBD', eeprom: 'EEPROM', oem_online: 'OEM online' };

export async function VoltModule({ ctx, job, locked, extras }: ModuleProps) {
  const path = `/app/jobs/${job.id}`;
  const s = ctx.supabase;
  const [scans, findings, battery, charging, sessions, interventions, keys, files, custom] = await Promise.all([
    s.from('volt_scans').select('*').eq('job_id', job.id).order('scanned_at'),
    s.from('volt_dtc_findings').select('*').eq('job_id', job.id).order('created_at'),
    s.from('volt_battery_tests').select('*').eq('job_id', job.id).order('tested_at', { ascending: false }),
    s.from('volt_charging_tests').select('*').eq('job_id', job.id).order('tested_at', { ascending: false }),
    s.from('volt_drain_sessions').select('*, readings:volt_drain_readings(t_offset_min, current_ma, event)').eq('job_id', job.id).order('started_at'),
    s.from('volt_module_interventions').select('*').eq('job_id', job.id).order('performed_at'),
    s.from('volt_keys').select('*').eq('asset_id', job.asset.id).order('created_at', { ascending: false }),
    s.from('attachments').select('id, caption, path, mime, created_at').eq('job_id', job.id).order('created_at', { ascending: false }),
    s.from('volt_dtc_custom').select('code, description_hr, causes, tests'),
  ]);

  // "Solved cases": what this code turned out to be on the workshop's earlier jobs.
  const codes = [...new Set((findings.data ?? []).map((f) => f.code as string))];
  const solved = codes.length
    ? (
        await s
          .from('volt_dtc_findings')
          .select('code, confirmed_cause, job_id')
          .in('code', codes)
          .neq('job_id', job.id)
          .not('confirmed_cause', 'is', null)
          .limit(30)
      ).data ?? []
    : [];
  const customByCode = new Map((custom.data ?? []).map((c) => [c.code as string, c]));
  // "Datoteka · 30. 09. 2026. 14:20" instead of a stored file name nobody recognises.
  const fileOptions = (files.data ?? []).map((f) => ({
    value: f.id as string,
    label: (f.caption as string | null) || `${String(f.mime ?? '').startsWith('image/') ? 'Fotografija' : 'Datoteka'} · ${formatDateTime(f.created_at as string)}`,
  }));
  const readOnly = locked;
  // Core: fault codes and the battery. The rest is one row each.
  const { show, open } = foldable(extras);
  const showCharging = show('punjenje', (charging.data ?? []).length > 0);
  const showDrain = show('struja mirovanja', (sessions.data ?? []).length > 0);
  const showModules = show('zahvati na modulima', (interventions.data ?? []).length > 0);
  const showKeys = show('ključevi', (keys.data ?? []).length > 0);

  return (
    <div className="space-y-4">
      {/* Fault codes */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ScanLine className="size-4 text-accent" /> Dijagnostika i kodovi grešaka
            </span>
          }
          action={
            !readOnly ? (
              <RecordSheet
                table="volt_scans"
                title="Novo skeniranje"
                revalidate={path}
                fixed={{ job_id: job.id }}
                label="Skeniranje"
                initial={{ kind: (scans.data ?? []).length ? 'control' : 'initial', meter_value: job.meter_in }}
                fields={[
                  { name: 'kind', label: 'Vrsta', type: 'select', options: opts(SCAN_KIND), required: true, half: true },
                  { name: 'tool', label: 'Uređaj', placeholder: 'npr. Autel MS909', half: true, extra: true },
                  { name: 'meter_value', label: 'Stanje brojila', type: 'number', suffix: 'km', extra: true },
                ]}
              />
            ) : null
          }
        />
        {(scans.data ?? []).length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Dodajte početno skeniranje, pa upišite kodove po modulima.</p>
        ) : (
          <div className="divide-y divide-line">
            {(scans.data ?? []).map((scan) => {
              const rows = (findings.data ?? []).filter((f) => f.scan_id === scan.id);
              return (
                <div key={scan.id as string} className="px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {SCAN_KIND[scan.kind as keyof typeof SCAN_KIND]} <span className="font-normal text-faint">· {formatDateTime(scan.scanned_at as string)}{scan.tool ? ` · ${scan.tool}` : ''}</span>
                    </p>
                    {!readOnly ? <DtcFindingSheet jobId={job.id} scanId={scan.id as string} custom={(custom.data ?? []).map((c) => ({ code: c.code as string, description: c.description_hr as string }))} /> : null}
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-sm text-ok">Bez kodova grešaka.</p>
                  ) : (
                    <ul className="space-y-2">
                      {rows.map((f) => {
                        const entry = findDtcCode(f.code as string);
                        const own = customByCode.get(f.code as string);
                        const hints = entry ? DTC_CATEGORY_HINTS[entry.category] : null;
                        const cases = solved.filter((c) => c.code === f.code);
                        return (
                          <li key={f.id as string} className="rounded-xl border border-line bg-bg p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-bold">{f.code as string}</span>
                              <Badge tone="muted">{f.module as string}</Badge>
                              <Badge tone={f.status === 'active' ? 'crit' : 'warn'}>{FINDING_STATUS[f.status as keyof typeof FINDING_STATUS]}</Badge>
                              {f.cleared ? <Badge tone={f.returned_after_clear ? 'crit' : 'ok'}>{f.returned_after_clear ? 'Vratio se nakon brisanja' : 'Obrisan'}</Badge> : null}
                              {!readOnly ? (
                                <span className="ml-auto">
                                  <RecordSheet
                                    table="volt_dtc_findings"
                                    title={`${f.code}: zaključak`}
                                    id={f.id as string}
                                    revalidate={path}
                                    deletable
                                    initial={f}
                                    trigger={<button className="text-xs text-accent">Uredi</button>}
                                    fields={[
                                      { name: 'status', label: 'Status', type: 'select', options: opts(FINDING_STATUS), half: true },
                                      { name: 'module', label: 'Modul', half: true, extra: true },
                                      { name: 'description', label: 'Opis', extra: true },
                                      { name: 'confirmed_cause', label: 'Potvrđeni uzrok (za arhivu riješenih slučajeva)', type: 'textarea' },
                                      { name: 'resolution_note', label: 'Kako je riješeno', type: 'textarea' },
                                      { name: 'cleared', label: 'Kod obrisan', type: 'checkbox', half: true, extra: true },
                                      { name: 'returned_after_clear', label: 'Vratio se', type: 'checkbox', half: true, extra: true },
                                    ]}
                                  />
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-muted">{(f.description as string | null) ?? own?.description_hr ?? entry?.description ?? 'Opis nije u knjižnici'}</p>
                            {f.confirmed_cause ? <p className="mt-1 text-sm text-ok">Uzrok: {f.confirmed_cause as string}</p> : null}
                            {hints && !f.confirmed_cause ? (
                              <details className="mt-2 text-xs text-muted">
                                <summary className="cursor-pointer text-accent">Najčešći uzroci i provjere</summary>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  <ul className="list-disc space-y-0.5 pl-4">{((own?.causes as string[] | undefined)?.length ? (own!.causes as string[]) : hints.causes).map((c) => <li key={c}>{c}</li>)}</ul>
                                  <ul className="list-disc space-y-0.5 pl-4">{((own?.tests as string[] | undefined)?.length ? (own!.tests as string[]) : hints.tests).map((t) => <li key={t}>{t}</li>)}</ul>
                                </div>
                              </details>
                            ) : null}
                            {cases.length ? (
                              <p className="mt-2 text-xs text-muted">
                                Iz Vaše arhive: {cases.slice(0, 3).map((c) => c.confirmed_cause as string).join(' · ')}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Battery and charging */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Battery className="size-4 text-accent" /> Akumulator
              </span>
            }
            action={
              !readOnly ? (
                <RecordSheet
                  table="volt_battery_tests"
                  title="Test akumulatora"
                  revalidate={path}
                  fixed={{ job_id: job.id }}
                  label="Test"
                  proposeTemplate="volt.battery"
                  fields={[
                    { name: 'battery_type', label: 'Vrsta', type: 'select', options: opts(BATTERY_TYPE), half: true },
                    { name: 'rest_voltage_v', label: 'Napon mirovanja', type: 'number', suffix: 'V', half: true },
                    { name: 'rated_cca_a', label: 'Nazivni CCA', type: 'number', suffix: 'A', half: true, extra: true },
                    { name: 'measured_cca_a', label: 'Izmjereni CCA', type: 'number', suffix: 'A', half: true },
                    { name: 'soh_pct', label: 'SOH', type: 'number', suffix: '%', half: true, extra: true },
                    { name: 'soc_pct', label: 'SOC', type: 'number', suffix: '%', half: true, extra: true },
                    { name: 'cranking_min_v', label: 'Min. napon pri startu', type: 'number', suffix: 'V', half: true, extra: true },
                    { name: 'result', label: 'Rezultat', type: 'select', options: opts(BATTERY_RESULT), half: true },
                    { name: 'registered_in_car', label: 'Novi akumulator registriran u vozilu (BMS)', type: 'checkbox', extra: true },
                  ]}
                />
              ) : null
            }
          />
          {(battery.data ?? []).length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted">Nema testova.</p>
          ) : (
            <ul className="divide-y divide-line">
              {(battery.data ?? []).map((t) => (
                <li key={t.id as string} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="tabular">{t.rest_voltage_v ?? '-'} V</span>
                  <span className="tabular text-muted">
                    CCA {t.measured_cca_a ?? '-'} / {t.rated_cca_a ?? '-'} A
                  </span>
                  <span className="tabular text-muted">SOH {t.soh_pct ?? '-'}%</span>
                  {t.result ? <Badge tone={t.result === 'good' ? 'ok' : t.result === 'recharge' ? 'warn' : 'crit'}>{BATTERY_RESULT[t.result as keyof typeof BATTERY_RESULT]}</Badge> : null}
                  {!readOnly ? <span className="ml-auto"><DeleteRecordButton table="volt_battery_tests" id={t.id as string} revalidate={path} /></span> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {showCharging ? (
        <Offer title="Punjenje" summary={(charging.data ?? []).length ? `${(charging.data ?? []).length} mjerenja` : 'Napon, valovitost'} filled={open('punjenje')}>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Zap className="size-4 text-accent" /> Punjenje (alternator)
              </span>
            }
            action={
              !readOnly ? (
                <RecordSheet
                  table="volt_charging_tests"
                  title="Test punjenja"
                  revalidate={path}
                  fixed={{ job_id: job.id }}
                  label="Test"
                  fields={[
                    { name: 'alternator_type', label: 'Vrsta alternatora', type: 'select', options: opts(ALTERNATOR) },
                    { name: 'idle_voltage_v', label: 'Napon u praznom hodu', type: 'number', suffix: 'V', half: true },
                    { name: 'loaded_voltage_v', label: 'Napon pod opterećenjem', type: 'number', suffix: 'V', half: true },
                    { name: 'charge_current_a', label: 'Struja punjenja', type: 'number', suffix: 'A', half: true },
                    { name: 'ripple_mv', label: 'Valovitost (ripple)', type: 'number', suffix: 'mV', half: true },
                    { name: 'result', label: 'Rezultat', type: 'select', options: opts(CHARGING_RESULT) },
                  ]}
                />
              ) : null
            }
          />
          {(charging.data ?? []).length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted">Nema testova.</p>
          ) : (
            <ul className="divide-y divide-line">
              {(charging.data ?? []).map((t) => (
                <li key={t.id as string} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="tabular">
                    {t.idle_voltage_v ?? '-'} / {t.loaded_voltage_v ?? '-'} V
                  </span>
                  <span className="tabular text-muted">{t.ripple_mv ?? '-'} mV</span>
                  {t.result ? <Badge tone={t.result === 'ok' ? 'ok' : 'crit'}>{CHARGING_RESULT[t.result as keyof typeof CHARGING_RESULT]}</Badge> : null}
                  {!readOnly ? <span className="ml-auto"><DeleteRecordButton table="volt_charging_tests" id={t.id as string} revalidate={path} /></span> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        </Offer>
        ) : null}
      </div>

      {/* Parasitic drain */}
      {showDrain ? (
      <Offer title="Struja mirovanja" summary={(sessions.data ?? []).length ? `${(sessions.data ?? []).length} mjerenja` : 'mA nakon uspavljivanja'} filled={open('struja mirovanja')}>
      <Card>
        <CardHeader
          title="Parazitska potrošnja"
          action={
            !readOnly ? (
              <RecordSheet
                table="volt_drain_sessions"
                title="Novo mjerenje"
                revalidate={path}
                fixed={{ job_id: job.id }}
                label="Mjerenje"
                initial={{ method: 'clamp', target_ma: 50 }}
                fields={[
                  { name: 'method', label: 'Metoda', type: 'select', options: opts(DRAIN_METHOD), required: true },
                  { name: 'target_ma', label: 'Cilj nakon spavanja', type: 'number', suffix: 'mA', half: true, required: true },
                  { name: 'expected_sleep_min', label: 'Očekivano spavanje', type: 'number', suffix: 'min', half: true },
                ]}
              />
            ) : null
          }
        />
        {(sessions.data ?? []).length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Kad se akumulator prazni: zaključajte vozilo, bilježite struju svakih nekoliko minuta i pratite graf.</p>
        ) : (
          <div className="divide-y divide-line">
            {(sessions.data ?? []).map((session) => {
              const readings = ((session.readings as { t_offset_min: number; current_ma: number; event: string | null }[]) ?? [])
                .map((r) => ({ t: Number(r.t_offset_min), ma: Number(r.current_ma), event: r.event }))
                .sort((a, b) => a.t - b.t);
              return (
                <div key={session.id as string} className="space-y-3 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{DRAIN_METHOD[session.method as keyof typeof DRAIN_METHOD]}</span>
                    <span className="text-faint">· cilj {session.target_ma as number} mA · {formatDateTime(session.started_at as string)}</span>
                    {session.verdict ? <Badge tone={session.verdict === 'ok' ? 'ok' : 'crit'}>{session.verdict === 'ok' ? 'U granicama' : 'Previsoka'}</Badge> : null}
                  </div>
                  <DrainChart readings={readings} target={Number(session.target_ma)} />
                  {session.culprit_circuit || session.culprit_module ? (
                    <p className="text-sm">
                      Krivac: <b>{[session.culprit_circuit, session.culprit_module].filter(Boolean).join(' · ')}</b>
                      {session.final_ma !== null ? <span className="text-muted"> · nakon popravka {session.final_ma as number} mA</span> : null}
                    </p>
                  ) : null}
                  {!readOnly ? (
                    <div className="flex flex-wrap gap-2">
                      <RecordSheet
                        table="volt_drain_readings"
                        title="Očitanje"
                        revalidate={path}
                        fixed={{ session_id: session.id }}
                        label="Očitanje"
                        initial={{ t_offset_min: readings.length ? readings[readings.length - 1].t + 5 : 0 }}
                        fields={[
                          { name: 't_offset_min', label: 'Minuta od zaključavanja', type: 'number', suffix: 'min', half: true, required: true },
                          { name: 'current_ma', label: 'Struja', type: 'number', suffix: 'mA', half: true, required: true },
                          { name: 'event', label: 'Događaj', placeholder: 'npr. izvađen F23' },
                        ]}
                      />
                      <RecordSheet
                        table="volt_drain_sessions"
                        title="Zaključak mjerenja"
                        id={session.id as string}
                        revalidate={path}
                        fixed={{ job_id: job.id }}
                        label="Zaključak"
                        deletable
                        initial={session}
                        proposeTemplate="volt.drain"
                        fields={[
                          { name: 'culprit_circuit', label: 'Krug / osigurač', half: true },
                          { name: 'culprit_module', label: 'Modul', half: true },
                          { name: 'final_ma', label: 'Nakon popravka', type: 'number', suffix: 'mA', half: true },
                          { name: 'verdict', label: 'Ocjena', type: 'select', options: [{ value: 'ok', label: 'U granicama' }, { value: 'too_high', label: 'Previsoka' }], half: true },
                          { name: 'note', label: 'Napomena', type: 'textarea' },
                        ]}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>
      </Offer>
      ) : null}

      {/* Module interventions */}
      {showModules ? (
      <Offer title="Zahvati na modulima" summary={(interventions.data ?? []).length ? `${(interventions.data ?? []).length} zahvata` : 'Kodiranje, backup, flash'} filled={open('zahvati na modulima')}>
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Cpu className="size-4 text-accent" /> Zahvati na modulima
            </span>
          }
          action={
            !readOnly ? (
              <RecordSheet
                table="volt_module_interventions"
                title="Zahvat na modulu"
                revalidate={path}
                fixed={{ job_id: job.id }}
                label="Zahvat"
                initial={{ voltage_stabilized: true }}
                fields={[
                  { name: 'kind', label: 'Vrsta', type: 'select', options: opts(INTERVENTION), required: true },
                  { name: 'module', label: 'Modul', placeholder: 'npr. ECM, BCM', half: true, required: true },
                  { name: 'tool', label: 'Alat', placeholder: 'npr. KESS3', half: true },
                  { name: 'sw_before', label: 'SW prije', half: true },
                  { name: 'sw_after', label: 'SW poslije', half: true },
                  { name: 'backup_attachment_id', label: 'Backup originalne datoteke (iz Fotografija/datoteka)', type: 'select', options: fileOptions },
                  { name: 'voltage_stabilized', label: 'Stabilizator napona spojen', type: 'checkbox' },
                  { name: 'compliance_ack', label: 'Potvrđujem: ne uklanjaju se sustavi za ispušne plinove (EGR/DPF/AdBlue)', type: 'checkbox' },
                  { name: 'result', label: 'Rezultat', type: 'select', options: opts(INTERVENTION_RESULT) },
                  { name: 'notes', label: 'Bilješke', type: 'textarea' },
                ]}
              />
            ) : null
          }
        />
        {(interventions.data ?? []).length === 0 ? (
          <div className="space-y-3 px-4 py-4">
            <p className="text-sm text-muted">Za programiranje i remap sustav traži backup originala.</p>
            {!locked ? <ShotButton tenantId={ctx.tenant.id} jobId={job.id} tag="document" caption="Backup originala" label="Učitaj backup" accept="*" capture={false} /> : null}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {(interventions.data ?? []).map((i) => (
              <li key={i.id as string} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{INTERVENTION[i.kind as keyof typeof INTERVENTION]}</span>
                  <Badge tone="muted">{i.module as string}</Badge>
                  {i.result ? <Badge tone={i.result === 'success' ? 'ok' : 'warn'}>{INTERVENTION_RESULT[i.result as keyof typeof INTERVENTION_RESULT]}</Badge> : null}
                  {i.backup_attachment_id ? <Badge tone="accent">Backup ✓</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {[i.tool, i.sw_before && `SW ${i.sw_before} → ${i.sw_after ?? '?'}`, formatDateTime(i.performed_at as string)].filter(Boolean).join(' · ')}
                </p>
                {i.notes ? <p className="mt-1 text-sm text-muted">{i.notes as string}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      </Offer>
      ) : null}

      {/* Keys */}
      {showKeys ? (
      <Offer title="Ključevi vozila" summary={(keys.data ?? []).length ? `${(keys.data ?? []).length} zapisa` : 'Programiranje, bez PIN-a'} filled={open('ključevi')}>
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="size-4 text-accent" /> Ključevi vozila
            </span>
          }
          subtitle="PIN i sigurnosni kodovi se nikad ne spremaju"
          action={
            !readOnly ? (
              <RecordSheet
                table="volt_keys"
                title="Ključ"
                revalidate={path}
                fixed={{ asset_id: job.asset.id, job_id: job.id }}
                label="Ključ"
                fields={[
                  { name: 'key_type', label: 'Vrsta', type: 'select', options: opts(KEY_TYPE), half: true },
                  { name: 'method', label: 'Metoda', type: 'select', options: opts(KEY_METHOD), half: true },
                  { name: 'transponder', label: 'Transponder', placeholder: 'npr. ID48, Hitag Pro' },
                  { name: 'programmed_now', label: 'Programirano sada', type: 'number', half: true },
                  { name: 'total_after', label: 'Ukupno ključeva', type: 'number', half: true },
                  { name: 'lost_disabled', label: 'Izgubljeni ključevi onemogućeni', type: 'checkbox' },
                  { name: 'notes', label: 'Napomena', type: 'textarea' },
                ]}
              />
            ) : null
          }
        />
        {(keys.data ?? []).length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Nema zapisa o ključevima.</p>
        ) : (
          <ul className="divide-y divide-line">
            {(keys.data ?? []).map((k) => (
              <li key={k.id as string} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <span className="font-medium">{KEY_TYPE[k.key_type as keyof typeof KEY_TYPE] ?? 'Ključ'}</span>
                {k.transponder ? <Badge tone="muted">{k.transponder as string}</Badge> : null}
                <span className="text-muted">
                  +{(k.programmed_now as number | null) ?? 0} · ukupno {(k.total_after as number | null) ?? '-'}
                </span>
                {k.lost_disabled ? <Badge tone="ok">Izgubljeni onemogućeni</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      </Offer>
      ) : null}
    </div>
  );
}
