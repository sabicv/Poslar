import type { InspectionTemplate, PackageConfig } from '../tenant.config';
import { DEAL_ZONES } from './condition-zones';
import { checklist } from './shared';

export const DEAL_SOURCES: Record<string, string> = {
  private: 'Otkup od privatne osobe',
  trade_in: 'Staro za novo',
  import: 'Uvoz',
  auction: 'Aukcija',
  leasing: 'Povrat s leasinga',
  company: 'Od tvrtke',
};

// Days on the lot: the number a dealer watches most. Past 60 the car
// costs money standing; past 90 it is time to drop the price.
export function stockTone(days: number): 'ok' | 'warn' | 'crit' {
  return days > 90 ? 'crit' : days > 60 ? 'warn' : 'ok';
}

// Whole days from purchase to sale, or to today while the car stands.
export function daysOnLot(purchasedOn: string, soldOn: string | null, today: string): number {
  const day = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.max(0, Math.round((day(soldOn ?? today) - day(purchasedOn)) / 86400000));
}

// What the car earned: sale price less purchase price and the cost of
// getting it ready (net of VAT for a workshop in the VAT system, since it
// gets that VAT back). Null until both prices are known.
export function dealMargin(sale: number | null, purchase: number | null, costs: number): number | null {
  if (sale === null || purchase === null) return null;
  return Math.round((sale - purchase - costs) * 100) / 100;
}

const buyCheck: InspectionTemplate = {
  code: 'deal.buy_check',
  name: 'Pregled pri otkupu',
  purpose: 'dvi',
  sections: [
    {
      title: 'A · Papiri',
      items: [
        { code: 'a01', label: 'Vlasnik u prometnoj je prodavatelj' },
        { code: 'a02', label: 'VIN na vozilu odgovara prometnoj' },
        { code: 'a03', label: 'Servisna povijest' },
        { code: 'a04', label: 'Broj ključeva', unit: 'kom', warnBelow: 2, critBelow: 1 },
      ],
    },
    {
      title: 'B · Karoserija',
      items: [
        { code: 'b01', label: 'Debljina laka (najviša izmjerena)', unit: 'µm', warnAbove: 300, critAbove: 500 },
        { code: 'b02', label: 'Hrđa (pragovi, blatobrani, pod)' },
        { code: 'b03', label: 'Stakla i svjetla' },
        { code: 'b04', label: 'Dubina šare gume (najmanja)', unit: 'mm', warnBelow: 3, critBelow: 1.6 },
      ],
    },
    {
      title: 'C · Motor i vožnja',
      items: [
        { code: 'c01', label: 'Greške u memoriji (dijagnostika)' },
        { code: 'c02', label: 'Curenje ulja ili tekućina' },
        { code: 'c03', label: 'Mjenjač i kvačilo u probnoj vožnji' },
        { code: 'c04', label: 'Kočnice i ovjes u probnoj vožnji' },
        { code: 'c05', label: 'Klima hladi' },
        { code: 'c06', label: 'Kilometraža odgovara servisnoj povijesti' },
      ],
    },
  ],
};

