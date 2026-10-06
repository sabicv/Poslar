import { addMonths } from '../../lib/time';
import type { InspectionTemplate, PackageConfig } from '../tenant.config';
import { checklist } from './shared';

// ---------------------------------------------------------------------
// Refrigerants and F-gas obligations
//
// GWP values as used by the EU F-gas rules (AR4). t CO2e = kg × GWP / 1000.
// Leak checks (Reg. (EU) 2024/573, art. 5): ≥ 5 t CO2e every 12 months,
// ≥ 50 t every 6, ≥ 500 t every 3; an automatic leak-detection system
// doubles the interval; hermetically sealed equipment under 10 t CO2e is
// exempt; a repaired leak is re-checked within one month. Croatia: a
// service card (SK 1) for equipment with 3 kg or more.
// These rules are shown to the technician as guidance — the workshop
// remains responsible for the current legal text.
// ---------------------------------------------------------------------
export const REFRIGERANTS: Record<string, { gwp: number; label: string; fgas: boolean }> = {
  R32: { gwp: 675, label: 'R32', fgas: true },
  R410A: { gwp: 2088, label: 'R410A', fgas: true },
  R407C: { gwp: 1774, label: 'R407C', fgas: true },
  R134a: { gwp: 1430, label: 'R134a', fgas: true },
  R454B: { gwp: 466, label: 'R454B', fgas: true },
  R404A: { gwp: 3922, label: 'R404A', fgas: true },
  R1234yf: { gwp: 4, label: 'R1234yf', fgas: true },
  R290: { gwp: 3, label: 'R290 (propan)', fgas: false },
  R744: { gwp: 1, label: 'R744 (CO₂)', fgas: false },
};

export interface FgasObligations {
  tco2e: number | null;
  serviceCard: boolean;
  leakCheckMonths: number | null;
  note: string;
}

export function fgasObligations(refrigerant: string | null, chargeKg: number | null, opts: { sealed?: boolean; leakDetection?: boolean } = {}): FgasObligations {
  const gas = refrigerant ? REFRIGERANTS[refrigerant] : undefined;
  if (!gas || chargeKg === null || chargeKg === undefined) {
    return { tco2e: null, serviceCard: false, leakCheckMonths: null, note: 'Upišite vrstu i količinu plina s natpisne pločice.' };
  }
  const tco2e = Math.round(((chargeKg * gas.gwp) / 1000) * 100) / 100;
  const serviceCard = chargeKg >= 3;
  if (!gas.fgas) return { tco2e, serviceCard: false, leakCheckMonths: null, note: 'Prirodna radna tvar. F-plinske provjere propuštanja ne primjenjuju se.' };
  let months: number | null = tco2e >= 500 ? 3 : tco2e >= 50 ? 6 : tco2e >= 5 ? 12 : null;
  if (months !== null && opts.sealed && tco2e < 10) months = null;
  if (months !== null && opts.leakDetection) months *= 2;
  const shown = tco2e.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const note =
    months === null
      ? `${shown} t CO₂e, ispod praga obveznih periodičnih provjera propuštanja.`
      : `${shown} t CO₂e, provjera propuštanja najmanje svakih ${months} mjeseci.`;
  return { tco2e, serviceCard, leakCheckMonths: months, note };
}

// Next leak check for equipment that needs periodic checks. After a leak
// repair the rules ask for a check within one month to confirm the repair;
// until that check is logged it is the next one due.
export function nextLeakCheck(
  leakCheckMonths: number,
  lastCheckDay: string | null,
  lastRepairDay: string | null
): { due: string | null; afterRepair: boolean } {
  if (lastRepairDay && (!lastCheckDay || lastCheckDay < lastRepairDay)) return { due: addMonths(lastRepairDay, 1), afterRepair: true };
  return { due: lastCheckDay ? addMonths(lastCheckDay, leakCheckMonths) : null, afterRepair: false };
}

// Extra refrigerant for a line longer than the factory pre-charge.
// Pre-charged length and g/m come from the unit's installation manual.
export function extraCharge(pipeLengthM: number, prechargedM: number, gramsPerM: number): number {
  return Math.max(0, Math.round((pipeLengthM - prechargedM) * gramsPerM));
}

