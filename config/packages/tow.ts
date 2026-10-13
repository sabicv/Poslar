import type { PackageConfig } from '../tenant.config';
import { TOW_ZONES } from './condition-zones';
import { checklist } from './shared';

export const TOW_SERVICES: Record<string, string> = {
  tow: 'Vuča',
  jump_start: 'Pokretanje (akumulator)',
  wheel_change: 'Zamjena kotača',
  unlock: 'Otključavanje',
  fuel: 'Dovoz goriva',
  winch: 'Izvlačenje vitlom',
  transport: 'Prijevoz vozila',
  other: 'Ostalo',
};

export const TOW_PAYERS: Record<string, string> = {
  private: 'Vozač plaća',
  insurance: 'Osiguranje',
  assistance: 'Asistencija',
  company: 'Tvrtka',
  police: 'Policija / grad',
};

// Steps of a call, in order. Arrival also stores where the phone was.
export const TOW_STEPS = [
  { key: 'departed_at', label: 'Krenuo' },
  { key: 'arrived_at', label: 'Stigao', gps: true },
  { key: 'loaded_at', label: 'Utovareno' },
  { key: 'delivered_at', label: 'Predano' },
] as const;

// Days on the yard, counted the way yards charge: every started day.
export function storageDays(inAt: string, outAt: string | null, now = new Date()): number {
  const end = outAt ? new Date(outAt) : now;
  return Math.max(1, Math.ceil((end.getTime() - new Date(inAt).getTime()) / 86400000));
}

