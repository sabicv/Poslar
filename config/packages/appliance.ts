import type { InspectionTemplate, PackageConfig } from '../tenant.config';
import { checklist, COMMON_PHOTO_TAGS } from './shared';

// Servis kućanskih aparata: washing machines, dishwashers, fridges, ovens,
// dryers and coffee machines, mostly at the customer's home. The model and
// serial number come from a photo of the rating plate, the fault code and
// the measurements go on the record, and a repair carries its warranty.

const check: InspectionTemplate = {
  code: 'appliance.check',
  name: 'Pregled uređaja',
  purpose: 'dvi',
  sections: [
    {
      title: 'A · Uređaj',
      items: [
        { code: 'a01', label: 'Fotografija natpisne pločice' },
        { code: 'a02', label: 'Šifra greške na zaslonu' },
        { code: 'a03', label: 'Starost uređaja', unit: 'god.' },
        { code: 'a04', label: 'Uređaj priključen i uzemljen' },
      ],
    },
    {
      title: 'B · Mjerenja',
      items: [
        { code: 'b01', label: 'Otpor grijača', unit: 'Ω' },
        { code: 'b02', label: 'Struja motora ili kompresora', unit: 'A' },
        { code: 'b03', label: 'Otpor izolacije', unit: 'MΩ', warnBelow: 2, critBelow: 1 },
        { code: 'b04', label: 'Temperatura (hladnjak, pećnica, voda)', unit: '°C' },
      ],
    },
    {
      title: 'C · Pregled',
      items: [
        { code: 'c01', label: 'Pumpa i filter odvoda' },
        { code: 'c02', label: 'Brtva vrata' },
        { code: 'c03', label: 'Ležajevi i remen (perilica)' },
        { code: 'c04', label: 'Kamenac' },
        { code: 'c05', label: 'Curenje ispod uređaja' },
      ],
    },
  ],
};

export const appliance: PackageConfig = {
  id: 'appliance',
  product: 'Servis kućanskih aparata',
  short: 'Kućanski aparati',
  domain: 'kucanskiaparati.poslar.eu',
  tagline: 'Perilice, hladnjaci, štednjaci i aparati za kavu',
  pitch: ['Model i serijski broj sa slike pločice', 'Šifra greške i mjerenja na zapisniku', 'Jamstvo na popravak uz svaku stavku'],
  sector: 'field',
  accent: '#1CA7DD',
  vocabulary: {
    client: { one: 'Mušterija', many: 'Mušterije', new: 'Nova mušterija', acc: 'mušteriju' },
    asset: { one: 'Uređaj', many: 'Uređaji', new: 'Novi uređaj' },
    identifier: 'Oznaka uređaja',
  },
  assetTypes: ['washer', 'dishwasher', 'fridge', 'oven', 'dryer', 'coffee_machine', 'small_appliance'],
  defaultAssetType: 'washer',
  phaseLabels: { intake: 'Novi zahtjev', diagnosis: 'Zakazano', in_progress: 'Na terenu', ready: 'Popravljeno', collected: 'Zatvoreno' },
  symptoms: ['Ne izbacuje vodu', 'Ne grije', 'Curi voda', 'Ne pali', 'Buka pri centrifugi', 'Ne hladi', 'Greška na zaslonu', 'Vrata se ne zatvaraju', 'Čišćenje kamenca'],
  photoTags: [{ code: 'nameplate', label: 'Natpisna pločica' }, { code: 'error_code', label: 'Šifra greške' }, ...COMMON_PHOTO_TAGS],
  diagram: 'car',
  equipment: [],
  inspections: [
    check,
    checklist('appliance.handover', 'Završetak popravka', 'checklist', 'Prije odlaska', [
      'Uređaj isproban u punom ciklusu',
      'Nema curenja nakon probe',
      'Stari dio pokazan mušteriji',
      'Mušterija zna koliko traje jamstvo',
    ]),
  ],
  templates: [
    { code: 'appliance.visit', name: 'Izlazak i dijagnostika', lines: [{ kind: 'fee', description: 'Izlazak i dijagnostika kvara', qty: 1, unit: 'paušal', price: 35 }], inspection: 'appliance.check' },
    { code: 'appliance.hour', name: 'Sat rada', lines: [{ kind: 'labor', description: 'Servisni radovi', qty: 1, unit: 'h', price: 35 }] },
    {
      code: 'appliance.pump',
      name: 'Zamjena pumpe odvoda',
      lines: [
        { kind: 'labor', description: 'Zamjena pumpe odvoda', qty: 0.7, unit: 'h', price: 35 },
        { kind: 'part', description: 'Pumpa odvoda', qty: 1, unit: 'kom', price: 40 },
      ],
      inspection: 'appliance.handover',
    },
    {
      code: 'appliance.heater',
      name: 'Zamjena grijača',
      lines: [
        { kind: 'labor', description: 'Zamjena grijača', qty: 1, unit: 'h', price: 35 },
        { kind: 'part', description: 'Grijač', qty: 1, unit: 'kom', price: 35 },
      ],
      inspection: 'appliance.handover',
    },
    {
      code: 'appliance.bearings',
      name: 'Zamjena ležajeva perilice',
      lines: [
        { kind: 'labor', description: 'Rastavljanje bubnja i zamjena ležajeva i semeringa', qty: 2.5, unit: 'h', price: 35 },
        { kind: 'part', description: 'Ležajevi i semering (komplet)', qty: 1, unit: 'kom', price: 35 },
      ],
      inspection: 'appliance.handover',
    },
    {
      code: 'appliance.gasket',
      name: 'Zamjena brtve vrata',
      lines: [
        { kind: 'labor', description: 'Zamjena brtve vrata', qty: 0.7, unit: 'h', price: 35 },
        { kind: 'part', description: 'Brtva vrata', qty: 1, unit: 'kom', price: 45 },
      ],
    },
    {
      code: 'appliance.thermostat',
      name: 'Zamjena termostata hladnjaka',
      lines: [
        { kind: 'labor', description: 'Zamjena termostata', qty: 0.7, unit: 'h', price: 35 },
        { kind: 'part', description: 'Termostat', qty: 1, unit: 'kom', price: 30 },
      ],
    },
    { code: 'appliance.descale', name: 'Čišćenje kamenca', lines: [{ kind: 'package', description: 'Čišćenje kamenca i servis aparata za kavu', qty: 1, unit: 'paušal', price: 45 }] },
    { code: 'appliance.filters', name: 'Čišćenje filtera i odvoda', lines: [{ kind: 'labor', description: 'Čišćenje filtera, sifona i odvoda', qty: 0.5, unit: 'h', price: 35 }] },
  ],
  modules: ['dvi', 'approvals', 'field_visits', 'maintenance_plans'],
  optionalModules: [],
  moduleTab: 'Uređaj i servis',
  modulePage: 'Servisni planovi',
  plan: {
    title: 'Redovno čišćenje kamenca',
    template: 'appliance.descale',
    months: 6,
    hint: 'Redovni servis (npr. aparat za kavu svakih 6 mjeseci) uključuje se na nalogu, kartica „Uređaj i servis”. Mušterija se ovdje pojavi mjesec dana prije roka.',
  },
};
