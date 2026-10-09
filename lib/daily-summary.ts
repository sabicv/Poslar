import 'server-only';
import { getPackage, phaseLabel } from '@/config/tenant.config';
import { subscription } from '@/lib/billing';
import { clientName, countJobs, formatEuro, plural, vocativeHR } from '@/lib/format';
import { isGuestTenant } from '@/lib/guest';
import { sendMail } from '@/lib/mail';
import { publicAppUrl } from '@/lib/qr';
import { allRows, inChunks } from '@/lib/paged';
import { createAdminClient } from '@/lib/supabase/admin';
import { addDays, formatTime, todayInZagreb, zagrebMidnight } from '@/lib/time';
import type { Tenant } from '@/types/db';

// Dnevni sažetak: in the evening every owner gets one e-mail with the day
// in each of their workshops (new jobs and where they came from, jobs
// handed over, revenue, payments, Poslar's calls, what is still unpaid)
// and tomorrow's appointments. A quiet day sends nothing. The owner
// switches it off per workshop in Postavke (settings.daily_email).

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;

const FROM: Record<string, string> = { phone: 'Poslar na telefonu', booking: 'rezervacija online', qr: 's vrata' };

export interface DaySummary {
  tenant: Tenant;
  quiet: boolean;
  revenue: number;
  text: string;
}

const dayTitle = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('hr-HR', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'UTC' });

export async function daySummary(admin: Admin, t: Tenant, day: string): Promise<DaySummary> {
  const from = zagrebMidnight(day).toISOString();
  const to = zagrebMidnight(addDays(day, 1)).toISOString();
  const after = zagrebMidnight(addDays(day, 2)).toISOString();
  const pkg = getPackage(t.package);
  const money = !pkg.internalJobs;
  const jobs = () => admin.from('jobs').select('id').eq('tenant_id', t.id);
  const [created, handed, paid, unpaid, calls, { data: tomorrow }] = await Promise.all([
    allRows<Row>((a, b) => admin.from('jobs').select('id, source').eq('tenant_id', t.id).gte('created_at', from).lt('created_at', to).order('id').range(a, b)),
    allRows<Row>((a, b) => jobs().gte('collected_at', from).lt('collected_at', to).order('id').range(a, b)),
    money ? allRows<Row>((a, b) => jobs().gte('paid_at', from).lt('paid_at', to).order('id').range(a, b)) : Promise.resolve([] as Row[]),
    money ? allRows<Row>((a, b) => jobs().in('phase', ['ready', 'collected']).eq('payment_status', 'unpaid').order('id').range(a, b)) : Promise.resolve([] as Row[]),
    allRows<Row>((a, b) => admin.from('phone_calls').select('duration_s').eq('tenant_id', t.id).gte('created_at', from).lt('created_at', to).order('id').range(a, b)),
    admin
      .from('jobs')
      .select('scheduled_start, complaint, client:clients(kind, first_name, last_name, company_name), asset:assets(identifier), site:sites(address, city)')
      .eq('tenant_id', t.id)
      .gte('scheduled_start', to)
      .lt('scheduled_start', after)
      .neq('phase', 'collected')
      .order('scheduled_start')
      .limit(30),
  ]);
  const ids = (rows: Row[]) => rows.map((r) => r.id as string);
  const totals = money ? await inChunks<Row>([...new Set([...ids(handed), ...ids(paid), ...ids(unpaid)])], (chunk) => admin.from('job_totals').select('job_id, gross_total').in('job_id', chunk).order('job_id')) : [];
  const gross = new Map(totals.map((r) => [r.job_id as string, Number(r.gross_total)]));
  const sum = (rows: Row[]) => rows.reduce((s, r) => s + (gross.get(r.id as string) ?? 0), 0);
  const revenue = sum(handed);
  const minutes = Math.ceil(calls.reduce((s, c) => s + Number(c.duration_s ?? 0), 0) / 60);
  const next = tomorrow ?? [];

  const lines: string[] = [`${t.name}`, ''];
  if (created.length) {
    const bySource = Object.entries(FROM)
      .map(([source, label]) => [created.filter((j) => j.source === source).length, label] as const)
      .filter(([n]) => n > 0)
      .map(([n, label]) => `${n} ${label}`);
    lines.push(`Novi nalozi: ${created.length}${bySource.length ? ` (${bySource.join(', ')})` : ''}`);
  }
  if (handed.length) lines.push(`${phaseLabel(pkg, 'collected')}: ${countJobs(handed.length)}${money ? `, promet ${formatEuro(revenue)}` : ''}`);
  if (paid.length) lines.push(`Naplaćeno: ${formatEuro(sum(paid))}`);
  if (calls.length) lines.push(`Poslar na telefonu: ${calls.length} ${plural(calls.length, 'poziv', 'poziva', 'poziva')}, ${minutes} min`);
  if (unpaid.length) lines.push(`Za naplatu ukupno: ${formatEuro(sum(unpaid))} (${countJobs(unpaid.length)})`);
  if (lines.length === 2) lines.push('Danas bez novih naloga i preuzimanja.');
  lines.push('');
  if (next.length) {
    lines.push(`Sutra, ${dayTitle(addDays(day, 1))}: ${next.length} ${plural(next.length, 'termin', 'termina', 'termina')}`);
    for (const j of next) {
      const site = j.site as unknown as { address: string | null; city: string | null } | null;
      const where = pkg.sector === 'field' ? [site?.address, site?.city].filter(Boolean).join(', ') : ((j.asset as unknown as { identifier: string | null } | null)?.identifier ?? '');
      const what = ((j.complaint as string | null) ?? '').replace(/\s+/g, ' ').slice(0, 70);
      lines.push(`${formatTime(j.scheduled_start as string)} · ${[where, clientName(j.client as never), what].filter(Boolean).join(' · ')}`);
    }
  } else {
    lines.push(`Sutra, ${dayTitle(addDays(day, 1))}: nema zakazanih termina.`);
  }

  const quiet = !created.length && !handed.length && !paid.length && !calls.length && !next.length;
  return { tenant: t, quiet, revenue, text: lines.join('\n') };
}

