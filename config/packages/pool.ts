import type { InspectionTemplate, PackageConfig } from '../tenant.config';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

// Održavanje bazena: weekly water chemistry on site. The numbers decide
// the colour (pH and free chlorine have limits), and finishing the test
// proposes the weekly service line for the owner to confirm.

const water: InspectionTemplate = {
  code: 'pool.water',
  name: 'Mjerenje vode',
  purpose: 'dvi',
  proposeTemplate: 'pool.weekly',
  sections: [
    {
      title: 'A · Kemija vode',
      items: [
        { code: 'a01', label: 'pH', unit: '', warnBelow: 7.2, critBelow: 7.0, warnAbove: 7.6, critAbove: 7.8 },
        { code: 'a02', label: 'Slobodni klor', unit: 'mg/l', warnBelow: 0.5, critBelow: 0.3, warnAbove: 1.5, critAbove: 3 },
        { code: 'a03', label: 'Kombinirani klor', unit: 'mg/l', warnAbove: 0.4, critAbove: 0.8 },
        { code: 'a04', label: 'Cijanurna kiselina', unit: 'mg/l', warnAbove: 70, critAbove: 100 },
        { code: 'a05', label: 'Temperatura vode', unit: '°C' },
        { code: 'a06', label: 'Bistra voda, bez algi' },
      ],
    },
    {
      title: 'B · Postrojenje',
      items: [
        { code: 'b01', label: 'Filter ispran / tlak u granicama' },
        { code: 'b02', label: 'Skimer i košara očišćeni' },
        { code: 'b03', label: 'Pumpa radi, nema curenja' },
        { code: 'b04', label: 'Razina vode u redu' },
        { code: 'b05', label: 'Fotografija vode i uređaja' },
      ],
    },
  ],
};

export const pool: PackageConfig = {
  id: 'pool',
  product: 'Održavanje bazena',
  short: 'Bazeni',
  domain: 'bazeni.poslar.eu',
  tagline: 'pH, klor i tjedni obilazak na jednom nalogu',
  pitch: [
    'Mjerenje pH i klora s granicama, za vlasnika i sljedeći dolazak',
    'Tjedni obilazak sam se ponudi kad dođe rok',
    'Raspored dana, navigacija i poruka „Na putu” jednim dodirom',
  ],
  sector: 'field',
  accent: '#1CA7DD',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Bazen', many: 'Bazeni', new: 'Novi bazen' },
    identifier: 'Oznaka',
  },
  assetTypes: ['swimming_pool', 'pool_plant'],
  defaultAssetType: 'swimming_pool',
  phaseLabels: { intake: 'Novi poziv', diagnosis: 'Zakazano', in_progress: 'Na terenu', ready: 'Odrađeno', collected: 'Zatvoreno' },
  skipPhases: ['awaiting_parts', 'quality_check'],
  symptoms: ['Tjedni servis', 'Mutna voda', 'Zelene alge', 'pH visok', 'Nema klora', 'Filter zapinje', 'Pumpa ne vuče', 'Curenje', 'Otvaranje sezone', 'Zatvaranje sezone'],
  photoTags: [{ code: 'before', label: 'Prije' }, { code: 'after', label: 'Poslije' }, { code: 'water', label: 'Voda' }, { code: 'plant', label: 'Strojarnica' }, ...COMMON_PHOTO_TAGS],
  diagram: 'car',
  equipment: [],
  inspections: [
    water,
    checklist('pool.open', 'Otvaranje sezone', 'checklist', 'Prije punjenja', [
      'Plahta skinuta, zidovi očišćeni',
      'Filter i pumpa isprani i spojeni',
      'Sredstva za start (šok klor, pH minus) spremna',
      'Prvo mjerenje vode upisano',
      'Fotografija napunjenog bazena',
    ]),
    checklist('pool.close', 'Zatvaranje sezone', 'checklist', 'Prije zime', [
      'Voda spuštena ispod skimmera',
      'Cijevi ispuhane, čepovi postavljeni',
      'Pumpa i filter ispražnjeni',
      'Zimsko sredstvo dodano',
      'Plahta nategnuta',
    ]),
  ],
  templates: [
    { code: 'pool.visit', name: 'Izlazak', lines: [{ kind: 'fee', description: 'Izlazak na adresu', qty: 1, unit: 'paušal', price: 20 }] },
    {
      code: 'pool.weekly',
      name: 'Tjedni servis bazena',
      lines: [{ kind: 'package', description: 'Tjedni servis: mjerenje, kemija, čišćenje skimmera i pregled filtera', qty: 1, unit: 'paušal', price: 45 }],
      inspection: 'pool.water',
    },
    {
      code: 'pool.shock',
      name: 'Šok kloriranje',
      lines: [
        { kind: 'labor', description: 'Šok kloriranje i podešavanje pH', qty: 0.7, unit: 'h', price: 35 },
        { kind: 'material', description: 'Šok klor', qty: 1, unit: 'kg', price: 12 },
      ],
      inspection: 'pool.water',
    },
    {
      code: 'pool.filter',
      name: 'Pranje filtera',
      lines: [{ kind: 'labor', description: 'Povratno pranje filtera i provjera tlaka', qty: 0.5, unit: 'h', price: 35 }],
    },
    {
      code: 'pool.algae',
      name: 'Uklanjanje algi',
      lines: [
        { kind: 'labor', description: 'Četkanje, usis i tretman algi', qty: 1.5, unit: 'h', price: 35 },
        { kind: 'material', description: 'Algecid i šok klor', qty: 1, unit: 'paušal', price: 18 },
      ],
    },
    { code: 'pool.open', name: 'Otvaranje sezone', lines: [{ kind: 'package', description: 'Otvaranje bazena: čišćenje, spajanje, start kemija', qty: 1, unit: 'paušal', price: 180 }], inspection: 'pool.open' },
    { code: 'pool.close', name: 'Zatvaranje sezone', lines: [{ kind: 'package', description: 'Zatvaranje bazena za zimu', qty: 1, unit: 'paušal', price: 160 }], inspection: 'pool.close' },
    { code: 'pool.hour', name: 'Sat rada', lines: [{ kind: 'labor', description: 'Radovi na bazenu', qty: 1, unit: 'h', price: 35 }] },
  ],
  modules: ['dvi', 'approvals', 'field_visits', 'maintenance_plans'],
  optionalModules: [],
  moduleTab: 'Bazen i plan',
  modulePage: 'Servisni planovi',
  plan: {
    title: 'Tjedni obilazak',
    template: 'pool.weekly',
    months: 1,
    hint: 'Tjedni servis uključuje se na nalogu, kartica „Bazen i plan”. Mušterija se ovdje pojavi pred sljedećim dolaskom. Pravi tjedni ritam dolazi s tjednim posjetima.',
  },
};
