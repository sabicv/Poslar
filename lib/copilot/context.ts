import 'server-only';

import { createHash } from 'node:crypto';
import { BODY_DAMAGE_TYPES, BODY_OPERATIONS, BODY_ZONES } from '@/config/packages/body';
import { fgasObligations } from '@/config/packages/air';
import { COMPLIANCE_LABELS } from '@/config/packages/fleet';
import { DTC_CATEGORY_HINTS, findDtcCode } from '@/config/packages/volt-dtc';
import { ASSET_TYPE_LABELS, METER_LABELS, phaseLabel, type MeterUnit } from '@/config/tenant.config';
import { daysUntil } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { getInspectionTemplates } from '@/lib/templates';

// Builds the work-order JSON the Kopilot reasons over. Read with the
// signed-in user's own client, so Row Level Security applies: a worker's
// context can never contain prices. Customer names, phones, OIB and the
// plate are deliberately left out — the assistant needs the machine, not
// the person.

type Json = Record<string, unknown>;

const FUEL: Record<string, string> = { petrol: 'benzin', diesel: 'dizel', hybrid: 'hibrid', plugin: 'plug-in hibrid', electric: 'električni', lpg: 'LPG', cng: 'CNG' };
const STATUS: Record<string, string> = { ok: 'OK', warn: 'pratiti', crit: 'hitno', na: 'n/p', not_checked: 'nije provjereno' };
const SITE_KIND: Record<string, string> = { house: 'kuća', flat: 'stan', apartment: 'apartman', office: 'ured', commercial: 'poslovni prostor', other: 'ostalo' };
const APPROVAL: Record<string, string> = { approved: 'radi se', proposed: 'predloženo stranci', declined: 'stranka odbila', deferred: 'odgođeno' };

