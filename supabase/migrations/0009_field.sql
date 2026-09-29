-- =====================================================================
-- X-Files · 0009 field service layer
--
-- For work done at the customer's address (Air Files first; available to
-- any package as the "field_visits" module):
--   · sites: the places a customer has (flat, house, apartment, office),
--     with access notes and a GPS pin learned on the first arrival
--   · jobs: work mode, site, appointment window, the on-site timeline
--     (departed → arrived with GPS → left) and a customer report link
--   · maintenance_plans: recurring service per site/device (yearly check)
--   · air_equipment / air_fgas_log: refrigerant, charge, leak checks —
--     the F-gas record a service company keeps for its customers
-- =====================================================================

-- Sites --------------------------------------------------------------------
create table if not exists public.sites (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  client_id      uuid not null,
  label          text,
  kind           text not null default 'flat' check (kind in ('house', 'flat', 'apartment', 'office', 'commercial', 'other')),
  address        text not null check (length(btrim(address)) > 2),
  city           text,
  postal_code    text,
  lat            double precision check (lat is null or lat between -90 and 90),
  lng            double precision check (lng is null or lng between -180 and 180),
  access_notes   text,
  contact_name   text,
  contact_phone  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade
);
comment on column public.sites.access_notes is 'Ključ kod susjeda, šifra ulaza, kat, parking — what the technician needs at the door.';
create index if not exists idx_sites_client on public.sites (client_id);

-- Devices live at a site; new device types for climate work.
alter table public.assets add column if not exists site_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'assets_site_fk') then
    alter table public.assets add constraint assets_site_fk
      foreign key (site_id, tenant_id) references public.sites (id, tenant_id) on delete set null (site_id);
  end if;
end
$$;
create index if not exists idx_assets_site on public.assets (site_id);

alter table public.assets drop constraint if exists assets_asset_type_check;
alter table public.assets add constraint assets_asset_type_check check (asset_type in (
  'car', 'van', 'truck', 'tractor_unit', 'bus', 'trailer', 'semi_trailer', 'machine',
  'tractor', 'implement', 'motorcycle', 'scooter', 'atv', 'jetski', 'boat', 'outboard', 'inboard',
  'ac_split', 'ac_multi', 'ac_ducted', 'ac_vrf', 'heat_pump', 'ventilation', 'chiller'));

-- Maintenance plans --------------------------------------------------------
create table if not exists public.maintenance_plans (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  client_id        uuid not null,
  site_id          uuid,
  asset_id         uuid,
  title            text not null check (length(btrim(title)) > 1),
  interval_months  int not null default 12 check (interval_months between 1 and 120),
  next_due_date    date not null,
  template_code    text,
  active           boolean not null default true,
  last_job_id      uuid,
  last_reminded_at timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade,
  foreign key (site_id, tenant_id) references public.sites (id, tenant_id) on delete cascade,
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade
);
create index if not exists idx_maintenance_plans_due on public.maintenance_plans (tenant_id, active, next_due_date);

