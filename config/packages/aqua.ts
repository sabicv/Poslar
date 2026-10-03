import type { InspectionTemplate, PackageConfig } from '../tenant.config';
import { checklist } from './shared';

export const ENERGY_LABELS: Record<string, string> = {
  electric: 'Struja',
  gas: 'Plin',
  heat_pump: 'Dizalica topline',
  solar: 'Solarni kolektori',
  combined: 'Kombinirano',
  oil: 'Lož ulje',
  none: 'Bez grijača',
};

// Pressure drop over a test, as written on the record. Whether the test
// passed stays the plumber's call, against the rule he works to.
export function pressureDrop(start: number | null, end: number | null): number | null {
  if (start === null || end === null) return null;
  return Math.round((start - end) * 100) / 100;
}

// ---------------------------------------------------------------------
// Checklists (same inspection engine as the workshop DVI)
// ---------------------------------------------------------------------
const heaterService: InspectionTemplate = {
  code: 'aqua.heater_service',
  name: 'Servis bojlera',
  purpose: 'dvi',
  sections: [
    {
      title: 'A · Unutra',
      items: [
        { code: 'a01', label: 'Istrošenost anode', unit: '%', warnAbove: 60, critAbove: 80 },
        { code: 'a02', label: 'Kamenac očišćen' },
        { code: 'a03', label: 'Grijač provjeren' },
        { code: 'a04', label: 'Brtva prirubnice nova' },
      ],
    },
    {
      title: 'B · Rad i sigurnost',
      items: [
        { code: 'b01', label: 'Sigurnosni ventil ispušta' },
        { code: 'b02', label: 'Termostat isključuje na zadanoj temperaturi' },
        { code: 'b03', label: 'Temperatura vode', unit: '°C' },
        { code: 'b04', label: 'Nema curenja nakon punjenja' },
        { code: 'b05', label: 'Fotografija natpisne pločice' },
      ],
    },
  ],
};

const boilerService: InspectionTemplate = {
  code: 'aqua.boiler_service',
  name: 'Servis plinskog kotla',
  purpose: 'dvi',
  sections: [
    {
      title: 'Hidraulika',
      items: [
        { code: 'h01', label: 'Tlak vode u sustavu', unit: 'bar', warnBelow: 1.0, critBelow: 0.7 },
        { code: 'h02', label: 'Predtlak ekspanzijske posude', unit: 'bar' },
        { code: 'h03', label: 'Filter i hvatač nečistoća očišćeni' },
        { code: 'h04', label: 'Sustav odzračen' },
      ],
    },
    {
      title: 'Plamenik i dimovod',
      items: [
        { code: 'p01', label: 'Izmjenjivač i plamenik očišćeni' },
        { code: 'p02', label: 'Sifon kondenzata očišćen' },
        { code: 'p03', label: 'Elektrode paljenja i ionizacije' },
        { code: 'p04', label: 'CO u dimnim plinovima', unit: 'ppm' },
        { code: 'p05', label: 'Dimovod nepropustan, bez korozije' },
        { code: 'p06', label: 'Plinski priključak provjeren na propuštanje' },
        { code: 'p07', label: 'Greške u memoriji kotla' },
      ],
    },
  ],
};

