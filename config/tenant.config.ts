// =====================================================================
// Poslar · central tenant configuration
//
// One workshop = one package. Everything that differs between Volt,
// Gear, Body, Wheel, Fleet, Machine, Moto, Marine, Air, Aqua, Tow, Deal,
// Detail, Electric, Appliance, Locksmith, Pool and Clean lives here as typed data: brand and
// accent colour, vocabulary (Mušterija vs Tvrtka, km vs mth), object
// types, job phase wording, inspection checklists, work templates and
// which modules are switched on. The database stores only the package
// id, so changing this file upgrades every workshop in one deploy and
// costs nothing at runtime.
// =====================================================================

import type { CSSProperties } from 'react';
import { volt } from './packages/volt';
import { gear } from './packages/gear';
import { body } from './packages/body';
import { wheel } from './packages/wheel';
import { fleet } from './packages/fleet';
import { machine } from './packages/machine';
import { moto } from './packages/moto';
import { marine } from './packages/marine';
import { air } from './packages/air';
import { aqua } from './packages/aqua';
import { tow } from './packages/tow';
import { deal } from './packages/deal';
import { detail } from './packages/detail';
import { electric } from './packages/electric';
import { appliance } from './packages/appliance';
import { locksmith } from './packages/locksmith';
import { pool } from './packages/pool';
import { clean } from './packages/clean';

export type PackageId = 'volt' | 'gear' | 'body' | 'wheel' | 'fleet' | 'machine' | 'moto' | 'marine' | 'air' | 'aqua' | 'tow' | 'deal' | 'detail' | 'electric' | 'appliance' | 'locksmith' | 'pool' | 'clean';
// Where the work happens: the customer brings the object in, or the
// technician goes to the customer's address.
export type Sector = 'workshop' | 'field';
export type MeterUnit = 'km' | 'mth';
export type JobPhase =
  | 'intake'
  | 'diagnosis'
  | 'awaiting_approval'
  | 'awaiting_parts'
  | 'in_progress'
  | 'quality_check'
  | 'ready'
  | 'collected';
export type LineKind = 'labor' | 'part' | 'material' | 'package' | 'sublet' | 'fee';
export type AssetType =
  | 'car' | 'van' | 'truck' | 'tractor_unit' | 'bus' | 'trailer' | 'semi_trailer' | 'machine'
  | 'tractor' | 'implement' | 'motorcycle' | 'scooter' | 'atv' | 'jetski' | 'boat' | 'outboard' | 'inboard'
  | 'ac_split' | 'ac_multi' | 'ac_ducted' | 'ac_vrf' | 'heat_pump' | 'ventilation' | 'chiller'
  | 'water_heater' | 'gas_boiler' | 'plumbing' | 'drainage' | 'heating' | 'pump'
  | 'electrical' | 'switchboard' | 'solar_pv' | 'ev_charger'
  | 'washer' | 'dishwasher' | 'fridge' | 'oven' | 'dryer' | 'coffee_machine' | 'small_appliance'
  | 'door_lock' | 'safe'
  | 'swimming_pool' | 'pool_plant'
  | 'apartment_unit' | 'holiday_unit' | 'office_unit';

export type ModuleId =
  | 'dvi'
  | 'condition_report'
  | 'approvals'
  | 'service_plan'
  | 'parts'
  | 'volt_diagnostics'
  | 'body_damage'
  | 'body_paint'
  | 'body_insurance'
  | 'wheel_hotel'
  | 'wheel_alignment'
  | 'wheel_torque'
  | 'fleet_compliance'
  | 'fleet_field'
  | 'fleet_pm'
  | 'moto_seasonal'
  | 'moto_storage'
  | 'marine'
  | 'field_visits'
  | 'maintenance_plans'
  | 'fgas';

export interface Vocabulary {
  client: { one: string; many: string; new: string; acc: string };
  asset: { one: string; many: string; new: string };
  identifier: string;
}

export interface InspectionItem {
  code: string;
  label: string;
  unit?: string;
  // Thresholds turn a typed measurement into a traffic-light status.
  warnBelow?: number;
  critBelow?: number;
  warnAbove?: number;
  critAbove?: number;
}

export interface InspectionSection {
  title: string;
  items: InspectionItem[];
}

export interface InspectionTemplate {
  code: string;
  name: string;
  purpose: 'dvi' | 'checklist' | 'driver_check' | 'seasonal';
  sections: InspectionSection[];
  // After the worker finishes this measurement, propose this priced
  // template on the job (once). Same idea as a battery test proposing
  // volt.battery — the owner still confirms the charge.
  proposeTemplate?: string;
}