export const deal: PackageConfig = {
  id: 'deal',
  product: 'Auto plac',
  short: 'Auto plac',
  domain: 'auto-plac.poslar.eu',
  tagline: 'Otkup, priprema i prodaja rabljenih vozila',
  pitch: [
    'Svako vozilo na placu: dani, troškovi i zarada',
    'Priprema za prodaju kao nalog: servis, poliranje, slike',
    'Probne vožnje upisane s brojem vozačke',
  ],
  sector: 'workshop',
  accent: '#00C46A',
  // The work orders are the dealer's own cost of getting a car ready, not
  // a bill to a customer: no "Za naplatu" and no invoice on them.
  internalJobs: true,
  vocabulary: {
    client: { one: 'Stranka', many: 'Stranke', new: 'Nova stranka', acc: 'stranku' },
    asset: { one: 'Vozilo', many: 'Vozila', new: 'Novo vozilo' },
    identifier: 'Registracija',
  },
  assetTypes: ['car', 'van', 'motorcycle', 'truck'],
  defaultAssetType: 'car',
  phaseLabels: {
    intake: 'Otkupljeno',
    diagnosis: 'Pregled',
    awaiting_approval: 'Čeka odluku',
    awaiting_parts: 'Čeka dijelove',
    in_progress: 'Priprema',
    quality_check: 'Slikanje i oglas',
    ready: 'Na prodaju',
    collected: 'Prodano',
  },
  opening: { intake: 'Sljedeće: pregled i trošak pripreme.', diagnosis: 'Sljedeće: priprema za prodaju.', tab: 'modul' },
  symptoms: ['Otkup od privatne osobe', 'Staro za novo', 'Uvoz', 'Servis prije prodaje', 'Poliranje i čišćenje', 'Popravak limarije', 'Priprema za tehnički', 'Slikanje za oglas'],
  photoTags: [
    { code: 'ad', label: 'Za oglas' },
    { code: 'intake', label: 'Stanje pri otkupu' },
    { code: 'damage', label: 'Oštećenje' },
    { code: 'meter', label: 'Kilometraža' },
    { code: 'document', label: 'Papiri (prometna, knjižica)' },
    { code: 'after', label: 'Nakon pripreme' },
  ],
  diagram: 'car',
  conditionZones: DEAL_ZONES,
  marks: [
    { code: 'O', label: 'Ogrebotina' },
    { code: 'K', label: 'Odlupan lak' },
    { code: 'U', label: 'Udubljenje' },
    { code: 'P', label: 'Pukotina' },
    { code: 'L', label: 'Lakirano' },
    { code: 'R', label: 'Korozija' },
    { code: 'I', label: 'Istrošeno' },
    { code: 'B', label: 'Savijeno' },
    { code: 'N', label: 'Nedostaje' },
    { code: 'D', label: 'Kvar / defekt / neispravno' },
  ],
  equipment: ['Ključevi (oba)', 'Daljinski', 'Prometna dozvola', 'Servisna knjižica', 'Rezervni kotač', 'Druge gume', 'Radio kod'],
  inspections: [
    buyCheck,
    checklist('deal.ready', 'Spremno za prodaju', 'checklist', 'Prije oglasa', [
      'Servis obavljen ili upisan',
      'Dubinsko čišćenje i poliranje',
      'Fotografije za oglas (barem 20)',
      'Oglas objavljen',
      'Ključevi i papiri u registratoru',
      'Tehnički pregled važeći',
    ]),
  ],
  templates: [
    { code: 'deal.buy_check', name: 'Pregled pri otkupu', lines: [{ kind: 'labor', description: 'Pregled i dijagnostika pri otkupu', qty: 1, unit: 'h', price: 40 }], inspection: 'deal.buy_check' },
    {
      code: 'deal.service',
      name: 'Servis prije prodaje',
      lines: [
        { kind: 'labor', description: 'Zamjena ulja i filtera', qty: 0.6, unit: 'h', price: 40 },
        { kind: 'part', description: 'Filter ulja', qty: 1, unit: 'kom', price: 12 },
        { kind: 'part', description: 'Filter kabine', qty: 1, unit: 'kom', price: 15 },
        { kind: 'material', description: 'Motorno ulje', qty: 5, unit: 'l', price: 11 },
      ],
    },
    { code: 'deal.detailing', name: 'Dubinsko čišćenje i poliranje', lines: [{ kind: 'sublet', description: 'Dubinsko čišćenje i poliranje', qty: 1, unit: 'paušal', price: 150 }] },
    { code: 'deal.photos', name: 'Slikanje i oglas', lines: [{ kind: 'labor', description: 'Fotografiranje i objava oglasa', qty: 1, unit: 'h', price: 25 }], inspection: 'deal.ready' },
    { code: 'deal.tech', name: 'Tehnički pregled', lines: [{ kind: 'sublet', description: 'Tehnički pregled', qty: 1, unit: 'paušal', price: 45 }] },
    { code: 'deal.registration', name: 'Registracija', lines: [{ kind: 'sublet', description: 'Registracija vozila', qty: 1, unit: 'paušal' }] },
    {
      code: 'deal.tyres',
      name: 'Komplet guma',
      lines: [
        { kind: 'part', description: 'Guma', qty: 4, unit: 'kom', price: 80 },
        { kind: 'labor', description: 'Montaža i balansiranje', qty: 0.8, unit: 'h', price: 40 },
      ],
    },
    { code: 'deal.brakes', name: 'Kočnice naprijed', lines: [{ kind: 'labor', description: 'Zamjena pločica i diskova naprijed', qty: 1.2, unit: 'h', price: 40 }, { kind: 'part', description: 'Pločice i diskovi naprijed', qty: 1, unit: 'kom', price: 140 }] },
    { code: 'deal.pdr', name: 'Udubljenje bez lakiranja', lines: [{ kind: 'sublet', description: 'Popravak udubljenja bez lakiranja', qty: 1, unit: 'kom', price: 60 }] },
    { code: 'deal.paint', name: 'Lakiranje elementa', lines: [{ kind: 'sublet', description: 'Lakiranje jednog elementa', qty: 1, unit: 'kom', price: 180 }] },
    { code: 'deal.transport', name: 'Prijevoz vozila', lines: [{ kind: 'sublet', description: 'Prijevoz vozila do placa', qty: 1, unit: 'paušal', price: 120 }] },
  ],
  modules: ['dvi', 'condition_report'],
  optionalModules: [],
  moduleTab: 'Otkup i prodaja',
  modulePage: 'Vozila na prodaju',
};
