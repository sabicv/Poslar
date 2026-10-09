// Generates app icons into public/icons:
//   <id>-192.png, <id>-512.png, <id>-maskable-512.png, <id>-180.png (Apple)
// Poslar: the white one-line checkbox mark on a blue tile (the same drawing
// as public/brand, from scripts/brand-mark.mjs). Each trade: a dark tile
// with its glyph glowing in the trade colour (same shapes as the lucide
// icons in the app). Run: npm run icons
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { BLUE, markShapes, poslarMark } from './brand-mark.mjs';

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
  machine: {
    accent: '#C4A35A',
    glyph:
      '<path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20"/><path d="M16 18h-5"/><path d="M18 5a1 1 0 0 0-1 1v5.573"/><path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246"/><path d="M4 11V4"/><path d="M8 10.1V4"/><circle cx="18" cy="18" r="2"/><circle cx="7" cy="15" r="5"/>',
  },
  moto: { accent: '#0AB4FF', glyph: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>' },
  marine: { accent: '#0D5C75', glyph: '<path d="M12 22V8M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>' },
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
  detail: {
    accent: '#1CA7DD',
    glyph:
      '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/>',
  },
  electric: {
    accent: '#1CA7DD',
    glyph: '<path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z"/><path d="m2 22 3-3M7.5 13.5 10 11M10.5 16.5 13 14M18 3l-4 4h6l-4 4"/>',
  },
  appliance: {
    accent: '#1CA7DD',
    glyph: '<path d="M3 6h3M17 6h.01"/><rect width="18" height="20" x="3" y="2" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M12 18a2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 1 0-5"/>',
  },
  locksmith: {
    accent: '#1CA7DD',
    glyph:
      '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5"/>',
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

// Poslar: the mark on a blue tile, smaller for maskable (Android may cut
// the icon to a circle, so it stays inside the central safe zone).
function brandSvg(size, { maskable = false } = {}) {
  const radius = maskable ? 0 : size * 0.22;
  const m = poslarMark();
  const [e0, e1] = m.extent;
  const scale = ((maskable ? 0.54 : 0.66) * size) / (e1 - e0);
  const shift = (size - (e1 - e0) * scale) / 2 - e0 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BLUE}"/>
  <g transform="translate(${shift} ${shift}) scale(${scale})">${markShapes(m)}</g>
</svg>`;
}

const out = path.join(process.cwd(), 'public', 'icons');
mkdirSync(out, { recursive: true });

// The earlier brands' icons.
for (const old of ['taktix', 'xfiles']) {
  for (const suffix of ['192', '512', 'maskable-512', '180']) rmSync(path.join(out, `${old}-${suffix}.png`), { force: true });
}

const ALL = { poslar: null, ...PRODUCTS };
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
