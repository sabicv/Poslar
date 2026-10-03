import { BRAND } from '@/config/tenant.config';
import { packageForRequest } from '@/lib/package-for-request';

// One manifest per product: Volt Files installs as "Volt Files" with the
// blue icon, Air Files as "Air Files". On a product domain the domain
// decides; elsewhere the signed-in workshop does (so it is private), and a
// visitor who is neither gets the TaktIX brand.
export async function GET() {
  const { pkg, byDomain, generic } = await packageForRequest();
  const id = generic ? BRAND.id : pkg.id;
  const name = generic ? BRAND.name : pkg.product;
  const manifest = {
    id: `/?product=${id}`,
    name,
    short_name: name,
    description: generic ? BRAND.tagline : pkg.tagline,
    lang: 'hr',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0F172A',
    theme_color: '#0F172A',
    icons: [
      { src: `/icons/${id}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/icons/${id}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `/icons/${id}-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: generic
      ? []
      : [
          { name: 'Novi nalog', url: '/app/jobs/new', icons: [{ src: `/icons/${id}-192.png`, sizes: '192x192' }] },
          { name: pkg.modulePage, url: '/app/module', icons: [{ src: `/icons/${id}-192.png`, sizes: '192x192' }] },
        ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': byDomain ? 'public, max-age=3600' : 'private, max-age=300' },
  });
}