export const tow: PackageConfig = {
  id: 'tow',
  product: 'Vučna služba',
  short: 'Vučna služba',
  domain: 'vucna-sluzba.poslar.eu',
  tagline: 'Vuča vozila i pomoć na cesti',
  pitch: [
    'Poziv, lokacija i navigacija odmah, i u tri ujutro',
    'Fotografije pri utovaru štite te od lažnih šteta',
    'Kilometri, ležarina i broj slučaja za asistenciju na jednom mjestu',
  ],
  sector: 'workshop',
  accent: '#E3FF00',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Vozilo', many: 'Vozila', new: 'Novo vozilo' },
    identifier: 'Registracija',
  },
  assetTypes: ['car', 'van', 'motorcycle', 'truck', 'bus', 'trailer', 'machine'],
  defaultAssetType: 'car',
  phaseLabels: {
    intake: 'Poziv',
    diagnosis: 'Na putu',
    awaiting_approval: 'Čeka odobrenje',
    // A waiting state: chosen on purpose for a car left on the yard, never
    // the automatic next step after a tow.
    awaiting_parts: 'Na placu',
    in_progress: 'Vuča u tijeku',
    ready: 'Predano',
    collected: 'Zatvoreno',
  },
  skipPhases: ['quality_check'],
  quote: 'never',
  opening: { intake: 'Sljedeće: krenite na intervenciju.', tab: 'modul' },
  symptoms: ['Ne pali', 'Prometna nezgoda', 'Pukla guma', 'Prazan akumulator', 'Nestalo goriva', 'Ključevi zaključani u vozilu', 'Izvlačenje iz jarka', 'Prijevoz vozila', 'Premještanje vozila (pauk)'],
  photoTags: [
    { code: 'pickup', label: 'Na mjestu preuzimanja' },
    { code: 'damage', label: 'Postojeće oštećenje' },
    { code: 'loaded', label: 'Utovareno' },
    { code: 'delivered', label: 'Pri predaji' },
    { code: 'meter', label: 'Kilometraža' },
    { code: 'document', label: 'Dokument / nalog asistencije' },
  ],
  diagram: 'car',
  conditionZones: TOW_ZONES,
  marks: [
    { code: 'O', label: 'Ogrebotina' },
    { code: 'U', label: 'Udubljenje' },
    { code: 'P', label: 'Pukotina' },
    { code: 'L', label: 'Razbijeno' },
    { code: 'B', label: 'Savijeno' },
    { code: 'K', label: 'Kamenčić' },
    { code: 'T', label: 'Trag vezanja / vitla' },
    { code: 'N', label: 'Nedostaje' },
    { code: 'D', label: 'Kvar / defekt / neispravno' },
  ],
  equipment: ['Ključevi', 'Prometna dozvola', 'Rezervni kotač', 'Stvari u vozilu', 'Dječja sjedalica', 'Registracijske ploče'],
  inspections: [
    checklist('tow.pickup', 'Preuzimanje vozila', 'checklist', 'Prije utovara', [
      'Fotografije sa sve četiri strane',
      'Postojeća oštećenja pokazana vozaču',
      'Ključevi i dokumenti preuzeti',
      'Stvari u vozilu popisane',
      'Vozilo vezano trakama u četiri točke',
      'Rotacija i svjetla upaljeni',
    ]),
    checklist('tow.delivery', 'Predaja vozila', 'checklist', 'Pri istovaru', [
      'Fotografije pri istovaru',
      'Ključevi i dokumenti predani',
      'Primatelj potpisao',
      'Kilometraža upisana',
    ]),
  ],
  templates: [
    { code: 'tow.city', name: 'Vuča u gradu', lines: [{ kind: 'package', description: 'Vuča vozila u gradu (do 15 km)', qty: 1, unit: 'paušal', price: 60 }], inspection: 'tow.pickup' },
    {
      code: 'tow.km',
      name: 'Vuča izvan grada',
      lines: [
        { kind: 'fee', description: 'Izlazak vučnog vozila', qty: 1, unit: 'paušal', price: 40 },
        { kind: 'package', description: 'Vuča vozila', qty: 0, unit: 'km', price: 1.3 },
      ],
      inspection: 'tow.pickup',
    },
    { code: 'tow.motorway', name: 'Vuča s autoceste', lines: [{ kind: 'package', description: 'Vuča vozila s autoceste', qty: 1, unit: 'paušal', price: 120 }], inspection: 'tow.pickup' },
    { code: 'tow.jump', name: 'Pokretanje vozila', lines: [{ kind: 'package', description: 'Pokretanje vozila s praznim akumulatorom', qty: 1, unit: 'paušal', price: 35 }] },
    { code: 'tow.wheel', name: 'Zamjena kotača na cesti', lines: [{ kind: 'package', description: 'Zamjena kotača na mjestu kvara', qty: 1, unit: 'paušal', price: 40 }] },
    { code: 'tow.unlock', name: 'Otključavanje vozila', lines: [{ kind: 'package', description: 'Otključavanje vozila bez oštećenja', qty: 1, unit: 'paušal', price: 45 }] },
    {
      code: 'tow.fuel',
      name: 'Dovoz goriva',
      lines: [
        { kind: 'package', description: 'Dovoz goriva', qty: 1, unit: 'paušal', price: 35 },
        { kind: 'material', description: 'Gorivo', qty: 10, unit: 'l', price: 1.5 },
      ],
    },
    { code: 'tow.winch', name: 'Izvlačenje vitlom', lines: [{ kind: 'labor', description: 'Izvlačenje vozila vitlom', qty: 1, unit: 'h', price: 70 }] },
    { code: 'tow.wait', name: 'Čekanje na mjestu', lines: [{ kind: 'fee', description: 'Čekanje na mjestu', qty: 1, unit: 'h', price: 25 }] },
    { code: 'tow.night', name: 'Noćni ili vikend dodatak', lines: [{ kind: 'fee', description: 'Dodatak za noć, vikend ili blagdan', qty: 1, unit: 'paušal', price: 30 }] },
    { code: 'tow.storage', name: 'Ležarina', lines: [{ kind: 'fee', description: 'Ležarina na placu', qty: 1, unit: 'dan', price: 10 }] },
  ],
  modules: ['dvi', 'condition_report'],
  optionalModules: [],
  moduleTab: 'Poziv i vuča',
  modulePage: 'Pozivi i plac',
};
