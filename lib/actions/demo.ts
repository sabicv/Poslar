'use server';

import { redirect } from 'next/navigation';
import { PACKAGE_IDS, type PackageId } from '@/config/tenant.config';
import { demoEmails, isDemoUser, type DemoRole } from '@/lib/demo';
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

  const admin = createAdminClient();
  let data: Awaited<ReturnType<typeof admin.auth.admin.generateLink>>['data'] | null = null;
  for (const email of demoEmails(pkg, role)) {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (!link.error && isDemoUser(link.data.user)) {
      data = link.data;
      break;
    }
  }
  if (!data) redirect('/demo?greska=1');

  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: data.properties.hashed_token });
  if (verifyError) redirect('/demo?greska=1');
  redirect('/app');
}
