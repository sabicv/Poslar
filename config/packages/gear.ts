import type { InspectionTemplate, PackageConfig } from '../tenant.config';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

// The 50-point digital vehicle inspection. Items with a unit take a
// measurement; thresholds turn it into green / yellow / red.
const dvi50: InspectionTemplate = {
  code: 'gear.dvi50',
  name: 'Inspekcija u 50 točaka',
  purpose: 'dvi',
  sections: [
    {
      title: 'A · Ispod haube',
      items: [
        { code: 'g01', label: 'Razina i stanje motornog ulja' },
        { code: 'g02', label: 'Rashladna tekućina — zaštita', unit: '°C', warnAbove: -25, critAbove: -15 },
        { code: 'g03', label: 'Kočiona tekućina — razina' },
        { code: 'g04', label: 'Tekućina servo upravljača' },
        { code: 'g05', label: 'Tekućina za pranje stakla' },
        { code: 'g06', label: 'Remen pomoćnih uređaja i zatezač' },
        { code: 'g07', label: 'Crijeva i spojevi rashladnog sustava' },
        { code: 'g08', label: 'Zračni filter' },
        { code: 'g09', label: 'Filter kabine' },
        { code: 'g10', label: 'Curenja: ulje, rashladna, gorivo' },
      ],
    },
    {
      title: 'B · Akumulator i elektrika',
      items: [
        { code: 'g11', label: 'Akumulator — napon mirovanja', unit: 'V', warnBelow: 12.4, critBelow: 12.1 },
        { code: 'g12', label: 'Polovi i priključci' },
        { code: 'g13', label: 'Prednja svjetla: kratka, duga, dnevna, poziciona' },
        { code: 'g14', label: 'Stražnja svjetla: kočiona, pokazivači, maglenka, hod unazad' },
        { code: 'g15', label: 'Kontrolne lampice i greške u memoriji' },
      ],
    },
    {
      title: 'C · Kočnice',
      items: [
        { code: 'g16', label: 'Prednje pločice', unit: 'mm', warnBelow: 4, critBelow: 2.5 },
        { code: 'g17', label: 'Prednji diskovi — debljina, brazde, rub' },
        { code: 'g18', label: 'Stražnje pločice ili obloge', unit: 'mm', warnBelow: 4, critBelow: 2.5 },
        { code: 'g19', label: 'Stražnji diskovi ili bubnjevi' },
        { code: 'g20', label: 'Kočione cijevi i crijeva' },
        { code: 'g21', label: 'Čeljusti — vodilice i klipovi' },
        { code: 'g22', label: 'Parkirna kočnica' },
        { code: 'g23', label: 'Kočiona tekućina — udio vode', unit: '%', warnAbove: 2, critAbove: 3 },
      ],
    },
    {
      title: 'D · Ovjes i upravljanje',
      items: [
        { code: 'g24', label: 'Amortizeri naprijed' },
        { code: 'g25', label: 'Amortizeri straga' },
        { code: 'g26', label: 'Opruge' },
        { code: 'g27', label: 'Ramena i silentblokovi' },
        { code: 'g28', label: 'Kuglasti zglobovi' },
        { code: 'g29', label: 'Krajnici i aksijalni zglobovi' },
        { code: 'g30', label: 'Manžete poluosovina' },
        { code: 'g31', label: 'Stabilizator — spone i gumice' },
      ],
    },
    {
      title: 'E · Kotači i gume',
      items: [
        { code: 'g32', label: 'Dubina šare (najmanja)', unit: 'mm', warnBelow: 3, critBelow: 1.6 },
        { code: 'g33', label: 'Tlak u gumama', unit: 'bar', warnBelow: 2.0, critBelow: 1.6 },
        { code: 'g34', label: 'DOT — starost guma', unit: 'god.', warnAbove: 6, critAbove: 10 },
        { code: 'g35', label: 'Neravnomjerno trošenje' },
        { code: 'g36', label: 'Rezervni kotač ili komplet za popravak' },
        { code: 'g37', label: 'Naplatci i vijci' },
      ],
    },
    {
      title: 'F · Ispod vozila',
      items: [
        { code: 'g38', label: 'Ispušni sustav i nosači' },
        { code: 'g39', label: 'Katalizator i DPF — vizualno' },
        { code: 'g40', label: 'Mjenjač i diferencijal — curenje' },
        { code: 'g41', label: 'Nosači motora' },
        { code: 'g42', label: 'Podvozje i pragovi — korozija' },
        { code: 'g43', label: 'Spremnik i vodovi goriva' },
      ],
    },
    {
      title: 'G · Karoserija i unutrašnjost',
      items: [
        { code: 'g44', label: 'Metlice brisača' },
        { code: 'g45', label: 'Vjetrobransko staklo' },
        { code: 'g46', label: 'Sigurnosni pojasevi' },
        { code: 'g47', label: 'Klima — temperatura na izlazu', unit: '°C', warnAbove: 9, critAbove: 14 },
      ],
    },
    {
      title: 'H · Probna vožnja',
      items: [
        { code: 'g48', label: 'Kočenje — vuče, vibrira' },
        { code: 'g49', label: 'Upravljanje i ravnanje' },
        { code: 'g50', label: 'Buka — ležajevi, ovjes, mjenjač' },
      ],
    },
  ],
};

