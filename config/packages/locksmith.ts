import type { PackageConfig } from '../tenant.config';
import { LOCKSMITH_ZONES } from './condition-zones';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

// Bravar: locked out, broken keys, new cylinders and safety locks, safes.
// Most calls come at night or at the weekend, so Poslar on the phone and
// the night supplement matter most. An opening is written down with how
// the person proved they may enter, which protects the locksmith.

export const locksmith: PackageConfig = {
  id: 'locksmith',
  product: 'Bravar',
  short: 'Bravar',
  domain: 'bravar.poslar.eu',
  tagline: 'Hitna otvaranja, cilindri, sigurnosne brave i sefovi',
  pitch: ['Zapisnik otvaranja: tko je otvorio i kako je dokazao pravo ulaska', 'Noćni i vikend dodatak sam na nalogu', 'Poslar na telefonu preuzme poziv i u tri ujutro'],
  sector: 'field',
  accent: '#1CA7DD',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Vrata ili sef', many: 'Vrata i sefovi', new: 'Nova vrata ili sef' },
    identifier: 'Oznaka',
  },
  assetTypes: ['door_lock', 'safe'],
  defaultAssetType: 'door_lock',
  phaseLabels: { intake: 'Novi poziv', diagnosis: 'Na putu', in_progress: 'Na terenu', ready: 'Odrađeno', collected: 'Zatvoreno' },
  skipPhases: ['awaiting_parts', 'quality_check'],
  symptoms: ['Zaključan sam vani', 'Slomljen ključ u bravi', 'Zamjena cilindra', 'Sigurnosna brava', 'Popravak brave', 'Otvaranje sefa', 'Izrada ključa', 'Brava zapinje'],
  photoTags: [{ code: 'before', label: 'Prije' }, { code: 'after', label: 'Poslije' }, { code: 'id_check', label: 'Dokaz prava ulaska' }, ...COMMON_PHOTO_TAGS],
  diagram: 'car',
  conditionZones: LOCKSMITH_ZONES,
  equipment: ['Ključevi predani', 'Stari cilindar', 'Kartice / transponderi', 'Dokaz prava ulaska'],
  inspections: [
    checklist('locksmith.opening', 'Zapisnik otvaranja', 'checklist', 'Prije i poslije otvaranja', [
      'Osobna iskaznica pregledana (ime i adresa)',
      'Pravo ulaska dokazano (adresa na osobnoj, ugovor o najmu, vlasnik na telefonu)',
      'Fotografija vrata prije otvaranja',
      'Način otvaranja zapisan (bez oštećenja, cilindar razbijen…)',
      'Fotografija nakon otvaranja',
      'Mušterija potpisala zapisnik',
    ], 'locksmith.open'),
    checklist('locksmith.install', 'Ugradnja brave', 'checklist', 'Ugradnja', [
      'Mjere cilindra izmjerene (vani i unutra)',
      'Razred zaštite cilindra zapisan',
      'Svi ključevi predani, broj ključeva zapisan',
      'Kartica za izradu dodatnih ključeva predana',
      'Brava isprobana s oba ključa',
    ]),
  ],
  templates: [
    { code: 'locksmith.open', name: 'Hitno otvaranje vrata', lines: [{ kind: 'package', description: 'Otvaranje zaključanih vrata bez oštećenja', qty: 1, unit: 'paušal', price: 60 }], inspection: 'locksmith.opening' },
    { code: 'locksmith.night', name: 'Noću, vikendom, blagdanom', lines: [{ kind: 'fee', description: 'Dodatak za noć, vikend ili blagdan', qty: 1, unit: 'paušal', price: 40 }] },
    { code: 'locksmith.visit', name: 'Izlazak', lines: [{ kind: 'fee', description: 'Izlazak na adresu', qty: 1, unit: 'paušal', price: 25 }] },
    {
      code: 'locksmith.cylinder',
      name: 'Zamjena cilindra',
      lines: [
        { kind: 'labor', description: 'Zamjena cilindra', qty: 0.5, unit: 'h', price: 35 },
        { kind: 'part', description: 'Cilindar s 3 ključa', qty: 1, unit: 'kom', price: 35 },
      ],
      inspection: 'locksmith.install',
    },
    {
      code: 'locksmith.security',
      name: 'Sigurnosni cilindar',
      lines: [
        { kind: 'labor', description: 'Ugradnja sigurnosnog cilindra', qty: 0.5, unit: 'h', price: 35 },
        { kind: 'part', description: 'Sigurnosni cilindar s karticom i 5 ključeva', qty: 1, unit: 'kom', price: 95 },
      ],
      inspection: 'locksmith.install',
    },
    {
      code: 'locksmith.broken_key',
      name: 'Vađenje slomljenog ključa',
      lines: [{ kind: 'labor', description: 'Vađenje slomljenog ključa iz brave', qty: 0.5, unit: 'h', price: 40 }],
    },
    {
      code: 'locksmith.lock',
      name: 'Ugradnja brave',
      lines: [
        { kind: 'labor', description: 'Ugradnja ili zamjena brave', qty: 1, unit: 'h', price: 35 },
        { kind: 'part', description: 'Brava', qty: 1, unit: 'kom', price: 30 },
      ],
      inspection: 'locksmith.install',
    },
    { code: 'locksmith.key', name: 'Izrada ključa', lines: [{ kind: 'part', description: 'Izrada ključa', qty: 1, unit: 'kom', price: 8 }] },
    { code: 'locksmith.safe', name: 'Otvaranje sefa', lines: [{ kind: 'package', description: 'Otvaranje sefa', qty: 1, unit: 'paušal', price: 150 }], inspection: 'locksmith.opening' },
  ],
  modules: ['dvi', 'condition_report', 'approvals', 'field_visits', 'maintenance_plans'],
  optionalModules: [],
  moduleTab: 'Vrata i povijest',
  modulePage: 'Servisni planovi',
  plan: {
    title: 'Servis protupaničnih okova',
    template: 'locksmith.lock',
    months: 12,
    hint: 'Za tvrtke i zgrade: godišnji servis brava i protupaničnih okova uključuje se na nalogu, kartica „Vrata i povijest”. Mušterija se ovdje pojavi mjesec dana prije roka.',
  },
};
