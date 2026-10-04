import type { PackageConfig } from '../tenant.config';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

export const volt: PackageConfig = {
  id: 'volt',
  product: 'TaktiX Autoelektričar',
  short: 'Autoelektričar',
  domain: 'voltfiles.hr',
  tagline: 'Autoelektrika, dijagnostika i elektronika',
  pitch: [
    'DTC kodovi s uzrocima i riješenim slučajevima iz tvoje arhive',
    'Parazitska potrošnja s grafom pada struje',
    'Trajni dnevnik zahvata na modulima s backupom',
  ],
  sector: 'workshop',
  accent: '#FFD60A',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Vozilo', many: 'Vozila', new: 'Novo vozilo' },
    identifier: 'Registracija',
  },
  assetTypes: ['car', 'van', 'truck', 'bus', 'motorcycle'],
  defaultAssetType: 'car',
  phaseLabels: { diagnosis: 'Dijagnostika', in_progress: 'Popravak u tijeku' },
  symptoms: [
    'Akumulator se prazni',
    'Ne pali / verglanje',
    'Lampica na armaturi',
    'Ne puni (alternator)',
    'Svjetla ili signalizacija',
    'Podizači, centralno, komfor',
    'Ključ / imobilizator',
    'Klima ne radi',
    'Naknadna ugradnja opreme',
  ],
  photoTags: [
    ...COMMON_PHOTO_TAGS,
    { code: 'dtc_screen', label: 'Zaslon dijagnostike' },
    { code: 'wiring', label: 'Instalacija' },
    { code: 'scope', label: 'Valni oblik (osciloskop)' },
  ],
  diagram: 'car',
  equipment: ['Ključevi', 'Daljinski', 'Dokumenti vozila', 'Punjač / kabel'],
  inspections: [
    checklist('volt.diag_protocol', 'Dijagnostički protokol', 'checklist', 'Koraci dijagnostike', [
      'Napon akumulatora ≥ 12,4 V prije dijagnostike, inače punjač',
      'Početno skeniranje svih modula, izvještaj spremljen',
      'Freeze frame zapisan za svaki aktivni kod',
      'Vizualni pregled konektora i mase modula s kodom',
      'Mjerenje prema testovima prije zamjene dijela',
      'Uzrok potvrđen mjerenjem, ne samo kodom',
      'Popravak i brisanje kodova',
      'Probna vožnja ili ciklus pripreme',
      'Kontrolno skeniranje, nema novih kodova',
      'Zaključak i preporuke upisani za zapisnik stranke',
    ]),
    checklist('volt.pre_write', 'Prije zapisa u modul', 'checklist', 'Programiranje, remap, IMMO', [
      'Stabilizator napona spojen, ≥ 13,5 V',
      'Backup originalne datoteke spremljen u arhivu naloga',
      'SW i HW verzija zapisana',
      'Potrošači isključeni, vrata zatvorena, ključ u vozilu',
      'Kabel i sučelje provjereni',
      'Mušterija upoznata i odobrila zahvat',
      'Nakon zapisa: adaptacije, brisanje kodova, kontrolno skeniranje',
      'Probna vožnja i očitanje parametara',
    ]),
    checklist('volt.drain', 'Parazitska potrošnja', 'checklist', 'Postupak mjerenja', [
      'Akumulator napunjen, sve zatvoreno, ključ izvan dosega',
      'Prekidač poklopca motora premošten',
      'Početno očitanje odmah nakon zaključavanja',
      'Očitanja do spavanja sabirnica',
      'Iznad cilja nakon spavanja: osigurači jedan po jedan',
      'Krug i modul krivac zapisani',
      'Kontrolno mjerenje nakon popravka',
    ]),
  ],
  templates: [
    {
      code: 'volt.diag',
      name: 'Dijagnostika elektrike',
      lines: [{ kind: 'labor', description: 'Dijagnostika elektroničkih sustava', qty: 1, unit: 'h', price: 55 }],
      inspection: 'volt.diag_protocol',
    },
    {
      code: 'volt.battery',
      name: 'Test akumulatora i punjenja',
      lines: [{ kind: 'labor', description: 'Test akumulatora, anlasera i alternatora', qty: 0.5, unit: 'h', price: 55 }],
    },
    {
      code: 'volt.drain',
      name: 'Mjerenje parazitske potrošnje',
      lines: [{ kind: 'labor', description: 'Mjerenje i lociranje parazitske potrošnje', qty: 2, unit: 'h', price: 55 }],
      inspection: 'volt.drain',
    },
    {
      code: 'volt.key',
      name: 'Programiranje ključa',
      lines: [
        { kind: 'labor', description: 'Programiranje ključa', qty: 1, unit: 'h', price: 65 },
        { kind: 'part', description: 'Ključ s transponderom', qty: 1, unit: 'kom', price: 90 },
      ],
      inspection: 'volt.pre_write',
    },
    {
      code: 'volt.coding',
      name: 'Kodiranje / adaptacija modula',
      lines: [{ kind: 'labor', description: 'Kodiranje i adaptacija modula', qty: 0.5, unit: 'h', price: 65 }],
      inspection: 'volt.pre_write',
    },
    {
      code: 'volt.battery_swap',
      name: 'Zamjena akumulatora',
      lines: [
        { kind: 'labor', description: 'Zamjena akumulatora i registracija u vozilu', qty: 0.5, unit: 'h', price: 55 },
        { kind: 'part', description: 'Akumulator', qty: 1, unit: 'kom', price: 110 },
      ],
    },
    {
      code: 'volt.alternator',
      name: 'Zamjena alternatora',
      lines: [
        { kind: 'labor', description: 'Demontaža i montaža alternatora', qty: 1.5, unit: 'h', price: 55 },
        { kind: 'part', description: 'Alternator', qty: 1, unit: 'kom', price: 220 },
      ],
    },
    {
      code: 'volt.starter',
      name: 'Zamjena anlasera',
      lines: [
        { kind: 'labor', description: 'Demontaža i montaža anlasera', qty: 1.5, unit: 'h', price: 55 },
        { kind: 'part', description: 'Anlaser', qty: 1, unit: 'kom', price: 180 },
      ],
    },
    {
      code: 'volt.glow_plugs',
      name: 'Zamjena grijača',
      lines: [
        { kind: 'labor', description: 'Zamjena grijača motora', qty: 1.2, unit: 'h', price: 55 },
        { kind: 'part', description: 'Grijač', qty: 4, unit: 'kom', price: 18 },
      ],
    },
    {
      code: 'volt.bulbs',
      name: 'Žarulje i svjetla',
      lines: [
        { kind: 'labor', description: 'Zamjena žarulja', qty: 0.3, unit: 'h', price: 55 },
        { kind: 'part', description: 'Žarulja', qty: 2, unit: 'kom', price: 8 },
      ],
    },
    { code: 'volt.headlight_aim', name: 'Podešavanje svjetala', lines: [{ kind: 'labor', description: 'Podešavanje snopa prednjih svjetala', qty: 0.3, unit: 'h', price: 55 }] },
    {
      code: 'volt.wiring',
      name: 'Popravak instalacije',
      lines: [
        { kind: 'labor', description: 'Popravak kabela i konektora', qty: 1, unit: 'h', price: 55 },
        { kind: 'material', description: 'Konektori, kabel, termo bužir', qty: 1, unit: 'paušal', price: 10 },
      ],
    },
    {
      code: 'volt.window',
      name: 'Podizač stakla',
      lines: [
        { kind: 'labor', description: 'Zamjena podizača stakla', qty: 1, unit: 'h', price: 55 },
        { kind: 'part', description: 'Podizač stakla', qty: 1, unit: 'kom', price: 70 },
      ],
    },
    {
      code: 'volt.central_lock',
      name: 'Centralno zaključavanje',
      lines: [
        { kind: 'labor', description: 'Dijagnostika i popravak centralnog zaključavanja', qty: 1, unit: 'h', price: 55 },
        { kind: 'part', description: 'Motor brave', qty: 1, unit: 'kom', price: 60 },
      ],
    },
    {
      code: 'volt.parking_sensors',
      name: 'Parking senzori',
      lines: [
        { kind: 'labor', description: 'Zamjena parking senzora', qty: 0.8, unit: 'h', price: 55 },
        { kind: 'part', description: 'Parking senzor', qty: 1, unit: 'kom', price: 35 },
      ],
    },
  ],
  modules: ['condition_report', 'approvals', 'volt_diagnostics', 'dvi'],
  optionalModules: ['service_plan', 'parts', 'field_visits'],
  moduleTab: 'Dijagnostika',
  modulePage: 'Kodovi i slučajevi',
};
