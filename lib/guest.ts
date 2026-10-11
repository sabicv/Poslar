import type { User } from '@supabase/supabase-js';

// The open demo: one tap on "Isprobaj demo verziju" gives the visitor a demo
// workshop of their own, a copy of the trade's sample, with no e-mail or
// password. The server makes a throwaway login for it, marked in
// app_metadata (only the service role writes there) and on the workshop
// (settings.guest). There is no clock. Switching trade keeps the same
// login, so the AI taste below is not refreshed.

// Never a real mailbox: nothing is ever sent to these addresses.
export const GUEST_DOMAIN = 'gost.poslar.invalid';

// AI in the demo: scans and Poslar's answers share one pool of 5 per login.
// Enough to try both, not enough to use the demo for real work.
export const GUEST_AI_TOTAL = 5;
export const GUEST_AI_QUOTA = { scan: GUEST_AI_TOTAL, copilot: GUEST_AI_TOTAL };

export function isGuestUser(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return user?.app_metadata?.guest === true;
}

export function isGuestTenant(tenant: { settings?: unknown } | null | undefined): boolean {
  return (tenant?.settings as { guest?: unknown } | null)?.guest === true;
}
