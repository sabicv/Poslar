'use server';

import { redirect } from 'next/navigation';
import { PACKAGE_IDS, type PackageId } from '@/config/tenant.config';
import { demoEmail, isDemoUser, type DemoRole } from '@/lib/demo';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Switch seats inside the demo: only a demo account may call this, and
// only into another demo account. The session is replaced server-side
// through a one-time login token, so no password is stored in the app.
export async function openDemoSeat(formData: FormData) {
  const pkg = String(formData.get('pkg')) as PackageId;
  const role = String(formData.get('role')) as DemoRole;
  if (!PACKAGE_IDS.includes(pkg) || (role !== 'owner' && role !== 'worker')) redirect('/demo');

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isDemoUser(user)) redirect('/login');

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email: demoEmail(pkg, role) });
  if (error || !isDemoUser(data.user)) redirect('/demo?greska=1');

  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: data.properties.hashed_token });
  if (verifyError) redirect('/demo?greska=1');
  redirect('/app');
}
