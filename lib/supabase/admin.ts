import 'server-only';

import { createClient } from '@supabase/supabase-js';

// Service-role client: bypasses Row Level Security. Only for trusted
// server code — registration, creating staff accounts, the Super Admin
// panel, the public approval page, and template prices on a new job.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
