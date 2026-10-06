import type { PackageConfig } from '../tenant.config';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

export const MOTO_ZONES = [
  'Prednji blatobran', 'Prednja maska i far', 'Vjetrobran', 'Lijevi bočni oklop', 'Desni bočni oklop',
  'Spremnik goriva', 'Sjedalo', 'Stražnji oklop i rep', 'Stražnji blatobran i nosač tablice', 'Ispuh',
  'Ručice kočnice i kvačila', 'Retrovizori', 'Poklopci motora i klizači', 'Papučice', 'Naplatci', 'Koferi',
];

export const moto: PackageConfig = {
  id: 'moto',
  product: 'Poslar Moto',
  short: 'Moto',
  domain: 'motocikli.poslar.hr',
  tagline: 'Motocikli, skuteri i quadovi',
  pitch: [
    'Zapisnik oklopa i opreme pri prijemu, s potpisom',
    'Konzervacija i dekonzervacija kao gotovi protokoli',
    'VIN, serijski broj motora i stanje kilometara po motociklu',
  ],
  sector: 'workshop',
  accent: '#0AB4FF',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Vozilo', many: 'Vozila', new: 'Novo vozilo' },
    identifier: 'Registracija',
  },
  assetTypes: ['motorcycle', 'scooter', 'atv'],
  defaultAssetType: 'motorcycle',
  phaseLabels: { in_progress: 'Servis / protokol' },
  symptoms: ['Redovni servis', 'Konzervacija (zimovanje)', 'Dekonzervacija', 'Ne pali', 'Gubi snagu', 'Pregrijava se', 'Električni kvar', 'Skladištenje'],
  photoTags: [...COMMON_PHOTO_TAGS, { code: 'fairing', label: 'Oklop / plastika' }, { code: 'equipment', label: 'Oprema' }],
  diagram: 'moto',
  equipment: ['Kaciga', 'Bočni kofer', 'Top case', 'Ključ', 'Daljinski alarma', 'Punjač / održavač', 'Cerada', 'Prekidač za slučaj pada'],
  inspections: [
    checklist('moto.winterize_moto', 'Konzervacija motocikla', 'seasonal', 'Zimovanje', [
      'Pranje i sušenje',
      'Zamjena ulja i filtera',
      'Pun spremnik i stabilizator goriva',
      'Podmazivanje lanca',
      'Akumulator skinut ili na održavaču',
      'Tlak u gumama, postolje',
      'Zaštita metalnih dijelova',
      'Ispuh zatvoren',
      'Cerada',
      'Brojilo zapisano',
    ]),
    checklist('moto.dewinterize', 'Dekonzervacija', 'seasonal', 'Priprema za sezonu', [
      'Akumulator: napon i test',
      'Tlak i stanje guma',
      'Kočnice: pločice i tekućina',
      'Lanac: zategnutost i podmazivanje',
      'Svjetla i pokazivači',
      'Probna vožnja',
    ]),
  ],
  templates: [
    {
      code: 'moto.service_small',
      name: 'Mali servis motocikla',
      lines: [
        { kind: 'labor', description: 'Zamjena ulja i filtera, pregled', qty: 1, unit: 'h', price: 45 },
        { kind: 'part', description: 'Filter ulja', qty: 1, unit: 'kom', price: 14 },
        { kind: 'material', description: 'Motorno ulje', qty: 3, unit: 'l', price: 14 },
      ],
    },
    {
      code: 'moto.winterize_moto',
      name: 'Konzervacija motocikla',
      lines: [
        { kind: 'package', description: 'Konzervacija motocikla (zimovanje)', qty: 1, unit: 'paušal', price: 80 },
        { kind: 'material', description: 'Stabilizator goriva', qty: 1, unit: 'kom', price: 12 },
      ],
      inspection: 'moto.winterize_moto',
    },
    {
      code: 'moto.dewinterize',
      name: 'Dekonzervacija motocikla',
      lines: [{ kind: 'package', description: 'Dekonzervacija i probna vožnja', qty: 1, unit: 'paušal', price: 70 }],
      inspection: 'moto.dewinterize',
    },
    {
      code: 'moto.service_big',
      name: 'Veliki servis motocikla',
      lines: [
        { kind: 'labor', description: 'Veliki servis s provjerom ventila', qty: 4, unit: 'h', price: 45 },
        { kind: 'part', description: 'Filter ulja', qty: 1, unit: 'kom', price: 14 },
        { kind: 'part', description: 'Filter zraka', qty: 1, unit: 'kom', price: 30 },
        { kind: 'part', description: 'Svjećica', qty: 4, unit: 'kom', price: 12 },
        { kind: 'material', description: 'Motorno ulje', qty: 3, unit: 'l', price: 14 },
      ],
    },
    {
      code: 'moto.chain',
      name: 'Lanac i zupčanici',
      lines: [
        { kind: 'labor', description: 'Zamjena kompleta lanca', qty: 1, unit: 'h', price: 45 },
        { kind: 'part', description: 'Komplet lanca i zupčanika', qty: 1, unit: 'kom', price: 150 },
      ],
    },
    {
      code: 'moto.brake_pads',
      name: 'Kočione pločice',
      lines: [
        { kind: 'labor', description: 'Zamjena kočionih pločica', qty: 0.6, unit: 'h', price: 45 },
        { kind: 'part', description: 'Kočione pločice (set)', qty: 1, unit: 'kom', price: 40 },
      ],
    },
    {
      code: 'moto.fork',
      name: 'Servis prednje vilice',
      lines: [
        { kind: 'labor', description: 'Servis prednje vilice', qty: 2.5, unit: 'h', price: 45 },
        { kind: 'part', description: 'Semering vilice', qty: 2, unit: 'kom', price: 15 },
        { kind: 'material', description: 'Ulje za vilicu', qty: 1, unit: 'l', price: 20 },
      ],
    },
    {
      code: 'moto.tyre',
      name: 'Guma motocikla',
      lines: [
        { kind: 'labor', description: 'Zamjena gume motocikla', qty: 0.8, unit: 'h', price: 45 },
        { kind: 'part', description: 'Guma motocikla', qty: 1, unit: 'kom', price: 120 },
      ],
    },
    {
      code: 'moto.battery',
      name: 'Akumulator motocikla',
      lines: [
        { kind: 'labor', description: 'Zamjena akumulatora', qty: 0.3, unit: 'h', price: 45 },
        { kind: 'part', description: 'Akumulator motocikla', qty: 1, unit: 'kom', price: 70 },
      ],
    },
    {
      code: 'moto.cvt',
      name: 'Servis variomata (skuter)',
      lines: [
        { kind: 'labor', description: 'Servis variomata', qty: 1.5, unit: 'h', price: 45 },
        { kind: 'part', description: 'Remen variomata', qty: 1, unit: 'kom', price: 40 },
        { kind: 'part', description: 'Valjčići (set)', qty: 1, unit: 'kom', price: 20 },
      ],
    },
  ],
  modules: ['condition_report', 'approvals', 'moto_seasonal', 'moto_storage'],
  optionalModules: ['dvi'],
  moduleTab: 'Sezona i skladište',
  modulePage: 'Skladište',
};
