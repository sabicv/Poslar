'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CLIMATE_TYPES, defaultMeterUnit } from '@/config/tenant.config';
import { fail, type ActionResult } from '@/lib/action-result';
import { nameKey, phoneKey, type ImportClient } from '@/lib/import/detect';
import { requireWorkshop } from '@/lib/session';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));

const assetSchema = z.object({
  identifier: text(40),
  vin: text(40),
  make: text(60),
  model: text(80),
  year: z.number().int().min(1900).max(2100).nullable(),
});
const clientSchema = z.object({
  kind: z.enum(['person', 'company']),
  first_name: text(80),
  last_name: text(80),
  company_name: text(160),
  phone: text(40),
  email: text(160),
  oib: z
    .string()
    .regex(/^\d{11}$/)
    .nullable(),
  address: text(200),
  city: text(80),
  notes: text(1000),
  assets: z.array(assetSchema).max(50),
});

export interface ImportResult {
  clients: number;
  assets: number;
  sites: number;
  existingClients: number;
  existingAssets: number;
}

const compact = (v: string | null) => (v ? v.toUpperCase().replace(/[\s-]/g, '') : '');

async function all<T>(fetch: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await fetch(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

// Adds a batch of clients with their vehicles/devices. Whoever already
// exists (same phone, OIB or name; same plate or VIN) is left as it is and
// only counted, so importing the same file twice changes nothing.
export async function importClients(batch: ImportClient[]): Promise<ActionResult<ImportResult>> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Uvoz radi voditelj servisa.');
  const parsed = z.array(clientSchema).max(500).safeParse(batch);
  if (!parsed.success) return fail('Neki podaci iz datoteke nisu ispravni.');
  const db = ctx.supabase;
  const tenant_id = ctx.tenant.id;

  const [clients, assets] = await Promise.all([
    all((a, b) => db.from('clients').select('id, first_name, last_name, company_name, phone, oib').range(a, b)),
    all((a, b) => db.from('assets').select('identifier, vin').range(a, b)),
  ]);
  const byPhone = new Map<string, string>();
  const byOib = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of clients) {
    const id = c.id as string;
    const p = phoneKey(c.phone as string | null);
    if (p) byPhone.set(p, id);
    if (c.oib) byOib.set(c.oib as string, id);
    byName.set(nameKey(c as never), id);
  }
  const knownAssets = new Set<string>();
  for (const a of assets) {
    if (a.identifier) knownAssets.add(`i:${compact(a.identifier as string)}`);
    if (a.vin) knownAssets.add(`v:${compact(a.vin as string)}`);
  }

  const type = ctx.pkg.defaultAssetType;
  const field = ctx.pkg.sector === 'field';
  const newClients: Record<string, unknown>[] = [];
  const newSites: Record<string, unknown>[] = [];
  const newAssets: Record<string, unknown>[] = [];
  const result: ImportResult = { clients: 0, assets: 0, sites: 0, existingClients: 0, existingAssets: 0 };

  for (const c of parsed.data) {
    const p = phoneKey(c.phone);
    // A name alone matches only when the row has no phone or OIB: two
    // different "Ivan Horvat" with different phones stay two clients.
    let clientId = (p && byPhone.get(p)) || (c.oib && byOib.get(c.oib)) || (!p && !c.oib ? byName.get(nameKey(c)) : undefined);
    let siteId: string | null = null;
    if (clientId) result.existingClients++;
    else {
      clientId = randomUUID();
      const { assets: _assets, ...row } = c;
      newClients.push({ ...row, id: clientId, tenant_id });
      result.clients++;
      if (p) byPhone.set(p, clientId);
      if (c.oib) byOib.set(c.oib, clientId);
      byName.set(nameKey(c), clientId);
      // On the field the client's address is where the devices are.
      if (field && c.address && c.address.length > 2) {
        siteId = randomUUID();
        newSites.push({ id: siteId, tenant_id, client_id: clientId, address: c.address, city: c.city });
        result.sites++;
      }
    }
    for (const a of c.assets) {
      const keys = [a.identifier && `i:${compact(a.identifier)}`, a.vin && `v:${compact(a.vin)}`].filter(Boolean) as string[];
      if (keys.some((k) => knownAssets.has(k))) {
        result.existingAssets++;
        continue;
      }
      keys.forEach((k) => knownAssets.add(k));
      newAssets.push({
        id: randomUUID(),
        tenant_id,
        client_id: clientId,
        site_id: siteId,
        asset_type: type,
        identifier: a.identifier && !CLIMATE_TYPES.includes(type) ? a.identifier.toUpperCase() : a.identifier,
        vin: a.vin,
        make: a.make,
        model: a.model,
        year: a.year,
        meter_primary_unit: defaultMeterUnit(type),
      });
      result.assets++;
    }
  }

  for (const [table, rows] of [
    ['clients', newClients],
    ['sites', newSites],
    ['assets', newAssets],
  ] as const) {
    for (let i = 0; i < rows.length; i += 250) {
      const { error } = await db.from(table).insert(rows.slice(i, i + 250));
      if (error) return fail(error);
    }
  }
  revalidatePath('/app/clients');
  return { ok: true, data: result };
}
