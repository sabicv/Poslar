import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getPackage, type PackageConfig, type PackageId } from '@/config/tenant.config';
import { subscription } from '@/lib/billing';
import { isDemoUser } from '@/lib/demo';
import { createServerSupabaseClient, type ServerSupabaseClient } from '@/lib/supabase/server';
import type { Profile, StaffRole, Tenant, TenantStatus } from '@/types/db';

// sample_ended: the 24-hour trial on sample data is over and the owner
// has not yet chosen how to go on (/probni-dan).
export type LockReason = 'suspended' | 'trial_ended' | 'unpaid' | 'no_workshop' | 'sample_ended';

export interface WorkshopContext {
  supabase: ServerSupabaseClient;
  user: User;
  profile: Profile;
  tenant: Tenant;
  pkg: PackageConfig;
  role: StaffRole;
  isOwner: boolean;
}

type WorkshopState =
  | { kind: 'anonymous' }
  | { kind: 'locked'; reason: LockReason; user: User; name?: string; pkg?: PackageConfig; role?: StaffRole; tenantId?: string }
  | ({ kind: 'active' } & WorkshopContext);

interface AccessRow {
  tenant_id: string;
  name: string;
  package: PackageId;
  status: TenantStatus;
  trial_ends_at: string | null;
  role: StaffRole;
}

export const getAuth = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

// Resolved once per request (React cache), shared by layout and page.
export const getWorkshop = cache(async (): Promise<WorkshopState> => {
  const { supabase, user } = await getAuth();
  if (!user) return { kind: 'anonymous' };

  const { data } = await supabase.rpc('my_workshop_access');
  const access = (data as AccessRow[] | null)?.[0];
  if (!access) return { kind: 'locked', reason: 'no_workshop', user };

  const pkg = getPackage(access.package);
  if (access.status === 'suspended') {
    return { kind: 'locked', reason: 'suspended', user, name: access.name, pkg, role: access.role };
  }
  if (access.status === 'trial' && access.trial_ends_at && new Date(access.trial_ends_at) < new Date()) {
    return { kind: 'locked', reason: 'trial_ended', user, name: access.name, pkg, role: access.role, tenantId: access.tenant_id };
  }

  const [{ data: tenant }, { data: profile }] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', access.tenant_id).single(),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ]);
  if (!tenant || !profile) return { kind: 'locked', reason: 'no_workshop', user };
  if ((tenant as Tenant).sample_until && new Date((tenant as Tenant).sample_until!) <= new Date()) {
    return { kind: 'locked', reason: 'sample_ended', user, name: access.name, pkg, role: access.role, tenantId: access.tenant_id };
  }
  // Paid until a date that is more than a week gone: locked until the payment arrives.
  if (subscription(tenant as Tenant).status === 'overdue') {
    return { kind: 'locked', reason: 'unpaid', user, name: access.name, pkg, role: access.role, tenantId: access.tenant_id };
  }

  return {
    kind: 'active',
    supabase,
    user,
    tenant: tenant as Tenant,
    profile: profile as Profile,
    pkg,
    role: access.role,
    isOwner: access.role === 'owner',
  };
});

// For every page under /app. Locked workshops land on /locked, which lives
// outside /app so it can never redirect back here. The demo login has no
// workshop of its own and goes to the demo centre instead.
export async function requireWorkshop(): Promise<WorkshopContext> {
  const state = await getWorkshop();
  if (state.kind === 'anonymous') redirect('/login');
  if (state.kind === 'locked') redirect(state.reason === 'sample_ended' ? '/probni-dan' : state.reason === 'no_workshop' && isDemoUser(state.user) ? '/demo' : '/locked');
  return state;
}

export async function requireOwner(): Promise<WorkshopContext> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) redirect('/app');
  return ctx;
}

export const isPlatformAdmin = cache(async () => {
  const { supabase, user } = await getAuth();
  if (!user) return false;
  const { data } = await supabase.rpc('is_platform_admin');
  return data === true;
});
