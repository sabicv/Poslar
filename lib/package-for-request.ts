import 'server-only';

import { headers } from 'next/headers';
import { getPackage, matchPackageFromHost, type PackageConfig } from '@/config/tenant.config';
import { getWorkshop } from '@/lib/session';

// The product a request belongs to: its domain (airfiles.hr → Air Files),
// or, on an address that is no product's domain (the Vercel URL, a local
// network IP), the signed-in person's own workshop — so the app installed
// from there carries the right name and icon. With neither, the page shows
// the TaktIX brand itself (generic: true).
export async function packageForRequest(): Promise<{ pkg: PackageConfig; byDomain: boolean; generic: boolean }> {
  const byHost = matchPackageFromHost((await headers()).get('host'));
  if (byHost) return { pkg: byHost, byDomain: true, generic: false };
  const state = await getWorkshop();
  if (state.kind === 'active') return { pkg: state.pkg, byDomain: false, generic: false };
  if (state.kind === 'locked' && state.pkg) return { pkg: state.pkg, byDomain: false, generic: false };
  return { pkg: getPackage(process.env.NEXT_PUBLIC_DEFAULT_PACKAGE), byDomain: false, generic: true };
}
