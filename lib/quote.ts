import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { billingFrom, type InvoiceLine } from '@/components/invoice/InvoiceDocument';
import type { QuoteDocumentData } from '@/components/quote/QuoteDocument';
import { getPackage } from '@/config/tenant.config';
import type { Asset, Client } from '@/types/db';

export interface QuoteSnapshotLine {
  id: string;
  description: string;
  qty: number;
  unit: string;
  approval: 'proposed' | 'approved';
  unit_price: number;
  discount_pct: number;
  vat_rate: number;
}

export interface QuoteSnapshot {
  complaint: string | null;
  diagnosis: string | null;
  lines: QuoteSnapshotLine[];
}

type JobBits = {
  number: number;
  complaint: string | null;
  diagnosis_notes: string | null;
  client: Pick<Client, 'kind' | 'first_name' | 'last_name' | 'company_name' | 'oib' | 'address' | 'city'> | null;
  asset: Pick<Asset, 'make' | 'model' | 'asset_type' | 'identifier'> | null;
  site: { address: string | null; city: string | null } | null;
};

export function linesFromSnapshot(snapshot: QuoteSnapshot | null, only: 'all' | 'proposed' = 'all'): InvoiceLine[] {
  const rows = (snapshot?.lines ?? []).filter((l) => (only === 'proposed' ? l.approval === 'proposed' : true));
  return rows.map((l) => ({
    description: l.description,
    qty: Number(l.qty),
    unit: l.unit,
    unit_price: Number(l.unit_price),
    discount_pct: Number(l.discount_pct),
    vat_rate: Number(l.vat_rate),
  }));
}

export async function loadQuotePaper(
  db: SupabaseClient,
  jobId: string,
  snapshot: QuoteSnapshot | null,
  meta: { number: number | null; year: number | null; sentAt: string | null; validUntil: string | null }
): Promise<QuoteDocumentData | null> {
  const { data: job } = await db
    .from('jobs')
    .select('number, complaint, diagnosis_notes, tenant_id, client:clients(kind, first_name, last_name, company_name, oib, address, city), asset:assets(make, model, asset_type, identifier), site:sites(address, city)')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return null;
  const row = job as unknown as JobBits & { tenant_id: string };
  const { data: tenant } = await db.from('tenants').select('name, phone, email, address, city, oib, logo_url, package, settings').eq('id', row.tenant_id).single();
  if (!tenant) return null;
  const pkg = getPackage(tenant.package as string);
  const place = [row.site?.address, row.site?.city].filter(Boolean).join(', ') || null;

  let lines = linesFromSnapshot(snapshot);
  if (!snapshot) {
    const { data: live } = await db.from('job_lines').select('id, description, qty, unit, approval, sort').eq('job_id', jobId).in('approval', ['proposed', 'approved']).order('sort');
    const ids = (live ?? []).map((l) => l.id as string);
    const { data: prices } = ids.length ? await db.from('job_line_prices').select('job_line_id, unit_price, discount_pct, vat_rate').in('job_line_id', ids) : { data: [] };
    const priceOf = new Map((prices ?? []).map((p) => [p.job_line_id as string, p]));
    lines = (live ?? []).map((l) => {
      const price = priceOf.get(l.id as string);
      return {
        description: l.description as string,
        qty: Number(l.qty),
        unit: l.unit as string,
        unit_price: Number(price?.unit_price ?? 0),
        discount_pct: Number(price?.discount_pct ?? 0),
        vat_rate: Number(price?.vat_rate ?? 25),
      };
    });
  }

  return {
    workshop: {
      name: tenant.name as string,
      address: (tenant.address as string | null) ?? null,
      city: (tenant.city as string | null) ?? null,
      oib: (tenant.oib as string | null) ?? null,
      phone: (tenant.phone as string | null) ?? null,
      email: (tenant.email as string | null) ?? null,
      logoUrl: (tenant.logo_url as string | null) ?? null,
    },
    billing: billingFrom(tenant.settings),
    number: meta.number,
    year: meta.year,
    sentAt: meta.sentAt,
    validUntil: meta.validUntil,
    jobNumber: row.number,
    client: row.client,
    asset: row.asset,
    assetLabel: pkg.vocabulary.asset.one,
    place,
    request: snapshot?.complaint ?? row.complaint,
    finding: snapshot?.diagnosis ?? row.diagnosis_notes,
    lines,
    note: null,
  };
}