// Which workshops get one: real ones that work (not the demos, not the
// 24-hour trial on examples, not locked) and did not switch it off.
export function wantsSummary(t: Tenant): boolean {
  const s = (t.settings as { demo?: unknown; daily_email?: unknown } | null) ?? {};
  if (isGuestTenant(t) || s.demo === true || s.daily_email === false || t.sample_until) return false;
  if (t.status === 'suspended') return false;
  if (t.status === 'trial' && t.trial_ends_at && new Date(t.trial_ends_at) < new Date()) return false;
  return subscription(t).status !== 'overdue';
}

export function summaryMail(name: string | null, day: string, parts: DaySummary[]): { subject: string; text: string } {
  const first = (name ?? '').trim().split(/\s+/)[0];
  const total = parts.reduce((s, p) => s + p.revenue, 0);
  const subject =
    parts.length === 1
      ? `Poslar · ${parts[0].tenant.name}: ${dayTitle(day)}${parts[0].revenue ? `, ${formatEuro(parts[0].revenue)}` : ''}`
      : `Poslar · ${parts.length} radionice: ${dayTitle(day)}${total ? `, ${formatEuro(total)}` : ''}`;
  const text = [
    first ? `Dobra večer, ${vocativeHR(first)}.` : 'Dobra večer.',
    parts.length === 1 ? 'Evo kako je prošao dan u radionici.' : 'Evo kako je prošao dan u Vašim radionicama.',
    '',
    parts.map((p) => p.text).join('\n\n----------\n\n'),
    '',
    `Otvori Poslar: ${publicAppUrl()}/app`,
    'Sažetak isključujete u Postavke → Dnevni sažetak.',
  ]
    .filter((l, i, all) => !(l === '' && all[i - 1] === ''))
    .join('\n');
  return { subject, text };
}

// Every owner once, with all of their workshops. Returns how many went.
export async function sendDailySummaries(admin: Admin, day = todayInZagreb()): Promise<{ sent: number; quiet: number; owners: number }> {
  const tenants = (await allRows<Tenant>((a, b) => admin.from('tenants').select('*').order('id').range(a, b))).filter(wantsSummary);
  if (!tenants.length) return { sent: 0, quiet: 0, owners: 0 };
  const byId = new Map(tenants.map((t) => [t.id, t]));
  const owners = await inChunks<Row>([...byId.keys()], (chunk) => admin.from('profiles').select('id, tenant_id, full_name').in('tenant_id', chunk).eq('role', 'owner').order('id'));
  const people = new Map<string, { name: string | null; tenants: string[] }>();
  for (const o of owners) {
    const p = people.get(o.id as string) ?? { name: (o.full_name as string | null) ?? null, tenants: [] };
    p.tenants.push(o.tenant_id as string);
    people.set(o.id as string, p);
  }
  const cache = new Map<string, Promise<DaySummary>>();
  const summaryOf = (id: string) => {
    if (!cache.has(id)) cache.set(id, daySummary(admin, byId.get(id)!, day));
    return cache.get(id)!;
  };
  let sent = 0;
  let quiet = 0;
  const queue = [...people.entries()];
  // A few owners at a time: each is a handful of small reads.
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const [userId, p] = next;
        const parts = (await Promise.all(p.tenants.map(summaryOf))).filter((s) => !s.quiet);
        if (!parts.length) {
          quiet++;
          continue;
        }
        const { data: u } = await admin.auth.admin.getUserById(userId);
        const email = u.user?.email;
        if (!email || email.endsWith('.invalid')) continue;
        const mail = summaryMail(p.name, day, parts);
        if (await sendMail(email, mail.subject, mail.text)) sent++;
      }
    })
  );
  return { sent, quiet, owners: people.size };
}
