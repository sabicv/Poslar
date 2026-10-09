import 'server-only';
import { COMPLIANCE_LABELS } from '@/config/packages/fleet';
import { hasModule } from '@/config/tenant.config';
import { assetTitle, clientName, formatDate } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { addDays, addMonths, todayInZagreb } from '@/lib/time';

// Who should hear from the workshop now: tyres for the season, a service
// that is a year old, a recurring service plan, a legal deadline. Worked
// out from the jobs on every visit (nothing to keep in sync); what was
// sent or waved away is kept in `reminders` so it doesn't come back.

export type ReminderGroup = 'season' | 'service' | 'plan' | 'compliance';

export interface ReminderItem {
  key: string;
  group: ReminderGroup;
  clientId: string | null;
  assetId: string | null;
  planId?: string;
  name: string;
  phone: string | null;
  asset: string;
  reason: string;
  due: string | null;
  message: string;
}

export interface Season {
  kind: 'winter' | 'summer' | null;
  start: string;
  end: string;
  next: { kind: 'winter' | 'summer'; start: string };
}

// Winter tyres from 1 October to 15 December, summer from 1 March to 15 May.
export function currentSeason(today = todayInZagreb()): Season {
  const y = today.slice(0, 4);
  const md = today.slice(5);
  if (md >= '10-01' && md <= '12-15') return { kind: 'winter', start: `${y}-10-01`, end: `${y}-12-15`, next: { kind: 'summer', start: `${Number(y) + 1}-03-01` } };
  if (md >= '03-01' && md <= '05-15') return { kind: 'summer', start: `${y}-03-01`, end: `${y}-05-15`, next: { kind: 'winter', start: `${y}-10-01` } };
  const next = md < '03-01' ? { kind: 'summer' as const, start: `${y}-03-01` } : md < '10-01' ? { kind: 'winter' as const, start: `${y}-10-01` } : { kind: 'summer' as const, start: `${Number(y) + 1}-03-01` };
  return { kind: null, start: '', end: '', next };
}

const SEASON_CODES = ['wheel.season', 'wheel.suv'];
const SERVICE_CODES = ['gear.small_service', 'gear.big_service', 'moto.service_small', 'moto.service_big', 'moto.outboard_service', 'fleet.pm_a', 'fleet.pm_b', 'machine.service_250', 'machine.service_500'];
// Lines typed by hand count too: what a service or a tyre change is called.
const SEASON_WORDS = ['sezonsk', 'montaža 4 kotača', 'zamjena guma', 'zimske gume', 'ljetne gume'];
const SERVICE_WORDS = ['mali servis', 'veliki servis', 'zamjena ulja', 'ulje i filter', 'plansko održavanje', 'servis motocikla'];
const lineMatch = (codes: string[], words: string[]) => [`template_code.in.(${codes.join(',')})`, ...words.map((w) => `description.ilike.*${w}*`)].join(',');

type ClientRef = { kind: 'person' | 'company'; first_name: string | null; last_name: string | null; company_name: string | null; phone: string | null } | null;
type AssetRef = { id: string; asset_type: never; identifier: string | null; make: string | null; model: string | null; client_id: string; client: ClientRef } | null;

const label = (a: AssetRef) => [assetTitle(a), a?.identifier].filter(Boolean).join(' · ');
const vehicle = (a: AssetRef) => [assetTitle(a), a?.identifier ? `(${a.identifier})` : ''].filter(Boolean).join(' ');

