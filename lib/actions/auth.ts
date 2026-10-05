'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { isGuestUser } from '@/lib/guest';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { deleteWorkshop } from '@/lib/workshop-delete';

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  // An open demo has no way back in: it goes now, and the visitor to the home page.
  if (user && isGuestUser(user)) {
    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle();
    const tenantId = profile?.tenant_id as string | undefined;
    if (tenantId) after(() => deleteWorkshop(admin, tenantId));
    redirect('/');
  }
  redirect('/login');
}
