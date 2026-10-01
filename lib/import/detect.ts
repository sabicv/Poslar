// Works out what each column of an imported table holds — from its header
// ("Mob.", "Reg. oznaka", "Kupac") or, without one, from what the values
// look like (a phone, an e-mail, an OIB, a VIN, a Croatian plate) — and
// turns the rows into clients with their vehicles or devices. Rows of the
// same client (same phone, OIB or name) become one client with several
// vehicles.

export type Target =
  | 'skip'
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'company'
  | 'phone'
  | 'email'
  | 'oib'
  | 'address'
  | 'city'
  | 'identifier'
  | 'vin'
  | 'make'
  | 'make_model'
  | 'model'
  | 'year'
  | 'notes';

export function targetLabels(identifier: string, asset: string): Record<Target, string> {
  return {
    skip: 'Ne uvozi',
    full_name: 'Ime i prezime',
    first_name: 'Ime',
    last_name: 'Prezime',
    company: 'Tvrtka',
    phone: 'Telefon',
    email: 'E-mail',
    oib: 'OIB',
    address: 'Adresa',
    city: 'Grad',
    identifier,
    vin: 'VIN / broj šasije',
    make: 'Marka',
    make_model: `${asset} (marka i model)`,
    model: 'Model',
    year: 'Godište',
    notes: 'Napomena',
  };
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const HEADERS: [Target, string[]][] = [
  ['full_name', ['ime i prezime', 'ime prezime', 'prezime i ime', 'prezime ime', 'kupac', 'klijent', 'stranka', 'musterija', 'korisnik', 'vlasnik', 'naziv kupca', 'name', 'full name', 'kontakt', 'osoba']],
  ['first_name', ['ime', 'first name', 'firstname', 'given name']],
  ['last_name', ['prezime', 'last name', 'lastname', 'surname', 'family name']],
  ['company', ['tvrtka', 'firma', 'naziv', 'naziv tvrtke', 'naziv firme', 'poduzece', 'company', 'organization', 'organizacija', 'obrt']],
  ['phone', ['telefon', 'tel', 'mobitel', 'mob', 'gsm', 'broj telefona', 'br telefona', 'phone', 'mobile', 'mobilni', 'kontakt telefon', 'telefon mobitel', 'tel mob']],
  ['email', ['email', 'e mail', 'mail', 'e posta', 'eposta', 'elektronicka posta']],
  ['oib', ['oib', 'porezni broj', 'pdv id', 'vat']],
  ['address', ['adresa', 'ulica', 'ulica i broj', 'address', 'street', 'adresa ulica']],
  ['city', ['grad', 'mjesto', 'city', 'town', 'opcina', 'naselje']],
  ['identifier', ['registracija', 'reg', 'reg oznaka', 'registarska oznaka', 'registarske oznake', 'registracijska oznaka', 'tablice', 'tablica', 'oznaka', 'plate', 'license plate', 'reg broj', 'registracija vozila']],
  ['vin', ['vin', 'sasija', 'broj sasije', 'sasija broj', 'chassis', 'vin broj']],
  ['make', ['marka', 'proizvodac', 'make', 'brand', 'marka vozila']],
  ['make_model', ['vozilo', 'auto', 'automobil', 'marka i model', 'marka model', 'vehicle', 'uredaj', 'stroj', 'plovilo', 'motor']],
  ['model', ['model', 'tip', 'type', 'model vozila']],
  ['year', ['godiste', 'godina', 'god', 'year', 'godina proizvodnje', 'god proizvodnje']],
  ['notes', ['napomena', 'biljeska', 'opis', 'komentar', 'notes', 'note', 'primjedba']],
];

function headerTarget(cell: string): Target | null {
  const f = fold(cell);
  if (!f) return null;
  for (const [target, names] of HEADERS) if (names.includes(f)) return target;
  // "Mobitel kupca", "Reg. oznaka vozila": the first word decides.
  for (const [target, names] of HEADERS) if (names.some((n) => !n.includes(' ') && n.length > 2 && f.split(' ')[0] === n)) return target;
  return null;
}

export function validOib(oib: string): boolean {
  if (!/^\d{11}$/.test(oib)) return false;
  let a = 10;
  for (let i = 0; i < 10; i++) {
    a = (a + Number(oib[i])) % 10;
    if (a === 0) a = 10;
    a = (a * 2) % 11;
  }
  return (11 - a) % 10 === Number(oib[10]);
}

const PLATE = /^[A-ZČĆŽŠĐ]{2}[\s-]*\d{3,4}[\s-]*[A-ZČĆŽŠĐ]{1,2}$/i;
const VIN = /^[A-HJ-NPR-Z0-9]{17}$/i;
const looksLike: Partial<Record<Target, (v: string) => boolean>> = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  oib: (v) => validOib(v.replace(/\s/g, '')),
  vin: (v) => VIN.test(v.replace(/\s/g, '')),
  identifier: (v) => PLATE.test(v.trim()),
  year: (v) => /^(19[5-9]\d|20[0-4]\d)$/.test(v.trim()),
  phone: (v) => /^[+\d][\d\s/().-]{6,}$/.test(v.trim()) && v.replace(/\D/g, '').length >= 8 && v.replace(/\D/g, '').length <= 13,
};