export interface TemplateLine {
  kind: LineKind;
  description: string;
  code?: string;
  qty: number;
  unit: string;
  price?: number;
  kpd?: string;
}

export interface JobTemplate {
  code: string;
  name: string;
  lines: TemplateLine[];
  inspection?: string;
}

export interface PackageConfig {
  id: PackageId;
  product: string;
  short: string;
  domain: string;
  tagline: string;
  pitch: string[];
  sector: Sector;
  accent: string;
  // Work orders are the business's own cost (Deal: getting a car ready
  // for sale), never a bill: no "Za naplatu", no invoice.
  internalJobs?: boolean;
  vocabulary: Vocabulary;
  assetTypes: AssetType[];
  defaultAssetType: AssetType;
  phaseLabels: Partial<Record<JobPhase, string>>;
  // Phases the trade never uses: left out of the phase picker and "next".
  skipPhases?: JobPhase[];
  symptoms: string[];
  photoTags: { code: string; label: string }[];
  diagram: 'car' | 'truck' | 'moto' | 'boat';
  // Parts on the intake/handover zapisnik. Falls back to the diagram list.
  conditionZones?: ConditionZone[];
  // What a mark means on that zapisnik. Vehicles keep the body-shop list
  // (scratch, stone chip). A room or a boiler does not.
  marks?: { code: string; label: string }[];
  // The gauge under the equipment list. Vehicles keep fuel.
  level?: 'fuel' | 'battery' | 'none';
  // first: the job should open with a quote. offer: only when lines are
  // proposed. never: the price is already known (or there is no customer).
  quote?: 'first' | 'offer' | 'never';
  // This trade's first move, while the job is still at the start.
  // A quote that is waiting replaces it.
  opening?: { intake: string; diagnosis?: string; tab?: 'modul' | 'inspekcija' | 'foto' | 'stavke'; diagnosisTab?: 'modul' | 'inspekcija' | 'foto' | 'stavke' };
  equipment: string[];
  inspections: InspectionTemplate[];
  templates: JobTemplate[];
  modules: ModuleId[];
  optionalModules: ModuleId[];
  // Label of the package's tab on a work order and of its own page in the menu.
  moduleTab: string;
  modulePage: string;
  // Trades without a module of their own (components/modules/GenericModule):
  // the recurring service offered on the job's tab, and the hint on the
  // module page while nothing is due.
  plan?: { title: string; template: string; months: number; hint: string };
}

export type ConditionZone = { code: string; label: string; group: string };

export const PACKAGES: Record<PackageId, PackageConfig> = { volt, gear, body, wheel, fleet, machine, moto, marine, air, aqua, tow, deal, detail, electric, appliance, locksmith, pool, clean };
export const PACKAGE_IDS = Object.keys(PACKAGES) as PackageId[];

// Groups so a visitor first says how he works, then picks the trade:
// the work is run from the workshop (trucks and machines too, with notes
// from the field), the craftsman goes to the customer, the truck goes to
// the road, or the cars are bought and sold.
export type TradeGroupId = 'radionica' | 'teren' | 'cesta' | 'prodaja';
export const TRADE_GROUPS: { id: TradeGroupId; name: string; hint: string; packages: PackageId[] }[] = [
  { id: 'radionica', name: 'Radionica', hint: 'Posao se vodi iz radionice', packages: ['volt', 'gear', 'body', 'wheel', 'detail', 'moto', 'marine', 'fleet', 'machine'] },
  { id: 'teren', name: 'Teren', hint: 'Majstor ide k mušteriji', packages: ['air', 'aqua', 'electric', 'appliance', 'locksmith', 'pool', 'clean'] },
  { id: 'cesta', name: 'Cesta', hint: 'Vuča i pomoć na cesti, danju i noću', packages: ['tow'] },
  { id: 'prodaja', name: 'Prodaja', hint: 'Otkup, priprema i prodaja rabljenih vozila', packages: ['deal'] },
];
export function tradeGroupOf(id: PackageId): TradeGroupId {
  return TRADE_GROUPS.find((g) => g.packages.includes(id))?.id ?? 'radionica';
}

export const PHASE_ORDER: JobPhase[] = [
  'intake',
  'diagnosis',
  'awaiting_approval',
  'awaiting_parts',
  'in_progress',
  'quality_check',
  'ready',
  'collected',
];

const BASE_PHASE_LABELS: Record<JobPhase, string> = {
  intake: 'Prijem',
  diagnosis: 'Dijagnostika',
  awaiting_approval: 'Čeka odobrenje',
  awaiting_parts: 'Čeka dijelove',
  in_progress: 'Popravak u tijeku',
  quality_check: 'Kontrola',
  ready: 'Gotovo',
  collected: 'Preuzeto',
};

