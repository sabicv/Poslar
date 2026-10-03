import type { PackageConfig } from '../tenant.config';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

// Panels of the 2D damage map. Codes are stored in body_panel_damages.zone.
export const BODY_ZONES: { code: string; label: string }[] = [
  { code: 'front_bumper', label: 'Prednji branik' },
  { code: 'grille', label: 'Rešetka' },
  { code: 'hood', label: 'Hauba' },
  { code: 'windshield', label: 'Vjetrobran' },
  { code: 'roof', label: 'Krov' },
  { code: 'rear_window', label: 'Stražnje staklo' },
  { code: 'trunk', label: 'Prtljažnik / peta vrata' },
  { code: 'rear_bumper', label: 'Stražnji branik' },
  { code: 'fender_fl', label: 'Prednji blatobran lijevi' },
  { code: 'fender_fr', label: 'Prednji blatobran desni' },
  { code: 'door_fl', label: 'Prednja vrata lijeva' },
  { code: 'door_fr', label: 'Prednja vrata desna' },
  { code: 'door_rl', label: 'Stražnja vrata lijeva' },
  { code: 'door_rr', label: 'Stražnja vrata desna' },
  { code: 'quarter_rl', label: 'Stražnji blatobran lijevi' },
  { code: 'quarter_rr', label: 'Stražnji blatobran desni' },
  { code: 'sill_l', label: 'Prag lijevi' },
  { code: 'sill_r', label: 'Prag desni' },
  { code: 'mirror_l', label: 'Retrovizor lijevi' },
  { code: 'mirror_r', label: 'Retrovizor desni' },
  { code: 'headlight_l', label: 'Far lijevi' },
  { code: 'headlight_r', label: 'Far desni' },
  { code: 'taillight_l', label: 'Stop svjetlo lijevo' },
  { code: 'taillight_r', label: 'Stop svjetlo desno' },
];

export const BODY_OPERATIONS: Record<string, string> = {
  repair: 'Popravak',
  replace: 'Zamjena',
  remove_install: 'Skini-postavi',
  refinish: 'Lakiranje',
  polish: 'Poliranje',
  pdr: 'PDR (bez lakiranja)',
};

export const BODY_DAMAGE_TYPES: Record<string, string> = {
  scratch: 'Ogrebotina',
  dent: 'Udubljenje',
  crack: 'Pukotina',
  deformation: 'Deformacija',
  break: 'Lom',
  corrosion: 'Korozija',
};

export const PHOTO_ANGLES = [
  'Prednja lijeva 3/4',
  'Prednja strana',
  'Prednja desna 3/4',
  'Desni bok',
  'Stražnja desna 3/4',
  'Stražnja strana',
  'Stražnja lijeva 3/4',
  'Lijevi bok',
  'Brojilo',
  'VIN pločica',
  'Pločica boje',
];

export const body: PackageConfig = {
  id: 'body',
  product: 'Body Files',
  short: 'Body',
  domain: 'bodyfiles.hr',
  tagline: 'Autolimarija, lakirnica i procjena štete',
  pitch: [
    'Mapa oštećenja: dodir panela, operacija i sati po fazi',
    'Lakirnica: šifra, receptura i grami, cilj i stvarno',
    'Zapisnik za osiguranje s fotografijama prije i poslije',
  ],
  sector: 'workshop',
  accent: '#FF4D9A',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Vozilo', many: 'Vozila', new: 'Novo vozilo' },
    identifier: 'Registracija',
  },
  assetTypes: ['car', 'van', 'truck', 'motorcycle'],
  defaultAssetType: 'car',
  phaseLabels: { diagnosis: 'Procjena', in_progress: 'U proizvodnji', awaiting_approval: 'Čeka osiguranje' },
  symptoms: ['Sudar', 'Parkiranje', 'Tuča', 'Divljač', 'Vandalizam', 'Korozija', 'Poliranje / zaštita'],
  photoTags: [
    ...COMMON_PHOTO_TAGS,
    { code: 'angle', label: 'Standardni kut' },
    { code: 'paint_code', label: 'Pločica boje' },
    { code: 'test_panel', label: 'Probna pločica' },
    { code: 'adas', label: 'ADAS kalibracija' },
  ],
  diagram: 'car',
  equipment: ['Ključevi', 'Dokumenti vozila', 'Europsko izvješće o nezgodi', 'Polica osiguranja'],
  inspections: [
    checklist('body.pre_paint', 'Prije lakiranja', 'checklist', 'Priprema za kabinu', [
      'Šifra boje potvrđena s pločice',
      'Receptura i varijanta odabrane',
      'Probna pločica usporedba pod svjetlom',
      'Paneli za prijelaz određeni',
      'Maskiranje provjereno',
      'Kabina: temperatura i vlaga zapisane',
    ]),
    checklist('body.final', 'Završna kontrola', 'checklist', 'Prije predaje', [
      'Razmaci panela jednaki',
      'Nijansa pod dnevnim svjetlom',
      'Bez curenja, mrlja i prašine u laku',
      'Svjetla i senzori rade',
      'ADAS kalibriran ako je diran',
      'Kontrolno skeniranje bez kodova',
      'Vozilo oprano, fotografije "poslije" snimljene',
    ]),
  ],
  templates: [
    {
      code: 'body.polish',
      name: 'Poliranje vozila',
      lines: [
        { kind: 'labor', description: 'Poliranje i zaštita laka', qty: 4, unit: 'h', price: 40 },
        { kind: 'material', description: 'Paste i zaštita', qty: 1, unit: 'kom', price: 35 },
      ],
    },
    {
      code: 'body.pdr',
      name: 'PDR: udubljenje bez lakiranja',
      lines: [{ kind: 'labor', description: 'Izvlačenje udubljenja bez lakiranja', qty: 1.5, unit: 'h', price: 50 }],
    },
    {
      code: 'body.panel_paint',
      name: 'Lakiranje jednog dijela',
      lines: [
        { kind: 'labor', description: 'Priprema dijela', qty: 1.5, unit: 'h', price: 42 },
        { kind: 'labor', description: 'Lakiranje dijela', qty: 1.2, unit: 'h', price: 42 },
        { kind: 'material', description: 'Materijal za lakiranje', qty: 1, unit: 'kom', price: 85 },
      ],
      inspection: 'body.pre_paint',
    },
  ],
  modules: ['condition_report', 'approvals', 'body_damage', 'body_paint', 'body_insurance'],
  optionalModules: ['dvi'],
  moduleTab: 'Oštećenja i lak',
  modulePage: 'Proizvodnja',
};
