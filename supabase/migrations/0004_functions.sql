-- =====================================================================
-- X-Files · 0004 functions
-- =====================================================================

-- Creates a workshop with its owner in one transaction. Called only by
-- the server (self-registration and the Super Admin panel) with the
-- service role, after the auth user exists.
create or replace function public.register_workshop(
  p_user_id        uuid,
  p_full_name      text,
  p_workshop_name  text,
  p_package        public.package_id,
  p_oib            text default null,
  p_phone          text default null,
  p_city           text default null,
  p_status         public.tenant_status default 'trial',
  p_trial_days     int default 30
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant  uuid;
  v_base    text;
  v_slug    text;
  v_i       int := 1;
begin
  v_base := lower(translate(btrim(p_workshop_name), 'čćđšžČĆĐŠŽ', 'ccdszccdsz'));
  v_base := trim(both '-' from regexp_replace(v_base, '[^a-z0-9]+', '-', 'g'));
  if length(v_base) < 3 then
    v_base := 'radionica';
  end if;
  v_base := left(v_base, 50);
  v_slug := v_base;
  while exists (select 1 from public.tenants where slug = v_slug) loop
    v_i := v_i + 1;
    v_slug := v_base || '-' || v_i;
  end loop;

  insert into public.tenants (name, slug, package, status, trial_ends_at, oib, phone, city)
  values (
    btrim(p_workshop_name), v_slug, p_package, p_status,
    case when p_status = 'trial' then now() + make_interval(days => p_trial_days) end,
    nullif(btrim(coalesce(p_oib, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_city, '')), '')
  )
  returning id into v_tenant;

  insert into public.profiles (id, tenant_id, full_name, role)
  values (p_user_id, v_tenant, nullif(btrim(coalesce(p_full_name, '')), ''), 'owner');

  insert into public.price_lists (tenant_id, name, is_default, labor_rates)
  values (v_tenant, 'Osnovni cjenik', true, '{"default": 50}'::jsonb);

  return v_tenant;
end
$$;

revoke all on function public.register_workshop(uuid, text, text, public.package_id, text, text, text, public.tenant_status, int) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.register_workshop(uuid, text, text, public.package_id, text, text, text, public.tenant_status, int) from anon, authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.register_workshop(uuid, text, text, public.package_id, text, text, text, public.tenant_status, int) to service_role';
  end if;
end
$$;

-- The caller's workshop even when it is locked, so the app can say why
-- (suspended vs. trial ended) instead of showing an empty screen.
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
  where p.id = auth.uid()
$$;

-- Live delivery of internal messages (Supabase Realtime), when available.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'job_messages'
     ) then
    execute 'alter publication supabase_realtime add table public.job_messages';
  end if;
end
$$;
