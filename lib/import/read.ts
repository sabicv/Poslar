// Turns what a workshop already has into a plain table of text cells, in
// the browser: an Excel workbook (.xlsx, first sheet), a CSV export from an
// old program or Excel (any separator, UTF-8 or the Windows encoding older
// Croatian Excel uses), or a phone address book (.vcf). No libraries: .xlsx
// is a zip of XML files, unpacked with the browser's own decompressor.

export type Table = string[][];

export async function readTable(file: File): Promise<Table> {
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (name.endsWith('.xlsx') || (bytes[0] === 0x50 && bytes[1] === 0x4b)) return readXlsx(bytes);
  if (name.endsWith('.xls')) throw new Error('Stari Excel (.xls) nije podržan. U Excelu odaberite Spremi kao → Excel radna knjiga (.xlsx) ili CSV.');
  const text = decodeText(bytes);
  if (name.endsWith('.vcf') || /^\s*BEGIN:VCARD/i.test(text)) return readVcard(text);
  return readCsv(text);
}

// UTF-8 when it is valid UTF-8, otherwise the Central European Windows
// code page (č, ć, ž, š, đ from an older Excel "Spremi kao CSV").
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1250').decode(bytes);
  }
}

export function readCsv(text: string): Table {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n');
  const separator = [';', '\t', ','].map((s) => ({ s, n: firstLines.split(s).length })).sort((a, b) => b.n - a.n)[0].s;
  const rows: Table = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === separator) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return clean(rows);
}

function clean(rows: Table): Table {
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

// ---------------------------------------------------------------- vCard

function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = [];
  const s = value;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...new TextEncoder().encode(s[i]));
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
}

// One logical line per property: a line starting with a space continues
// the one before; a quoted-printable value ending in "=" continues too.
function vcardLines(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const last = lines.length - 1;
    if (last >= 0 && /^[ \t]/.test(raw)) lines[last] += raw.slice(1);
    else if (last >= 0 && /QUOTED-PRINTABLE/i.test(lines[last].split(':')[0]) && lines[last].endsWith('=')) lines[last] = lines[last].slice(0, -1) + raw;
    else lines.push(raw);
  }
  return lines;
}

export function readVcard(text: string): Table {
  const rows: Table = [['Ime i prezime', 'Telefon', 'E-mail', 'Tvrtka', 'Adresa', 'Grad']];
  for (const card of vcardLines(text).join('\n').split(/BEGIN:VCARD/i).slice(1)) {
    const fields: Record<string, string[]> = {};
    for (const line of card.split('\n')) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const [rawKey, ...params] = line.slice(0, colon).split(';');
      const key = rawKey.replace(/^item\d+\./i, '').toUpperCase();
      let value = line.slice(colon + 1);
      if (params.some((p) => /QUOTED-PRINTABLE/i.test(p))) value = decodeQuotedPrintable(value);
      // A mobile number first, if the card has several.
      const mobile = params.some((p) => /CELL/i.test(p));
      (fields[key] ??= [])[mobile ? 'unshift' : 'push'](value.replace(/\\,/g, ',').replace(/\\;/g, ';').trim());
    }
    const n = (fields.N?.[0] ?? '').split(';');
    const name = fields.FN?.[0] || [n[1], n[0]].filter(Boolean).join(' ');
    const adr = (fields.ADR?.[0] ?? '').split(';');
    rows.push([name, fields.TEL?.[0] ?? '', fields.EMAIL?.[0] ?? '', (fields.ORG?.[0] ?? '').replace(/;+$/, ''), adr[2] ?? '', adr[3] ?? '']);
  }
  return clean(rows);
}

// ---------------------------------------------------------------- .xlsx

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(bytes: Uint8Array, wanted: (name: string) => boolean): Promise<Map<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('Datoteka nije ispravan Excel.');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const out = new Map<string, string>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
    if (!wanted(name)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + size);
    out.set(name, dec.decode(method === 8 ? await inflate(raw) : raw));
  }
  return out;
}

const xml = (text: string | undefined) => new DOMParser().parseFromString(text ?? '<x/>', 'application/xml');
const byTag = (node: Document | Element, tag: string) => Array.from(node.getElementsByTagNameNS('*', tag));

function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function readXlsx(bytes: Uint8Array): Promise<Table> {
  const files = await unzip(bytes, (n) => n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || n === 'xl/sharedStrings.xml' || n.startsWith('xl/worksheets/sheet'));
  // The first sheet in the workbook's own order, through its relationship.
  const firstSheet = byTag(xml(files.get('xl/workbook.xml')), 'sheet')[0];
  const relId = firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? firstSheet?.getAttribute('r:id');
  const rel = byTag(xml(files.get('xl/_rels/workbook.xml.rels')), 'Relationship').find((r) => r.getAttribute('Id') === relId);
  const target = rel?.getAttribute('Target')?.replace(/^\/?(xl\/)?/, 'xl/');
  const sheetXml = (target && files.get(target)) ?? files.get('xl/worksheets/sheet1.xml') ?? [...files.entries()].find(([n]) => n.startsWith('xl/worksheets/sheet'))?.[1];
  if (!sheetXml) throw new Error('U Excelu nije pronađen nijedan list.');

  const shared = byTag(xml(files.get('xl/sharedStrings.xml')), 'si').map((si) => byTag(si, 't').map((t) => t.textContent ?? '').join(''));
  const rows: Table = [];
  for (const row of byTag(xml(sheetXml), 'row')) {
    const cells: string[] = [];
    for (const c of byTag(row, 'c')) {
      const type = c.getAttribute('t');
      const v = byTag(c, 'v')[0]?.textContent ?? '';
      const value = type === 's' ? (shared[Number(v)] ?? '') : type === 'inlineStr' ? byTag(c, 't').map((t) => t.textContent ?? '').join('') : type === 'b' ? (v === '1' ? 'da' : 'ne') : v;
      const ref = c.getAttribute('r');
      cells[ref ? columnIndex(ref) : cells.length] = value;
    }
    rows.push(Array.from(cells, (x) => x ?? ''));
  }
  return clean(rows);
}