export async function loadReminders(ctx: WorkshopContext): Promise<{ items: ReminderItem[]; season: Season; sentLately: number }> {
  const s = ctx.supabase;
  const today = todayInZagreb();
  const season = currentSeason(today);
  const sign = `\n\n${ctx.tenant.name}${ctx.tenant.phone ? `, ${ctx.tenant.phone}` : ''}`;
  const seasonal = ctx.pkg.id === 'wheel' || hasModule(ctx.pkg, ctx.tenant.enabled_modules, 'wheel_hotel');
  const services = ctx.pkg.templates.some((t) => SERVICE_CODES.includes(t.code)) || hasModule(ctx.pkg, ctx.tenant.enabled_modules, 'service_plan');
  const assetSel = 'id, asset_type, identifier, make, model, client_id, client:clients(kind, first_name, last_name, company_name, phone)';

  const [sent, open, plans, compliance, stored, seasonLines, serviceLines, schedule] = await Promise.all([
    // What was sent or waved away lately (a season back at most).
    s.from('reminders').select('kind, asset_id, client_id, status, created_at').in('status', ['sent', 'cancelled']).gte('created_at', addMonths(today, -6)),
    s.from('jobs').select('asset_id').neq('phase', 'collected'),
    s
      .from('maintenance_plans')
      .select('id, title, next_due_date, last_reminded_at, client:clients(kind, first_name, last_name, company_name, phone), site:sites(address, city, contact_phone), asset:assets(id, asset_type, identifier, make, model, client_id)')
      .eq('active', true)
      .lte('next_due_date', addDays(today, 30)),
    ctx.pkg.id === 'fleet' || ctx.pkg.id === 'machine' ? s.from('fleet_compliance_items').select(`id, kind, valid_until, asset:assets(${assetSel})`).gte('valid_until', addDays(today, -30)).lte('valid_until', addDays(today, 30)) : Promise.resolve({ data: [] }),
    seasonal && season.kind ? s.from('wheel_tire_sets').select(`id, season, client_id, client:clients(kind, first_name, last_name, company_name, phone), asset:assets(${assetSel})`).eq('status', 'stored').eq('season', season.kind) : Promise.resolve({ data: [] }),
    seasonal && season.kind
      ? s.from('job_lines').select(`template_code, job:jobs(created_at, asset:assets(${assetSel}))`).or(lineMatch(SEASON_CODES, SEASON_WORDS)).gte('created_at', addMonths(today, -18))
      : Promise.resolve({ data: [] }),
    services ? s.from('job_lines').select(`template_code, job:jobs(phase, created_at, collected_at, asset:assets(${assetSel}))`).or(lineMatch(SERVICE_CODES, SERVICE_WORDS)).gte('created_at', addMonths(today, -24)) : Promise.resolve({ data: [] }),
    services ? s.from('gear_asset_schedule').select(`label, next_due_date, asset:assets(${assetSel})`).not('next_due_date', 'is', null).lte('next_due_date', addDays(today, 30)) : Promise.resolve({ data: [] }),
  ]);

  const done = (sent.data ?? []) as { kind: string; asset_id: string | null; client_id: string | null; status: string; created_at: string }[];
  const handled = (kind: string, assetId: string | null, clientId: string | null, since: string) =>
    done.some((r) => r.kind === kind && r.created_at >= since && (assetId ? r.asset_id === assetId : r.client_id === clientId));
  const inShop = new Set((open.data ?? []).map((j) => j.asset_id as string));
  const items: ReminderItem[] = [];

  // Tyres for the season: sets we keep, and everyone who changed tyres here last year.
  if (season.kind) {
    const word = season.kind === 'winter' ? 'zimske' : 'ljetne';
    const lead = season.kind === 'winter' ? 'Stiže hladno vrijeme' : 'Stiže toplije vrijeme';
    const byAsset = new Map<string, ReminderItem>();
    for (const set of (stored.data ?? []) as unknown as { id: string; client_id: string; client: ClientRef; asset: AssetRef }[]) {
      const key = set.asset?.id ?? `client:${set.client_id}`;
      if (handled('season', set.asset?.id ?? null, set.client_id, season.start) || (set.asset && inShop.has(set.asset.id))) continue;
      byAsset.set(key, {
        key: `season:${key}`,
        group: 'season',
        clientId: set.client_id,
        assetId: set.asset?.id ?? null,
        name: clientName(set.client),
        phone: set.client?.phone ?? null,
        asset: set.asset ? label(set.asset) : 'Komplet guma',
        reason: `${word[0].toUpperCase()}${word.slice(1)} gume čuvamo kod nas`,
        due: season.start,
        message: `Poštovani, ${lead.toLowerCase()} i vrijeme je za ${word} gume${set.asset ? ` na Vašem vozilu ${vehicle(set.asset)}` : ''}. Vaše ${word} gume čuvamo kod nas. Javite nam koji dan Vam odgovara.${sign}`,
      });
    }
    const last = new Map<string, { at: string; asset: AssetRef }>();
    for (const l of (seasonLines.data ?? []) as unknown as { job: { created_at: string; asset: AssetRef } | null }[]) {
      const a = l.job?.asset;
      if (!a) continue;
      const prev = last.get(a.id);
      if (!prev || l.job!.created_at > prev.at) last.set(a.id, { at: l.job!.created_at, asset: a });
    }
    for (const [id, { at, asset }] of last) {
      if (byAsset.has(id) || at.slice(0, 10) >= season.start || inShop.has(id) || handled('season', id, asset!.client_id, season.start)) continue;
      byAsset.set(id, {
        key: `season:${id}`,
        group: 'season',
        clientId: asset!.client_id,
        assetId: id,
        name: clientName(asset!.client),
        phone: asset!.client?.phone ?? null,
        asset: label(asset),
        reason: `Zadnja zamjena guma ${formatDate(at)}`,
        due: season.start,
        message: `Poštovani, ${lead.toLowerCase()} i vrijeme je za ${word} gume na Vašem vozilu ${vehicle(asset)}. Javite nam koji dan Vam odgovara.${sign}`,
      });
    }
    items.push(...byAsset.values());
  }

  // A service a year old (and nothing newer), or due on the vehicle's service plan.
  const lastService = new Map<string, { at: string; asset: AssetRef }>();
  for (const l of (serviceLines.data ?? []) as unknown as { job: { phase: string; created_at: string; collected_at: string | null; asset: AssetRef } | null }[]) {
    const a = l.job?.asset;
    if (!a) continue;
    const at = l.job!.collected_at ?? l.job!.created_at;
    const prev = lastService.get(a.id);
    if (!prev || at > prev.at) lastService.set(a.id, { at, asset: a });
  }
  const serviceItems = new Map<string, ReminderItem>();
  for (const [id, { at, asset }] of lastService) {
    if (at.slice(0, 10) > addMonths(today, -11) || inShop.has(id) || handled('service', id, asset!.client_id, addDays(today, -60))) continue;
    serviceItems.set(id, {
      key: `service:${id}`,
      group: 'service',
      clientId: asset!.client_id,
      assetId: id,
      name: clientName(asset!.client),
      phone: asset!.client?.phone ?? null,
      asset: label(asset),
      reason: `Zadnji servis ${formatDate(at)}`,
      due: addMonths(at.slice(0, 10), 12),
      message: `Poštovani, prošla je godina od zadnjeg servisa Vašeg vozila ${vehicle(asset)}. Javite nam kad Vam odgovara termin.${sign}`,
    });
  }
  for (const row of (schedule.data ?? []) as unknown as { label: string; next_due_date: string; asset: AssetRef }[]) {
    const a = row.asset;
    if (!a || inShop.has(a.id) || handled('service', a.id, a.client_id, addDays(today, -60))) continue;
    const existing = serviceItems.get(a.id);
    if (existing) {
      existing.reason += ` · po planu: ${row.label.toLowerCase()} ${formatDate(row.next_due_date)}`;
      continue;
    }
    serviceItems.set(a.id, {
      key: `service:${a.id}`,
      group: 'service',
      clientId: a.client_id,
      assetId: a.id,
      name: clientName(a.client),
      phone: a.client?.phone ?? null,
      asset: label(a),
      reason: `Po servisnom planu: ${row.label.toLowerCase()} ${formatDate(row.next_due_date)}`,
      due: row.next_due_date,
      message: `Poštovani, za Vaše vozilo ${vehicle(a)} bliži se ${row.label.toLowerCase()} (rok ${formatDate(row.next_due_date)}). Javite nam kad Vam odgovara termin.${sign}`,
    });
  }
  items.push(...serviceItems.values());

  // Recurring plans (field trades): due within a month, not reminded in the last month.
  type PlanRow = { id: string; title: string; next_due_date: string; last_reminded_at: string | null; client: ClientRef; site: { address: string; city: string | null; contact_phone: string | null } | null; asset: AssetRef };
  for (const p of (plans.data ?? []) as unknown as PlanRow[]) {
    if (p.last_reminded_at && p.last_reminded_at.slice(0, 10) > addDays(today, -30)) continue;
    const place = [p.site?.address, p.site?.city].filter(Boolean).join(', ');
    items.push({
      key: `plan:${p.id}`,
      group: 'plan',
      clientId: p.asset?.client_id ?? null,
      assetId: p.asset?.id ?? null,
      planId: p.id,
      name: clientName(p.client),
      phone: p.site?.contact_phone || p.client?.phone || null,
      asset: [place, assetTitle(p.asset)].filter(Boolean).join(' · '),
      reason: `${p.title}, rok ${formatDate(p.next_due_date)}`,
      due: p.next_due_date,
      message: `Poštovani, bliži se ${p.title.toLowerCase()}${place ? ` na adresi ${place}` : ''} (rok ${formatDate(p.next_due_date)}). Odgovorite s danom i vremenom koje Vam odgovara.${sign}`,
    });
  }

  // Legal deadlines on fleet vehicles.
  for (const c of (compliance.data ?? []) as unknown as { id: string; kind: string; valid_until: string; asset: AssetRef }[]) {
    const a = c.asset;
    if (!a || handled('compliance', a.id, a.client_id, addDays(today, -30))) continue;
    const what = COMPLIANCE_LABELS[c.kind] ?? c.kind;
    items.push({
      key: `compliance:${c.id}`,
      group: 'compliance',
      clientId: a.client_id,
      assetId: a.id,
      name: clientName(a.client),
      phone: a.client?.phone ?? null,
      asset: label(a),
      reason: `${what} · rok ${formatDate(c.valid_until)}${c.valid_until < today ? ' (prošao)' : ''}`,
      due: c.valid_until,
      message: `Poštovani, za vozilo ${vehicle(a)} rok za ${what.toLowerCase()} je ${formatDate(c.valid_until)}. Javite nam termin za pripremu.${sign}`,
    });
  }

  items.sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
  const sentLately = done.filter((r) => r.status === 'sent' && r.created_at >= addDays(today, -30)).length;
  return { items, season, sentLately };
}
