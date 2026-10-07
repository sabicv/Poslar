import 'server-only';
import { FOUNDER_MONTHS, FOUNDER_SPOTS } from '@/config/plans';
import { createAdminClient } from '@/lib/supabase/admin';
import { addMonths, todayInZagreb } from '@/lib/time';

// The founder price (config/plans.ts): the first FOUNDER_SPOTS workshops
// that sign up pay it for FOUNDER_MONTHS. A deleted workshop frees its spot;
// the tower can take it back from one that never paid.

type Admin = ReturnType<typeof createAdminClient>;

export async function founderSpotsLeft(admin: Admin = createAdminClient()): Promise<number> {
  const { count, error } = await admin.from('tenants').select('id', { count: 'exact', head: true }).not('founder_until', 'is', null);
  if (error) return 0;
  return Math.max(0, FOUNDER_SPOTS - (count ?? 0));
}

// For a workshop signing up now: until when it pays the founder price, or
// null when the spots are gone.
export async function founderUntilForNew(admin: Admin): Promise<string | null> {
  return (await founderSpotsLeft(admin)) > 0 ? addMonths(todayInZagreb(), FOUNDER_MONTHS) : null;
}
