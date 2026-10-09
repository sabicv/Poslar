import type { InspectionTemplate, PackageConfig } from '../tenant.config';
import { ELECTRIC_ZONES } from './condition-zones';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

// Električar: home and small-business installations, switchboards, solar
// power plants and car chargers, on the field. The measurements of an
// installation test are written as numbers with limits, so the record for
// the customer (and the next visit) shows what was measured.

// Limits as an electrician reads them on site: insulation at least 1 MΩ
// (500 V), a 30 mA RCD trips within 300 ms, the protective conductor's
// continuity well under 1 Ω. The loop impedance limit depends on the
// breaker, so it only warns.
const measure: InspectionTemplate = {
  code: 'electric.measure',
  name: 'Ispitivanje instalacije',
  purpose: 'dvi',
  proposeTemplate: 'electric.test',
  sections: [
    {
      title: 'A · Mjerenja',
      items: [
        { code: 'a01', label: 'Otpor izolacije (500 V)', unit: 'MΩ', warnBelow: 2, critBelow: 1 },
        { code: 'a02', label: 'Neprekinutost zaštitnog vodiča', unit: 'Ω', warnAbove: 0.5, critAbove: 1 },
        { code: 'a03', label: 'Impedancija petlje kvara', unit: 'Ω', warnAbove: 1.5 },
        { code: 'a04', label: 'Otpor uzemljenja', unit: 'Ω', warnAbove: 10, critAbove: 30 },
        { code: 'a05', label: 'FID: vrijeme isklapanja', unit: 'ms', warnAbove: 200, critAbove: 300 },
        { code: 'a06', label: 'FID: struja isklapanja', unit: 'mA', warnAbove: 28, critAbove: 30 },
      ],
    },
    {
      title: 'B · Pregled',
      items: [
        { code: 'b01', label: 'Razvodni ormar označen i zatvoren' },
        { code: 'b02', label: 'Osigurači odgovaraju presjeku vodiča' },
        { code: 'b03', label: 'Utičnice i sklopke bez oštećenja' },
        { code: 'b04', label: 'Izjednačenje potencijala u kupaonici' },
        { code: 'b05', label: 'Fotografija razvodnog ormara' },
      ],
    },
  ],
};

const solar: InspectionTemplate = {
  code: 'electric.solar',
  name: 'Pregled sunčane elektrane',
  purpose: 'dvi',
  proposeTemplate: 'electric.solar',
  sections: [
    {
      title: 'Elektrana',
      items: [
        { code: 's01', label: 'Napon niza (string)', unit: 'V' },
        { code: 's02', label: 'Struja niza (string)', unit: 'A' },
        { code: 's03', label: 'Otpor izolacije DC strane', unit: 'MΩ', warnBelow: 2, critBelow: 1 },
        { code: 's04', label: 'Proizvodnja od zadnjeg pregleda', unit: 'kWh' },
        { code: 's05', label: 'Greške u memoriji izmjenjivača' },
        { code: 's06', label: 'Paneli čisti, bez pukotina i vrućih točaka' },
        { code: 's07', label: 'Konektori i kabeli bez oštećenja' },
        { code: 's08', label: 'DC rastavljač i prenaponska zaštita' },
      ],
    },
  ],
};

