import { resolvePackageFromHost } from '@/config/tenant.config';

// One manifest per product domain: Volt Files installs as "Volt Files"
// with the blue icon, Gear Files as "Gear Files" with the violet one.
export function GET(request: Request) {
  const pkg = resolvePackageFromHost(request.headers.get('host'));
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
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
  });
}
