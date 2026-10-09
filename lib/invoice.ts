import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { billingFrom, type InvoiceData, type InvoiceStatus, type PaymentMethod } from '@/components/invoice/InvoiceDocument';
import { getPackage } from '@/config/tenant.config';
import { allRows, inChunks } from '@/lib/paged';

export type LoadedInvoice = InvoiceData & {
  jobId: string;
  tenantId: string;
  clientPhone: string | null;
  clientFirstName: string | null;
  token: string;
  paid: boolean;
  // The "Pogledaj primjer naloga" job of a real workshop: shown, never numbered.
  sample: boolean;
};

const JOB_FIELDS =
  'id, tenant_id, number, is_demo, work_summary, payment_status, invoice_number, invoice_year, invoice_issued_at, invoice_fiscal_ref, invoice_token, invoice_payment_method, invoice_premises, invoice_device, invoice_operator, invoice_status, invoice_sent_at, invoice_voided_at, client:clients(kind, first_name, last_name, company_name, oib, address, city, phone), asset:assets(make, model, asset_type, identifier)';

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
// the accountant's export. Owner only: prices come through RLS. With the
// service role (the monthly e-mail) the workshop must be named: nothing
// else narrows it to one.
export async function loadIssuedInvoices(db: SupabaseClient, month: string, tenantId?: string): Promise<LoadedInvoice[]> {
  const [y, m] = month.split('-').map(Number);
  // A day either side, then exact by the Zagreb calendar date.
  const from = new Date(Date.UTC(y, m - 1, 1) - 86400_000).toISOString();
  const to = new Date(Date.UTC(y, m, 1) + 86400_000).toISOString();
  const jobs = await allRows<JobRow>((a, b) => {
    let q = db.from('jobs').select(JOB_FIELDS).not('invoice_number', 'is', null).gte('invoice_issued_at', from).lt('invoice_issued_at', to);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    return q.order('invoice_year').order('invoice_number').order('id').range(a, b);
  });
  const inMonth = jobs.filter((j) => zagrebDate(j.invoice_issued_at as string).startsWith(month));
  return assemble(db, inMonth);
}

// Every invoice issued on one day (Zagreb time), in the order they were
// issued: "Računi danas", to type into the fiscal till. Owner only.
export async function loadInvoicesOfDay(db: SupabaseClient, day: string): Promise<LoadedInvoice[]> {
  // A day either side, then exact by the Zagreb calendar date.
  const from = new Date(Date.parse(`${day}T00:00:00Z`) - 86400_000).toISOString();
  const to = new Date(Date.parse(`${day}T00:00:00Z`) + 2 * 86400_000).toISOString();
  const jobs = await allRows<JobRow>((a, b) =>
    db.from('jobs').select(JOB_FIELDS).not('invoice_number', 'is', null).gte('invoice_issued_at', from).lt('invoice_issued_at', to).order('invoice_issued_at').order('id').range(a, b)
  );
  return assemble(
    db,
    jobs.filter((j) => zagrebDate(j.invoice_issued_at as string) === day)
  );
}

// "2026-09-30" as the calendar date in Croatia.
export function zagrebDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

type JobRow = Record<string, unknown>;

function statusOf(job: JobRow): InvoiceStatus {
  const stored = job.invoice_status as InvoiceStatus | null;
  if (stored === 'draft' || stored === 'issued' || stored === 'sent' || stored === 'fiscalized' || stored === 'rejected' || stored === 'voided') return stored;
  if (!job.invoice_number) return 'draft';
  if (job.invoice_fiscal_ref) return 'fiscalized';
  return 'issued';
}

async function assemble(db: SupabaseClient, jobs: JobRow[]): Promise<LoadedInvoice[]> {
  if (!jobs.length) return [];
  const { data: tenant } = await db.from('tenants').select('name, address, city, oib, phone, email, logo_url, settings, package').eq('id', jobs[0].tenant_id as string).single();
  if (!tenant) return [];
  const lines = await inChunks<JobRow>(
    jobs.map((j) => j.id as string),
    (chunk) => db.from('job_lines').select('id, job_id, description, qty, unit, sort').in('job_id', chunk).eq('approval', 'approved').order('sort').order('id')
  );
  const prices = await inChunks<JobRow>(
    lines.map((l) => l.id as string),
    (chunk) => db.from('job_line_prices').select('job_line_id, unit_price, discount_pct, vat_rate').in('job_line_id', chunk).order('job_line_id')
  );
  const priceOf = new Map(prices.map((p) => [p.job_line_id as string, p]));
  const billing = billingFrom(tenant.settings);
  const assetLabel = getPackage(tenant.package as string).vocabulary.asset.one;
  const demoWorkshop = (tenant.settings as { demo?: unknown } | null)?.demo === true;

  return jobs.map((job) => {
    const client = job.client as (InvoiceData['client'] & { phone: string | null }) | null;
    return {
      jobId: job.id as string,
      tenantId: job.tenant_id as string,
      token: job.invoice_token as string,
      paid: job.payment_status === 'paid',
      sample: job.is_demo === true && !demoWorkshop,
      clientPhone: client?.phone ?? null,
      clientFirstName: client?.kind === 'person' ? client.first_name : null,
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
      status: statusOf(job),
      sentAt: (job.invoice_sent_at as string | null) ?? null,
      voidedAt: (job.invoice_voided_at as string | null) ?? null,
      paymentMethod: (job.invoice_payment_method as PaymentMethod | null) ?? null,
      premises: (job.invoice_premises as string | null) ?? null,
      device: (job.invoice_device as string | null) ?? null,
      operator: (job.invoice_operator as string | null) ?? null,
      jobNumber: job.number as number,
      client,
      asset: (job.asset as InvoiceData['asset']) ?? null,
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