export interface Detected {
  hasHeader: boolean;
  targets: Target[];
}

export function detectColumns(table: string[][]): Detected {
  const width = Math.max(0, ...table.map((r) => r.length));
  const first = table[0] ?? [];
  const fromHeader = Array.from({ length: width }, (_, i) => headerTarget(first[i] ?? ''));
  const hasHeader = fromHeader.filter(Boolean).length >= Math.max(1, Math.ceil(first.filter(Boolean).length / 3));
  const body = hasHeader ? table.slice(1) : table;
  const used = new Set<Target>();
  const targets: Target[] = [];
  for (let i = 0; i < width; i++) {
    let t: Target | null = hasHeader ? fromHeader[i] : null;
    if (!t) {
      const sample = body.map((r) => r[i] ?? '').filter(Boolean).slice(0, 40);
      const share = (test: (v: string) => boolean) => (sample.length ? sample.filter(test).length / sample.length : 0);
      // Most specific patterns first: an OIB is also a long number.
      t = (['email', 'oib', 'vin', 'identifier', 'year', 'phone'] as Target[]).find((k) => share(looksLike[k]!) >= 0.6) ?? null;
      if (!t && sample.length && share((v) => /\p{L}/u.test(v)) >= 0.6 && !used.has('full_name') && !used.has('company') && !used.has('first_name')) t = 'full_name';
    }
    if (t && t !== 'notes' && used.has(t)) t = 'skip';
    targets.push(t ?? 'skip');
    if (t) used.add(t);
  }
  // Without headers, a second short text column next to a plate or VIN is
  // the vehicle ("Opel Astra").
  if (!hasHeader && (used.has('identifier') || used.has('vin')) && !used.has('make') && !used.has('make_model')) {
    const i = targets.findIndex((t, col) => {
      if (t !== 'skip') return false;
      const sample = body.map((r) => r[col] ?? '').filter(Boolean).slice(0, 40);
      return sample.length > 0 && sample.filter((v) => /\p{L}/u.test(v) && v.length <= 40 && !v.includes('@')).length / sample.length >= 0.6;
    });
    if (i >= 0) targets[i] = 'make_model';
  }
  return { hasHeader, targets };
}

export interface ImportAsset {
  identifier: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
}

export interface ImportClient {
  kind: 'person' | 'company';
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  oib: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  assets: ImportAsset[];
}

const COMPANY = /\b(d\.?\s?o\.?\s?o\.?|j\.?\s?d\.?\s?o\.?\s?o\.?|d\.?\s?d\.?|obrt|udruga|ustanova|zadruga|ltd|gmbh)(\W|$)/i;

export function tidyPhone(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  let digits = v.replace(/[^\d+]/g, '');
  // Excel stores a phone as a number and drops the leading zero.
  if (/^[1-9]\d{7,8}$/.test(digits)) digits = `0${digits}`;
  if (/^385\d{8,9}$/.test(digits)) digits = `+${digits}`;
  if (/^00\d{9,}$/.test(digits)) digits = `+${digits.slice(2)}`;
  return digits.replace(/\D/g, '').length >= 6 ? digits : null;
}