export const electric: PackageConfig = {
  id: 'electric',
  product: 'Električar',
  short: 'Električar',
  domain: 'elektricar.poslar.eu',
  tagline: 'Instalacije, razvodni ormari, sunčane elektrane i punjači',
  pitch: ['Zapisnik mjerenja s granicama, za mušteriju i sljedeći dolazak', 'Raspored dana, navigacija i poruka „Na putu” jednim dodirom', 'Pregled sunčane elektrane sam se ponudi kad dođe rok'],
  sector: 'field',
  accent: '#1CA7DD',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Instalacija', many: 'Instalacije', new: 'Nova instalacija' },
    identifier: 'Oznaka',
  },
  assetTypes: ['electrical', 'switchboard', 'solar_pv', 'ev_charger'],
  defaultAssetType: 'electrical',
  phaseLabels: { intake: 'Novi zahtjev', diagnosis: 'Zakazano', in_progress: 'Na terenu', ready: 'Odrađeno', collected: 'Zatvoreno' },
  symptoms: ['Nema struje', 'Iskače osigurač', 'Iskače FID sklopka', 'Nova utičnica ili prekidač', 'Rasvjeta', 'Ispitivanje instalacije', 'Punjač za auto', 'Sunčana elektrana', 'Razvodni ormar'],
  photoTags: [{ code: 'before', label: 'Prije' }, { code: 'after', label: 'Poslije' }, { code: 'board', label: 'Razvodni ormar' }, { code: 'meter_reading', label: 'Mjerni instrument' }, ...COMMON_PHOTO_TAGS],
  diagram: 'car',
  conditionZones: ELECTRIC_ZONES,
  equipment: ['Ključ ormara', 'Shema razvoda', 'Oznake krugova'],
  inspections: [
    measure,
    solar,
    checklist('electric.fault', 'Traženje kvara', 'checklist', 'Redom', [
      'Koji strujni krug ispada i kada',
      'Potrošači isključeni jedan po jedan',
      'Otpor izolacije sumnjivog kruga izmjeren',
      'Spojevi u kutijama i utičnicama provjereni',
      'Mjesto kvara fotografirano',
    ]),
    checklist('electric.handover', 'Završetak radova', 'checklist', 'Prije odlaska', [
      'Svi strujni krugovi uključeni i provjereni',
      'Oznake u razvodnom ormaru dopisane',
      'Otpad i stari materijal odneseni',
      'Mušterija zna gdje je glavna sklopka',
    ]),
  ],
  templates: [
    { code: 'electric.visit', name: 'Izlazak na intervenciju', lines: [{ kind: 'fee', description: 'Izlazak na intervenciju', qty: 1, unit: 'paušal', price: 30 }] },
    { code: 'electric.night', name: 'Hitno noću ili vikendom', lines: [{ kind: 'fee', description: 'Dodatak za hitnu intervenciju (noć, vikend, blagdan)', qty: 1, unit: 'paušal', price: 40 }] },
    { code: 'electric.hour', name: 'Sat rada', lines: [{ kind: 'labor', description: 'Elektroinstalaterski radovi', qty: 1, unit: 'h', price: 35 }] },
    { code: 'electric.fault', name: 'Traženje kvara', lines: [{ kind: 'labor', description: 'Traženje kvara u instalaciji', qty: 1.5, unit: 'h', price: 40 }], inspection: 'electric.fault' },
    {
      code: 'electric.socket',
      name: 'Nova utičnica',
      lines: [
        { kind: 'labor', description: 'Ugradnja utičnice', qty: 0.7, unit: 'h', price: 35 },
        { kind: 'part', description: 'Utičnica s okvirom', qty: 1, unit: 'kom', price: 12 },
        { kind: 'material', description: 'Kabel i sitni materijal', qty: 1, unit: 'paušal', price: 8 },
      ],
    },
    { code: 'electric.light', name: 'Montaža rasvjetnog tijela', lines: [{ kind: 'labor', description: 'Montaža i spajanje rasvjetnog tijela', qty: 0.7, unit: 'h', price: 35 }] },
    {
      code: 'electric.rcd',
      name: 'Ugradnja FID sklopke',
      lines: [
        { kind: 'labor', description: 'Ugradnja FID sklopke u razvodni ormar', qty: 1, unit: 'h', price: 35 },
        { kind: 'part', description: 'FID sklopka 40 A / 30 mA', qty: 1, unit: 'kom', price: 45 },
      ],
      inspection: 'electric.measure',
    },
    { code: 'electric.test', name: 'Ispitivanje instalacije sa zapisnikom', lines: [{ kind: 'package', description: 'Ispitivanje električne instalacije sa zapisnikom', qty: 1, unit: 'paušal', price: 120 }], inspection: 'electric.measure' },
    {
      code: 'electric.charger',
      name: 'Montaža punjača za auto',
      lines: [
        { kind: 'package', description: 'Montaža i spajanje kućnog punjača za električni auto', qty: 1, unit: 'paušal', price: 250 },
        { kind: 'material', description: 'Kabel, zaštita i sitni materijal', qty: 1, unit: 'paušal', price: 60 },
      ],
      inspection: 'electric.measure',
    },
    { code: 'electric.solar', name: 'Pregled sunčane elektrane', lines: [{ kind: 'package', description: 'Godišnji pregled sunčane elektrane s mjerenjima', qty: 1, unit: 'paušal', price: 150 }], inspection: 'electric.solar' },
  ],
  modules: ['dvi', 'condition_report', 'approvals', 'field_visits', 'maintenance_plans'],
  optionalModules: [],
  moduleTab: 'Instalacija i plan',
  modulePage: 'Servisni planovi',
  plan: {
    title: 'Godišnji pregled',
    template: 'electric.solar',
    months: 12,
    hint: 'Servisni plan (npr. pregled sunčane elektrane svake godine) uključuje se na nalogu, kartica „Instalacija i plan”. Mušterija se ovdje pojavi mjesec dana prije roka.',
  },
};
