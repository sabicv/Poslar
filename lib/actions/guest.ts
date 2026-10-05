'use server';

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { PACKAGE_IDS, type PackageId } from '@/config/tenant.config';
import { GUEST_AI_QUOTA, GUEST_DOMAIN, isGuestUser } from '@/lib/guest';
import { deleteExpiredGuests, startSampleDay } from '@/lib/sample-day';
import { getAuth, getWorkshop } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteWorkshop } from '@/lib/workshop-delete';

// "Isprobaj demo verziju" (Vedran, 2026-10-05: open, no sign-in, no
// password). One tap makes the visitor's own demo workshop, a copy of the
// trade's sample with its 24-hour clock, and signs this browser in to it
// with a throwaway login nobody types (lib/guest.ts). Limits: a few demos
// per IP an hour and a daily total, counted apart from sign-ups.
export async function openDemo(formData: FormData): Promise<void> {
  const pkg = String(formData.get('paket') ?? '') as PackageId;
  if (!PACKAGE_IDS.includes(pkg)) redirect('/isprobaj');
  const back = (query: string) => `/isprobaj?paket=${pkg}&${query}`;
  const admin = createAdminClient();
  const { supabase, user } = await getAuth();

  if (user) {
    if (isGuestUser(user)) {
      // Already in a demo: the same trade carries on, another one replaces it.
      const state = await getWorkshop();
      if (state.kind === 'active' && state.pkg.id === pkg) redirect('/app');
      const old = state.kind === 'active' ? state.tenant.id : state.kind === 'locked' ? state.tenantId : undefined;
      await supabase.auth.signOut({ scope: 'local' });
      if (old) after(() => deleteWorkshop(admin, old));
    } else {
      // Someone's real account is signed in on this phone: ask first.
      if (formData.get('zamijeni') !== '1') redirect(back('prijavljen=1'));
      await supabase.auth.signOut({ scope: 'local' });
    }
  }

  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  const ipHash = createHash('sha256').update(`${ip}|${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`).digest('hex').slice(0, 40);
  const [{ count: perIp }, { count: perDay }] = await Promise.all([
    admin.from('registration_attempts').select('id', { count: 'exact', head: true }).eq('kind', 'guest').eq('ip_hash', ipHash).gte('created_at', new Date(Date.now() - 3600_000).toISOString()),
    admin.from('registration_attempts').select('id', { count: 'exact', head: true }).eq('kind', 'guest').gte('created_at', new Date(Date.now() - 86400_000).toISOString()),
  ]);
  if ((perIp ?? 0) >= (Number(process.env.DEMO_PER_HOUR) || 10) || (perDay ?? 0) >= (Number(process.env.DEMO_DAILY_LIMIT) || 300)) redirect(back('greska=puno'));
  await admin.from('registration_attempts').insert({ ip_hash: ipHash, kind: 'guest' });

  // The trade's sample gives the workshop its name and its owner's name.
  const { data: source } = await admin.from('tenants').select('id, name, city').eq('slug', `uzorak-${pkg}`).eq('settings->>sample', 'true').maybeSingle();
  if (!source) redirect(back('greska=1'));
  const { data: owner } = await admin.from('profiles').select('full_name').eq('tenant_id', source.id).eq('role', 'owner').limit(1).maybeSingle();
  const fullName = (owner?.full_name as string | null) ?? 'Demo korisnik';

  const email = `gost-${randomUUID()}@${GUEST_DOMAIN}`;
  const password = randomBytes(24).toString('base64url');
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { guest: true }, user_metadata: { full_name: fullName } });
  if (error || !created.user) redirect(back('greska=1'));
  const userId = created.user.id;
  // The trial runs a day past the examples, so the 24 hours end on the
  // "Demo je završio" page, not on a locked one.
  const { data: tenantId, error: rpcError } = await admin.rpc('register_workshop', {
    p_user_id: userId,
    p_full_name: fullName,
    p_workshop_name: source.name,
    p_package: pkg,
    p_oib: null,
    p_phone: null,
    p_city: source.city ?? null,
    p_status: 'trial',
    p_trial_days: 2,
  });
  if (rpcError || !tenantId) {
    await admin.auth.admin.deleteUser(userId);
    redirect(back('greska=1'));
  }
  const workshop = tenantId as string;
  const giveUp = async () => {
    await deleteWorkshop(admin, workshop);
    await admin.auth.admin.deleteUser(userId);
  };
  const { error: patchError } = await admin.from('tenants').update({ settings: { guest: true }, ai_quota: GUEST_AI_QUOTA }).eq('id', workshop);
  if (patchError || !(await startSampleDay(admin, workshop, pkg))) {
    await giveUp();
    redirect(back('greska=1'));
  }
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    await giveUp();
    redirect(back('greska=1'));
  }
  // Old demos go after the answer, never holding up this one.
  after(() => deleteExpiredGuests(admin));
  redirect('/app');
}
