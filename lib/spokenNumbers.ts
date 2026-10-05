// Numbers as the phone's speech recognition hands them over. Croatian
// recognition writes many numbers out ("pet", "dvanaest i pol", "nula
// devedeset osam") and mixes them with digits ("120 tisuća", "12.6"). A
// number field keeps only digits, so written-out words used to vanish.
//
// Words build one number while they fit together ("sto dvadeset tri" =
// 123, "dvije tisuće dvadeset četiri" = 2024); a word that no longer fits
// starts the next group, and groups are written one after another, the way
// a phone number or an OIB is read out ("nula devedeset osam" = 098,
// "devetnaest devedeset osam" = 1998).

const UNITS: Record<string, number> = {
  jedan: 1, jedna: 1, jedno: 1, jednu: 1,
  dva: 2, dvije: 2, dvoje: 2,
  tri: 3, troje: 3,
  četiri: 4, cetiri: 4, četvero: 4,
  pet: 5, šest: 6, sest: 6, sedam: 7, osam: 8, devet: 9,
};
const TEENS: Record<string, number> = {
  deset: 10, jedanaest: 11, dvanaest: 12, trinaest: 13, četrnaest: 14, cetrnaest: 14,
  petnaest: 15, šesnaest: 16, sesnaest: 16, sedamnaest: 17, osamnaest: 18, devetnaest: 19,
};
const TENS: Record<string, number> = {
  dvadeset: 20, trideset: 30, četrdeset: 40, cetrdeset: 40, pedeset: 50,
  šezdeset: 60, sezdeset: 60, sedamdeset: 70, osamdeset: 80, devedeset: 90,
};
const HUNDREDS: Record<string, number> = {
  sto: 100, stotinu: 100, stotina: 100,
  dvjesto: 200, dvjesta: 200, dvesto: 200, dvesta: 200,
  tristo: 300, trista: 300,
  četiristo: 400, cetiristo: 400, četristo: 400, cetristo: 400,
  petsto: 500, peststo: 500,
  šesto: 600, šeststo: 600, sesto: 600, seststo: 600,
  sedamsto: 700, osamsto: 800, devetsto: 900,
};
const THOUSAND = new Set(['tisuću', 'tisuća', 'tisuće', 'tisucu', 'tisuca', 'tisuce', 'hiljadu', 'hiljada', 'hiljade']);
const DECIMAL = new Set(['zarez', 'koma', 'točka', 'tocka']);
const HALF = new Set(['pol', 'pola']);
const ZERO = new Set(['nula', 'nule']);

function wordValue(word: string): number | undefined {
  return UNITS[word] ?? TEENS[word] ?? TENS[word] ?? HUNDREDS[word];
}

// Is a piece of speech only a number? ("pedeset šest", "56", "dvanaest i pol")
export function isNumberWords(words: string[]): boolean {
  return (
    words.length > 0 &&
    words.every((w) => /^[\d.,+-]+$/.test(w) || wordValue(w) !== undefined || w.startsWith('stotin') || ZERO.has(w) || THOUSAND.has(w) || DECIMAL.has(w) || HALF.has(w) || w === 'i' || w === 'plus' || w === 'minus')
  );
}

type Group = { thousands: number | null; cur: number; h: boolean; t: boolean; u: boolean; any: boolean };
const emptyGroup = (): Group => ({ thousands: null, cur: 0, h: false, t: false, u: false, any: false });