// Semantic tone per phase: green, amber and red belong to status only;
// the product accent marks "being worked on".
export const PHASE_TONE: Record<JobPhase, 'neutral' | 'accent' | 'warn' | 'ok' | 'muted'> = {
  intake: 'neutral',
  diagnosis: 'accent',
  awaiting_approval: 'warn',
  awaiting_parts: 'warn',
  in_progress: 'accent',
  quality_check: 'accent',
  ready: 'ok',
  collected: 'muted',
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  car: 'Osobni automobil',
  van: 'Dostavno vozilo',
  truck: 'Kamion',
  tractor_unit: 'Tegljač',
  bus: 'Autobus',
  trailer: 'Prikolica',
  semi_trailer: 'Poluprikolica',
  machine: 'Radni stroj',
  tractor: 'Traktor',
  implement: 'Priključni stroj',
  motorcycle: 'Motocikl',
  scooter: 'Skuter',
  atv: 'ATV / quad',
  jetski: 'Jet-ski',
  boat: 'Plovilo',
  outboard: 'Vanbrodski motor',
  inboard: 'Unutarnji motor',
  ac_split: 'Split klima',
  ac_multi: 'Multi-split klima',
  ac_ducted: 'Kanalna / kazetna klima',
  ac_vrf: 'VRF / VRV sustav',
  heat_pump: 'Dizalica topline',
  ventilation: 'Ventilacija / rekuperator',
  chiller: 'Rashladnik vode (chiller)',
  water_heater: 'Bojler',
  gas_boiler: 'Plinski kotao',
  plumbing: 'Vodovodna instalacija',
  drainage: 'Odvodnja i kanalizacija',
  heating: 'Grijanje (radijatori, podno)',
  pump: 'Pumpa ili hidrofor',
  electrical: 'Električna instalacija',
  switchboard: 'Razvodni ormar',
  solar_pv: 'Sunčana elektrana',
  ev_charger: 'Punjač za električni auto',
  washer: 'Perilica rublja',
  dishwasher: 'Perilica posuđa',
  fridge: 'Hladnjak ili zamrzivač',
  oven: 'Štednjak ili pećnica',
  dryer: 'Sušilica rublja',
  coffee_machine: 'Aparat za kavu',
  small_appliance: 'Mali kućanski aparat',
  door_lock: 'Vrata i brava',
  safe: 'Sef',
  swimming_pool: 'Bazen',
  pool_plant: 'Strojarnica bazena',
  apartment_unit: 'Apartman',
  holiday_unit: 'Kuća za odmor',
  office_unit: 'Ured',
};

export const CLIMATE_TYPES: AssetType[] = ['ac_split', 'ac_multi', 'ac_ducted', 'ac_vrf', 'heat_pump', 'ventilation', 'chiller'];
export const WATER_TYPES: AssetType[] = ['water_heater', 'gas_boiler', 'plumbing', 'drainage', 'heating', 'pump'];
export const ELECTRIC_TYPES: AssetType[] = ['electrical', 'switchboard', 'solar_pv', 'ev_charger'];
export const APPLIANCE_TYPES: AssetType[] = ['washer', 'dishwasher', 'fridge', 'oven', 'dryer', 'coffee_machine', 'small_appliance'];
export const LOCK_TYPES: AssetType[] = ['door_lock', 'safe'];
export const POOL_TYPES: AssetType[] = ['swimming_pool', 'pool_plant'];
export const CLEAN_TYPES: AssetType[] = ['apartment_unit', 'holiday_unit', 'office_unit'];

// A place, not a device: an apartment or a pool has an oznaka, not a make and model.
export function assetNeedsMake(type: AssetType): boolean {
  return !CLEAN_TYPES.includes(type) && type !== 'swimming_pool';
}
// Not a vehicle: no plate, no kilometres, a serial number instead of a VIN.
export const DEVICE_TYPES: AssetType[] = [...CLIMATE_TYPES, ...WATER_TYPES, ...ELECTRIC_TYPES, ...APPLIANCE_TYPES, ...LOCK_TYPES, ...POOL_TYPES, ...CLEAN_TYPES];
const MTH_TYPES: AssetType[] = ['machine', 'tractor', 'implement', 'jetski', 'boat', 'outboard', 'inboard', ...DEVICE_TYPES];

export function defaultMeterUnit(type: AssetType): MeterUnit {
  return MTH_TYPES.includes(type) ? 'mth' : 'km';
}

