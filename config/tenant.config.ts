// =====================================================================
// X-Files · central tenant configuration
//
// One workshop = one package. Everything that differs between Volt,
// Gear, Body, Wheel, Fleet and Moto lives here as typed data: brand and
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
import { moto } from './packages/moto';

export type PackageId = 'volt' | 'gear' | 'body' | 'wheel' | 'fleet' | 'moto';
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
  | 'tractor' | 'implement' | 'motorcycle' | 'scooter' | 'atv' | 'jetski' | 'boat' | 'outboard' | 'inboard';

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
  | 'marine';

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
}

export interface TemplateLine {
  kind: LineKind;
  description: string;
  code?: string;
  qty: number;
  unit: string;
  price?: number;
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
  accent: string;
  vocabulary: Vocabulary;
  assetTypes: AssetType[];
  defaultAssetType: AssetType;
  phaseLabels: Partial<Record<JobPhase, string>>;
  symptoms: string[];
  photoTags: { code: string; label: string }[];
  diagram: 'car' | 'truck' | 'moto' | 'boat';
  equipment: string[];
  inspections: InspectionTemplate[];
  templates: JobTemplate[];
  modules: ModuleId[];
  optionalModules: ModuleId[];
  // Label of the package's tab on a work order and of its own page in the menu.
  moduleTab: string;
  modulePage: string;
}

export const PACKAGES: Record<PackageId, PackageConfig> = { volt, gear, body, wheel, fleet, moto };
export const PACKAGE_IDS = Object.keys(PACKAGES) as PackageId[];

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
};

const MTH_TYPES: AssetType[] = ['machine', 'tractor', 'implement', 'jetski', 'boat', 'outboard', 'inboard'];

export function defaultMeterUnit(type: AssetType): MeterUnit {
  return MTH_TYPES.includes(type) ? 'mth' : 'km';
}

export function identifierLabel(type: AssetType): string {
  if (type === 'boat' || type === 'jetski') return 'Registarska oznaka plovila';
  if (type === 'outboard' || type === 'inboard') return 'Serijski broj motora';
  if (type === 'machine' || type === 'implement') return 'Serijski broj';
  return 'Registracija';
}

export function vinLabel(type: AssetType): string {
  if (type === 'boat' || type === 'jetski') return 'HIN / CIN (14 znakova)';
  if (type === 'outboard' || type === 'inboard') return 'Oznaka modela';
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

export function hasModule(pkg: PackageConfig, enabled: string[] | null | undefined, module: ModuleId): boolean {
  return pkg.modules.includes(module) || Boolean(enabled?.includes(module) && pkg.optionalModules.includes(module));
}

export function findInspection(pkg: PackageConfig, code: string): InspectionTemplate | undefined {
  return pkg.inspections.find((t) => t.code === code);
}

// Product by domain: gearfiles.hr → Gear. Subdomains (gear.localhost,
// gear.x-files.vercel.app) work too, for testing all six on one server.
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

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Accent variables for an element with the accent-scope class. A light
// accent (Wheel silver) is darkened for the light theme so accent text
// stays readable on white, and text on an accent button flips between
// black and white by contrast.
export function accentStyle(pkg: PackageConfig): CSSProperties {
  const rgb = hexToRgb(pkg.accent);
  const onLight = luminance(rgb) > 0.35 ? (rgb.map((c) => Math.round(c * 0.42)) as [number, number, number]) : rgb;
  const fg = (c: [number, number, number]) => (luminance(c) > 0.45 ? '10 10 11' : '255 255 255');
  return {
    ['--accent-dark' as string]: rgb.join(' '),
    ['--accent-light' as string]: onLight.join(' '),
    ['--accent-fg-dark' as string]: fg(rgb),
    ['--accent-fg-light' as string]: fg(onLight),
  };
}
