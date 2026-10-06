// Writes the Poslar brand files into public/brand, pure vector (the letters
// are paths, so no font is needed where they are shown):
//   poslar-logo.svg  blue pill, "Poslar" in Saira Condensed Bold, orange
//                    with a white outline, the mark at the letters' ink height
//   poslar-mark.svg  the mark alone (blue tile, white line)
// The outline of the letters and the mark's line are the same width.
// Run: npm run brand
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import { BLUE, ORANGE, WHITE, markShapes, poslarMark } from './brand-mark.mjs';

const FONT_SIZE = 80;
const STROKE = 7;
const GAP = 16;
const PADX = 50;
const PADY = 34;
const RADIUS = 30;

const dir = path.dirname(fileURLToPath(import.meta.url));
const buf = readFileSync(path.join(dir, 'assets', 'SairaCondensed-Bold.ttf'));
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const n = (v) => +v.toFixed(2);

function lockup(word) {
  const glyphs = font.getPath(word, 0, 0, FONT_SIZE, { kerning: true });
  const bb = glyphs.getBoundingBox();
  // Close every contour, or the outline gets a notch where each letter's
  // outline starts (the font's paths end with L, not Z).
  const d = `${glyphs.toPathData(2).replace(/Z?M/g, (m, i) => (i === 0 ? 'M' : 'ZM'))}Z`.replace(/ZZ/g, 'Z');
  const ink = { left: bb.x1 - STROKE / 2, right: bb.x2 + STROKE / 2, top: bb.y1 - STROKE / 2, bottom: bb.y2 + STROKE / 2 };
  const inkH = ink.bottom - ink.top;
  const m = poslarMark();
  const [e0, e1] = m.extent;
  const s = inkH / (e1 - e0);
  const tx = ink.right + GAP - e0 * s;
  const ty = ink.top - e0 * s;
  const right = ink.right + GAP + (e1 - e0) * s;
  const box = { x: ink.left - PADX, y: ink.top - PADY, w: right - ink.left + 2 * PADX, h: inkH + 2 * PADY };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(box.x)} ${n(box.y)} ${n(box.w)} ${n(box.h)}" width="${n(box.w)}" height="${n(box.h)}">
  <title>Poslar</title>
  <rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" rx="${RADIUS}" fill="${BLUE}"/>
  <path d="${d}" fill="none" stroke="${WHITE}" stroke-width="${STROKE}" stroke-linejoin="round"/>
  <path d="${d}" fill="${ORANGE}"/>
  <g transform="translate(${n(tx)} ${n(ty)}) scale(${n(s)})">${markShapes(m)}</g>
</svg>
`;
}

function markOnly() {
  const m = poslarMark();
  const [e0, e1] = m.extent.map(n);
  const size = n(e1 - e0);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${e0} ${e0} ${size} ${size}" width="${size}" height="${size}"><title>Poslar</title>${markShapes(m)}</svg>
`;
}

const out = path.join(process.cwd(), 'public', 'brand');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'poslar-logo.svg'), lockup('Poslar'));
writeFileSync(path.join(out, 'poslar-mark.svg'), markOnly());
console.log('brand: public/brand/poslar-logo.svg, poslar-mark.svg');
