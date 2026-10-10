import type { InspectionTemplate, PackageConfig } from '../tenant.config';
import { CLEAN_ZONES } from './condition-zones';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

// Čišćenje apartmana i ureda: turnover between guests, and a regular
// office clean. The checklist is the record the owner and the next
// cleaner see; finishing it proposes the priced turnover line.

const turnover: InspectionTemplate = {
  code: 'clean.turnover',
  name: 'Smjena između gostiju',
  purpose: 'checklist',
  proposeTemplate: 'clean.turnover',
  sections: [
    {
      title: 'A · Jedinica',
      items: [
        { code: 'a01', label: 'Kreveti presvučeni, rublje u vreći' },
        { code: 'a02', label: 'Kupaonica očišćena, potrošni materijal nadopunjen' },
        { code: 'a03', label: 'Kuhinja: sudoper, ploča, hladnjak, pod' },
        { code: 'a04', label: 'Podovi usisani i obrisani' },
        { code: 'a05', label: 'Smeće odneseno, vreće nove' },
        { code: 'a06', label: 'Terasa / balkon pometen' },
      ],
    },
    {
      title: 'B · Prije predaje',
      items: [
        { code: 'b01', label: 'Inventar pregledan (nema nestalog)' },
        { code: 'b02', label: 'Štete zabilježene i fotografirane' },
        { code: 'b03', label: 'Ključevi / kartice na mjestu' },
        { code: 'b04', label: 'Fotografija gotove jedinice' },
        { code: 'b05', label: 'Vlasnik ili recepcija obaviješteni' },
      ],
    },
  ],
};

export const clean: PackageConfig = {
  id: 'clean',
  product: 'Čišćenje apartmana',
  short: 'Apartmani',
  domain: 'apartmani.poslar.eu',
  tagline: 'Smjene između gostiju i redovno čišćenje ureda',
  pitch: [
    'Zapisnik smjene: kreveti, kupaonica, inventar i slike prije predaje',
    'Raspored dana, navigacija i poruka „Na putu” jednim dodirom',
    'Redovno čišćenje ureda sam se ponudi kad dođe rok',
  ],
  sector: 'field',
  accent: '#1CA7DD',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Jedinica', many: 'Jedinice', new: 'Nova jedinica' },
    identifier: 'Oznaka',
  },
  assetTypes: ['apartment_unit', 'holiday_unit', 'office_unit'],
  defaultAssetType: 'apartment_unit',
  phaseLabels: { intake: 'Novi poziv', diagnosis: 'Zakazano', in_progress: 'Na terenu', ready: 'Odrađeno', collected: 'Zatvoreno' },
  skipPhases: ['awaiting_parts', 'quality_check'],
  quote: 'never',
  opening: { intake: 'Sljedeće: čišćenje jedinice.', tab: 'modul' },
  symptoms: ['Smjena između gostiju', 'Dubinsko čišćenje', 'Redovno čišćenje ureda', 'Nakon odjave', 'Prije dolaska gostiju', 'Prozori', 'Posteljina', 'Oštećenje nakon gosta'],
  photoTags: [{ code: 'before', label: 'Prije' }, { code: 'after', label: 'Poslije' }, { code: 'damage', label: 'Šteta' }, { code: 'linen', label: 'Rublje' }, ...COMMON_PHOTO_TAGS],
  diagram: 'car',
  conditionZones: CLEAN_ZONES,
  marks: [
    { code: 'D', label: 'Prljavo' },
    { code: 'M', label: 'Mrlja' },
    { code: 'O', label: 'Oštećeno' },
    { code: 'S', label: 'Slomljeno' },
    { code: 'P', label: 'Pokvareno' },
    { code: 'I', label: 'Neispravno' },
    { code: 'N', label: 'Nedostaje' },
  ],
  level: 'battery',
  equipment: ['Ključevi / kartice', 'Daljinski klime', 'Inventar (popis)', 'Posteljina predana'],
  inspections: [
    turnover,
    checklist('clean.office', 'Čišćenje ureda', 'checklist', 'Ured', [
      'Podovi usisani i obrisani',
      'Radni stolovi obrisani, kablovi posloženi',
      'Kuhinjica i suđe',
      'Toalet i potrošni materijal',
      'Smeće odneseno',
      'Fotografija gotovog prostora',
    ], 'clean.office'),
    checklist('clean.deep', 'Dubinsko čišćenje', 'checklist', 'Dubinski', [
      'Prozori iznutra',
      'Ornari i ladice',
      'Perilica i sušilica',
      'Hladnjak odleđen i opran',
      'Tepisi i tapecirani namještaj',
    ]),
  ],
  templates: [
    { code: 'clean.visit', name: 'Izlazak', lines: [{ kind: 'fee', description: 'Izlazak na adresu', qty: 1, unit: 'paušal', price: 15 }] },
    {
      code: 'clean.turnover',
      name: 'Smjena između gostiju',
      lines: [{ kind: 'package', description: 'Čišćenje apartmana između gostiju (kreveti, kupaonica, kuhinja, podovi)', qty: 1, unit: 'paušal', price: 55 }],
      inspection: 'clean.turnover',
    },
    {
      code: 'clean.office',
      name: 'Čišćenje ureda',
      lines: [{ kind: 'package', description: 'Redovno čišćenje ureda', qty: 1, unit: 'paušal', price: 40 }],
      inspection: 'clean.office',
    },
    {
      code: 'clean.deep',
      name: 'Dubinsko čišćenje',
      lines: [{ kind: 'package', description: 'Dubinsko čišćenje jedinice (prozori, ormari, tepisi)', qty: 1, unit: 'paušal', price: 120 }],
      inspection: 'clean.deep',
    },
    { code: 'clean.windows', name: 'Pranje prozora', lines: [{ kind: 'labor', description: 'Pranje prozora', qty: 1, unit: 'h', price: 30 }] },
    { code: 'clean.linen', name: 'Posteljina i ručnici', lines: [{ kind: 'labor', description: 'Zamjena i pranje posteljine i ručnika', qty: 1, unit: 'paušal', price: 20 }] },
    { code: 'clean.hour', name: 'Sat rada', lines: [{ kind: 'labor', description: 'Čišćenje', qty: 1, unit: 'h', price: 18 }] },
  ],
  modules: ['dvi', 'condition_report', 'approvals', 'field_visits', 'maintenance_plans'],
  optionalModules: [],
  moduleTab: 'Jedinica i plan',
  modulePage: 'Planovi čišćenja',
  plan: {
    title: 'Redovno čišćenje',
    template: 'clean.office',
    months: 1,
    hint: 'Redovno čišćenje ureda uključuje se na nalogu, kartica „Jedinica i plan”. Smjene između gostiju otvarate po rezervaciji. Pravi tjedni ritam dolazi s tjednim posjetima.',
  },
};