// Drops null, undefined, empty strings, empty arrays and empty objects, so
// the prompt carries only what is known.
function compact(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(compact).filter((v) => v !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Json)
      .map(([k, v]) => [k, compact(v)] as const)
      .filter(([, v]) => v !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (value === null || value === undefined || value === '') return undefined;
  return value;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export interface CopilotContext {
  context: Json;
  hash: string;
}

export async function buildCopilotContext(ctx: WorkshopContext, jobId: string): Promise<CopilotContext | null> {
  const s = ctx.supabase;
  const { data: job } = await s
    .from('jobs')
    .select('id, number, created_at, phase, complaint, diagnosis_notes, work_summary, meter_in, meter_unit, is_urgent, work_mode, asset:assets(*), site:sites(kind)')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return null;
  const asset = job.asset as unknown as Json & { id: string; asset_type: keyof typeof ASSET_TYPE_LABELS; parent_asset_id: string | null; make: string | null };

  const [{ data: lines }, { data: inspections }, templates, parent] = await Promise.all([
    s.from('job_lines').select('code, description, kind, qty, unit, approval, priority').eq('job_id', jobId).order('sort'),
    s.from('inspections').select('id, template_code, title, completed_at, results:inspection_results(item_code, status, measure_value, measure_unit, note)').eq('job_id', jobId),
    getInspectionTemplates(ctx),
    asset.parent_asset_id ? s.from('assets').select('asset_type, make, model, year').eq('id', asset.parent_asset_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const labels = new Map(templates.flatMap((t) => t.sections.flatMap((sec) => sec.items.map((i) => [`${t.code}:${i.code}`, i.label] as const))));
  const inspectionFindings = (inspections ?? []).map((ins) => {
    const results = (ins.results as { item_code: string; status: string; measure_value: number | null; measure_unit: string | null; note: string | null }[]) ?? [];
    return {
      obrazac: ins.title,
      zavrseno: Boolean(ins.completed_at),
      provjereno_stavki: results.filter((r) => r.status !== 'not_checked').length,
      nalazi: results
        .filter((r) => r.status === 'warn' || r.status === 'crit' || r.note || r.measure_value !== null)
        .map((r) => ({
          stavka: labels.get(`${ins.template_code}:${r.item_code}`) ?? r.item_code,
          status: STATUS[r.status] ?? r.status,
          mjerenje: r.measure_value !== null ? `${num(r.measure_value)} ${r.measure_unit ?? ''}`.trim() : null,
          napomena: r.note,
        })),
    };
  });

  const meterUnit = (job.meter_unit as MeterUnit | null) ?? 'km';
  const context: Json = {
    sector: `${ctx.pkg.product}: ${ctx.pkg.tagline}`,
    work_order_id: `NO-${new Date(job.created_at as string).getFullYear()}-${String(job.number).padStart(3, '0')}`,
    faza: phaseLabel(ctx.pkg, job.phase as never),
    hitno: job.is_urgent || null,
    // Only the kind of place, never the address or access notes (door codes).
    rad_na_terenu: job.work_mode === 'field' ? { vrsta_objekta: SITE_KIND[(job.site as unknown as { kind: string } | null)?.kind ?? ''] ?? 'lokacija klijenta' } : null,
    equipment: {
      category: ASSET_TYPE_LABELS[asset.asset_type],
      brand: asset.make,
      model: [asset.model, asset.variant].filter(Boolean).join(' ') || null,
      year: asset.year,
      serial_number: asset.vin,
      engine_code: asset.engine_code,
      fuel: asset.fuel ? FUEL[asset.fuel as string] ?? asset.fuel : null,
      power_kw: num(asset.power_kw),
      paint_code: asset.paint_code,
      axle_config: asset.axle_config,
      gvw_t: num(asset.gvw_t),
      meter: job.meter_in !== null ? `${num(job.meter_in)} ${METER_LABELS[meterUnit].short}` : null,
      part_of: parent.data ? `${ASSET_TYPE_LABELS[parent.data.asset_type as keyof typeof ASSET_TYPE_LABELS]} ${[parent.data.make, parent.data.model, parent.data.year].filter(Boolean).join(' ')}` : null,
    },
    service_items: (lines ?? []).map((l) => ({
      code: l.code,
      description: l.description,
      qty: `${num(l.qty)} ${l.unit}`,
      status: APPROVAL[l.approval as string],
      priority: l.priority,
    })),
    reported_symptoms: job.complaint,
    dijagnoza_radnika: job.diagnosis_notes,
    obavljeni_radovi: job.work_summary,
    nalazi_inspekcije: inspectionFindings,
    foto_oznake_aplikacije: ctx.pkg.photoTags.map((t) => t.label),
    paket: await packageData(ctx, jobId, asset),
  };

  const clean = (compact(context) ?? {}) as Json;
  const hash = createHash('sha256').update(JSON.stringify(clean)).digest('hex').slice(0, 32);
  return { context: clean, hash };
}

// What each package knows beyond the common work order.
async function packageData(ctx: WorkshopContext, jobId: string, asset: Json & { id: string; make: string | null }): Promise<Json> {
  const s = ctx.supabase;
  switch (ctx.pkg.id) {
    case 'volt': {
      const [{ data: findings }, { data: battery }, { data: charging }, { data: drains }, { data: interventions }] = await Promise.all([
        s.from('volt_dtc_findings').select('code, module, status, description, cleared, returned_after_clear, confirmed_cause').eq('job_id', jobId),
        s.from('volt_battery_tests').select('battery_type, rest_voltage_v, rated_cca_a, measured_cca_a, soh_pct, soc_pct, cranking_min_v, result').eq('job_id', jobId).order('tested_at', { ascending: false }).limit(1),
        s.from('volt_charging_tests').select('alternator_type, idle_voltage_v, loaded_voltage_v, charge_current_a, ripple_mv, result').eq('job_id', jobId).order('tested_at', { ascending: false }).limit(1),
        s.from('volt_drain_sessions').select('method, target_ma, culprit_circuit, culprit_module, final_ma, verdict, readings:volt_drain_readings(t_offset_min, current_ma, event)').eq('job_id', jobId),
        s.from('volt_module_interventions').select('module, kind, sw_before, sw_after, result').eq('job_id', jobId),
      ]);
      const codes = [...new Set((findings ?? []).map((f) => f.code as string))];
      const [{ data: own }, { data: archive }] = codes.length
        ? await Promise.all([
            s.from('volt_dtc_custom').select('code, description_hr, causes, tests').in('code', codes),
            s.from('volt_dtc_findings').select('code, confirmed_cause').in('code', codes).neq('job_id', jobId).not('confirmed_cause', 'is', null).limit(40),
          ])
        : [{ data: [] }, { data: [] }];
      return {
        kodovi_gresaka: (findings ?? []).map((f) => {
          const entry = findDtcCode(f.code as string);
          const custom = (own ?? []).find((c) => c.code === f.code);
          return {
            kod: f.code,
            modul: f.module,
            status: f.status,
            opis: f.description ?? custom?.description_hr ?? entry?.description,
            obrisan: f.cleared || null,
            vratio_se_nakon_brisanja: f.returned_after_clear || null,
            potvrdjeni_uzrok_na_ovom_nalogu: f.confirmed_cause,
            radionica_vlastiti_uzroci: custom?.causes,
            radionica_vlastite_provjere: custom?.tests,
            radionica_potvrdjeni_uzroci_iz_arhive: (archive ?? []).filter((a) => a.code === f.code).map((a) => a.confirmed_cause),
            knjiznica_kategorija: entry?.category,
            knjiznica_tipicni_uzroci: entry ? DTC_CATEGORY_HINTS[entry.category].causes : null,
          };
        }),
        test_akumulatora: battery?.[0],
        test_punjenja: charging?.[0],
        parazitska_potrosnja: (drains ?? []).map((d) => ({
          metoda: d.method,
          cilj_ma: d.target_ma,
          ocitanja: ((d.readings as { t_offset_min: number; current_ma: number; event: string | null }[]) ?? [])
            .sort((a, b) => Number(a.t_offset_min) - Number(b.t_offset_min))
            .map((r) => `${num(r.t_offset_min)} min: ${num(r.current_ma)} mA${r.event ? ` (${r.event})` : ''}`),
          krivac: [d.culprit_circuit, d.culprit_module].filter(Boolean).join(' · ') || null,
          nakon_popravka_ma: num(d.final_ma),
          ocjena: d.verdict,
        })),
        zahvati_na_modulima: interventions,
      };
    }
    case 'gear': {
      const [{ data: parts }, { data: schedule }] = await Promise.all([
        s.from('gear_parts').select('catalog_number, oe_number, brand, order_status, line:job_lines(description)').eq('job_id', jobId),
        s.from('gear_asset_schedule').select('label, interval_km, interval_months, last_done_meter, last_done_date, next_due_meter, next_due_date').eq('asset_id', asset.id),
      ]);
      return {
        dijelovi: (parts ?? []).map((p) => ({ dio: (p.line as unknown as { description: string } | null)?.description, katalog: p.catalog_number, oe: p.oe_number, proizvodjac: p.brand, status: p.order_status })),
        servisni_plan: schedule,
      };
    }
    case 'body': {
      const [{ data: estimates }, { data: paint }, { data: adas }] = await Promise.all([
        s.from('body_estimates').select('id, version, status, loss_type, damages:body_panel_damages(zone, damage_type, size, operation, hours_body, hours_prep, hours_paint, hours_assembly, note)').eq('job_id', jobId).order('version', { ascending: false }).limit(1),
        s.from('body_paint_jobs').select('paint_code, paint_name, paint_system, coat_structure, color_match, variant, blend_panels, booth_temp_c, booth_humidity_pct').eq('job_id', jobId).maybeSingle(),
        s.from('body_adas_calibrations').select('system, procedure, result').eq('job_id', jobId),
      ]);
      const estimate = estimates?.[0];
      const zone = (code: string) => BODY_ZONES.find((z) => z.code === code)?.label ?? code;
      return {
        steta: estimate ? { vrsta: estimate.loss_type, status_procjene: estimate.status } : null,
        ostecenja: ((estimate?.damages as Json[] | undefined) ?? []).map((d) => ({
          dio: zone(d.zone as string),
          ostecenje: d.damage_type ? BODY_DAMAGE_TYPES[d.damage_type as string] : null,
          velicina: d.size,
          operacija: BODY_OPERATIONS[d.operation as string],
          sati: { lim: num(d.hours_body), priprema: num(d.hours_prep), lak: num(d.hours_paint), sastavljanje: num(d.hours_assembly) },
          napomena: d.note,
        })),
        lakiranje: paint,
        adas_kalibracije: adas,
      };
    }
    case 'wheel': {
      const [{ data: sets }, { data: specs }, { data: torque }, { data: repairs }, { data: alignment }] = await Promise.all([
        s.from('wheel_tire_sets').select('season, width, aspect, rim_diameter, load_index, speed_index, brand, model, status, tires:wheel_tires(position, dot_week, dot_year, tread_inner_mm, tread_middle_mm, tread_outer_mm, damage)').eq('asset_id', asset.id),
        asset.make ? s.from('wheel_torque_specs').select('model, torque_nm, bolt_size, retorque_km').ilike('make', asset.make) : Promise.resolve({ data: [] }),
        s.from('wheel_torque_records').select('applied_nm, retorque_due, retorque_done').eq('job_id', jobId),
        s.from('wheel_repairs').select('position, damage_zone, method, allowed').eq('job_id', jobId),
        s.from('wheel_alignments').select('device, values:wheel_alignment_values(axle, wheel, parameter, before_value, after_value, spec_min, spec_max, unit)').eq('job_id', jobId),
      ]);
      return {
        setovi_guma: (sets ?? []).map((set) => ({
          sezona: set.season,
          dimenzija: set.width ? `${set.width}/${set.aspect} R${set.rim_diameter} ${set.load_index ?? ''}${set.speed_index ?? ''}`.trim() : null,
          marka: [set.brand, set.model].filter(Boolean).join(' ') || null,
          gdje: set.status,
          gume: ((set.tires as Json[]) ?? []).map((t) => ({
            pozicija: t.position,
            dot: t.dot_week ? `${String(t.dot_week).padStart(2, '0')}/${t.dot_year}` : null,
            sara_mm: [t.tread_outer_mm, t.tread_middle_mm, t.tread_inner_mm].map(num),
            ostecenje: t.damage !== 'none' ? t.damage : null,
          })),
        })),
        radionica_moment_pritezanja: specs,
        pritezanje_na_nalogu: torque,
        popravci_guma: repairs,
        geometrija: alignment,
      };
    }
    case 'fleet': {
      const [{ data: compliance }, { data: field }, { data: downtime }] = await Promise.all([
        s.from('fleet_compliance_items').select('kind, valid_until').eq('asset_id', asset.id),
        s.from('fleet_field_jobs').select('address, arrived_at, work_started, work_finished').eq('job_id', jobId).maybeSingle(),
        s.from('fleet_downtime').select('from_at, to_at, reason').eq('job_id', jobId),
      ]);
      return {
        zakonski_rokovi: (compliance ?? []).map((c) => ({ vrsta: COMPLIANCE_LABELS[c.kind as string], vrijedi_do: c.valid_until, dana_do_isteka: daysUntil(c.valid_until as string) })),
        teren: field,
        zastoj: downtime,
      };
    }
    case 'moto': {
      const [{ data: engine }, { data: vessel }, { data: protocols }] = await Promise.all([
        s.from('moto_engine_details').select('engine_serial, power_hp, stroke, position, impeller_replaced_mth, impeller_replaced_date').eq('asset_id', asset.id).maybeSingle(),
        s.from('moto_vessel_details').select('length_m, beam_m, hull_material').eq('asset_id', asset.id).maybeSingle(),
        s.from('moto_seasonal_protocols').select('kind, fuel_stabilized, battery_maintained, anodes_wear_pct, completed_at').eq('job_id', jobId),
      ]);
      return { motor: engine, plovilo: vessel, sezonski_protokoli: protocols };
    }
    case 'air': {
      const [{ data: device }, { data: log }] = await Promise.all([
        s.from('air_equipment').select('refrigerant, charge_kg, hermetically_sealed, leak_detection, indoor_units, cooling_kw, heating_kw, install_date, warranty_until').eq('asset_id', asset.id).maybeSingle(),
        s.from('air_fgas_log').select('refrigerant, action, quantity_kg, leak_found, leak_location, cause, performed_at').eq('asset_id', asset.id).order('performed_at', { ascending: false }).limit(10),
      ]);
      const duty = device ? fgasObligations(device.refrigerant as string | null, num(device.charge_kg), { sealed: device.hermetically_sealed as boolean, leakDetection: device.leak_detection as boolean }) : null;
      return {
        uredjaj: device,
        f_plin_obveze: duty ? { t_co2e: duty.tco2e, servisna_kartica_sk1: duty.serviceCard, provjera_propustanja_mjeseci: duty.leakCheckMonths, napomena: duty.note } : null,
        radionica_evidencija_f_plina: log,
      };
    }
  }
}
