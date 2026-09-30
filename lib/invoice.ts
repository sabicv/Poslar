import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { billingFrom, type InvoiceData } from '@/components/invoice/InvoiceDocument';
import { getPackage } from '@/config/tenant.config';

export type LoadedInvoice = InvoiceData & {
  jobId: string;
  tenantId: string;
  clientPhone: string | null;
  clientFirstName: string | null;
  token: string;
  paid: boolean;
};

const JOB_FIELDS =
  'id, tenant_id, number, work_summary, payment_status, invoice_number, invoice_year, invoice_issued_at, invoice_fiscal_ref, invoice_token, client:clients(kind, first_name, last_name, company_name, oib, address, city, phone), asset:assets(make, model, asset_type, identifier)';

// Everything the invoice page shows, from one job. The owner's page passes
// the owner's own client (prices under RLS); the customer's link passes the
// admin client and finds the job by its invoice token.
export async function loadInvoice(db: SupabaseClient, by: { id: string } | { token: string }): Promise<LoadedInvoice | null> {
  let query = db.from('jobs').select(JOB_FIELDS);
  query = 'id' in by ? query.eq('id', by.id) : query.eq('invoice_token', by.token);
  const { data: job } = await query.maybeSingle();
  if (!job) return null;
  const [invoice] = await assemble(db, [job]);
  return invoice ?? null;
}

// Every invoice issued in one month (Zagreb time), in number order — for
// the accountant's export. Owner only: prices come through RLS.
export async function loadIssuedInvoices(db: SupabaseClient, month: string): Promise<LoadedInvoice[]> {
  const [y, m] = month.split('-').map(Number);
  // A day either side, then exact by the Zagreb calendar date.
  const from = new Date(Date.UTC(y, m - 1, 1) - 86400_000).toISOString();
  const to = new Date(Date.UTC(y, m, 1) + 86400_000).toISOString();
  const { data: jobs } = await db
    .from('jobs')
    .select(JOB_FIELDS)
    .not('invoice_number', 'is', null)
    .gte('invoice_issued_at', from)
    .lt('invoice_issued_at', to)
    .order('invoice_year')
    .order('invoice_number');
  const inMonth = (jobs ?? []).filter((j) => zagrebDate(j.invoice_issued_at as string).startsWith(month));
  return assemble(db, inMonth);
}

// "2026-09-30" as the calendar date in Croatia.
export function zagrebDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

type JobRow = Record<string, unknown>;

async function inChunks<T>(ids: string[], fetch: (chunk: string[]) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 100) out.push(...((await fetch(ids.slice(i, i + 100))).data ?? []));
  return out;
}

async function assemble(db: SupabaseClient, jobs: JobRow[]): Promise<LoadedInvoice[]> {
  if (!jobs.length) return [];
  const { data: tenant } = await db.from('tenants').select('name, address, city, oib, phone, email, logo_url, settings, package').eq('id', jobs[0].tenant_id as string).single();
  if (!tenant) return [];
  const lines = await inChunks(
    jobs.map((j) => j.id as string),
    (chunk) => db.from('job_lines').select('id, job_id, description, qty, unit, sort').in('job_id', chunk).eq('approval', 'approved').order('sort')
  );
  const prices = await inChunks(
    lines.map((l) => l.id as string),
    (chunk) => db.from('job_line_prices').select('job_line_id, unit_price, discount_pct, vat_rate').in('job_line_id', chunk)
  );
  const priceOf = new Map(prices.map((p) => [p.job_line_id as string, p]));
  const billing = billingFrom(tenant.settings);
  const assetLabel = getPackage(tenant.package as string).vocabulary.asset.one;

  return jobs.map((job) => {
    const client = job.client as InvoiceData['client'] & { phone: string | null };
    return {
      jobId: job.id as string,
      tenantId: job.tenant_id as string,
      token: job.invoice_token as string,
      paid: job.payment_status === 'paid',
      clientPhone: client.phone,
      clientFirstName: client.kind === 'person' ? client.first_name : null,
      workshop: {
        name: tenant.name as string,
        address: tenant.address as string | null,
        city: tenant.city as string | null,
        oib: tenant.oib as string | null,
        phone: tenant.phone as string | null,
        email: tenant.email as string | null,
        logoUrl: tenant.logo_url as string | null,
      },
      billing,
      number: job.invoice_number as number | null,
      year: job.invoice_year as number | null,
      issuedAt: job.invoice_issued_at as string | null,
      fiscalRef: job.invoice_fiscal_ref as string | null,
      jobNumber: job.number as number,
      client,
      asset: job.asset as InvoiceData['asset'],
      assetLabel,
      workSummary: job.work_summary as string | null,
      lines: lines
        .filter((l) => l.job_id === job.id)
        .map((l) => {
          const p = priceOf.get(l.id as string);
          return {
            description: l.description as string,
            qty: Number(l.qty),
            unit: l.unit as string,
            unit_price: Number(p?.unit_price ?? 0),
            discount_pct: Number(p?.discount_pct ?? 0),
            vat_rate: Number(p?.vat_rate ?? 25),
          };
        }),
    };
  });
}