-- Jobs: field columns --------------------------------------------------------
alter table public.jobs add column if not exists work_mode text not null default 'workshop';
alter table public.jobs add column if not exists site_id uuid;
alter table public.jobs add column if not exists scheduled_start timestamptz;
alter table public.jobs add column if not exists scheduled_end timestamptz;
alter table public.jobs add column if not exists departed_at timestamptz;
alter table public.jobs add column if not exists arrived_at timestamptz;
alter table public.jobs add column if not exists arrived_lat double precision;
alter table public.jobs add column if not exists arrived_lng double precision;
alter table public.jobs add column if not exists left_at timestamptz;
alter table public.jobs add column if not exists customer_notified_at timestamptz;
alter table public.jobs add column if not exists report_token uuid default gen_random_uuid();
alter table public.jobs add column if not exists report_shared_at timestamptz;
alter table public.jobs add column if not exists plan_id uuid;
update public.jobs set report_token = gen_random_uuid() where report_token is null;
alter table public.jobs alter column report_token set not null;
create unique index if not exists uq_jobs_report_token on public.jobs (report_token);
create index if not exists idx_jobs_schedule on public.jobs (tenant_id, scheduled_start);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_work_mode_check') then
    alter table public.jobs add constraint jobs_work_mode_check check (work_mode in ('workshop', 'field'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_schedule_order') then
    alter table public.jobs add constraint jobs_schedule_order check (scheduled_end is null or scheduled_start is null or scheduled_end >= scheduled_start);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_site_fk') then
    alter table public.jobs add constraint jobs_site_fk
      foreign key (site_id, tenant_id) references public.sites (id, tenant_id) on delete set null (site_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_plan_fk') then
    alter table public.jobs add constraint jobs_plan_fk
      foreign key (plan_id, tenant_id) references public.maintenance_plans (id, tenant_id) on delete set null (plan_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'maintenance_plans_last_job_fk') then
    alter table public.maintenance_plans add constraint maintenance_plans_last_job_fk
      foreign key (last_job_id, tenant_id) references public.jobs (id, tenant_id) on delete set null (last_job_id);
  end if;
end
$$;

-- A finished job moves its maintenance plan forward by one interval.
create or replace function public.advance_maintenance_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan_id is not null
     and new.phase in ('ready', 'collected')
     and old.phase not in ('ready', 'collected') then
    update public.maintenance_plans
       set next_due_date = (coalesce(new.finished_at, now())::date + make_interval(months => interval_months))::date,
           last_job_id = new.id,
           updated_at = now()
     where id = new.plan_id and tenant_id = new.tenant_id;
  end if;
  return new;
end
$$;
drop trigger if exists trg_jobs_advance_plan on public.jobs;
create trigger trg_jobs_advance_plan after update of phase on public.jobs
  for each row execute function public.advance_maintenance_plan();

-- Technician's F-gas certificate number (shown on the F-gas record).
alter table public.profiles add column if not exists fgas_certificate text;

-- Air Files: devices and the F-gas record ------------------------------------
create table if not exists public.air_equipment (
  asset_id             uuid primary key,
  tenant_id            uuid not null references public.tenants (id) on delete cascade,
  refrigerant          text,
  charge_kg            numeric(8, 3) check (charge_kg is null or charge_kg >= 0),
  hermetically_sealed  boolean not null default false,
  leak_detection       boolean not null default false,
  indoor_units         int check (indoor_units is null or indoor_units between 1 and 64),
  cooling_kw           numeric(6, 2),
  heating_kw           numeric(6, 2),
  indoor_serial        text,
  outdoor_serial       text,
  install_date         date,
  warranty_until       date,
  updated_at           timestamptz not null default now(),
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade
);
comment on table public.air_equipment is 'Refrigerant and charge per device; t CO2e and leak-check interval are derived in the app (GWP table in config/packages/air.ts).';

create table if not exists public.air_fgas_log (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  job_id           uuid not null,
  asset_id         uuid not null,
  refrigerant      text not null,
  action           text not null check (action in ('charge', 'top_up', 'recovery', 'leak_check', 'repair', 'decommission')),
  quantity_kg      numeric(8, 3) not null default 0 check (quantity_kg >= 0),
  leak_found       boolean,
  leak_location    text,
  cause            text,
  technician_id    uuid,
  technician_cert  text,
  performed_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade,
  foreign key (technician_id, tenant_id) references public.profiles (id, tenant_id) on delete set null (technician_id)
);
comment on table public.air_fgas_log is 'Every refrigerant intervention: kept 5 years (EU 2024/573 art. 7); basis for the SK 1 service card and the yearly report.';
create index if not exists idx_air_fgas_log_asset on public.air_fgas_log (asset_id, performed_at desc);
create index if not exists idx_air_fgas_log_year on public.air_fgas_log (tenant_id, performed_at);

-- updated_at
do $$
declare
  t text;
begin
  foreach t in array array['sites', 'maintenance_plans', 'air_equipment'] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;

-- Row Level Security: same rule as every tenant table; deleting a site or
-- a plan is for the owner.
do $$
declare
  t text;
  del text;
begin
  foreach t in array array['sites', 'maintenance_plans', 'air_equipment', 'air_fgas_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format('drop policy if exists tenant_delete on public.%I', t);
    execute format('create policy tenant_select on public.%I for select to authenticated using (tenant_id = public.auth_tenant_id())', t);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (tenant_id = public.auth_tenant_id())', t);
    execute format('create policy tenant_update on public.%I for update to authenticated using (tenant_id = public.auth_tenant_id()) with check (tenant_id = public.auth_tenant_id())', t);
    del := case when t in ('sites', 'maintenance_plans') then 'tenant_id = public.auth_tenant_id() and public.is_owner()' else 'tenant_id = public.auth_tenant_id()' end;
    execute format('create policy tenant_delete on public.%I for delete to authenticated using (%s)', t, del);
    execute format('create index if not exists idx_%s_tenant on public.%I (tenant_id)', t, t);
  end loop;
end
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.sites, public.maintenance_plans, public.air_equipment, public.air_fgas_log from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on public.sites, public.maintenance_plans, public.air_equipment, public.air_fgas_log to authenticated';
    execute 'grant update (fgas_certificate) on public.profiles to authenticated';
  end if;
end
$$;
