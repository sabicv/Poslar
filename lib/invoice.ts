import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { billingFrom, type InvoiceData } from '@/components/invoice/InvoiceDocument';
import { getPackage } from '@/config/tenant.config';

// Everything the invoice page shows, from one job. The owner's page passes
// the owner's own client (prices under RLS); the customer's link passes the
// admin client and finds the job by its invoice token.
export async function loadInvoice(db: SupabaseClient, by: { id: string } | { token: string }): Promise<(InvoiceData & { jobId: string; tenantId: string; clientPhone: string | null; clientFirstName: string | null; token: string }) | null> {
  let query = db
    .from('jobs')
    .select(
      'id, tenant_id, number, work_summary, invoice_number, invoice_year, invoice_issued_at, invoice_fiscal_ref, invoice_token, client:clients(kind, first_name, last_name, company_name, oib, address, city, phone), asset:assets(make, model, asset_type, identifier)'
    );
  query = 'id' in by ? query.eq('id', by.id) : query.eq('invoice_token', by.token);
  const { data: job } = await query.maybeSingle();
  if (!job) return null;

  const [{ data: tenant }, { data: lines }] = await Promise.all([
    db.from('tenants').select('name, address, city, oib, phone, email, logo_url, settings, package').eq('id', job.tenant_id).single(),
    db.from('job_lines').select('id, description, qty, unit, sort').eq('job_id', job.id).eq('approval', 'approved').order('sort'),
  ]);
  if (!tenant) return null;
  const ids = (lines ?? []).map((l) => l.id as string);
  const { data: prices } = ids.length ? await db.from('job_line_prices').select('job_line_id, unit_price, discount_pct, vat_rate').in('job_line_id', ids) : { data: [] };
  const priceOf = new Map((prices ?? []).map((p) => [p.job_line_id as string, p]));
  const client = job.client as unknown as InvoiceData['client'] & { phone: string | null };

  return {
    jobId: job.id as string,
    tenantId: job.tenant_id as string,
    token: job.invoice_token as string,
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
    billing: billingFrom(tenant.settings),
    number: job.invoice_number as number | null,
    year: job.invoice_year as number | null,
    issuedAt: job.invoice_issued_at as string | null,
    fiscalRef: job.invoice_fiscal_ref as string | null,
    jobNumber: job.number as number,
    client,
    asset: job.asset as unknown as InvoiceData['asset'],
    assetLabel: getPackage(tenant.package as string).vocabulary.asset.one,
    workSummary: job.work_summary as string | null,
    lines: (lines ?? []).map((l) => {
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
}
