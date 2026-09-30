import { packageForRequest } from '@/lib/package-for-request';

// One manifest per product: Volt Files installs as "Volt Files" with the
// blue icon, Air Files as "Air Files". On a product domain the domain
// decides; elsewhere the signed-in workshop does (so it is private).
export async function GET() {
  const { pkg, byDomain } = await packageForRequest();
  const manifest = {
    id: `/?product=${pkg.id}`,
    name: pkg.product,
    short_name: pkg.product,
    description: pkg.tagline,
    lang: 'hr',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#09090b',
    theme_color: '#09090b',
    icons: [
      { src: `/icons/${pkg.id}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/icons/${pkg.id}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `/icons/${pkg.id}-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Novi nalog', url: '/app/jobs/new', icons: [{ src: `/icons/${pkg.id}-192.png`, sizes: '192x192' }] },
      { name: pkg.modulePage, url: '/app/module', icons: [{ src: `/icons/${pkg.id}-192.png`, sizes: '192x192' }] },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': byDomain ? 'public, max-age=3600' : 'private, max-age=300' },
  });
}
