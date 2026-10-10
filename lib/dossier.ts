import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { MARK_CODES, diagramFor, resolveZones } from '@/components/Diagram';
import { getPackage } from '@/config/tenant.config';
import { assetTitle, clientName, formatDateTime } from '@/lib/format';
import { formatTime } from '@/lib/time';
import type { Asset, Client, ConditionMark, ConditionReport } from '@/types/db';

export interface DossierData {
  workshop: { name: string; address: string | null; city: string | null; phone: string | null; email: string | null; logoUrl: string | null };
  jobNumber: number;
  clientName: string;
  assetLabel: string;
  assetName: string;
  identifier: string | null;
  place: string | null;
  when: string | null;
  technician: string | null;
  request: string | null;
  workDone: string | null;
  intake: string[];
  handover: string[];
  findings: { label: string; detail: string | null; tone: 'warn' | 'crit' }[];
  okCount: number;
  works: string[];
  photos: { url: string; caption: string | null }[];
  signature: { url: string; name: string | null; when: string | null; kind: 'intake' | 'handover' } | null;
}

const PHOTO_CAP = 4;
const LIST_CAP = 8;

function shorten(lines: string[]): string[] {
  if (lines.length <= LIST_CAP) return lines;
  return [...lines.slice(0, LIST_CAP), `i još ${lines.length - LIST_CAP}`];
}

function sameMarks(a: ConditionMark[], b: ConditionMark[]) {
  const key = (m: ConditionMark) => `${m.zone}|${m.code}|${m.note ?? ''}`;
  return a.map(key).sort().join('\n') === b.map(key).sort().join('\n');
}

function isImage(mime: string | null, path: string) {
  if (mime?.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|heic)$/i.test(path);
}

