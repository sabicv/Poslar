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
  product: 'Moto & Marine Files',
  short: 'Moto',
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
  ],
  modules: ['condition_report', 'approvals', 'moto_seasonal', 'moto_storage', 'marine'],
  optionalModules: ['dvi'],
  moduleTab: 'Sezona i plovilo',
  modulePage: 'Skladište',
};
