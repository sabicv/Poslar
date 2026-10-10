import type { ConditionZone, PackageConfig } from '../tenant.config';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

// Panels of the 2D damage map. Codes are stored in body_panel_damages.zone.
export const BODY_ZONES: ConditionZone[] = [
  { code: 'front_bumper', label: 'Prednji branik', group: 'Prednji kraj' },
  { code: 'grille', label: 'Rešetka', group: 'Prednji kraj' },
  { code: 'hood', label: 'Hauba', group: 'Prednji kraj' },
  { code: 'windshield', label: 'Vjetrobran', group: 'Prednji kraj' },
  { code: 'headlight_l', label: 'Far lijevi', group: 'Prednji kraj' },
  { code: 'headlight_r', label: 'Far desni', group: 'Prednji kraj' },
  { code: 'fog_l', label: 'Maglenka lijeva', group: 'Prednji kraj' },
  { code: 'fog_r', label: 'Maglenka desna', group: 'Prednji kraj' },
  { code: 'fender_fl', label: 'Prednji blatobran lijevi', group: 'Lijeva strana' },
  { code: 'door_fl', label: 'Prednja vrata lijeva', group: 'Lijeva strana' },
  { code: 'door_rl', label: 'Stražnja vrata lijeva', group: 'Lijeva strana' },
  { code: 'quarter_rl', label: 'Stražnji blatobran lijevi', group: 'Lijeva strana' },
  { code: 'sill_l', label: 'Prag lijevi', group: 'Lijeva strana' },
  { code: 'mirror_l', label: 'Retrovizor lijevi', group: 'Lijeva strana' },
  { code: 'glass_fl', label: 'Staklo prednjih vrata lijevo', group: 'Lijeva strana' },
  { code: 'glass_rl', label: 'Staklo stražnjih vrata lijevo', group: 'Lijeva strana' },
  { code: 'pillar_a_l', label: 'A stup lijevi', group: 'Lijeva strana' },
  { code: 'pillar_b_l', label: 'B stup lijevi', group: 'Lijeva strana' },
  { code: 'pillar_c_l', label: 'C stup lijevi', group: 'Lijeva strana' },
  { code: 'wheel_fl', label: 'Naplatak prednji lijevi', group: 'Lijeva strana' },
  { code: 'wheel_rl', label: 'Naplatak stražnji lijevi', group: 'Lijeva strana' },
  { code: 'fender_fr', label: 'Prednji blatobran desni', group: 'Desna strana' },
  { code: 'door_fr', label: 'Prednja vrata desna', group: 'Desna strana' },
  { code: 'door_rr', label: 'Stražnja vrata desna', group: 'Desna strana' },
  { code: 'quarter_rr', label: 'Stražnji blatobran desni', group: 'Desna strana' },
  { code: 'sill_r', label: 'Prag desni', group: 'Desna strana' },
  { code: 'mirror_r', label: 'Retrovizor desni', group: 'Desna strana' },
  { code: 'glass_fr', label: 'Staklo prednjih vrata desno', group: 'Desna strana' },
  { code: 'glass_rr', label: 'Staklo stražnjih vrata desno', group: 'Desna strana' },
  { code: 'pillar_a_r', label: 'A stup desni', group: 'Desna strana' },
  { code: 'pillar_b_r', label: 'B stup desni', group: 'Desna strana' },
  { code: 'pillar_c_r', label: 'C stup desni', group: 'Desna strana' },
  { code: 'wheel_fr', label: 'Naplatak prednji desni', group: 'Desna strana' },
  { code: 'wheel_rr', label: 'Naplatak stražnji desni', group: 'Desna strana' },
  { code: 'roof', label: 'Krov', group: 'Krov i straga' },
  { code: 'rear_window', label: 'Stražnje staklo', group: 'Krov i straga' },
  { code: 'trunk', label: 'Prtljažnik / peta vrata', group: 'Krov i straga' },
  { code: 'rear_bumper', label: 'Stražnji branik', group: 'Krov i straga' },
  { code: 'taillight_l', label: 'Stop svjetlo lijevo', group: 'Krov i straga' },
  { code: 'taillight_r', label: 'Stop svjetlo desno', group: 'Krov i straga' },
  { code: 'wipers', label: 'Brisači', group: 'Ostalo' },
  { code: 'fuel_door', label: 'Poklopac spremnika', group: 'Ostalo' },
  { code: 'underbody', label: 'Podvozje', group: 'Ostalo' },
  { code: 'exhaust', label: 'Ispuh', group: 'Ostalo' },
  { code: 'interior', label: 'Unutrašnjost', group: 'Ostalo' },
  { code: 'dash', label: 'Instrument ploča', group: 'Ostalo' },
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
  product: 'Limar i lakirer',
  short: 'Limar i lakirer',
  domain: 'limar-lakirer.poslar.eu',
  tagline: 'Autolimarija, lakirnica i procjena štete',
  pitch: [
    'Mapa oštećenja: dodir panela, operacija i sati po fazi',
    'Lakirnica: šifra, receptura i grami, cilj i stvarno',
    'Zapisnik za osiguranje s fotografijama prije i poslije',
  ],
  sector: 'workshop',
  accent: '#FF6A00',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Vozilo', many: 'Vozila', new: 'Novo vozilo' },
    identifier: 'Registracija',
  },
  assetTypes: ['car', 'van', 'truck', 'motorcycle'],
  defaultAssetType: 'car',
  phaseLabels: { diagnosis: 'Procjena', in_progress: 'U proizvodnji', awaiting_approval: 'Čeka osiguranje' },
  quote: 'first',
  opening: { intake: 'Sljedeće: procjena štete i ponuda.', diagnosis: 'Sljedeće: karta oštećenja i lak.', tab: 'stavke', diagnosisTab: 'modul' },
  symptoms: ['Sudar', 'Parkiranje', 'Tuča', 'Divljač', 'Vandalizam', 'Korozija', 'Poliranje / zaštita'],
  photoTags: [
    ...COMMON_PHOTO_TAGS,
    { code: 'angle', label: 'Standardni kut' },
    { code: 'paint_code', label: 'Pločica boje' },
    { code: 'test_panel', label: 'Probna pločica' },
    { code: 'adas', label: 'ADAS kalibracija' },
  ],
  diagram: 'car',
  conditionZones: BODY_ZONES,
  equipment: ['Ključevi', 'Dokumenti vozila', 'Europsko izvješće o nezgodi', 'Polica osiguranja', 'Radio / ukrasne lajsne', 'Sadržaj prtljažnika', 'Registracijske ploče'],
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
    {
      code: 'body.bumper_repair',
      name: 'Popravak branika',
      lines: [
        { kind: 'labor', description: 'Popravak plastike branika', qty: 2, unit: 'h', price: 42 },
        { kind: 'material', description: 'Materijal za plastiku', qty: 1, unit: 'paušal', price: 25 },
      ],
    },
    {
      code: 'body.bumper_paint',
      name: 'Lakiranje branika',
      lines: [
        { kind: 'labor', description: 'Priprema i lakiranje branika', qty: 3, unit: 'h', price: 42 },
        { kind: 'material', description: 'Boja i lak', qty: 1, unit: 'paušal', price: 90 },
      ],
      inspection: 'body.pre_paint',
    },
    {
      code: 'body.door',
      name: 'Popravak i lakiranje vrata',
      lines: [
        { kind: 'labor', description: 'Ravnanje vrata', qty: 3, unit: 'h', price: 42 },
        { kind: 'labor', description: 'Priprema i lakiranje vrata', qty: 3, unit: 'h', price: 42 },
        { kind: 'material', description: 'Kit, boja i lak', qty: 1, unit: 'paušal', price: 130 },
      ],
      inspection: 'body.pre_paint',
    },
    {
      code: 'body.fender',
      name: 'Zamjena blatobrana',
      lines: [
        { kind: 'labor', description: 'Zamjena i lakiranje blatobrana', qty: 3, unit: 'h', price: 42 },
        { kind: 'part', description: 'Blatobran', qty: 1, unit: 'kom', price: 90 },
        { kind: 'material', description: 'Boja i lak', qty: 1, unit: 'paušal', price: 80 },
      ],
      inspection: 'body.pre_paint',
    },
    {
      code: 'body.spot',
      name: 'Ogrebotina (spot repair)',
      lines: [
        { kind: 'labor', description: 'Lokalni popravak ogrebotine', qty: 1.5, unit: 'h', price: 42 },
        { kind: 'material', description: 'Boja i lak', qty: 1, unit: 'paušal', price: 30 },
      ],
    },
    {
      code: 'body.windscreen',
      name: 'Vjetrobransko staklo',
      lines: [
        { kind: 'labor', description: 'Zamjena vjetrobranskog stakla', qty: 1.5, unit: 'h', price: 42 },
        { kind: 'part', description: 'Vjetrobransko staklo', qty: 1, unit: 'kom', price: 250 },
        { kind: 'material', description: 'Ljepilo i brtva', qty: 1, unit: 'paušal', price: 25 },
      ],
    },
    {
      code: 'body.headlights',
      name: 'Poliranje farova',
      lines: [
        { kind: 'labor', description: 'Poliranje i zaštita farova', qty: 0.8, unit: 'h', price: 40 },
        { kind: 'material', description: 'Paste i lak za farove', qty: 1, unit: 'paušal', price: 10 },
      ],
    },
    {
      code: 'body.rust',
      name: 'Sanacija hrđe',
      lines: [
        { kind: 'labor', description: 'Izrezivanje i varenje hrđavog dijela', qty: 4, unit: 'h', price: 42 },
        { kind: 'material', description: 'Lim, antikor, boja', qty: 1, unit: 'paušal', price: 60 },
      ],
    },
    {
      code: 'body.ceramic',
      name: 'Keramička zaštita',
      lines: [
        { kind: 'labor', description: 'Priprema laka i nanošenje keramike', qty: 4, unit: 'h', price: 40 },
        { kind: 'material', description: 'Keramički premaz', qty: 1, unit: 'kom', price: 80 },
      ],
    },
    {
      code: 'body.mirror',
      name: 'Retrovizor',
      lines: [
        { kind: 'labor', description: 'Zamjena stakla ili kućišta retrovizora', qty: 0.5, unit: 'h', price: 42 },
        { kind: 'part', description: 'Staklo ili kućište retrovizora', qty: 1, unit: 'kom', price: 50 },
      ],
    },
  ],
  modules: ['condition_report', 'approvals', 'body_damage', 'body_paint', 'body_insurance'],
  optionalModules: ['dvi'],
  moduleTab: 'Oštećenja i lak',
  modulePage: 'Proizvodnja',
};
