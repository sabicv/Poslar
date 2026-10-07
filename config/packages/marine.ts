import type { PackageConfig } from '../tenant.config';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

export const BOAT_ZONES = [
  'Pramac', 'Bok lijevi', 'Bok desni', 'Krma', 'Dno / antivegetativ', 'Paluba', 'Ograda', 'Tende i jastuci',
  'Poklopac motora', 'Noga i propeler', 'Anode', 'Prikolica',
];

export const marine: PackageConfig = {
  id: 'marine',
  product: 'Nautika',
  short: 'Nautika',
  domain: 'nautika.poslar.eu',
  tagline: 'Plovila, vanbrodski i unutarnji motori',
  pitch: [
    'Zapisnik trupa i opreme pri prijemu, s potpisom',
    'Konzervacija i dekonzervacija kao gotovi protokoli',
    'HIN, serijski broj motora i radni sati po plovilu',
  ],
  sector: 'workshop',
  accent: '#0D5C75',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Plovilo', many: 'Plovila', new: 'Novo plovilo' },
    identifier: 'Registracija / oznaka plovila',
  },
  assetTypes: ['jetski', 'boat', 'outboard', 'inboard'],
  defaultAssetType: 'boat',
  phaseLabels: { in_progress: 'Servis / protokol' },
  symptoms: ['Redovni servis', 'Konzervacija (zimovanje)', 'Dekonzervacija', 'Ne pali', 'Gubi snagu', 'Pregrijava se', 'Električni kvar', 'Skladištenje'],
  photoTags: [...COMMON_PHOTO_TAGS, { code: 'hull', label: 'Trup' }, { code: 'equipment', label: 'Oprema' }],
  diagram: 'boat',
  equipment: ['Ključ', 'Daljinski alarma', 'Punjač / održavač', 'Cerada', 'Prsluk za spašavanje', 'Sidro', 'Prekidač za slučaj pada'],
  inspections: [
    checklist('marine.winterize_outboard', 'Konzervacija vanbrodskog motora', 'seasonal', 'Zimovanje', [
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
    checklist('marine.dewinterize', 'Dekonzervacija', 'seasonal', 'Priprema za sezonu', [
      'Akumulator: napon i test',
      'Impeler zamijenjen ili pregledan',
      'Anode zamijenjene po potrebi',
      'Filteri goriva',
      'Test rada u bačvi ili vodi, izlaz rashladne vode',
      'Trim i tilt',
      'Kontrolne lampice i instrumenti',
      'Sigurnosna oprema: rokovi valjanosti',
    ]),
  ],
  templates: [
    {
      code: 'marine.winterize_outboard',
      name: 'Konzervacija vanbrodskog motora',
      lines: [
        { kind: 'package', description: 'Konzervacija vanbrodskog motora', qty: 1, unit: 'paušal', price: 180 },
        { kind: 'material', description: 'Ulje noge', qty: 1, unit: 'l', price: 22 },
        { kind: 'material', description: 'Ulje za konzervaciju', qty: 1, unit: 'kom', price: 15 },
      ],
      inspection: 'marine.winterize_outboard',
    },
    {
      code: 'marine.dewinterize',
      name: 'Dekonzervacija',
      lines: [
        { kind: 'package', description: 'Dekonzervacija i test rada', qty: 1, unit: 'paušal', price: 120 },
        { kind: 'part', description: 'Impeler', qty: 1, unit: 'kom', price: 45 },
      ],
      inspection: 'marine.dewinterize',
    },
    {
      code: 'marine.jetski_winterize',
      name: 'Konzervacija jet-skija',
      lines: [{ kind: 'package', description: 'Konzervacija jet-skija', qty: 1, unit: 'paušal', price: 150 }],
    },
    {
      code: 'marine.outboard_service',
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
      code: 'marine.impeller',
      name: 'Impeler',
      lines: [
        { kind: 'labor', description: 'Zamjena impelera rashladne pumpe', qty: 1.2, unit: 'h', price: 50 },
        { kind: 'part', description: 'Impeler', qty: 1, unit: 'kom', price: 35 },
      ],
    },
    {
      code: 'marine.antifouling',
      name: 'Antivegetativna zaštita',
      lines: [
        { kind: 'labor', description: 'Pranje, brušenje i antivegetativni premaz', qty: 4, unit: 'h', price: 45 },
        { kind: 'material', description: 'Antivegetativna boja', qty: 2.5, unit: 'l', price: 50 },
      ],
    },
    {
      code: 'marine.anodes',
      name: 'Zamjena anoda',
      lines: [
        { kind: 'labor', description: 'Zamjena anoda', qty: 1, unit: 'h', price: 45 },
        { kind: 'part', description: 'Anode (komplet)', qty: 1, unit: 'kom', price: 64 },
      ],
    },
  ],
  modules: ['condition_report', 'approvals', 'moto_seasonal', 'moto_storage', 'marine'],
  optionalModules: ['dvi'],
  moduleTab: 'Sezona i plovilo',
  modulePage: 'Skladište',
};