export function identifierLabel(type: AssetType): string {
  if (type === 'boat' || type === 'jetski') return 'Registarska oznaka plovila';
  if (type === 'outboard' || type === 'inboard') return 'Serijski broj motora';
  if (type === 'machine' || type === 'implement') return 'Serijski broj';
  if (LOCK_TYPES.includes(type)) return 'Oznaka (ulaz, kat, stan)';
  if (POOL_TYPES.includes(type)) return 'Oznaka (adresa, villa, hotel)';
  if (CLEAN_TYPES.includes(type)) return 'Oznaka (apartman, ured)';
  if (type === 'electrical' || type === 'switchboard') return 'Oznaka (npr. stan, kuća, lokal)';
  if (DEVICE_TYPES.includes(type)) return 'Oznaka uređaja';
  return 'Registracija';
}

export function vinLabel(type: AssetType): string {
  if (type === 'boat' || type === 'jetski') return 'HIN / CIN (14 znakova)';
  if (type === 'outboard' || type === 'inboard') return 'Oznaka modela';
  if (DEVICE_TYPES.includes(type)) return 'Serijski broj';
  return 'VIN';
}

export const METER_LABELS: Record<MeterUnit, { short: string; long: string }> = {
  km: { short: 'km', long: 'Kilometri' },
  mth: { short: 'mth', long: 'Motosati' },
};

export function getPackage(id: string | null | undefined): PackageConfig {
  return PACKAGES[(id as PackageId) ?? 'volt'] ?? PACKAGES.volt;
}

export function phaseLabel(pkg: PackageConfig, phase: JobPhase): string {
  return pkg.phaseLabels[phase] ?? BASE_PHASE_LABELS[phase];
}

export function quotePolicy(pkg: PackageConfig): 'first' | 'offer' | 'never' {
  if (pkg.internalJobs) return 'never';
  return pkg.quote ?? 'offer';
}

export function hasModule(pkg: PackageConfig, enabled: string[] | null | undefined, module: ModuleId): boolean {
  return pkg.modules.includes(module) || Boolean(enabled?.includes(module) && pkg.optionalModules.includes(module));
}

// Field work (sites, appointments, on-site timeline, customer report):
// always for a field package, optional for a workshop that also goes out.
export function hasFieldWork(pkg: PackageConfig, enabled: string[] | null | undefined): boolean {
  return pkg.sector === 'field' || hasModule(pkg, enabled, 'field_visits');
}

export function findInspection(pkg: PackageConfig, code: string): InspectionTemplate | undefined {
  return pkg.inspections.find((t) => t.code === code);
}

// Product by domain: automehanicar.poslar.eu → Gear. Subdomains (gear.localhost,
// gear.x-files.vercel.app) work too, for testing all of them on one server.
export function matchPackageFromHost(host: string | null | undefined): PackageConfig | null {
  const h = (host ?? '').toLowerCase().split(':')[0];
  for (const pkg of Object.values(PACKAGES)) {
    const base = pkg.domain.split('.')[0];
    if (h === pkg.domain || h.endsWith(`.${pkg.domain}`) || h.startsWith(`${pkg.id}.`) || h.startsWith(`${base}.`)) {
      return pkg;
    }
  }
  return null;
}

export function resolvePackageFromHost(host: string | null | undefined): PackageConfig {
  return matchPackageFromHost(host) ?? getPackage(process.env.NEXT_PUBLIC_DEFAULT_PACKAGE);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const n = parseInt(value.length === 3 ? value.split('').map((c) => c + c).join('') : value, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// "61 155 255" for Tailwind's rgb(var(--accent) / <alpha>) colours.
export function hexToRgbTriplet(hex: string): string {
  return hexToRgb(hex).join(' ');
}

// The brand. accent: the buttons (the logo's blue, white letters on it,
// Vedran 2026-10-07); mark and blue: the logo's orange and blue
// (public/brand, drawn by scripts/brand.mjs).
export const BRAND = { id: 'poslar', name: 'Poslar', tagline: 'Manje administracije. Više odrađenog posla.', accent: '#1CA7DD', mark: '#F15A24', blue: '#1CA7DD' } as const;

export function brandAccentStyle(): CSSProperties {
  return accentStyle();
}

// Accent variables for an element with the accent-scope class. Since the
// Poslar colours every trade has the same blue (the trades differ by icon
// and name; pkg.accent stays for the trade icon files only), so the
// argument is kept for the callers but not read.
export function accentStyle(pkg?: PackageConfig): CSSProperties {
  void pkg;
  const blue = hexToRgb(BRAND.accent).join(' ');
  return {
    ['--accent-dark' as string]: blue,
    ['--accent-light' as string]: blue,
    ['--accent-fg-dark' as string]: '255 255 255',
    ['--accent-fg-light' as string]: '255 255 255',
  };
}