export function tidyPlate(raw: string): string | null {
  const v = raw.toUpperCase().replace(/[\s.-]+/g, '');
  if (!v) return null;
  const m = /^([A-ZČĆŽŠĐ]{2})(\d{3,4})([A-ZČĆŽŠĐ]{1,2})$/.exec(v);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : raw.trim().toUpperCase();
}

const blank = (v: string | undefined) => {
  const t = (v ?? '').trim();
  return t ? t : null;
};
// The same client on several rows: same phone (last nine digits), OIB or name.
export const phoneKey = (p: string | null) => (p ? p.replace(/\D/g, '').slice(-9) : '');
export const nameKey = (c: Pick<ImportClient, 'first_name' | 'last_name' | 'company_name'>) =>
  fold([c.company_name, c.first_name, c.last_name].filter(Boolean).join(' '));

export interface BuildResult {
  clients: ImportClient[];
  skipped: number;
}

export function buildClients(table: string[][], detected: Detected, isClimate: boolean): BuildResult {
  const body = detected.hasHeader ? table.slice(1) : table;
  const col = (row: string[], t: Target) => {
    const i = detected.targets.indexOf(t);
    return i >= 0 ? blank(row[i]) : null;
  };
  const byKey = new Map<string, ImportClient>();
  let skipped = 0;
  for (const row of body) {
    let first = col(row, 'first_name');
    let last = col(row, 'last_name');
    let company = col(row, 'company');
    const full = col(row, 'full_name');
    if (full) {
      if (COMPANY.test(full) && !company) company = full;
      else if (!first && !last) {
        // "Horvat, Ivan" or "Ivan Horvat" (the last word is the surname).
        const [a, b] = full.includes(',') ? full.split(',').map((s) => s.trim()) : [null, null];
        if (a && b) [first, last] = [b, a];
        else {
          const words = full.split(/\s+/);
          last = words.length > 1 ? words.pop()! : words[0];
          first = words.length && words[0] !== last ? words.join(' ') : null;
        }
      }
    }
    const oibRaw = col(row, 'oib')?.replace(/\s/g, '') ?? null;
    const client: ImportClient = {
      kind: company ? 'company' : 'person',
      first_name: first,
      last_name: last,
      company_name: company,
      phone: tidyPhone(col(row, 'phone') ?? ''),
      email: col(row, 'email'),
      oib: oibRaw && validOib(oibRaw) ? oibRaw : null,
      address: col(row, 'address'),
      city: col(row, 'city'),
      notes: col(row, 'notes'),
      assets: [],
    };
    if (!client.company_name && !client.first_name && !client.last_name) {
      skipped++;
      continue;
    }
    let make = col(row, 'make');
    let model = col(row, 'model');
    const makeModel = col(row, 'make_model');
    if (makeModel && !make) {
      const [m, ...rest] = makeModel.split(/\s+/);
      make = m;
      model = model ?? (rest.join(' ') || null);
    }
    const yearText = col(row, 'year');
    const year = yearText && /^\d{4}$/.test(yearText) ? Number(yearText) : null;
    const idRaw = col(row, 'identifier');
    const asset: ImportAsset = {
      identifier: idRaw ? (isClimate ? idRaw : tidyPlate(idRaw)) : null,
      vin: col(row, 'vin')?.replace(/\s/g, '').toUpperCase() ?? null,
      make,
      model,
      year: year && year >= 1900 && year <= 2100 ? year : null,
    };

    const key = phoneKey(client.phone) || client.oib || nameKey(client);
    const existing = byKey.get(key);
    const target = existing ?? client;
    if (existing) {
      // Fill what the first row lacked.
      for (const k of ['phone', 'email', 'oib', 'address', 'city', 'notes'] as const) target[k] ??= client[k];
    } else byKey.set(key, client);
    if (asset.identifier || asset.vin || asset.make || asset.model) {
      const same = target.assets.some((a) => (asset.identifier && a.identifier === asset.identifier) || (asset.vin && a.vin === asset.vin));
      if (!same) target.assets.push(asset);
    }
  }
  return { clients: [...byKey.values()], skipped };
}