// The job, told once, as the page that follows the invoice. Not every tab.
export async function loadDossier(db: SupabaseClient, jobId: string): Promise<DossierData | null> {
  const { data: job } = await db
    .from('jobs')
    .select(
      'id, tenant_id, number, complaint, work_summary, created_at, scheduled_start, arrived_at, left_at, finished_at, client:clients(kind, first_name, last_name, company_name), asset:assets(make, model, asset_type, identifier), site:sites(address, city), assignee:profiles(full_name)'
    )
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return null;

  const { data: tenant } = await db.from('tenants').select('name, phone, email, address, city, logo_url, package').eq('id', job.tenant_id as string).single();
  if (!tenant) return null;
  const pkg = getPackage(tenant.package as string);
  const asset = job.asset as unknown as Pick<Asset, 'make' | 'model' | 'asset_type' | 'identifier'> | null;
  const zones = resolveZones(diagramFor(asset?.asset_type ?? pkg.defaultAssetType, pkg.diagram), pkg.diagram, pkg.conditionZones);
  const zoneLabel = new Map(zones.map((z) => [z.code, z.label]));
  const markLabel = new Map((pkg.marks?.length ? pkg.marks : (Object.entries(MARK_CODES) as [string, string][]).map(([code, label]) => ({ code, label }))).map((m) => [m.code, m.label]));
  const itemLabel = new Map(pkg.inspections.flatMap((t) => t.sections.flatMap((sec) => sec.items.map((i) => [`${t.code}:${i.code}`, i.label] as const))));

  const [{ data: reports }, { data: inspections }, { data: lines }, { data: files }] = await Promise.all([
    db.from('condition_reports').select('kind, marks, signer_name, signature_path, signed_at').eq('job_id', jobId),
    db.from('inspections').select('template_code, completed_at, results:inspection_results(item_code, status, measure_value, measure_unit, note)').eq('job_id', jobId).not('completed_at', 'is', null),
    db.from('job_lines').select('description, sort').eq('job_id', jobId).eq('approval', 'approved').order('sort'),
    db.from('attachments').select('path, caption, mime, tag').eq('job_id', jobId).eq('visibility', 'customer').order('created_at').limit(24),
  ]);

  const say = (mark: ConditionMark) => {
    const where = zoneLabel.get(mark.zone) ?? mark.zone;
    const what = markLabel.get(mark.code) ?? mark.code;
    return mark.note ? `${where}: ${what} (${mark.note})` : `${where}: ${what}`;
  };
  const intakeReport = ((reports ?? []) as Pick<ConditionReport, 'kind' | 'marks' | 'signer_name' | 'signature_path' | 'signed_at'>[]).find((r) => r.kind === 'intake');
  const handoverReport = ((reports ?? []) as Pick<ConditionReport, 'kind' | 'marks' | 'signer_name' | 'signature_path' | 'signed_at'>[]).find((r) => r.kind === 'handover');
  const intakeMarks = (intakeReport?.marks ?? []) as ConditionMark[];
  const handoverMarks = (handoverReport?.marks ?? []) as ConditionMark[];

  const findings: DossierData['findings'] = [];
  let okCount = 0;
  for (const ins of inspections ?? []) {
    const code = ins.template_code as string;
    const results = (ins.results ?? []) as { item_code: string; status: string; measure_value: number | null; measure_unit: string | null; note: string | null }[];
    for (const row of results) {
      if (row.status === 'ok') okCount += 1;
      if (row.status !== 'warn' && row.status !== 'crit') continue;
      const measure = row.measure_value != null ? `${row.measure_value} ${row.measure_unit ?? ''}`.trim() : null;
      findings.push({
        label: itemLabel.get(`${code}:${row.item_code}`) ?? row.item_code,
        detail: [measure, row.note].filter(Boolean).join(' · ') || null,
        tone: row.status,
      });
    }
  }

  const images = (files ?? []).filter((f) => isImage((f.mime as string | null) ?? null, f.path as string));
  images.sort((a, b) => Number(b.tag === 'before' || b.tag === 'after') - Number(a.tag === 'before' || a.tag === 'after'));
  const picked = images.slice(0, PHOTO_CAP);
  const signed = picked.length ? (await db.storage.from('job-files').createSignedUrls(picked.map((f) => f.path as string), 3600)).data ?? [] : [];
  const urlOf = new Map(signed.filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]));

  const signedReport = handoverReport?.signature_path ? handoverReport : intakeReport?.signature_path ? intakeReport : null;
  let signature: DossierData['signature'] = null;
  if (signedReport?.signature_path) {
    const { data: sig } = await db.storage.from('job-files').createSignedUrl(signedReport.signature_path, 3600);
    if (sig?.signedUrl) {
      signature = {
        url: sig.signedUrl,
        name: signedReport.signer_name,
        when: signedReport.signed_at,
        kind: signedReport.kind,
      };
    }
  }

  const arrived = job.arrived_at as string | null;
  const left = job.left_at as string | null;
  const when = arrived
    ? `${formatDateTime(arrived)}${left ? ` – ${formatTime(left)}` : ''}`
    : formatDateTime((job.scheduled_start as string | null) ?? (job.finished_at as string | null) ?? (job.created_at as string));
  const site = job.site as unknown as { address: string | null; city: string | null } | null;
  const client = job.client as unknown as Pick<Client, 'kind' | 'first_name' | 'last_name' | 'company_name'> | null;

  return {
    workshop: {
      name: tenant.name as string,
      address: (tenant.address as string | null) ?? null,
      city: (tenant.city as string | null) ?? null,
      phone: (tenant.phone as string | null) ?? null,
      email: (tenant.email as string | null) ?? null,
      logoUrl: (tenant.logo_url as string | null) ?? null,
    },
    jobNumber: job.number as number,
    clientName: clientName(client),
    assetLabel: pkg.vocabulary.asset.one,
    assetName: assetTitle(asset),
    identifier: asset?.identifier ?? null,
    place: [site?.address, site?.city].filter(Boolean).join(', ') || null,
    when,
    technician: (job.assignee as unknown as { full_name: string | null } | null)?.full_name ?? null,
    request: (job.complaint as string | null) || null,
    workDone: (job.work_summary as string | null) || null,
    intake: shorten(intakeMarks.map(say)),
    handover: handoverMarks.length === 0 ? [] : sameMarks(intakeMarks, handoverMarks) ? ['Isto kao pri prijemu'] : shorten(handoverMarks.map(say)),
    findings: findings.slice(0, LIST_CAP),
    okCount,
    works: shorten(((lines ?? []) as { description: string }[]).map((l) => l.description).filter(Boolean)),
    photos: picked.flatMap((f) => {
      const url = urlOf.get(f.path as string);
      return url ? [{ url, caption: (f.caption as string | null) ?? null }] : [];
    }),
    signature,
  };
}
