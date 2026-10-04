import type { PackageConfig } from '../tenant.config';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

export const MOTO_ZONES = [
  'Prednji blatobran', 'Prednja maska i far', 'Vjetrobran', 'Lijevi bočni oklop', 'Desni bočni oklop',
  'Spremnik goriva', 'Sjedalo', 'Stražnji oklop i rep', 'Stražnji blatobran i nosač tablice', 'Ispuh',
  'Ručice kočnice i kvačila', 'Retrovizori', 'Poklopci motora i klizači', 'Papučice', 'Naplatci', 'Koferi',
];

export const BOAT_ZONES = [
  'Pramac', 'Bok lijevi', 'Bok desni', 'Krma', 'Dno / antivegetativ', 'Paluba', 'Ograda', 'Tende i jastuci',
  'Poklopac motora', 'Noga i propeler', 'Anode', 'Prikolica',
];

export const moto: PackageConfig = {
  id: 'moto',
  product: 'TaktiX Moto i nautika',
  short: 'Moto i nautika',
  domain: 'motofiles.hr',
  tagline: 'Motocikli, quadovi i nautika',
  pitch: [
    'Zapisnik oklopa i opreme pri prijemu, s potpisom',
    'Konzervacija i dekonzervacija kao gotovi protokoli',
    'HIN/CIN, serijski broj motora i motosati po motoru',
  ],
  sector: 'workshop',
  accent: '#66CC33',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Vozilo / plovilo', many: 'Vozila i plovila', new: 'Novo vozilo ili plovilo' },
    identifier: 'Registracija / oznaka plovila',
  },
  assetTypes: ['motorcycle', 'scooter', 'atv', 'jetski', 'boat', 'outboard', 'inboard'],
  defaultAssetType: 'motorcycle',
  phaseLabels: { in_progress: 'Servis / protokol' },
  symptoms: ['Redovni servis', 'Konzervacija (zimovanje)', 'Dekonzervacija', 'Ne pali', 'Gubi snagu', 'Pregrijava se', 'Električni kvar', 'Skladištenje'],
  photoTags: [
    ...COMMON_PHOTO_TAGS,
    { code: 'fairing', label: 'Oklop / plastika' },
    { code: 'hull', label: 'Trup' },
    { code: 'equipment', label: 'Oprema' },
  ],
  diagram: 'moto',
  equipment: ['Kaciga', 'Bočni kofer', 'Top case', 'Ključ', 'Daljinski alarma', 'Punjač / održavač', 'Cerada', 'Prsluk za spašavanje', 'Sidro', 'Prekidač za slučaj pada'],
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
    checklist('moto.winterize_outboard', 'Konzervacija vanbrodskog motora', 'seasonal', 'Zimovanje', [
      'Ispiranje slatkom vodom',
      'Ulje za konzervaciju u cilindre',
      'Zamjena ulja motora i filtera (4T)',
      'Zamjena ulja noge, provjera vode u ulju',
      'Stabilizator goriva',
      'Separator vode i filter goriva',
      'Pregled impelera',
      'Anode: % istrošenosti',
      'Podmazivanje mazalica i vratila propelera',
      'Propeler skinut i pregledan',
      'Akumulator odspojen i na održavanju',
      'Unutarnji motor: antifriz u rashladni krug',
    ]),
    checklist('moto.dewinterize', 'Dekonzervacija', 'seasonal', 'Priprema za sezonu', [
      'Akumulator: napon i test',
      'Impeler zamijenjen ili pregledan',
      'Anode zamijenjene po potrebi',
      'Filteri goriva',
      'Test rada u bačvi ili vodi, izlaz rashladne vode',
      'Trim i tilt',
      'Kontrolne lampice i instrumenti',
      'Sigurnosna oprema: rokovi valjanosti',
      'Motocikl: gume, kočnice, lanac, svjetla, probna vožnja',
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
      code: 'moto.winterize_outboard',
      name: 'Konzervacija vanbrodskog motora',
      lines: [
        { kind: 'package', description: 'Konzervacija vanbrodskog motora', qty: 1, unit: 'paušal', price: 180 },
        { kind: 'material', description: 'Ulje noge', qty: 1, unit: 'l', price: 22 },
        { kind: 'material', description: 'Ulje za konzervaciju', qty: 1, unit: 'kom', price: 15 },
      ],
      inspection: 'moto.winterize_outboard',
    },
    {
      code: 'moto.dewinterize',
      name: 'Dekonzervacija',
      lines: [
        { kind: 'package', description: 'Dekonzervacija i test rada', qty: 1, unit: 'paušal', price: 120 },
        { kind: 'part', description: 'Impeler', qty: 1, unit: 'kom', price: 45 },
      ],
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
    {
      code: 'moto.outboard_service',
      name: 'Godišnji servis vanbrodskog motora',
      lines: [
        { kind: 'labor', description: 'Godišnji servis vanbrodskog motora', qty: 2, unit: 'h', price: 50 },
        { kind: 'part', description: 'Impeler', qty: 1, unit: 'kom', price: 35 },
        { kind: 'part', description: 'Svjećica', qty: 2, unit: 'kom', price: 8 },
        { kind: 'part', description: 'Anoda', qty: 1, unit: 'kom', price: 25 },
        { kind: 'material', description: 'Ulje noge', qty: 1, unit: 'l', price: 15 },
      ],
    },
    {
      code: 'moto.impeller',
      name: 'Impeler',
      lines: [
        { kind: 'labor', description: 'Zamjena impelera rashladne pumpe', qty: 1.2, unit: 'h', price: 50 },
        { kind: 'part', description: 'Impeler', qty: 1, unit: 'kom', price: 35 },
      ],
    },
    {
      code: 'moto.antifouling',
      name: 'Antivegetativna zaštita',
      lines: [
        { kind: 'labor', description: 'Pranje, brušenje i antivegetativni premaz', qty: 4, unit: 'h', price: 45 },
        { kind: 'material', description: 'Antivegetativna boja', qty: 2.5, unit: 'l', price: 50 },
      ],
    },
  ],
  modules: ['condition_report', 'approvals', 'moto_seasonal', 'moto_storage', 'marine'],
  optionalModules: ['dvi'],
  moduleTab: 'Sezona i plovilo',
  modulePage: 'Skladište',
};
