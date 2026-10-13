import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { MARK_CODES, diagramFor, resolveZones } from '@/components/Diagram';
import { BODY_DAMAGE_TYPES, BODY_OPERATIONS } from '@/config/packages/body';
import { BODY_PHASES } from '@/config/production';
import { getPackage, phaseLabel, type JobPhase, type MeterUnit } from '@/config/tenant.config';
import { assetTitle, clientName, formatDate, formatDateTime, formatMeter } from '@/lib/format';
import type { Asset, Client, ConditionMark } from '@/types/db';

export interface JobSheet {
  workshop: string;
  jobNumber: number;
  phase: string;
  received: string;
  client: string;
  phone: string | null;
  assetLabel: string;
  assetName: string;
  identifier: string | null;
  meter: string | null;
  complaint: string | null;
  diagnosis: string | null;
  work: string | null;
  promised: string | null;
  bay: string | null;
  intake: string[];
  handover: string[];
  lines: string[];
  lists: { title: string; when: string; done: boolean; items: { label: string; result: string }[] }[];
  messages: { when: string; body: string }[];
  estimate: string[];
  damages: string[];
  paint: string | null;
  phases: string[];
  calibrations: string[];
  materials: string[];
}

const CHECK = { ok: 'U redu', warn: 'Oprez', crit: 'Hitno', na: 'Ne odnosi se', not_checked: 'Nije provjereno' } as const;
const ADAS = { front_camera: 'Prednja kamera', radar: 'Radar', parking_sensors: 'Parkirni senzori', surround_cameras: 'Kamere 360°', blind_spot: 'Mrtvi kut' };
const MATERIAL = { basecoat: 'Baza', clearcoat: 'Lak', primer: 'Temeljna', filler: 'Kit', thinner: 'Razrjeđivač', hardener: 'Otvrdnjivač', abrasive: 'Brusni materijal', masking: 'Maskiranje', other: 'Ostalo' };
const ESTIMATE_STATUS = { draft: 'U izradi', sent: 'Poslano osiguranju', approved: 'Odobreno', supplement: 'Dopuna', rejected: 'Odbijeno' };

function sayMark(mark: ConditionMark, zoneLabel: Map<string, string>, markLabel: Map<string, string>) {
  const where = zoneLabel.get(mark.zone) ?? mark.zone;
  const what = markLabel.get(mark.code) ?? mark.code;
  return mark.note ? `${where}: ${what} (${mark.note})` : `${where}: ${what}`;
}