// ---------------------------------------------------------------------
// Checklists (same inspection engine as the workshop DVI)
// ---------------------------------------------------------------------
const serviceSplit: InspectionTemplate = {
  code: 'air.service_split',
  name: 'Godišnji servis klima uređaja',
  purpose: 'dvi',
  sections: [
    {
      title: 'A · Unutarnja jedinica',
      items: [
        { code: 'a01', label: 'Filteri očišćeni' },
        { code: 'a02', label: 'Isparivač očišćen i dezinficiran' },
        { code: 'a03', label: 'Ventilator (valjak) čist' },
        { code: 'a04', label: 'Odvod kondenzata protočan' },
        { code: 'a05', label: 'Temperatura zraka na izlazu (hlađenje)', unit: '°C', warnAbove: 13, critAbove: 16 },
        { code: 'a06', label: 'Razlika temperature ulaz − izlaz', unit: '°C', warnBelow: 8, critBelow: 6 },
      ],
    },
    {
      title: 'B · Vanjska jedinica',
      items: [
        { code: 'b01', label: 'Lamele kondenzatora čiste' },
        { code: 'b02', label: 'Ventilator, nosači i antivibracijske podloge' },
        { code: 'b03', label: 'Električni priključci pritegnuti' },
        { code: 'b04', label: 'Struja kompresora', unit: 'A' },
        { code: 'b05', label: 'Tlak na usisu', unit: 'bar' },
      ],
    },
    {
      title: 'C · Nepropusnost i rad',
      items: [
        { code: 'c01', label: 'Spojevi i ventili provjereni detektorom' },
        { code: 'c02', label: 'Izolacija cijevi neoštećena' },
        { code: 'c03', label: 'Daljinski upravljač i svi načini rada' },
        { code: 'c04', label: 'Buka i vibracije' },
        { code: 'c05', label: 'Greške u memoriji uređaja' },
      ],
    },
    {
      title: 'D · Predaja',
      items: [
        { code: 'd01', label: 'Fotografije prije i poslije' },
        { code: 'd02', label: 'Korisnik upućen (čišćenje filtera, način rada)' },
      ],
    },
  ],
};

const install: InspectionTemplate = {
  code: 'air.install',
  name: 'Montaža i puštanje u rad',
  purpose: 'checklist',
  sections: [
    {
      title: 'Montaža',
      items: [
        { code: 'i01', label: 'Tlačna proba dušikom (bez pada tlaka)', unit: 'bar' },
        { code: 'i02', label: 'Vakuum postignut', unit: 'mbar', warnAbove: 0.7, critAbove: 2 },
        { code: 'i03', label: 'Duljina instalacije', unit: 'm' },
        { code: 'i04', label: 'Dopunjeno plina (duljina iznad tvorničkog punjenja)', unit: 'g' },
        { code: 'i05', label: 'Odvod kondenzata s padom, bez povratnog toka' },
        { code: 'i06', label: 'Električni priključak, osigurač i uzemljenje' },
        { code: 'i07', label: 'Rad u hlađenju i grijanju provjeren' },
        { code: 'i08', label: 'Natpisna pločica fotografirana' },
        { code: 'i09', label: 'Upute i jamstveni list predani korisniku' },
      ],
    },
  ],
};

const heatPump: InspectionTemplate = {
  code: 'air.heat_pump',
  name: 'Servis dizalice topline',
  purpose: 'dvi',
  sections: [
    {
      title: 'Hidraulika',
      items: [
        { code: 'h01', label: 'Tlak vode u sustavu', unit: 'bar', warnBelow: 1.0, critBelow: 0.7 },
        { code: 'h02', label: 'Predtlak ekspanzijske posude', unit: 'bar' },
        { code: 'h03', label: 'Filter / hvatač nečistoća očišćen' },
        { code: 'h04', label: 'Sustav odzračen' },
        { code: 'h05', label: 'Polazna temperatura', unit: '°C' },
      ],
    },
    {
      title: 'Uređaj',
      items: [
        { code: 'h06', label: 'Isparivač vanjske jedinice čist, odvod odleđivanja slobodan' },
        { code: 'h07', label: 'Anoda spremnika PTV-a', unit: '%', warnBelow: 40, critBelow: 20 },
        { code: 'h08', label: 'Greške u memoriji regulacije' },
        { code: 'h09', label: 'Spojevi rashladnog kruga provjereni detektorom' },
        { code: 'h10', label: 'Postavke krivulje grijanja provjerene s korisnikom' },
      ],
    },
  ],
};

