// Generates app icons for all seven products into public/icons:
//   <id>-192.png, <id>-512.png, <id>-maskable-512.png, <id>-180.png (Apple)
// A rounded accent tile with the product's glyph (same shapes as the
// lucide icons used in the app). Run: npm run icons
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PRODUCTS = {
  // The X-Files brand itself: on an address that is no product's domain.
  xfiles: { accent: '#F4F4F5', fg: '#0a0a0b', glyph: '<path d="M18 6 6 18M6 6l12 12"/>' },
  volt: { accent: '#3D9BFF', fg: '#ffffff', glyph: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>' },
  gear: {
    accent: '#9580FF',
    fg: '#ffffff',
    glyph:
      '<path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 2v2M12 22v-2M17 20.66l-1-1.73M11 10.27 7 3.34M20.66 17l-1.73-1M3.34 7l1.73 1M14 12h8M2 12h2M20.66 7l-1.73 1M3.34 17l1.73-1M17 3.34l-1 1.73M11 13.73l-4 6.93"/>',
  },
  body: {
    accent: '#FF4D9A',
    fg: '#ffffff',
    glyph: '<path d="M3 3h.01M7 5h.01M11 7h.01M3 7h.01M7 9h.01M3 11h.01"/><rect width="4" height="4" x="15" y="5"/><path d="m19 9 2 2v10c0 .6-.4 1-1 1h-6c-.6 0-1-.4-1-1V11l2-2"/><path d="m13 14 8-2M13 19l8-2"/>',
  },
  wheel: {
    accent: '#D5DBE3',
    fg: '#0a0a0b',
    glyph: '<circle cx="12" cy="12" r="10"/><path d="M6 12c0-1.7.7-3.2 1.8-4.2"/><circle cx="12" cy="12" r="2"/><path d="M18 12c0 1.7-.7 3.2-1.8 4.2"/>',
  },
  fleet: {
    accent: '#FF8A1F',
    fg: '#0a0a0b',
    glyph: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  },
  moto: { accent: '#2BD4E6', fg: '#0a0a0b', glyph: '<path d="M12 22V8M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>' },
  air: {
    accent: '#5EEAD4',
    fg: '#0a0a0b',
    glyph: '<path d="M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z"/><path d="M12 12v.01"/>',
  },
};

function svg({ accent, fg, glyph }, size, { maskable = false } = {}) {
  // Maskable icons need the glyph inside the central 80% safe zone.
  const radius = maskable ? 0 : size * 0.22;
  const glyphSize = size * (maskable ? 0.46 : 0.56);
  const offset = (size - glyphSize) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${accent}"/>
  <svg x="${offset}" y="${offset}" width="${glyphSize}" height="${glyphSize}" viewBox="0 0 24 24" fill="none" stroke="${fg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
</svg>`;
}

const out = path.join(process.cwd(), 'public', 'icons');
mkdirSync(out, { recursive: true });

for (const [id, product] of Object.entries(PRODUCTS)) {
  const jobs = [
    [`${id}-192.png`, svg(product, 192)],
    [`${id}-512.png`, svg(product, 512)],
    [`${id}-maskable-512.png`, svg(product, 512, { maskable: true })],
    // Apple adds its own rounding: a full square.
    [`${id}-180.png`, svg(product, 180, { maskable: true })],
  ];
  for (const [name, source] of jobs) {
    await sharp(Buffer.from(source)).png().toFile(path.join(out, name));
  }
  console.log('icons:', id);
}
