import type { User } from '@supabase/supabase-js';

// The open demo: one tap on "Isprobaj demo verziju" gives the visitor a demo
// workshop of their own, a copy of the trade's sample, with no e-mail or
// password. The server makes a throwaway login for it, marked in
// app_metadata (only the service role writes there) and on the workshop
// (settings.guest). After the 24 hours the workshop and its logins go.

// Never a real mailbox: nothing is ever sent to these addresses.
export const GUEST_DOMAIN = 'gost.poslar.invalid';

// AI in the demo: enough to try, not enough to use it for real work.
export const GUEST_AI_QUOTA = { scan: 5, copilot: 5 };

// After the 24 hours the visitor can still leave a review for a while.
export const GUEST_KEEP_HOURS = 12;

export function isGuestUser(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return user?.app_metadata?.guest === true;
}

export function isGuestTenant(tenant: { settings?: unknown } | null | undefined): boolean {
  return (tenant?.settings as { guest?: unknown } | null)?.guest === true;
}
