import 'server-only';

import { headers } from 'next/headers';
import { getPackage, matchPackageFromHost, type PackageConfig } from '@/config/tenant.config';
import { getWorkshop } from '@/lib/session';

// The product a request belongs to: its domain (airfiles.hr → Air Files),
// or, on an address that is no product's domain (the Vercel URL, a local
// network IP), the signed-in person's own workshop — so the app installed
// from there carries the right name and icon — then the default.
export async function packageForRequest(): Promise<{ pkg: PackageConfig; byDomain: boolean }> {
  const byHost = matchPackageFromHost((await headers()).get('host'));
  if (byHost) return { pkg: byHost, byDomain: true };
  const state = await getWorkshop();
  if (state.kind === 'active') return { pkg: state.pkg, byDomain: false };
  if (state.kind === 'locked' && state.pkg) return { pkg: state.pkg, byDomain: false };
  return { pkg: getPackage(process.env.NEXT_PUBLIC_DEFAULT_PACKAGE), byDomain: false };
}
