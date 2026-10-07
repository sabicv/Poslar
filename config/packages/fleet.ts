import type { PackageConfig } from '../tenant.config';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

export const COMPLIANCE_LABELS: Record<string, string> = {
  technical_inspection: 'Tehnički pregled',
  preventive_inspection: 'Preventivni pregled',
  tachograph: 'Tahograf, periodični pregled',
  cemt_permit: 'CEMT dozvola',
  adr: 'ADR',
  fire_extinguisher: 'Vatrogasni aparat',
  insurance: 'Osiguranje',
  registration: 'Registracija',
  license: 'Licencija',
};

export const fleet: PackageConfig = {
  id: 'fleet',
  product: 'Kamioni i strojevi',
  short: 'Kamioni i strojevi',
  domain: 'kamioni-strojevi.poslar.eu',
  tagline: 'Teretni program, građevina i flote',
  pitch: [
    'Motosati i kilometri, intervali "što prije nastupi"',
    'Kamion + prikolica, traktor + priključak, svaki sa svojom poviješću',
    'Zakonski rokovi i terenski nalog s lokacijom i potpisom',
  ],
  sector: 'workshop',
  accent: '#94A3B8',
  vocabulary: {
    client: { one: 'Tvrtka', many: 'Tvrtke', new: 'Nova tvrtka', acc: 'tvrtku' },
    asset: { one: 'Vozilo / stroj', many: 'Vozni park', new: 'Novo vozilo ili stroj' },
    identifier: 'Registracija / serijski broj',
  },
  assetTypes: ['truck', 'tractor_unit', 'trailer', 'semi_trailer', 'bus', 'van', 'machine', 'tractor', 'implement'],
  defaultAssetType: 'truck',
  phaseLabels: { in_progress: 'Rad (radionica / teren)' },
  symptoms: ['Planski servis (PM)', 'Vozilo stoji', 'Kočnice / zrak', 'Hidraulika', 'Elektrika', 'Tahograf', 'Tehnički pregled', 'Terenska intervencija'],
  photoTags: [...COMMON_PHOTO_TAGS, { code: 'field', label: 'Teren' }, { code: 'plate', label: 'Pločica stroja' }],
  diagram: 'truck',
  equipment: ['Ključevi', 'Kartica tahografa', 'Dokumenti vozila', 'Vatrogasni aparat', 'Trokut i prva pomoć'],
  inspections: [
    checklist('fleet.driver_check', 'Dnevni pregled vozača', 'driver_check', 'Prije polaska', [
      'Gume, tlak i oštećenja',
      'Svjetla i pokazivači',
      'Kočnice i tlak zraka',
      'Curenja ispod vozila',
      'Retrovizori i stakla',
      'Brisači i tekućina',
      'Spojnica i sigurnosni lanac prikolice',
      'Kabeli i crijeva prikolice (zrak, ABS, svjetla)',
      'Teret osiguran',
      'Tahograf i kartica vozača',
      'AdBlue i gorivo',
      'Vatrogasni aparat, trokut, prva pomoć',
      'Kontrolne lampice nakon paljenja',
    ]),
    checklist('fleet.pm_a', 'PM-A', 'checklist', 'Plansko održavanje A', [
      'Ulje motora i filter',
      'Filter goriva i separator vode',
      'Podmazivanje svih mazalica',
      'Kočnice: obloge i cilindri',
      'Remenje i crijeva',
      'Akumulatori i priključci',
      'Svjetla i elektrika',
      'Očitanje grešaka',
    ]),
    checklist('fleet.trailer', 'Priključak / prikolica', 'checklist', 'Pregled priključka', [
      'Kočnice i ležajevi kotača',
      'Spojnica ili king-pin',
      'Svjetla i kabel',
      'ABS/EBS kabel i dijagnostika',
      'Gume i vijci',
      'Nogari i stranice',
    ]),
  ],
  templates: [
    {
      code: 'fleet.pm_a',
      name: 'PM-A',
      lines: [
        { kind: 'labor', description: 'Plansko održavanje A', qty: 3, unit: 'h', price: 55 },
        { kind: 'part', description: 'Filter ulja', qty: 1, unit: 'kom', price: 35 },
        { kind: 'part', description: 'Filter goriva', qty: 1, unit: 'kom', price: 45 },
        { kind: 'material', description: 'Motorno ulje', qty: 32, unit: 'l', price: 6 },
      ],
      inspection: 'fleet.pm_a',
    },
    {
      code: 'fleet.field_call',
      name: 'Terenska intervencija',
      lines: [
        { kind: 'fee', description: 'Izlazak na teren', qty: 1, unit: 'paušal', price: 60 },
        { kind: 'labor', description: 'Rad na terenu', qty: 1, unit: 'h', price: 65 },
      ],
    },
    {
      code: 'fleet.mot_prep',
      name: 'Priprema za tehnički',
      lines: [{ kind: 'labor', description: 'Pregled i priprema za tehnički pregled', qty: 2, unit: 'h', price: 55 }],
    },
    {
      code: 'fleet.trailer_check',
      name: 'Pregled prikolice',
      lines: [{ kind: 'labor', description: 'Pregled priključnog vozila', qty: 1.5, unit: 'h', price: 55 }],
      inspection: 'fleet.trailer',
    },
    {
      code: 'fleet.pm_b',
      name: 'PM-B',
      lines: [
        { kind: 'labor', description: 'Plansko održavanje B', qty: 5, unit: 'h', price: 55 },
        { kind: 'part', description: 'Filter ulja', qty: 1, unit: 'kom', price: 35 },
        { kind: 'part', description: 'Filter goriva', qty: 2, unit: 'kom', price: 45 },
        { kind: 'part', description: 'Filter zraka', qty: 1, unit: 'kom', price: 80 },
        { kind: 'material', description: 'Motorno ulje', qty: 32, unit: 'l', price: 6 },
      ],
    },
    {
      code: 'fleet.brakes_axle',
      name: 'Kočnice jedne osovine',
      lines: [
        { kind: 'labor', description: 'Zamjena pločica i diskova jedne osovine', qty: 3, unit: 'h', price: 55 },
        { kind: 'part', description: 'Kočione pločice (set)', qty: 1, unit: 'kom', price: 180 },
        { kind: 'part', description: 'Kočioni disk', qty: 2, unit: 'kom', price: 220 },
      ],
    },
    { code: 'fleet.tachograph', name: 'Tahograf', lines: [{ kind: 'sublet', description: 'Baždarenje tahografa (ovlaštena radionica)', qty: 1, unit: 'paušal', price: 120 }] },
    { code: 'fleet.adblue', name: 'AdBlue sustav', lines: [{ kind: 'labor', description: 'Dijagnostika i čišćenje AdBlue sustava', qty: 2, unit: 'h', price: 55 }] },
    {
      code: 'fleet.air_dryer',
      name: 'Sušač zraka',
      lines: [
        { kind: 'labor', description: 'Zamjena uloška sušača zraka', qty: 0.5, unit: 'h', price: 55 },
        { kind: 'part', description: 'Uložak sušača zraka', qty: 1, unit: 'kom', price: 45 },
      ],
    },
    {
      code: 'fleet.truck_tyre',
      name: 'Guma kamiona',
      lines: [
        { kind: 'labor', description: 'Zamjena gume kamiona', qty: 0.7, unit: 'h', price: 55 },
        { kind: 'part', description: 'Guma kamiona', qty: 1, unit: 'kom', price: 350 },
      ],
    },
    {
      code: 'fleet.trailer_lights',
      name: 'Svjetla prikolice',
      lines: [
        { kind: 'labor', description: 'Popravak svjetala i instalacije prikolice', qty: 1, unit: 'h', price: 55 },
        { kind: 'material', description: 'Žarulje, konektori, kabel', qty: 1, unit: 'paušal', price: 20 },
      ],
    },
    {
      code: 'fleet.greasing',
      name: 'Podmazivanje',
      lines: [
        { kind: 'labor', description: 'Podmazivanje šasije i zglobova', qty: 0.7, unit: 'h', price: 55 },
        { kind: 'material', description: 'Mast', qty: 1, unit: 'kom', price: 8 },
      ],
    },
    {
      code: 'fleet.machine_250',
      name: 'Servis radnog stroja (250 mth)',
      lines: [
        { kind: 'labor', description: 'Servis radnog stroja', qty: 3, unit: 'h', price: 55 },
        { kind: 'part', description: 'Filter ulja', qty: 1, unit: 'kom', price: 30 },
        { kind: 'part', description: 'Filter goriva', qty: 1, unit: 'kom', price: 35 },
        { kind: 'material', description: 'Motorno ulje', qty: 15, unit: 'l', price: 6 },
      ],
    },
    {
      code: 'fleet.hydraulic_hose',
      name: 'Hidraulična cijev',
      lines: [
        { kind: 'labor', description: 'Zamjena hidraulične cijevi', qty: 1, unit: 'h', price: 55 },
        { kind: 'part', description: 'Hidraulična cijev', qty: 1, unit: 'kom', price: 60 },
        { kind: 'material', description: 'Hidraulično ulje', qty: 5, unit: 'l', price: 6 },
      ],
    },
  ],
  modules: ['dvi', 'approvals', 'fleet_compliance', 'fleet_field', 'fleet_pm'],
  optionalModules: ['condition_report', 'parts'],
  moduleTab: 'Flota i teren',
  modulePage: 'Rokovi i zahtjevi',
};
