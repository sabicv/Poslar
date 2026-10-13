import 'server-only';
import { allRows } from '@/lib/paged';
import type { WorkshopContext } from '@/lib/session';
import { addDays, addMonths, todayInZagreb, zagrebMidnight } from '@/lib/time';
import { plateIlike, toIlike } from '@/lib/utils';

// Arhiva: closed work orders (the last phase), by period, payment and a
// search across plate, VIN, customer, phone, OIB, job and invoice number.
// Owner only: amounts come from job_totals, which a worker can't read.

export const PERIODS = {
  mjesec: 'Ovaj mjesec',
  prosli: 'Prošli mjesec',
  '90': 'Zadnjih 90 dana',
  godina: 'Ova godina',
  prosla: 'Prošla godina',
  sve: 'Sve',
} as const;
export type Period = keyof typeof PERIODS | 'od-do';
// Shown in this order ("90" would otherwise come first as a number key).
export const PERIOD_ORDER: (keyof typeof PERIODS)[] = ['mjesec', 'prosli', '90', 'godina', 'prosla', 'sve'];
export type Paid = 'sve' | 'placeno' | 'neplaceno';

export interface ArchiveFilters {
  period: Period;
  from: string | null;
  to: string | null;
  paid: Paid;
  q: string;
  limit: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function readFilters(sp: Record<string, string | undefined>): ArchiveFilters {
  const from = sp.od && DAY.test(sp.od) ? sp.od : null;
  const to = sp.do && DAY.test(sp.do) ? sp.do : null;
  const period: Period = from || to ? 'od-do' : sp.r && sp.r in PERIODS ? (sp.r as Period) : 'mjesec';
  const paid: Paid = sp.p === 'placeno' || sp.p === 'neplaceno' ? sp.p : 'sve';
  const limit = Math.min(1000, Math.max(50, Number(sp.n) || 50));
  return { period, from, to, paid, q: (sp.q ?? '').trim().slice(0, 80), limit };
}

// Query string for links that keep the other filters.
export function filterQuery(f: ArchiveFilters, change: Partial<Record<'r' | 'p' | 'q' | 'n' | 'od' | 'do', string | null>> = {}): string {
  const sp = new URLSearchParams();
  const base: Record<string, string | null> = {
    r: f.period === 'od-do' ? null : f.period === 'mjesec' ? null : f.period,
    od: f.from,
    do: f.to,
    p: f.paid === 'sve' ? null : f.paid,
    q: f.q || null,
    n: null,
  };
  const merged = { ...base, ...change };
  // Picking a named period drops the custom dates.
  if (change.r !== undefined) {
    merged.od = null;
    merged.do = null;
  }
  for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// [from, to) as instants, in Zagreb time; null = open.
export function periodBounds(f: ArchiveFilters): [string | null, string | null] {
  const today = todayInZagreb();
  const month = `${today.slice(0, 7)}-01`;
  const year = `${today.slice(0, 4)}-01-01`;
  const at = (day: string) => zagrebMidnight(day).toISOString();
  switch (f.period) {
    case 'mjesec':
      return [at(month), at(addMonths(month, 1))];
    case 'prosli':
      return [at(addMonths(month, -1)), at(month)];
    case '90':
      return [at(addDays(today, -89)), at(addDays(today, 1))];
    case 'godina':
      return [at(year), at(addMonths(year, 12))];
    case 'prosla':
      return [at(addMonths(year, -12)), at(year)];
    case 'od-do':
      return [f.from ? at(f.from) : null, f.to ? at(addDays(f.to, 1)) : null];
    default:
      return [null, null];
  }
}

export interface ArchiveRow {
  id: string;
  number: number;
  collected_at: string | null;
  payment_status: 'paid' | 'unpaid';
  paid_at: string | null;
  locked_at: string | null;
  invoice_number: number | null;
  invoice_year: number | null;
  invoice_premises: string | null;
  invoice_device: string | null;
  complaint: string | null;
  client: { kind: 'person' | 'company'; first_name: string | null; last_name: string | null; company_name: string | null; phone: string | null } | null;
  asset: { asset_type: never; identifier: string | null; make: string | null; model: string | null } | null;
  gross: number;
}

export interface ArchiveResult {
  rows: ArchiveRow[];
  count: number;
  total: number;
  paid: number;
  unpaid: number;
  capped: boolean;
}

const MAX_SUMMARY = 3000;

export async function loadArchive(ctx: WorkshopContext, f: ArchiveFilters): Promise<ArchiveResult> {
  const s = ctx.supabase;
  const [start, end] = periodBounds(f);

  // Search: plates and customers first, then job and invoice numbers.
  let match: string | null = null;
  if (f.q) {
    const like = toIlike(f.q);
    const compact = toIlike(f.q.replace(/[\s-]/g, ''));
    const plate = plateIlike(f.q);
    const [assets, clients] = await Promise.all([
      s.from('assets').select('id').or(`identifier.ilike.${plate},vin.ilike.${plate},make.ilike.${like},model.ilike.${like}`).limit(100),
      s.from('clients').select('id').or(`first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like},phone.ilike.${compact},oib.ilike.${compact}`).limit(100),
    ]);
    const parts = [
      ...(assets.data?.length ? [`asset_id.in.(${assets.data.map((a) => a.id).join(',')})`] : []),
      ...(clients.data?.length ? [`client_id.in.(${clients.data.map((c) => c.id).join(',')})`] : []),
    ];
    // "12" is job 12 or invoice 12; "12/2026" is invoice 12 of 2026;
    // "12/PP1/1" is invoice 12 of premises PP1, device 1.
    const invoice = /^(\d{1,7})\s*\/\s*(\d{4})$/.exec(f.q);
    const fiscal = /^(\d{1,7})\s*\/\s*([A-Za-z0-9]{1,20})\s*\/\s*(\d{1,6})$/.exec(f.q);
    if (fiscal) parts.push(`and(invoice_number.eq.${fiscal[1]},invoice_premises.eq.${fiscal[2]},invoice_device.eq.${fiscal[3]})`);
    else if (invoice) parts.push(`and(invoice_number.eq.${invoice[1]},invoice_year.eq.${invoice[2]})`);
    else if (/^\d{1,7}$/.test(f.q)) parts.push(`number.eq.${f.q}`, `invoice_number.eq.${f.q}`);
    match = parts.length ? parts.join(',') : 'id.eq.00000000-0000-0000-0000-000000000000';
  }

  const base = (select: string) => {
    let query = s.from('jobs').select(select).eq('phase', 'collected');
    if (start) query = query.gte('collected_at', start);
    if (end) query = query.lt('collected_at', end);
    if (f.paid === 'placeno') query = query.eq('payment_status', 'paid');
    if (f.paid === 'neplaceno') query = query.eq('payment_status', 'unpaid');
    if (match) query = query.or(match);
    // Chronological by closing, newest first; the job number settles ties.
    return query.order('collected_at', { ascending: false, nullsFirst: false }).order('number', { ascending: false });
  };

  const [{ data: page }, allRowsRead] = await Promise.all([
    base('id, number, collected_at, payment_status, paid_at, locked_at, invoice_number, invoice_year, invoice_premises, invoice_device, complaint, client:clients(kind, first_name, last_name, company_name, phone), asset:assets(asset_type, identifier, make, model)').limit(f.limit),
    // The sums read in pages (the API gives 1000 rows at a time), up to the cap.
    allRows<{ id: string; payment_status: string }>((a, b) =>
      a >= MAX_SUMMARY
        ? Promise.resolve({ data: [], error: null })
        : (base('id, payment_status').range(a, Math.min(b, MAX_SUMMARY - 1)) as unknown as PromiseLike<{ data: { id: string; payment_status: string }[] | null; error: unknown }>)
    ),
  ]);
  const all = allRowsRead;
  const ids = all.map((j) => j.id);

  // Totals in batches: a long id list doesn't fit one request.
  const gross = new Map<string, number>();
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 150) batches.push(ids.slice(i, i + 150));
  const results = await Promise.all(batches.map((b) => s.from('job_totals').select('job_id, gross_total').in('job_id', b)));
  for (const r of results) for (const t of r.data ?? []) gross.set(t.job_id as string, Number(t.gross_total));

  let paid = 0;
  let unpaid = 0;
  for (const j of all) {
    const g = gross.get(j.id) ?? 0;
    if (j.payment_status === 'paid') paid += g;
    else unpaid += g;
  }
  const rows = ((page ?? []) as unknown as Omit<ArchiveRow, 'gross'>[]).map((r) => ({ ...r, gross: gross.get(r.id) ?? 0 }));
  return { rows, count: ids.length, total: paid + unpaid, paid, unpaid, capped: ids.length >= MAX_SUMMARY };
}
