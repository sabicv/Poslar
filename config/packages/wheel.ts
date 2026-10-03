import type { PackageConfig } from '../tenant.config';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

export const TIRE_POSITIONS = [
  { code: 'FL', label: 'Prednja lijeva' },
  { code: 'FR', label: 'Prednja desna' },
  { code: 'RL', label: 'Stražnja lijeva' },
  { code: 'RR', label: 'Stražnja desna' },
] as const;

export const SEASON_LABELS: Record<string, string> = {
  summer: 'Ljetne',
  winter: 'Zimske',
  all_season: 'Cjelogodišnje',
};

// Winter tyres below 4 mm do not count as winter equipment in Croatia;
// 1.6 mm is the legal minimum for any tyre.
export const TREAD_LIMITS = {
  winter: { warn: 5, crit: 4 },
  summer: { warn: 3, crit: 1.6 },
  all_season: { warn: 4, crit: 3 },
} as const;

export const wheel: PackageConfig = {
  id: 'wheel',
  product: 'Wheel Files',
  short: 'Wheel',
  domain: 'wheelfiles.hr',
  tagline: 'Vulkanizeri, geometrija i hotel za gume',
  pitch: [
    'Hotel za gume: QR naljepnice, sektor–regal–polica–mjesto',
    'Šara u tri točke po gumi, DOT i stanje naplatka',
    'Geometrija prije i poslije, moment pritezanja u Nm',
  ],
  sector: 'workshop',
  accent: '#C9953C',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Vozilo', many: 'Vozila', new: 'Novo vozilo' },
    identifier: 'Registracija',
  },
  assetTypes: ['car', 'van', 'truck', 'motorcycle', 'bus'],
  defaultAssetType: 'car',
  phaseLabels: { in_progress: 'Montaža / rad' },
  symptoms: ['Sezonska zamjena', 'Balansiranje', 'Krpanje gume', 'Geometrija', 'Nove gume', 'Vibracije u volanu', 'Vuče u stranu'],
  photoTags: [
    ...COMMON_PHOTO_TAGS,
    { code: 'tire', label: 'Guma' },
    { code: 'rim', label: 'Naplatak' },
    { code: 'alignment_report', label: 'Ispis geometrije' },
  ],
  diagram: 'car',
  equipment: ['Ključ sigurnosnih vijaka', 'Kapice', 'Rezervni kotač'],
  inspections: [
    checklist('wheel.storage_intake', 'Zaprimanje na čuvanje', 'checklist', 'Set guma', [
      'Dimenzija, marka i model',
      'DOT za svaku gumu',
      'Šara u tri točke za svaku gumu',
      'Stanje naplataka i fotografija oštećenja',
      'Vijci i ključ sigurnosnih vijaka',
      'Oprano i označeno QR naljepnicom',
      'Lokacija u skladištu',
      'Potvrda i potpis mušterije',
    ]),
    checklist('wheel.season_change', 'Sezonska zamjena', 'checklist', 'Montaža', [
      'Moment pritezanja prema modelu',
      'Tlak prema pločici vozila',
      'Balansiranje ako treba',
      'TPMS provjera i ponovno učenje',
      'Skinuti set izmjeren i uskladišten',
      'Podsjetnik ponovnog pritezanja zakazan',
    ]),
  ],
  templates: [
    {
      code: 'wheel.season',
      name: 'Sezonska zamjena',
      lines: [
        { kind: 'labor', description: 'Skidanje i montaža 4 kotača', qty: 1, unit: 'paušal', price: 30 },
        { kind: 'labor', description: 'Balansiranje 4 kotača', qty: 1, unit: 'paušal', price: 20 },
      ],
      inspection: 'wheel.season_change',
    },
    {
      code: 'wheel.balance',
      name: 'Balansiranje 4 kotača',
      lines: [
        { kind: 'labor', description: 'Balansiranje 4 kotača', qty: 1, unit: 'paušal', price: 20 },
        { kind: 'material', description: 'Utezi', qty: 1, unit: 'kom', price: 4 },
      ],
    },
    {
      code: 'wheel.repair',
      name: 'Krpanje gume',
      lines: [{ kind: 'labor', description: 'Krpanje gume (gazeći sloj)', qty: 1, unit: 'paušal', price: 15 }],
    },
    {
      code: 'wheel.alignment',
      name: 'Geometrija',
      lines: [{ kind: 'labor', description: 'Mjerenje i podešavanje geometrije', qty: 1, unit: 'paušal', price: 45 }],
    },
    {
      code: 'wheel.storage',
      name: 'Čuvanje guma (sezona)',
      lines: [{ kind: 'fee', description: 'Čuvanje seta guma jednu sezonu', qty: 1, unit: 'paušal', price: 25 }],
      inspection: 'wheel.storage_intake',
    },
  ],
  modules: ['dvi', 'approvals', 'wheel_hotel', 'wheel_torque', 'wheel_alignment'],
  optionalModules: ['condition_report', 'field_visits'],
  moduleTab: 'Gume i hotel',
  modulePage: 'Hotel za gume',
};

// "A-2-3-1" for a regular rack place; a place typed by hand in words
// ("Hala 2, kod vrata") is stored with 1-1-1 and shown by its words alone.
export function hotelPlace(l: { sector: unknown; rack: unknown; shelf: unknown; slot: unknown }): string {
  const sector = String(l.sector);
  const typed = Number(l.rack) === 1 && Number(l.shelf) === 1 && Number(l.slot) === 1 && !/^[A-Z0-9]{1,3}$/i.test(sector);
  return typed ? sector : `${sector}-${l.rack}-${l.shelf}-${l.slot}`;
}
