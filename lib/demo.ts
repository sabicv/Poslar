import type { User } from '@supabase/supabase-js';
import { PACKAGE_IDS, type PackageId } from '@/config/tenant.config';

// One login for testing every product: demo@demo.xfiles.hr opens the demo
// centre, and from there any demo workshop as its owner or its worker.
// The seed marks these accounts in app_metadata, which only the service
// role can write — an address that merely ends in the demo domain (self
// registration) is not a demo account.
export const DEMO_DOMAIN = 'demo.xfiles.hr';
export const DEMO_HUB_EMAIL = `demo@${DEMO_DOMAIN}`;

export type DemoRole = 'owner' | 'worker';

export function demoEmail(pkg: PackageId, role: DemoRole): string {
  return `${role === 'owner' ? 'vlasnik' : 'radnik'}.${pkg}@${DEMO_DOMAIN}`;
}

export function isDemoUser(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return user?.app_metadata?.demo === true;
}

// Which demo workshop and role an account is, or null for the hub.
export function demoSeat(email: string | null | undefined): { pkg: PackageId; role: DemoRole } | null {
  const match = /^(vlasnik|radnik)\.([a-z]+)@/.exec(email ?? '');
  if (!match || !PACKAGE_IDS.includes(match[2] as PackageId)) return null;
  return { pkg: match[2] as PackageId, role: match[1] === 'vlasnik' ? 'owner' : 'worker' };
}