// Spoken text → digits with the signs a field needs: "," for a decimal,
// "+" and "-", and a space where the phone itself left a gap between digits.
function spokenToDigits(text: string): string {
  const tokens = text.toLowerCase().match(/[+-]|\d(?:[\d.,]*\d)?|\p{L}+/gu) ?? [];
  const out: string[] = [];
  let g = emptyGroup();
  const flush = () => {
    if (g.any) out.push(String((g.thousands ?? 0) + g.cur));
    g = emptyGroup();
  };

  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k];
    const next = tokens[k + 1];

    if (/^\d/.test(tok)) {
      // A plain number can take "tisuća" after it or finish "dvadeset 5".
      const plain = /^[1-9]\d*$/.test(tok) || tok === '0';
      const n = Number(tok);
      if (plain && g.any && g.t && !g.u && n < 10) {
        g.cur += n;
        g.u = true;
      } else if (plain && g.any && g.thousands !== null && g.cur === 0 && n < 1000) {
        g.cur = n;
        g.h = g.t = g.u = true;
      } else if (plain && next && THOUSAND.has(next)) {
        flush();
        out.push(' ');
        g = { thousands: null, cur: n, h: true, t: true, u: true, any: true };
      } else {
        flush();
        // "120.000" is a thousand separator, "12.6" a decimal written the English way.
        let digits = tok;
        if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(digits)) digits = digits.replace(/\./g, '');
        else digits = digits.replace(/\./g, ',');
        out.push(' ', digits);
      }
      continue;
    }

    if (ZERO.has(tok)) {
      flush();
      out.push('0');
      continue;
    }
    if (THOUSAND.has(tok)) {
      if (g.thousands !== null) flush();
      g.thousands = (g.any ? g.cur : 1) * 1000;
      g.cur = 0;
      g.h = g.t = g.u = false;
      g.any = true;
      continue;
    }
    // "tri stotine", "pet stotina"
    if (tok.startsWith('stotin') && g.any && g.u && !g.t && !g.h && g.cur < 10) {
      g.cur *= 100;
      g.h = true;
      g.u = false;
      continue;
    }
    const v = wordValue(tok) ?? (tok === 'stotine' ? 100 : undefined);
    if (v !== undefined) {
      const fits = v < 10 ? !g.u : v < 100 ? !g.t && !g.u : !g.h && !g.t && !g.u;
      if (!fits) flush();
      g.cur += v;
      g.any = true;
      if (v < 10) g.u = true;
      else if (v < 20) g.t = g.u = true;
      else if (v < 100) g.t = true;
      else g.h = true;
      continue;
    }
    if (DECIMAL.has(tok)) {
      flush();
      out.push(',');
      continue;
    }
    // "dva i pol", "12 i pola", "dva i po"; "i" alone joins ("dvadeset i pet").
    if (tok === 'i' && next && (HALF.has(next) || next === 'po')) {
      flush();
      out.push(',5');
      k++;
      continue;
    }
    if (tok === 'i') continue;
    if (HALF.has(tok)) {
      const after = g.any || out.some((p) => /\d/.test(p));
      flush();
      out.push(after ? ',5' : '0,5');
      continue;
    }
    if (tok === 'plus' || tok === '+') {
      flush();
      out.push(' +');
      continue;
    }
    if (tok === 'minus' || tok === '-') {
      flush();
      out.push('-');
      continue;
    }
    // Any other word ("volti", "kilometara") ends the number being built.
    flush();
    out.push(' ');
  }
  flush();
  return out.join('');
}

// A measured value: "12,6", "120000", "-5", "0,5".
export function spokenNumber(text: string): string {
  const raw = spokenToDigits(text).replace(/[^\d,-]/g, '');
  const negative = raw.startsWith('-');
  let digits = raw.replace(/-/g, '');
  const comma = digits.indexOf(',');
  if (comma >= 0) digits = digits.slice(0, comma + 1) + digits.slice(comma + 1).replace(/,/g, '');
  if (digits.startsWith(',')) digits = `0${digits}`;
  return digits && negative ? `-${digits}` : digits;
}

// Digits only: an OIB, a postal code, a year.
export function spokenDigits(text: string): string {
  return spokenToDigits(text).replace(/\D/g, '');
}

// A phone number: digits, "+" at the start, the phone's own gaps kept.
export function spokenPhone(text: string): string {
  const s = spokenToDigits(text).replace(/[^\d+ ]/g, '').replace(/\s+/g, ' ').trim();
  const plus = s.startsWith('+');
  const rest = s.replace(/\+/g, '').trim();
  return plus ? `+${rest}` : rest;
}
