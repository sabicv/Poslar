import { BRAND } from '@/config/tenant.config';
import { packageForRequest } from '@/lib/package-for-request';

// The installed app is "Poslar" with the Poslar icon for every trade
// (Vedran, 2026-10-07); the trade shows inside the app. The id stays per
// trade, so an app installed earlier is updated in place, not installed
// twice. On a product domain the domain decides; elsewhere the signed-in
// workshop does (so it is private), and a visitor who is neither gets the
// Poslar brand.
export async function GET() {
  const { pkg, byDomain, generic } = await packageForRequest();
  const id = generic ? BRAND.id : pkg.id;
  const icon = `/icons/${BRAND.id}`;
  const manifest = {
    id: `/?product=${id}`,
    name: BRAND.name,
    short_name: BRAND.name,
    description: generic ? BRAND.tagline : `${pkg.short}: ${pkg.tagline}`,
    lang: 'hr',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0A0A0B',
    theme_color: '#0A0A0B',
    icons: [
      { src: `${icon}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${icon}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${icon}-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: generic
      ? []
      : [
          { name: 'Novi nalog', url: '/app/jobs/new', icons: [{ src: `${icon}-192.png`, sizes: '192x192' }] },
          { name: pkg.modulePage, url: '/app/module', icons: [{ src: `${icon}-192.png`, sizes: '192x192' }] },
        ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': byDomain ? 'public, max-age=3600' : 'private, max-age=300' },
  });
}
