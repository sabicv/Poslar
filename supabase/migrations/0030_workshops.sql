-- =====================================================================
-- Poslar · 0030 Više radionica pod jednim vlasnikom (Premium)
-- An owner can run up to three workshops: the main one (the one that pays)
-- and its branches (tenants.main_tenant_id). The owner has one profile
-- row in each, so the profile key becomes (id, tenant_id). Which of them
-- is open is kept per person in active_workshops; every tenant policy goes
-- through auth_tenant_id(), which now reads it. Someone with a single
-- workshop (every worker, most owners) sees no change at all.
-- Branches are billed through the main workshop: its plan, status, trial
-- and paid-until date are copied to them whenever they change.
-- =====================================================================

alter table public.tenants add column if not exists main_tenant_id uuid references public.tenants (id) on delete cascade;
create index if not exists idx_tenants_main on public.tenants (main_tenant_id) where main_tenant_id is not null;
comment on column public.tenants.main_tenant_id is 'Set on a branch: the owner''s main workshop, which pays for it. Tower and server only.';

-- One profile row per workshop a person belongs to.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_pkey' and conrelid = 'public.profiles'::regclass and array_length(conkey, 1) = 1
  ) then
    alter table public.profiles drop constraint profiles_pkey;
    alter table public.profiles add constraint profiles_pkey primary key (id, tenant_id);
  end if;
end
$$;
create index if not exists idx_profiles_id on public.profiles (id);

-- The workshop a person has open (only written when they switch).
create table if not exists public.active_workshops (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  updated_at  timestamptz not null default now()
);
alter table public.active_workshops enable row level security;
drop policy if exists active_workshops_self on public.active_workshops;
create policy active_workshops_self on public.active_workshops for select to authenticated
  using (user_id = auth.uid());
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke insert, update, delete on public.active_workshops from authenticated';
    execute 'grant select on public.active_workshops to authenticated';
  end if;
end
$$;

-- The open workshop, locked or not: the chosen one if the person still
-- belongs to it, otherwise the one they joined first.
create or replace function public.active_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.tenant_id
  from public.profiles p
  left join public.active_workshops a on a.user_id = p.id
  where p.id = auth.uid()
  order by (p.tenant_id = a.tenant_id) desc nulls last, p.created_at, p.tenant_id
  limit 1
$$;

-- The caller's workshop, or null when it is suspended or its trial ran
-- out, which locks every tenant policy at once.
create or replace function public.auth_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.tenants t
  where t.id = public.active_tenant_id()
    and t.status <> 'suspended'
    and not (t.status = 'trial' and t.trial_ends_at is not null and t.trial_ends_at < now())
$$;

create or replace function public.auth_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and tenant_id = public.active_tenant_id()
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'owner' from public.profiles where id = auth.uid() and tenant_id = public.active_tenant_id()), false)
$$;

create or replace function public.my_workshop_access()
returns table (tenant_id uuid, name text, package public.package_id, status public.tenant_status, trial_ends_at timestamptz, role public.staff_role)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.package, t.status, t.trial_ends_at, p.role
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where p.id = auth.uid() and p.tenant_id = public.active_tenant_id()
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.active_tenant_id() to authenticated';
  end if;
end
$$;

-- People of the open workshop; one's own row only for the open one, so a
-- staff list never shows the owner twice.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (tenant_id = public.auth_tenant_id() or (id = auth.uid() and tenant_id = public.active_tenant_id()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using ((id = auth.uid() and tenant_id = public.active_tenant_id()) or (tenant_id = public.auth_tenant_id() and public.is_owner()))
  with check ((id = auth.uid() and tenant_id = public.active_tenant_id()) or (tenant_id = public.auth_tenant_id() and public.is_owner()));

-- Branches follow the main workshop's subscription.
create or replace function public.sync_branch_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.main_tenant_id is null then
    update public.tenants b
    set status = new.status,
        status_note = new.status_note,
        trial_ends_at = new.trial_ends_at,
        plan = new.plan,
        billing_term = new.billing_term,
        paid_until = new.paid_until,
        founder_until = new.founder_until,
        ai_quota = new.ai_quota
    where b.main_tenant_id = new.id
      and (b.status, b.status_note, b.trial_ends_at, b.plan, b.billing_term, b.paid_until, b.founder_until, b.ai_quota)
          is distinct from (new.status, new.status_note, new.trial_ends_at, new.plan, new.billing_term, new.paid_until, new.founder_until, new.ai_quota);
  end if;
  return null;
end
$$;
drop trigger if exists trg_tenants_sync_branches on public.tenants;
create trigger trg_tenants_sync_branches
  after update of status, status_note, trial_ends_at, plan, billing_term, paid_until, founder_until, ai_quota on public.tenants
  for each row execute function public.sync_branch_billing();
