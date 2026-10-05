// Generates app icons into public/icons:
//   <id>-192.png, <id>-512.png, <id>-maskable-512.png, <id>-180.png (Apple)
// TaktiX: the blue metronome with the orange arrow pendulum swinging from
// the middle of its base, on a dark tile (components/ProductMark.tsx draws
// the same). Each trade: a dark tile with its glyph glowing in the trade
// colour (same shapes as the lucide icons in the app). Run: npm run icons
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BRAND_TILE = '#0D172C';
const BRAND_ORANGE = '#FC6002';
const BRAND_BLUE = '#2875BC';
const WEIGHT = 'x="59.84" y="52.76" width="7.2" height="13.6" rx="1.8" transform="rotate(-45 63.44 59.56)"';
const BRAND_SYMBOL = `<g transform="translate(-1.5 0)">
  <path d="M50 7L58.5 14.5L77 80H23L41.5 14.5Z" fill="${BRAND_BLUE}"/>
  <rect x="48" y="20" width="4" height="9" rx="1.2" fill="${BRAND_TILE}"/>
  <rect x="48" y="32" width="4" height="14" rx="1.2" fill="${BRAND_TILE}"/>
  <rect x="15" y="82.5" width="70" height="6.5" rx="1.6" fill="${BRAND_BLUE}"/>
  <rect x="23" y="91" width="11" height="3.2" rx="0.9" fill="#1D5FA6"/>
  <rect x="66" y="91" width="11" height="3.2" rx="0.9" fill="#1D5FA6"/>
  <g stroke="${BRAND_TILE}" stroke-linejoin="round" stroke-linecap="round">
    <path d="M50 73L74.75 48.25" stroke-width="9" fill="none"/>
    <path d="M82.53 40.47L78.99 53.91L69.09 44.01Z" stroke-width="3.4" fill="${BRAND_TILE}"/>
    <rect ${WEIGHT} fill="${BRAND_TILE}" stroke-width="3.4"/>
    <circle cx="50" cy="73" r="3.8" fill="${BRAND_TILE}" stroke-width="3"/>
  </g>
  <path d="M50 73L74.75 48.25" stroke="${BRAND_ORANGE}" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M82.53 40.47L78.99 53.91L69.09 44.01Z" fill="${BRAND_ORANGE}"/>
  <rect ${WEIGHT} fill="${BRAND_ORANGE}"/>
  <circle cx="50" cy="73" r="3.6" fill="${BRAND_ORANGE}"/>
</g>`;
const TILE = '#0B1220';

const PRODUCTS = {
  volt: { accent: '#FFD60A', glyph: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>' },
  gear: {
    accent: '#E8112D',
    glyph:
      '<path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 2v2M12 22v-2M17 20.66l-1-1.73M11 10.27 7 3.34M20.66 17l-1.73-1M3.34 7l1.73 1M14 12h8M2 12h2M20.66 7l-1.73 1M3.34 17l1.73-1M17 3.34l-1 1.73M11 13.73l-4 6.93"/>',
  },
  body: {
    accent: '#FF6A00',
    glyph: '<path d="M3 3h.01M7 5h.01M11 7h.01M3 7h.01M7 9h.01M3 11h.01"/><rect width="4" height="4" x="15" y="5"/><path d="m19 9 2 2v10c0 .6-.4 1-1 1h-6c-.6 0-1-.4-1-1V11l2-2"/><path d="m13 14 8-2M13 19l8-2"/>',
  },
  wheel: {
    accent: '#C9953C',
    glyph: '<circle cx="12" cy="12" r="10"/><path d="M6 12c0-1.7.7-3.2 1.8-4.2"/><circle cx="12" cy="12" r="2"/><path d="M18 12c0 1.7-.7 3.2-1.8 4.2"/>',
  },
  fleet: {
    accent: '#94A3B8',
    glyph: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  },
  moto: { accent: '#0AB4FF', glyph: '<path d="M12 22V8M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>' },
  air: {
    accent: '#5CE1E6',
    glyph: '<path d="M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z"/><path d="M12 12v.01"/>',
  },
  aqua: {
    accent: '#2F7BFF',
    glyph:
      '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>',
  },
  tow: {
    accent: '#E3FF00',
    glyph:
      '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1M18.5 4.5 18 5M2 12h1M12 2v1M4.929 4.929l.707.707M12 12v6"/>',
  },
  deal: {
    accent: '#00C46A',
    glyph:
      '<path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2M19 18v2"/>',
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

// TaktiX: the metronome on its dark tile (smaller for maskable).
function brandSvg(size, { maskable = false } = {}) {
  const radius = maskable ? 0 : size * 0.22;
  const scale = ((maskable ? 0.72 : 1) * size) / 100;
  const shift = (size - 100 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND_TILE}"/>
  <g transform="translate(${shift} ${shift}) scale(${scale})">${BRAND_SYMBOL}</g>
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