export const gear: PackageConfig = {
  id: 'gear',
  product: 'Gear Files',
  short: 'Gear',
  domain: 'gearfiles.hr',
  tagline: 'Automehanika i opći servis',
  pitch: [
    'Inspekcija u 50 točaka na semaforu, s fotografijom po stavci',
    'Servisni plan vozila: ulje, filteri, remen — po km i vremenu',
    'Dijelovi s kataloškim brojem, dobavljačem i jamstvom',
  ],
  accent: '#9580FF',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Vozilo', many: 'Vozila', new: 'Novo vozilo' },
    identifier: 'Registracija',
  },
  assetTypes: ['car', 'van', 'truck', 'motorcycle'],
  defaultAssetType: 'car',
  phaseLabels: {},
  symptoms: [
    'Redovni servis',
    'Kočnice škripe / slabo koče',
    'Lupa ovjes',
    'Curi ulje ili tekućina',
    'Lampica motora',
    'Klima ne hladi',
    'Priprema za tehnički',
    'Zamjena guma',
  ],
  photoTags: [...COMMON_PHOTO_TAGS, { code: 'inspection', label: 'Nalaz inspekcije' }],
  diagram: 'car',
  equipment: ['Ključevi', 'Dokumenti vozila', 'Servisna knjižica', 'Rezervni kotač'],
  inspections: [
    dvi50,
    checklist('gear.final', 'Završna kontrola', 'checklist', 'Prije predaje vozila', [
      'Svi odobreni radovi obavljeni',
      'Razine tekućina dopunjene',
      'Moment pritezanja kotača',
      'Nema curenja nakon rada',
      'Servisni interval resetiran',
      'Probna vožnja bez primjedbi',
      'Vozilo čisto, zaštita sjedala uklonjena',
    ]),
  ],
  templates: [
    {
      code: 'gear.small_service',
      name: 'Mali servis',
      lines: [
        { kind: 'labor', description: 'Zamjena ulja i filtera', qty: 0.6, unit: 'h', price: 45 },
        { kind: 'part', description: 'Filter ulja', qty: 1, unit: 'kom', price: 12 },
        { kind: 'material', description: 'Motorno ulje', qty: 5, unit: 'l', price: 11 },
      ],
      inspection: 'gear.dvi50',
    },
    {
      code: 'gear.big_service',
      name: 'Veliki servis',
      lines: [
        { kind: 'labor', description: 'Veliki servis prema planu proizvođača', qty: 2, unit: 'h', price: 45 },
        { kind: 'part', description: 'Filter ulja', qty: 1, unit: 'kom', price: 12 },
        { kind: 'part', description: 'Filter zraka', qty: 1, unit: 'kom', price: 18 },
        { kind: 'part', description: 'Filter kabine', qty: 1, unit: 'kom', price: 15 },
        { kind: 'part', description: 'Filter goriva', qty: 1, unit: 'kom', price: 25 },
        { kind: 'material', description: 'Motorno ulje', qty: 5, unit: 'l', price: 11 },
      ],
      inspection: 'gear.dvi50',
    },
    {
      code: 'gear.timing_belt',
      name: 'Remen razvoda komplet',
      lines: [
        { kind: 'labor', description: 'Zamjena kompleta remena razvoda i vodene pumpe', qty: 3.5, unit: 'h', price: 45 },
        { kind: 'part', description: 'Komplet remena razvoda s vodenom pumpom', qty: 1, unit: 'kom', price: 220 },
        { kind: 'material', description: 'Rashladna tekućina', qty: 5, unit: 'l', price: 4 },
      ],
    },
    {
      code: 'gear.brakes_front',
      name: 'Kočnice naprijed',
      lines: [
        { kind: 'labor', description: 'Zamjena pločica i diskova naprijed', qty: 1.2, unit: 'h', price: 45 },
        { kind: 'part', description: 'Kočione pločice naprijed', qty: 1, unit: 'kom', price: 45 },
        { kind: 'part', description: 'Kočioni diskovi naprijed', qty: 2, unit: 'kom', price: 55 },
      ],
    },
    {
      code: 'gear.brakes_rear',
      name: 'Kočnice straga',
      lines: [
        { kind: 'labor', description: 'Zamjena pločica i diskova straga', qty: 1.2, unit: 'h', price: 45 },
        { kind: 'part', description: 'Kočione pločice straga', qty: 1, unit: 'kom', price: 40 },
        { kind: 'part', description: 'Kočioni diskovi straga', qty: 2, unit: 'kom', price: 48 },
      ],
    },
    {
      code: 'gear.ac_service',
      name: 'Klima servis',
      lines: [
        { kind: 'labor', description: 'Servis klime: vakuum, punjenje, test propusnosti', qty: 0.8, unit: 'h', price: 45 },
        { kind: 'material', description: 'Rashladni plin', qty: 500, unit: 'g', price: 0.12 },
      ],
    },
    {
      code: 'gear.clutch',
      name: 'Kvačilo',
      lines: [
        { kind: 'labor', description: 'Zamjena kompleta kvačila', qty: 5, unit: 'h', price: 45 },
        { kind: 'part', description: 'Komplet kvačila', qty: 1, unit: 'kom', price: 260 },
      ],
    },
    {
      code: 'gear.mot_prep',
      name: 'Priprema za tehnički',
      lines: [{ kind: 'labor', description: 'Pregled i priprema vozila za tehnički pregled', qty: 1, unit: 'h', price: 45 }],
      inspection: 'gear.dvi50',
    },
  ],
  modules: ['dvi', 'condition_report', 'approvals', 'service_plan', 'parts'],
  optionalModules: ['wheel_hotel'],
  moduleTab: 'Servis i dijelovi',
  modulePage: 'Servisni plan',
};
