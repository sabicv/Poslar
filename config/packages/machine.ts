import type { PackageConfig } from '../tenant.config';
import { MACHINE_ZONES } from './condition-zones';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

export const MACHINE_COMPLIANCE_LABELS: Record<string, string> = {
  technical_inspection: 'Tehnički pregled',
  preventive_inspection: 'Preventivni pregled',
  fire_extinguisher: 'Vatrogasni aparat',
  insurance: 'Osiguranje',
  registration: 'Registracija',
  license: 'Homologacija / atest',
};

export const machine: PackageConfig = {
  id: 'machine',
  product: 'Radni strojevi',
  short: 'Radni strojevi',
  domain: 'radni-strojevi.poslar.eu',
  tagline: 'Bageri, traktori, viljuškari i priključci',
  pitch: [
    'Motosati i intervali „što prije nastupi”',
    'Stroj i priključak, svaki sa svojom poviješću',
    'Terenski nalog s lokacijom i potpisom strojara',
  ],
  sector: 'workshop',
  accent: '#C4A35A',
  vocabulary: {
    client: { one: 'Tvrtka', many: 'Tvrtke', new: 'Nova tvrtka', acc: 'tvrtku' },
    asset: { one: 'Stroj', many: 'Strojevi', new: 'Novi stroj' },
    identifier: 'Serijski broj / oznaka',
  },
  assetTypes: ['machine', 'tractor', 'implement'],
  defaultAssetType: 'machine',
  phaseLabels: { in_progress: 'Rad (radionica / teren)' },
  opening: { intake: 'Sljedeće: motosati i hidraulika.', tab: 'modul' },
  symptoms: ['Planski servis', 'Stroj stoji', 'Hidraulika', 'Motor', 'Elektrika', 'Gume / gusjenice', 'Priključak', 'Terenska intervencija'],
  photoTags: [...COMMON_PHOTO_TAGS, { code: 'field', label: 'Teren' }, { code: 'plate', label: 'Pločica stroja' }, { code: 'hydraulics', label: 'Hidraulika' }],
  diagram: 'truck',
  conditionZones: MACHINE_ZONES,
  marks: [
    { code: 'O', label: 'Ogrebotina' },
    { code: 'K', label: 'Kamenčić' },
    { code: 'U', label: 'Udubljenje' },
    { code: 'T', label: 'Pukotina' },
    { code: 'S', label: 'Savijeno' },
    { code: 'P', label: 'Curi' },
    { code: 'B', label: 'Istrošeno' },
    { code: 'R', label: 'Suho' },
    { code: 'C', label: 'Korozija' },
    { code: 'N', label: 'Nedostaje' },
    { code: 'D', label: 'Kvar / defekt / neispravno' },
  ],
  equipment: ['Ključevi kabine', 'Pločica stroja', 'Dokumenti stroja', 'Vatrogasni aparat', 'Priključak', 'Utezi', 'Uputstva'],
  inspections: [
    checklist('machine.check', 'Pregled stroja', 'checklist', 'Prije rada', [
      'Ulje motora i hidraulike, razina',
      'Curenja ispod stroja',
      'Crijevni spojevi i mazalice',
      'Gume ili gusjenice',
      'Svjetla i ogledala',
      'Kabina, sjedalo, sigurnosni pojas',
      'Kontrolne lampice nakon paljenja',
      'Priključak i brava priključka',
      'Vatrogasni aparat',
    ]),
    checklist('machine.service', 'Servis po motosatima', 'checklist', 'Plansko održavanje', [
      'Ulje motora i filter',
      'Filter goriva i separator vode',
      'Filter zraka',
      'Hidraulično ulje i filter',
      'Podmazivanje svih mazalica',
      'Remenje i crijeva',
      'Akumulator i priključci',
      'Očitanje grešaka',
    ]),
  ],
  templates: [
    {
      code: 'machine.service_250',
      name: 'Servis 250 mth',
      lines: [
        { kind: 'labor', description: 'Servis radnog stroja (250 mth)', qty: 3, unit: 'h', price: 55 },
        { kind: 'part', description: 'Filter ulja', qty: 1, unit: 'kom', price: 30 },
        { kind: 'part', description: 'Filter goriva', qty: 1, unit: 'kom', price: 35 },
        { kind: 'material', description: 'Motorno ulje', qty: 15, unit: 'l', price: 6 },
      ],
      inspection: 'machine.service',
    },
    {
      code: 'machine.service_500',
      name: 'Servis 500 mth',
      lines: [
        { kind: 'labor', description: 'Servis radnog stroja (500 mth)', qty: 5, unit: 'h', price: 55 },
        { kind: 'part', description: 'Filter ulja', qty: 1, unit: 'kom', price: 30 },
        { kind: 'part', description: 'Filter goriva', qty: 2, unit: 'kom', price: 35 },
        { kind: 'part', description: 'Filter zraka', qty: 1, unit: 'kom', price: 80 },
        { kind: 'material', description: 'Motorno ulje', qty: 15, unit: 'l', price: 6 },
      ],
      inspection: 'machine.service',
    },
    {
      code: 'machine.field_call',
      name: 'Terenska intervencija',
      lines: [
        { kind: 'fee', description: 'Izlazak na teren', qty: 1, unit: 'paušal', price: 60 },
        { kind: 'labor', description: 'Rad na terenu', qty: 1, unit: 'h', price: 65 },
      ],
    },
    {
      code: 'machine.hydraulic_hose',
      name: 'Hidraulična cijev',
      lines: [
        { kind: 'labor', description: 'Zamjena hidraulične cijevi', qty: 1, unit: 'h', price: 55 },
        { kind: 'part', description: 'Hidraulična cijev', qty: 1, unit: 'kom', price: 60 },
        { kind: 'material', description: 'Hidraulično ulje', qty: 5, unit: 'l', price: 6 },
      ],
    },
    {
      code: 'machine.hydraulic_oil',
      name: 'Hidraulično ulje',
      lines: [
        { kind: 'labor', description: 'Zamjena hidrauličnog ulja i filtera', qty: 2, unit: 'h', price: 55 },
        { kind: 'part', description: 'Filter hidraulike', qty: 1, unit: 'kom', price: 45 },
        { kind: 'material', description: 'Hidraulično ulje', qty: 40, unit: 'l', price: 5 },
      ],
    },
    {
      code: 'machine.greasing',
      name: 'Podmazivanje',
      lines: [
        { kind: 'labor', description: 'Podmazivanje šasije i zglobova', qty: 0.7, unit: 'h', price: 55 },
        { kind: 'material', description: 'Mast', qty: 1, unit: 'kom', price: 8 },
      ],
    },
    {
      code: 'machine.tracks',
      name: 'Gusjenice / gume',
      lines: [
        { kind: 'labor', description: 'Pregled i zatezanje gusjenica ili zamjena gume', qty: 2, unit: 'h', price: 55 },
      ],
    },
    {
      code: 'machine.implement',
      name: 'Pregled priključka',
      lines: [{ kind: 'labor', description: 'Pregled priključnog stroja', qty: 1.5, unit: 'h', price: 55 }],
      inspection: 'machine.check',
    },
  ],
  modules: ['dvi', 'condition_report', 'approvals', 'fleet_compliance', 'fleet_field', 'fleet_pm'],
  optionalModules: ['parts'],
  moduleTab: 'Stroj i teren',
  modulePage: 'Rokovi i zahtjevi',
};
