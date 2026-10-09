import type { User } from '@supabase/supabase-js';
import { PACKAGE_IDS, type PackageId } from '@/config/tenant.config';

// One login for testing every product: demo@demo.poslar.eu opens the demo
// centre, and from there any demo workshop as its owner or its worker.
// Accounts created on the old demo.xfiles.hr domain still work until the
// next seed. The seed marks these accounts in app_metadata, which only the
// service role can write — an address that merely ends in the demo domain
// (self registration) is not a demo account.
export const DEMO_DOMAIN = 'demo.poslar.eu';
export const DEMO_DOMAIN_LEGACY = 'demo.xfiles.hr';
export const DEMO_HUB_EMAIL = `demo@${DEMO_DOMAIN}`;
export const DEMO_HUB_EMAIL_LEGACY = `demo@${DEMO_DOMAIN_LEGACY}`;

export type DemoRole = 'owner' | 'worker';

export function demoEmail(pkg: PackageId, role: DemoRole, domain: string = DEMO_DOMAIN): string {
  return `${role === 'owner' ? 'vlasnik' : 'radnik'}.${pkg}@${domain}`;
}

export function demoEmails(pkg: PackageId, role: DemoRole): string[] {
  return [demoEmail(pkg, role), demoEmail(pkg, role, DEMO_DOMAIN_LEGACY)];
}

export function isDemoHubEmail(email: string | null | undefined): boolean {
  const e = (email ?? '').trim().toLowerCase();
  return e === DEMO_HUB_EMAIL || e === DEMO_HUB_EMAIL_LEGACY;
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
