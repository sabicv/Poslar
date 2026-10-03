// Generates app icons into public/icons:
//   <id>-192.png, <id>-512.png, <id>-maskable-512.png, <id>-180.png (Apple)
// TaktIX: the orange X with a black outline on light blue. Each trade: a
// dark tile with its glyph glowing in the trade colour (same shapes as the
// lucide icons in the app). Run: npm run icons
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BRAND_X = 'M27 15H43L52.6 37L71 15H87L59 50L73 85H57L47.4 63L29 85H13L41 50Z';
const TILE = '#0B1220';

const PRODUCTS = {
  volt: { accent: '#FFD60A', glyph: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>' },
  gear: {
    accent: '#E8112D',
    glyph:
      '<path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 2v2M12 22v-2M17 20.66l-1-1.73M11 10.27 7 3.34M20.66 17l-1.73-1M3.34 7l1.73 1M14 12h8M2 12h2M20.66 7l-1.73 1M3.34 17l1.73-1M17 3.34l-1 1.73M11 13.73l-4 6.93"/>',
  },
  body: {
    accent: '#0E9AA7',
    glyph: '<path d="M3 3h.01M7 5h.01M11 7h.01M3 7h.01M7 9h.01M3 11h.01"/><rect width="4" height="4" x="15" y="5"/><path d="m19 9 2 2v10c0 .6-.4 1-1 1h-6c-.6 0-1-.4-1-1V11l2-2"/><path d="m13 14 8-2M13 19l8-2"/>',
  },
  wheel: {
    accent: '#C9953C',
    glyph: '<circle cx="12" cy="12" r="10"/><path d="M6 12c0-1.7.7-3.2 1.8-4.2"/><circle cx="12" cy="12" r="2"/><path d="M18 12c0 1.7-.7 3.2-1.8 4.2"/>',
  },
  fleet: {
    accent: '#F25C05',
    glyph: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  },
  moto: { accent: '#66CC33', glyph: '<path d="M12 22V8M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>' },
  air: {
    accent: '#5CE1E6',
    glyph: '<path d="M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z"/><path d="M12 12v.01"/>',
  },
};

// A trade: dark tile, a soft glow under the glyph and a thin ring in its colour.
function productSvg({ accent, glyph }, size, { maskable = false } = {}) {
  // Maskable icons need the glyph inside the central 80% safe zone.
  const radius = maskable ? 0 : size * 0.22;
  const glyphSize = size * (maskable ? 0.46 : 0.56);
  const offset = (size - glyphSize) / 2;
  const ring = maskable
    ? ''
    : `<rect x="${size * 0.02}" y="${size * 0.02}" width="${size * 0.96}" height="${size * 0.96}" rx="${radius * 0.92}" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="${size * 0.02}"/>`;
  const drawGlyph = (width) =>
    `<svg x="${offset}" y="${offset}" width="${glyphSize}" height="${glyphSize}" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${size * 0.018}"/></filter></defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="${TILE}"/>${ring}
  <g filter="url(#glow)" opacity="0.8">${drawGlyph(3)}</g>
  ${drawGlyph(2.3)}
</svg>`;
}

// TaktIX: the X scaled into the light blue tile (smaller for maskable).
function brandSvg(size, { maskable = false } = {}) {
  const radius = maskable ? 0 : size * 0.22;
  const scale = ((maskable ? 0.72 : 1) * size) / 100;
  const shift = (size - 100 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#6CC5EA"/>
  <g transform="translate(${shift} ${shift}) scale(${scale})">
    <path d="${BRAND_X}" fill="#0B0F14" stroke="#0B0F14" stroke-width="9" stroke-linejoin="round"/>
    <path d="${BRAND_X}" fill="#FF6A13"/>
  </g>
</svg>`;
}

const out = path.join(process.cwd(), 'public', 'icons');
mkdirSync(out, { recursive: true });

const ALL = { taktix: null, ...PRODUCTS };
for (const [id, product] of Object.entries(ALL)) {
  const draw = (size, opts) => (product ? productSvg(product, size, opts) : brandSvg(size, opts));
  const jobs = [
    [`${id}-192.png`, draw(192)],
    [`${id}-512.png`, draw(512)],
    [`${id}-maskable-512.png`, draw(512, { maskable: true })],
    // Apple adds its own rounding: a full square.
    [`${id}-180.png`, draw(180, { maskable: true })],
  ];
  for (const [name, source] of jobs) {
    await sharp(Buffer.from(source)).png().toFile(path.join(out, name));
  }
  console.log('icons:', id);
}
