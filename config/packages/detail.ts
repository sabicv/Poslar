import type { InspectionTemplate, PackageConfig } from '../tenant.config';
import { DETAIL_ZONES } from './condition-zones';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

// Auto kozmetika: washing, deep cleaning, polishing and paint protection.
// The car's state is written down and photographed before the work (the
// customer cannot later say a scratch came from the polisher), the paint
// thickness is measured before polishing, and a ceramic coating comes back
// for its yearly care.

const intake: InspectionTemplate = {
  code: 'detail.intake',
  name: 'Prijem vozila',
  purpose: 'dvi',
  sections: [
    {
      title: 'A · Zatečeno stanje',
      items: [
        { code: 'a01', label: 'Ogrebotine i udubljenja fotografirani' },
        { code: 'a02', label: 'Oštećenja naplataka' },
        { code: 'a03', label: 'Stanje sjedala i obloga' },
        { code: 'a04', label: 'Mrlje i mirisi zapisani' },
        { code: 'a05', label: 'Osobne stvari u vozilu popisane' },
      ],
    },
    {
      // Factory paint is about 100 to 180 µm; under 80 the clear coat is
      // thin and a heavy cut can go through it.
      title: 'B · Debljina laka',
      items: [
        { code: 'b01', label: 'Hauba', unit: 'µm', warnBelow: 80, critBelow: 60 },
        { code: 'b02', label: 'Krov', unit: 'µm', warnBelow: 80, critBelow: 60 },
        { code: 'b03', label: 'Lijeva strana', unit: 'µm', warnBelow: 80, critBelow: 60 },
        { code: 'b04', label: 'Desna strana', unit: 'µm', warnBelow: 80, critBelow: 60 },
        { code: 'b05', label: 'Prtljažnik', unit: 'µm', warnBelow: 80, critBelow: 60 },
      ],
    },
  ],
};

const ceramic: InspectionTemplate = {
  code: 'detail.ceramic',
  name: 'Keramička zaštita',
  purpose: 'checklist',
  sections: [
    {
      title: 'Priprema i nanošenje',
      items: [
        { code: 'c01', label: 'Pranje i dekontaminacija (glina, uklanjanje željeza)' },
        { code: 'c02', label: 'Korekcija laka obavljena' },
        { code: 'c03', label: 'Lak odmašćen (IPA)' },
        { code: 'c04', label: 'Temperatura u prostoru', unit: '°C', warnBelow: 15, critBelow: 10 },
        { code: 'c05', label: 'Vlaga u prostoru', unit: '%', warnAbove: 70, critAbove: 85 },
        { code: 'c06', label: 'Broj slojeva', unit: 'sloj' },
        { code: 'c07', label: 'Proizvod i serija zapisani' },
        { code: 'c08', label: 'Mušterija zna: 7 dana bez pranja šamponom' },
      ],
    },
  ],
};