// Everything entered on the job, on one printable page, for a person reviewing the file.
export async function loadJobSheet(db: SupabaseClient, jobId: string): Promise<JobSheet | null> {
  const { data: job } = await db
    .from('jobs')
    .select('id, tenant_id, number, phase, complaint, diagnosis_notes, work_summary, created_at, promised_at, bay, meter_in, meter_unit, client:clients(kind, first_name, last_name, company_name, phone), asset:assets(make, model, asset_type, identifier)')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return null;

  const { data: tenant } = await db.from('tenants').select('name, package').eq('id', job.tenant_id as string).single();
  if (!tenant) return null;
  const pkg = getPackage(tenant.package as string);
  const asset = job.asset as unknown as Pick<Asset, 'make' | 'model' | 'asset_type' | 'identifier'> | null;
  const zones = resolveZones(diagramFor(asset?.asset_type ?? pkg.defaultAssetType, pkg.diagram), pkg.diagram, pkg.conditionZones);
  const zoneLabel = new Map(zones.map((zone) => [zone.code, zone.label]));
  const markLabel = new Map((pkg.marks?.length ? pkg.marks : (Object.entries(MARK_CODES) as [string, string][]).map(([code, label]) => ({ code, label }))).map((mark) => [mark.code, mark.label]));
  const itemLabel = new Map(pkg.inspections.flatMap((template) => template.sections.flatMap((section) => section.items.map((item) => [`${template.code}:${item.code}`, item.label] as const))));

  const [{ data: reports }, { data: inspections }, { data: lines }, { data: messages }, { data: staff }, { data: estimates }, { data: paint }, { data: phases }, { data: adas }, { data: materials }] = await Promise.all([
    db.from('condition_reports').select('kind, marks').eq('job_id', jobId),
    db.from('inspections').select('id, template_code, title, started_at, completed_at').eq('job_id', jobId).order('started_at'),
    db.from('job_lines').select('description, qty, unit, approval').eq('job_id', jobId).order('sort'),
    db.from('job_messages').select('body, created_at, sender_id').eq('job_id', jobId).order('created_at'),
    db.from('profiles').select('id, full_name'),
    pkg.id === 'body' ? db.from('body_estimates').select('id, version, status, claim_number, insurer_id').eq('job_id', jobId).order('version', { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
    pkg.id === 'body' ? db.from('body_paint_jobs').select('paint_code, paint_name, paint_system').eq('job_id', jobId).maybeSingle() : Promise.resolve({ data: null }),
    pkg.id === 'body' ? db.from('body_production_phases').select('phase, started_at, finished_at, worker_id').eq('job_id', jobId).order('started_at') : Promise.resolve({ data: [] }),
    pkg.id === 'body' ? db.from('body_adas_calibrations').select('system, result').eq('job_id', jobId) : Promise.resolve({ data: [] }),
    pkg.id === 'body' ? db.from('body_material_usage').select('material, qty, unit').eq('job_id', jobId) : Promise.resolve({ data: [] }),
  ]);

  const names = new Map((staff ?? []).map((person) => [person.id as string, (person.full_name as string | null) ?? '']));
  const intake = ((reports ?? []) as { kind: string; marks: ConditionMark[] }[]).find((report) => report.kind === 'intake');
  const handover = ((reports ?? []) as { kind: string; marks: ConditionMark[] }[]).find((report) => report.kind === 'handover');

  const inspectionIds = (inspections ?? []).map((inspection) => inspection.id as string);
  const { data: answers } = inspectionIds.length
    ? await db.from('inspection_results').select('inspection_id, item_code, status, note').in('inspection_id', inspectionIds)
    : { data: [] };
  const answersByList = new Map<string, { item_code: string; status: string; note: string | null }[]>();
  for (const answer of answers ?? []) {
    const list = answersByList.get(answer.inspection_id as string) ?? [];
    list.push(answer as { item_code: string; status: string; note: string | null });
    answersByList.set(answer.inspection_id as string, list);
  }

  const estimate = (estimates ?? [])[0] as { id: string; version: number; status: string; claim_number: string | null } | undefined;
  let damages: string[] = [];
  if (estimate) {
    const { data: panels } = await db.from('body_panel_damages').select('zone, damage_type, operation, hours_body, hours_prep, hours_paint, hours_assembly').eq('estimate_id', estimate.id);
    damages = (panels ?? []).map((panel) => {
      const where = zoneLabel.get(panel.zone as string) ?? (panel.zone as string);
      const what = panel.damage_type ? BODY_DAMAGE_TYPES[panel.damage_type as keyof typeof BODY_DAMAGE_TYPES] ?? panel.damage_type : null;
      const operation = BODY_OPERATIONS[panel.operation as keyof typeof BODY_OPERATIONS] ?? panel.operation;
      const hours = [panel.hours_body, panel.hours_prep, panel.hours_paint, panel.hours_assembly].map(Number).reduce((sum, value) => sum + value, 0);
      return [where, what, operation, hours ? `${hours} h` : null].filter(Boolean).join(' · ');
    });
  }

  const client = job.client as unknown as Pick<Client, 'kind' | 'first_name' | 'last_name' | 'company_name' | 'phone'> | null;
  const paintRow = paint as { paint_code: string | null; paint_name: string | null; paint_system: string | null } | null;

  return {
    workshop: tenant.name as string,
    jobNumber: job.number as number,
    phase: phaseLabel(pkg, job.phase as JobPhase),
    received: formatDateTime(job.created_at as string),
    client: clientName(client),
    phone: client?.phone ?? null,
    assetLabel: pkg.vocabulary.asset.one,
    assetName: assetTitle(asset),
    identifier: asset?.identifier ?? null,
    meter: job.meter_in == null ? null : formatMeter(job.meter_in as number, job.meter_unit as MeterUnit | null),
    complaint: (job.complaint as string | null) || null,
    diagnosis: (job.diagnosis_notes as string | null) || null,
    work: (job.work_summary as string | null) || null,
    promised: job.promised_at ? formatDateTime(job.promised_at as string) : null,
    bay: (job.bay as string | null) || null,
    intake: ((intake?.marks ?? []) as ConditionMark[]).map((mark) => sayMark(mark, zoneLabel, markLabel)),
    handover: ((handover?.marks ?? []) as ConditionMark[]).map((mark) => sayMark(mark, zoneLabel, markLabel)),
    lines: ((lines ?? []) as { description: string; qty: number; unit: string; approval: string }[]).map((line) => `${line.description} · ${line.qty} ${line.unit}`),
    lists: ((inspections ?? []) as { id: string; template_code: string; title: string; started_at: string; completed_at: string | null }[]).map((inspection) => ({
      title: inspection.title,
      when: formatDateTime(inspection.started_at),
      done: Boolean(inspection.completed_at),
      items: (answersByList.get(inspection.id) ?? []).map((answer) => ({
        label: itemLabel.get(`${inspection.template_code}:${answer.item_code}`) ?? answer.item_code,
        result: [CHECK[answer.status as keyof typeof CHECK] ?? answer.status, answer.note].filter(Boolean).join(' · '),
      })),
    })),
    messages: ((messages ?? []) as { body: string; created_at: string; sender_id: string }[]).map((message) => ({
      when: `${formatDateTime(message.created_at)} · ${names.get(message.sender_id) ?? ''}`,
      body: message.body,
    })),
    estimate: estimate ? [`Verzija ${estimate.version}`, ESTIMATE_STATUS[estimate.status as keyof typeof ESTIMATE_STATUS] ?? estimate.status, estimate.claim_number ? `Šteta ${estimate.claim_number}` : null].filter((line): line is string => Boolean(line)) : [],
    damages,
    paint: paintRow ? [paintRow.paint_code, paintRow.paint_name, paintRow.paint_system].filter(Boolean).join(' · ') || null : null,
    phases: ((phases ?? []) as { phase: string; started_at: string; finished_at: string | null; worker_id: string | null }[]).map((phase) => {
      const name = BODY_PHASES[phase.phase as keyof typeof BODY_PHASES] ?? phase.phase;
      const who = phase.worker_id ? names.get(phase.worker_id) : null;
      return [name, who, formatDate(phase.started_at), phase.finished_at ? 'završeno' : 'u tijeku'].filter(Boolean).join(' · ');
    }),
    calibrations: ((adas ?? []) as { system: string; result: string | null }[]).map((row) => `${ADAS[row.system as keyof typeof ADAS] ?? row.system}${row.result === 'success' ? ' · uspješno' : row.result === 'failed' ? ' · neuspješno' : ''}`),
    materials: ((materials ?? []) as { material: string; qty: number; unit: string }[]).map((row) => `${MATERIAL[row.material as keyof typeof MATERIAL] ?? row.material} · ${row.qty} ${row.unit}`),
  };
}