export const air: PackageConfig = {
  id: 'air',
  product: 'Poslar Klima serviser',
  short: 'Klima serviser',
  domain: 'klima-serviser.poslar.hr',
  tagline: 'Klime, dizalice topline i ventilacija na terenu',
  pitch: [
    'Raspored dana, navigacija i poruka „Na putu” jednim dodirom',
    'Izvještaj s fotografijama, vremenom i GPS-om za vlasnika koji nije kod kuće',
    'Evidencija F-plinova i godišnji servisi koji se sami nude za zakazivanje',
  ],
  sector: 'field',
  accent: '#5CE1E6',
  vocabulary: {
    client: { one: 'Klijent', many: 'Klijenti', new: 'Novi klijent', acc: 'klijenta' },
    asset: { one: 'Uređaj', many: 'Uređaji', new: 'Novi uređaj' },
    identifier: 'Oznaka uređaja',
  },
  assetTypes: ['ac_split', 'ac_multi', 'ac_ducted', 'ac_vrf', 'heat_pump', 'ventilation', 'chiller'],
  defaultAssetType: 'ac_split',
  phaseLabels: {
    intake: 'Novi zahtjev',
    diagnosis: 'Zakazano',
    in_progress: 'Na terenu',
    ready: 'Odrađeno',
    collected: 'Zatvoreno',
  },
  symptoms: ['Godišnji servis', 'Slabo hladi', 'Ne grije', 'Curi voda', 'Neugodan miris', 'Greška na displeju', 'Buka ili vibracije', 'Ne pali', 'Montaža novog uređaja'],
  photoTags: [
    { code: 'before', label: 'Prije' },
    { code: 'after', label: 'Poslije' },
    { code: 'nameplate', label: 'Natpisna pločica' },
    { code: 'gauges', label: 'Manometri / mjerenja' },
    { code: 'filter', label: 'Filter / isparivač' },
    { code: 'outdoor', label: 'Vanjska jedinica' },
    { code: 'error', label: 'Greška na displeju' },
    { code: 'document', label: 'Dokument' },
  ],
  diagram: 'car',
  equipment: [],
  inspections: [
    serviceSplit,
    install,
    heatPump,
    checklist('air.leak_check', 'Provjera propuštanja (F-plin)', 'checklist', 'Mjesta provjere', [
      'Spojevi unutarnje jedinice',
      'Spojevi i servisni ventili vanjske jedinice',
      'Izmjenjivač unutarnje jedinice',
      'Izmjenjivač vanjske jedinice',
      'Kompresor i cijevi u vanjskoj jedinici',
      'Vidljivi tragovi ulja na instalaciji',
    ]),
  ],
  templates: [
    {
      code: 'air.service_one',
      name: 'Godišnji servis klime (1 unutarnja)',
      lines: [
        { kind: 'package', description: 'Godišnji servis klima uređaja, 1 unutarnja jedinica', qty: 1, unit: 'paušal', price: 60 },
        { kind: 'material', description: 'Sredstvo za čišćenje i dezinfekciju isparivača', qty: 1, unit: 'kom', price: 8 },
      ],
      inspection: 'air.service_split',
    },
    {
      code: 'air.service_extra',
      name: 'Dodatna unutarnja jedinica',
      lines: [{ kind: 'package', description: 'Servis dodatne unutarnje jedinice', qty: 1, unit: 'kom', price: 35 }],
    },
    {
      code: 'air.visit',
      name: 'Izlazak na teren',
      lines: [{ kind: 'fee', description: 'Izlazak na teren', qty: 1, unit: 'paušal', price: 25 }],
    },
    {
      code: 'air.topup_r32',
      name: 'Dopuna plina R32',
      lines: [
        { kind: 'labor', description: 'Traženje propuštanja i dopuna plina', qty: 1, unit: 'h', price: 45 },
        { kind: 'material', description: 'Radna tvar R32', qty: 300, unit: 'g', price: 0.15 },
      ],
      inspection: 'air.leak_check',
    },
    {
      code: 'air.install_35',
      name: 'Montaža klime do 3,5 kW',
      lines: [
        { kind: 'package', description: 'Montaža split klime do 3,5 kW (do 3 m instalacije)', qty: 1, unit: 'paušal', price: 280 },
        { kind: 'material', description: 'Dodatni metar instalacije (Cu, izolacija, kabel)', qty: 0, unit: 'm', price: 25 },
      ],
      inspection: 'air.install',
    },
    {
      code: 'air.heat_pump_service',
      name: 'Servis dizalice topline',
      lines: [{ kind: 'package', description: 'Godišnji servis dizalice topline', qty: 1, unit: 'paušal', price: 120 }],
      inspection: 'air.heat_pump',
    },
    {
      code: 'air.leak_check',
      name: 'Provjera propuštanja (F-plin)',
      lines: [{ kind: 'labor', description: 'Periodična provjera propuštanja s upisom u evidenciju', qty: 1, unit: 'paušal', price: 40 }],
      inspection: 'air.leak_check',
    },
    {
      code: 'air.service_multi',
      name: 'Servis multi-split (do 3 unutarnje)',
      lines: [
        { kind: 'package', description: 'Godišnji servis multi-split sustava, do 3 unutarnje jedinice', qty: 1, unit: 'paušal', price: 140 },
        { kind: 'material', description: 'Sredstvo za čišćenje i dezinfekciju', qty: 2, unit: 'kom', price: 8 },
      ],
      inspection: 'air.service_split',
    },
    {
      code: 'air.deep_clean',
      name: 'Dubinsko čišćenje unutarnje jedinice',
      lines: [
        { kind: 'labor', description: 'Rastavljanje i dubinsko čišćenje unutarnje jedinice', qty: 1.5, unit: 'h', price: 45 },
        { kind: 'material', description: 'Sredstvo za čišćenje i dezinfekciju', qty: 1, unit: 'kom', price: 10 },
      ],
    },
    { code: 'air.drain', name: 'Odčepljenje odvoda kondenzata', lines: [{ kind: 'labor', description: 'Odčepljenje i ispiranje odvoda kondenzata', qty: 0.5, unit: 'h', price: 45 }] },
    { code: 'air.dismantle', name: 'Demontaža s povratom plina', lines: [{ kind: 'package', description: 'Demontaža klime s povratom radne tvari', qty: 1, unit: 'paušal', price: 90 }] },
    { code: 'air.relocate', name: 'Premještanje klime', lines: [{ kind: 'package', description: 'Premještanje klime s novom instalacijom do 3 m', qty: 1, unit: 'paušal', price: 250 }], inspection: 'air.install' },
    {
      code: 'air.install_70',
      name: 'Montaža klime od 5 do 7 kW',
      lines: [
        { kind: 'package', description: 'Montaža split klime od 5 do 7 kW (do 3 m instalacije)', qty: 1, unit: 'paušal', price: 350 },
        { kind: 'material', description: 'Dodatni metar instalacije (Cu, izolacija, kabel)', qty: 0, unit: 'm', price: 28 },
      ],
      inspection: 'air.install',
    },
    {
      code: 'air.condensate_pump',
      name: 'Pumpa kondenzata',
      lines: [
        { kind: 'labor', description: 'Ugradnja pumpe kondenzata', qty: 1, unit: 'h', price: 45 },
        { kind: 'part', description: 'Pumpa kondenzata', qty: 1, unit: 'kom', price: 70 },
      ],
    },
    {
      code: 'air.pcb',
      name: 'Elektronika unutarnje jedinice',
      lines: [
        { kind: 'labor', description: 'Zamjena elektroničke pločice', qty: 1, unit: 'h', price: 45 },
        { kind: 'part', description: 'Elektronička pločica', qty: 1, unit: 'kom', price: 120 },
      ],
    },
    {
      code: 'air.fan_motor',
      name: 'Motor ventilatora',
      lines: [
        { kind: 'labor', description: 'Zamjena motora ventilatora', qty: 1.5, unit: 'h', price: 45 },
        { kind: 'part', description: 'Motor ventilatora', qty: 1, unit: 'kom', price: 90 },
      ],
    },
    {
      code: 'air.ventilation',
      name: 'Servis rekuperatora',
      lines: [
        { kind: 'labor', description: 'Servis rekuperatora i čišćenje izmjenjivača', qty: 1, unit: 'h', price: 45 },
        { kind: 'part', description: 'Filteri rekuperatora (set)', qty: 1, unit: 'kom', price: 40 },
      ],
    },
  ],
  modules: ['dvi', 'approvals', 'field_visits', 'maintenance_plans', 'fgas'],
  optionalModules: [],
  moduleTab: 'Uređaj i F-plin',
  modulePage: 'Servisni planovi',
};