export const detail: PackageConfig = {
  id: 'detail',
  product: 'Auto kozmetika',
  short: 'Auto kozmetika',
  domain: 'autokozmetika.poslar.eu',
  tagline: 'Pranje, dubinsko čišćenje, poliranje i keramička zaštita',
  pitch: ['Slike prije i poslije na svakom nalogu', 'Debljina laka izmjerena prije poliranja', 'Obnova keramike sama se ponudi za godinu dana'],
  sector: 'workshop',
  accent: '#1CA7DD',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Vozilo', many: 'Vozila', new: 'Novo vozilo' },
    identifier: 'Registracija',
  },
  assetTypes: ['car', 'van', 'motorcycle'],
  defaultAssetType: 'car',
  phaseLabels: { diagnosis: 'Pregled stanja', in_progress: 'U obradi', quality_check: 'Završna kontrola' },
  skipPhases: ['awaiting_parts'],
  opening: { intake: 'Sljedeće: fotografije prije i debljina laka.', tab: 'modul' },
  symptoms: ['Vanjsko pranje', 'Dubinsko čišćenje unutra', 'Poliranje laka', 'Keramička zaštita', 'Poliranje farova', 'Čišćenje kože', 'Neugodan miris', 'Priprema za prodaju', 'Pranje motora'],
  photoTags: [{ code: 'before', label: 'Prije' }, { code: 'after', label: 'Poslije' }, ...COMMON_PHOTO_TAGS],
  diagram: 'car',
  conditionZones: DETAIL_ZONES,
  marks: [
    { code: 'O', label: 'Ogrebotina' },
    { code: 'H', label: 'Hologrami' },
    { code: 'K', label: 'Kamenčić' },
    { code: 'U', label: 'Udubljenje' },
    { code: 'M', label: 'Mrlja' },
    { code: 'F', label: 'Mutan far' },
    { code: 'C', label: 'Trag kamenca' },
    { code: 'D', label: 'Kvar / defekt / neispravno' },
  ],
  equipment: ['Ključevi', 'Daljinski', 'Tepisi', 'Dječja sjedalica', 'Punjač ili kabel', 'Sitnice u kabini'],
  inspections: [
    intake,
    ceramic,
    checklist('detail.handover', 'Predaja vozila', 'checklist', 'Prije predaje', [
      'Lak pregledan na suncu ili lampom, bez tragova poliranja',
      'Stakla bez mrlja, iznutra i izvana',
      'Unutrašnjost usisana i obrisana',
      'Osobne stvari vraćene na mjesto',
      'Mušterija zna kako održavati zaštitu',
    ]),
  ],
  templates: [
    { code: 'detail.wash', name: 'Vanjsko pranje', lines: [{ kind: 'package', description: 'Ručno pranje vozila izvana', qty: 1, unit: 'paušal', price: 20 }] },
    { code: 'detail.interior', name: 'Dubinsko čišćenje unutra', lines: [{ kind: 'package', description: 'Dubinsko čišćenje unutrašnjosti (sjedala, tepisi, plastika)', qty: 1, unit: 'paušal', price: 90 }], inspection: 'detail.handover' },
    { code: 'detail.full', name: 'Kompletna kozmetika', lines: [{ kind: 'package', description: 'Pranje izvana i dubinsko čišćenje unutra', qty: 1, unit: 'paušal', price: 140 }], inspection: 'detail.handover' },
    { code: 'detail.polish_one', name: 'Poliranje u jednom koraku', lines: [{ kind: 'package', description: 'Poliranje laka u jednom koraku s voskom', qty: 1, unit: 'paušal', price: 150 }], inspection: 'detail.intake' },
    { code: 'detail.polish_two', name: 'Korekcija laka u dva koraka', lines: [{ kind: 'package', description: 'Korekcija laka u dva koraka (rezanje i završno poliranje)', qty: 1, unit: 'paušal', price: 280 }], inspection: 'detail.intake' },
    {
      code: 'detail.ceramic',
      name: 'Keramička zaštita',
      lines: [
        { kind: 'package', description: 'Priprema laka i nanošenje keramičke zaštite', qty: 1, unit: 'paušal', price: 380 },
        { kind: 'material', description: 'Keramički premaz', qty: 1, unit: 'kom', price: 70 },
      ],
      inspection: 'detail.ceramic',
    },
    { code: 'detail.ceramic_care', name: 'Održavanje keramike', lines: [{ kind: 'package', description: 'Pranje i obnova keramičke zaštite', qty: 1, unit: 'paušal', price: 80 }] },
    { code: 'detail.headlights', name: 'Poliranje farova', lines: [{ kind: 'package', description: 'Poliranje i zaštita farova (par)', qty: 1, unit: 'paušal', price: 50 }] },
    { code: 'detail.leather', name: 'Čišćenje i zaštita kože', lines: [{ kind: 'package', description: 'Čišćenje i impregnacija kožnih sjedala', qty: 1, unit: 'paušal', price: 70 }] },
    { code: 'detail.ozone', name: 'Uklanjanje mirisa ozonom', lines: [{ kind: 'package', description: 'Tretman unutrašnjosti ozonom', qty: 1, unit: 'paušal', price: 35 }] },
    { code: 'detail.engine', name: 'Pranje motora', lines: [{ kind: 'package', description: 'Pranje i zaštita motornog prostora', qty: 1, unit: 'paušal', price: 30 }] },
    { code: 'detail.sale', name: 'Priprema za prodaju', lines: [{ kind: 'package', description: 'Priprema vozila za prodaju (izvana, iznutra, motor, farovi)', qty: 1, unit: 'paušal', price: 160 }], inspection: 'detail.intake' },
  ],
  modules: ['dvi', 'condition_report', 'approvals', 'maintenance_plans'],
  optionalModules: [],
  moduleTab: 'Zaštita i povijest',
  modulePage: 'Obnove zaštite',
  plan: {
    title: 'Održavanje keramičke zaštite',
    template: 'detail.ceramic_care',
    months: 12,
    hint: 'Kad nanesete keramiku, na nalogu uključite obnovu (kartica „Zaštita i povijest”). Mušterija se ovdje pojavi mjesec dana prije roka.',
  },
};