export const aqua: PackageConfig = {
  id: 'aqua',
  product: 'Aqua Files',
  short: 'Aqua',
  domain: 'aquafiles.hr',
  tagline: 'Vodoinstalacije, bojleri i grijanje na terenu',
  pitch: [
    'Raspored dana, navigacija i poruka „Na putu” jednim dodirom',
    'Zapisnik tlačne probe s fotografijom manometra',
    'Servis bojlera i kotla sam se nudi kad dođe rok',
  ],
  sector: 'field',
  accent: '#2F7BFF',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Uređaj', many: 'Uređaji', new: 'Novi uređaj' },
    identifier: 'Oznaka uređaja',
  },
  assetTypes: ['plumbing', 'water_heater', 'gas_boiler', 'heating', 'drainage', 'pump'],
  defaultAssetType: 'plumbing',
  phaseLabels: {
    intake: 'Novi zahtjev',
    diagnosis: 'Zakazano',
    in_progress: 'Na terenu',
    ready: 'Odrađeno',
    collected: 'Zatvoreno',
  },
  symptoms: ['Curi voda', 'Začepljen odvod', 'Bojler ne grije', 'Servis bojlera', 'Servis plinskog kotla', 'Pao tlak u grijanju', 'WC kotlić curi', 'Zamjena slavine', 'Nova instalacija'],
  photoTags: [
    { code: 'before', label: 'Prije' },
    { code: 'after', label: 'Poslije' },
    { code: 'leak', label: 'Mjesto curenja' },
    { code: 'gauge', label: 'Manometar / vodomjer' },
    { code: 'nameplate', label: 'Natpisna pločica' },
    { code: 'document', label: 'Dokument' },
  ],
  diagram: 'car',
  equipment: [],
  inspections: [
    heaterService,
    boilerService,
    checklist('aqua.leak_search', 'Traženje curenja', 'checklist', 'Redom', [
      'Vodomjer stoji kad su sve slavine zatvorene',
      'Vidljivi spojevi i ventili pregledani',
      'WC kotlić i sifoni provjereni',
      'Vlaga u zidu ili podu izmjerena',
      'Mjesto curenja fotografirano',
    ]),
    checklist('aqua.handover', 'Završetak radova', 'checklist', 'Prije odlaska', [
      'Instalacija isprana i odzračena',
      'Sve slavine i ispusti provjereni',
      'Nema curenja na novim spojevima',
      'Otpad i stari dijelovi odneseni',
      'Mušterija zna gdje je glavni ventil',
    ]),
  ],
  templates: [
    { code: 'aqua.visit', name: 'Izlazak na intervenciju', lines: [{ kind: 'fee', description: 'Izlazak na intervenciju', qty: 1, unit: 'paušal', price: 30 }] },
    { code: 'aqua.night', name: 'Hitno noću ili vikendom', lines: [{ kind: 'fee', description: 'Dodatak za hitnu intervenciju (noć, vikend, blagdan)', qty: 1, unit: 'paušal', price: 40 }] },
    { code: 'aqua.hour', name: 'Sat rada', lines: [{ kind: 'labor', description: 'Vodoinstalaterski radovi', qty: 1, unit: 'h', price: 35 }] },
    {
      code: 'aqua.leak',
      name: 'Traženje curenja',
      lines: [{ kind: 'labor', description: 'Traženje mjesta curenja', qty: 1.5, unit: 'h', price: 40 }],
      inspection: 'aqua.leak_search',
    },
    {
      code: 'aqua.heater_service',
      name: 'Servis bojlera',
      lines: [
        { kind: 'package', description: 'Servis bojlera: anoda, kamenac, brtva', qty: 1, unit: 'paušal', price: 70 },
        { kind: 'part', description: 'Magnezijeva anoda', qty: 1, unit: 'kom', price: 20 },
        { kind: 'part', description: 'Brtva prirubnice', qty: 1, unit: 'kom', price: 8 },
      ],
      inspection: 'aqua.heater_service',
    },
    {
      code: 'aqua.heater_swap',
      name: 'Zamjena bojlera',
      lines: [
        { kind: 'package', description: 'Demontaža starog i montaža novog bojlera', qty: 1, unit: 'paušal', price: 90 },
        { kind: 'part', description: 'Sigurnosni ventil', qty: 1, unit: 'kom', price: 15 },
        { kind: 'material', description: 'Fleksibilno crijevo', qty: 2, unit: 'kom', price: 6 },
      ],
      inspection: 'aqua.handover',
    },
    {
      code: 'aqua.boiler_service',
      name: 'Servis plinskog kotla',
      lines: [{ kind: 'package', description: 'Godišnji servis plinskog kotla s analizom dimnih plinova', qty: 1, unit: 'paušal', price: 90 }],
      inspection: 'aqua.boiler_service',
    },
    { code: 'aqua.drain', name: 'Odčepljenje odvoda', lines: [{ kind: 'package', description: 'Odčepljenje odvoda spiralom', qty: 1, unit: 'paušal', price: 60 }] },
    {
      code: 'aqua.wc',
      name: 'Popravak WC kotlića',
      lines: [
        { kind: 'labor', description: 'Popravak WC kotlića', qty: 0.7, unit: 'h', price: 35 },
        { kind: 'part', description: 'Mehanizam kotlića', qty: 1, unit: 'kom', price: 25 },
      ],
    },
    {
      code: 'aqua.faucet',
      name: 'Zamjena mješalice',
      lines: [
        { kind: 'labor', description: 'Demontaža i montaža mješalice', qty: 0.5, unit: 'h', price: 35 },
        { kind: 'part', description: 'Mješalica', qty: 1, unit: 'kom', price: 45 },
      ],
    },
    {
      code: 'aqua.pressure_test',
      name: 'Tlačna proba',
      lines: [{ kind: 'labor', description: 'Tlačna proba instalacije sa zapisnikom', qty: 1, unit: 'h', price: 35 }],
      inspection: 'aqua.handover',
    },
    {
      code: 'aqua.bleed',
      name: 'Odzračivanje grijanja',
      lines: [{ kind: 'labor', description: 'Odzračivanje radijatora i nadopuna sustava', qty: 1, unit: 'h', price: 35 }],
    },
  ],
  modules: ['dvi', 'approvals', 'field_visits', 'maintenance_plans'],
  optionalModules: [],
  moduleTab: 'Uređaj i tlačna proba',
  modulePage: 'Servisni planovi',
};
