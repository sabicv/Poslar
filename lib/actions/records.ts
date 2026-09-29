'use server';

import { revalidatePath } from 'next/cache';
import { hasModule, type ModuleId, type PackageId } from '@/config/tenant.config';
import { fail, type ActionResult } from '@/lib/action-result';
import { requireWorkshop, type WorkshopContext } from '@/lib/session';

// Generic save/delete for package records (volt_*, gear_*, body_*, wheel_*,
// fleet_*, moto_*). Row Level Security decides what the user may touch;
// the server always stamps the caller's own workshop, so a crafted request
// can't write into another one. Money tables are deliberately not listed.
const WRITABLE: Record<string, string> = {
  reminders: 'id',
  volt_dtc_custom: 'id',
  volt_scans: 'id',
  volt_dtc_findings: 'id',
  volt_battery_tests: 'id',
  volt_charging_tests: 'id',
  volt_drain_sessions: 'id',
  volt_drain_readings: 'id',
  volt_voltage_drops: 'id',
  volt_live_data: 'id',
  volt_module_interventions: 'id',
  volt_keys: 'id',
  gear_service_plans: 'id',
  gear_asset_schedule: 'id',
  gear_labor_norms: 'id',
  gear_suppliers: 'id',
  gear_parts: 'id',
  gear_warranty_claims: 'id',
  insurers: 'id',
  body_estimates: 'id',
  body_panel_damages: 'id',
  body_paint_jobs: 'id',
  body_paint_mix_lines: 'id',
  body_material_usage: 'id',
  body_production_phases: 'id',
  body_adas_calibrations: 'id',
  wheel_storage_locations: 'id',
  wheel_tire_sets: 'id',
  wheel_tires: 'id',
  wheel_rims: 'id',
  wheel_storage_stays: 'id',
  wheel_alignments: 'id',
  wheel_alignment_values: 'id',
  wheel_torque_specs: 'id',
  wheel_torque_records: 'id',
  wheel_balancing: 'id',
  wheel_repairs: 'id',
  wheel_tpms: 'id',
  wheel_inventory: 'id',
  fleet_accounts: 'id',
  fleet_pm_plans: 'id',
  fleet_asset_pm: 'id',
  fleet_compliance_items: 'id',
  fleet_service_requests: 'id',
  fleet_driver_checks: 'id',
  fleet_field_jobs: 'job_id',
  fleet_downtime: 'id',
  moto_vessel_details: 'asset_id',
  moto_engine_details: 'asset_id',
  moto_equipment_items: 'id',
  moto_seasonal_protocols: 'id',
  moto_storage_locations: 'id',
  moto_storage_stays: 'id',
};

type Values = Record<string, unknown>;

// Package tables belong to their package; a few are shared through an
// optional module (Gear with the tyre hotel, Volt with parts and service
// plan). Checked on the server, so a request for another package's table
// is refused even when made by hand.
const MODULE_TABLES: Record<string, ModuleId> = {
  gear_parts: 'parts',
  gear_suppliers: 'parts',
  gear_warranty_claims: 'parts',
  gear_asset_schedule: 'service_plan',
  gear_service_plans: 'service_plan',
  gear_labor_norms: 'service_plan',
  wheel_storage_locations: 'wheel_hotel',
  wheel_tire_sets: 'wheel_hotel',
  wheel_tires: 'wheel_hotel',
  wheel_rims: 'wheel_hotel',
  wheel_storage_stays: 'wheel_hotel',
};

function tablePackage(table: string): PackageId | null {
  if (table === 'insurers') return 'body';
  const prefix = table.split('_')[0];
  return (['volt', 'gear', 'body', 'wheel', 'fleet', 'moto'] as PackageId[]).includes(prefix as PackageId) ? (prefix as PackageId) : null;
}

function allowedForWorkshop(ctx: WorkshopContext, table: string): boolean {
  const owner = tablePackage(table);
  if (owner === null || owner === ctx.pkg.id) return true;
  const module = MODULE_TABLES[table];
  return Boolean(module && hasModule(ctx.pkg, ctx.tenant.enabled_modules, module));
}

export async function saveRecord(
  table: string,
  values: Values,
  options: { id?: string | null; upsertOn?: string; revalidate?: string } = {}
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireWorkshop();
  const key = WRITABLE[table];
  if (!key || !allowedForWorkshop(ctx, table)) return fail('Nepoznata vrsta zapisa.');
  // Buttons rendered on the server can't know when they'll be tapped:
  // "__now__" / "__today__" are stamped here, at the moment of saving.
  const now = new Date();
  const clean: Values = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v === '__now__' ? now.toISOString() : v === '__today__' ? now.toISOString().slice(0, 10) : v])
  );
  delete clean.tenant_id;
  delete clean.created_at;

  let result;
  if (options.upsertOn) {
    result = await ctx.supabase.from(table).upsert({ ...clean, tenant_id: ctx.tenant.id }, { onConflict: options.upsertOn }).select(key).single();
  } else if (options.id) {
    delete clean[key];
    result = await ctx.supabase.from(table).update(clean).eq(key, options.id).select(key).single();
  } else {
    result = await ctx.supabase.from(table).insert({ ...clean, tenant_id: ctx.tenant.id }).select(key).single();
  }
  if (result.error) return fail(result.error);
  if (options.revalidate) revalidatePath(options.revalidate);
  return { ok: true, data: { id: (result.data as unknown as Record<string, string>)[key] } };
}

export async function deleteRecord(table: string, id: string, revalidate?: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  const key = WRITABLE[table];
  if (!key || !allowedForWorkshop(ctx, table)) return fail('Nepoznata vrsta zapisa.');
  const { error } = await ctx.supabase.from(table).delete().eq(key, id);
  if (error) return fail(error);
  if (revalidate) revalidatePath(revalidate);
  return { ok: true };
}

// Owner-only amounts attached to package records (storage fee, approved
// insurance amount, tyre purchase price).
export async function savePrivateAmount(entity: string, entityId: string, field: string, amount: number | null, revalidate?: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Iznose uređuje voditelj servisa.');
  const match = { tenant_id: ctx.tenant.id, entity, entity_id: entityId, field };
  const { error } =
    amount === null
      ? await ctx.supabase.from('private_amounts').delete().match(match)
      : await ctx.supabase.from('private_amounts').upsert({ ...match, amount, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,entity,entity_id,field' });
  if (error) return fail(error);
  if (revalidate) revalidatePath(revalidate);
  return { ok: true };
}
