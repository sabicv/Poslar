-- =====================================================================
-- TaktiX · 0014 Aqua, Tow and Deal
--   · new object types: water heaters, boilers, installations
--   · aqua_equipment: what is on a water heater's or boiler's plate
--   · aqua_pressure_tests: the pressure test record for the customer
--   · tow_calls: one tow or roadside call per work order (payer, pickup,
--     drop-off, distance and the time of each step)
--   · tow_storage: a towed vehicle kept on the yard, day by day
--   · deal_stock: a used car from purchase to sale; the purchase, lowest
--     and sale price stay in private_amounts (owner only)
--   · deal_test_drives: who drove which car, with the licence number
-- =====================================================================

alter table public.assets drop constraint if exists assets_asset_type_check;
alter table public.assets add constraint assets_asset_type_check check (asset_type in (
  'car', 'van', 'truck', 'tractor_unit', 'bus', 'trailer', 'semi_trailer', 'machine',
  'tractor', 'implement', 'motorcycle', 'scooter', 'atv', 'jetski', 'boat', 'outboard', 'inboard',
  'ac_split', 'ac_multi', 'ac_ducted', 'ac_vrf', 'heat_pump', 'ventilation', 'chiller',
  'water_heater', 'gas_boiler', 'plumbing', 'drainage', 'heating', 'pump'));

-- Aqua Files ---------------------------------------------------------------
create table if not exists public.aqua_equipment (
  asset_id              uuid primary key,
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  energy                text check (energy is null or energy in ('electric', 'gas', 'heat_pump', 'solar', 'combined', 'oil', 'none')),
  capacity_l            numeric(8, 1) check (capacity_l is null or capacity_l >= 0),
  power_kw              numeric(6, 2) check (power_kw is null or power_kw >= 0),
  working_pressure_bar  numeric(5, 2) check (working_pressure_bar is null or working_pressure_bar >= 0),
  install_date          date,
  warranty_until        date,
  anode_changed_on      date,
  descaled_on           date,
  updated_at            timestamptz not null default now(),
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade
);
comment on table public.aqua_equipment is 'Water heater or boiler data from its plate; anode and descaling dates drive the next service.';

create table if not exists public.aqua_pressure_tests (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  job_id             uuid not null,
  asset_id           uuid,
  section            text,
  medium             text not null default 'water' check (medium in ('water', 'air')),
  test_pressure_bar  numeric(5, 2) not null check (test_pressure_bar > 0),
  end_pressure_bar   numeric(5, 2) check (end_pressure_bar is null or end_pressure_bar >= 0),
  duration_min       int check (duration_min is null or duration_min between 1 and 1440),
  passed             boolean,
  technician_id      uuid,
  performed_at       timestamptz not null default now(),
  note               text,
  created_at         timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete set null (asset_id),
  foreign key (technician_id, tenant_id) references public.profiles (id, tenant_id) on delete set null (technician_id)
);
comment on table public.aqua_pressure_tests is 'Tlačna proba: test pressure, pressure at the end, duration and result, per section of the installation.';
create index if not exists idx_aqua_pressure_tests_job on public.aqua_pressure_tests (job_id);

-- Tow Files ----------------------------------------------------------------
create table if not exists public.tow_calls (
  job_id           uuid primary key,
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  service          text not null default 'tow' check (service in ('tow', 'jump_start', 'wheel_change', 'unlock', 'fuel', 'winch', 'transport', 'other')),
  payer            text not null default 'private' check (payer in ('private', 'insurance', 'assistance', 'company', 'police')),
  payer_name       text,
  claim_no         text,
  pickup_address   text,
  pickup_lat       double precision check (pickup_lat is null or pickup_lat between -90 and 90),
  pickup_lng       double precision check (pickup_lng is null or pickup_lng between -180 and 180),
  dropoff_address  text,
  distance_km      numeric(7, 1) check (distance_km is null or distance_km >= 0),
  truck            text,
  called_at        timestamptz not null default now(),
  departed_at      timestamptz,
  arrived_at       timestamptz,
  loaded_at        timestamptz,
  delivered_at     timestamptz,
  notes            text,
  updated_at       timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);
comment on table public.tow_calls is 'One call per work order: who pays (private, insurer, assistance), where from and to, km, and when each step happened.';

create table if not exists public.tow_storage (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  job_id       uuid not null,
  asset_id     uuid not null,
  spot         text,
  in_at        timestamptz not null default now(),
  out_at       timestamptz,
  released_to  text,
  note         text,
  created_at   timestamptz not null default now(),
  check (out_at is null or out_at >= in_at),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade
);
comment on table public.tow_storage is 'A towed vehicle on the yard; days on the yard become the storage fee line.';
create unique index if not exists uq_tow_storage_open on public.tow_storage (asset_id) where out_at is null;

-- Deal Files ---------------------------------------------------------------
create table if not exists public.deal_stock (
  job_id            uuid primary key,
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  asset_id          uuid not null,
  source            text not null default 'private' check (source in ('private', 'trade_in', 'import', 'auction', 'leasing', 'company')),
  purchased_on      date not null default current_date,
  asking_price      numeric(12, 2) check (asking_price is null or asking_price >= 0),
  listed_on         date,
  ad_url            text,
  reserved_by       text,
  reserved_until    date,
  sold_on           date,
  buyer_name        text,
  buyer_phone       text,
  buyer_oib         text check (buyer_oib is null or buyer_oib ~ '^\d{11}$'),
  warranty_months   int check (warranty_months is null or warranty_months between 0 and 60),
  keys_count        int check (keys_count is null or keys_count between 0 and 9),
  service_book      boolean not null default false,
  registered_until  date,
  notes             text,
  updated_at        timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade
);
comment on table public.deal_stock is 'A car for sale. The asking price is public (it is on the ad); purchase, lowest and sale price are in private_amounts (entity deal_stock).';
create index if not exists idx_deal_stock_asset on public.deal_stock (asset_id);

create table if not exists public.deal_test_drives (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  job_id        uuid not null,
  asset_id      uuid not null,
  driver_name   text not null check (length(btrim(driver_name)) > 1),
  driver_phone  text,
  licence_no    text,
  out_at        timestamptz not null default now(),
  back_at       timestamptz,
  staff_id      uuid,
  note          text,
  created_at    timestamptz not null default now(),
  check (back_at is null or back_at >= out_at),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade,
  foreign key (staff_id, tenant_id) references public.profiles (id, tenant_id) on delete set null (staff_id)
);
create index if not exists idx_deal_test_drives_job on public.deal_test_drives (job_id, out_at desc);

-- updated_at
do $$
declare
  t text;
begin
  foreach t in array array['aqua_equipment', 'tow_calls', 'deal_stock'] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;

-- Row Level Security: the workshop's own rows; a car's sale record is
-- deleted only by the owner.
do $$
declare
  t text;
  del text;
begin
  foreach t in array array['aqua_equipment', 'aqua_pressure_tests', 'tow_calls', 'tow_storage', 'deal_stock', 'deal_test_drives'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format('drop policy if exists tenant_delete on public.%I', t);
    execute format('create policy tenant_select on public.%I for select to authenticated using (tenant_id = public.auth_tenant_id())', t);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (tenant_id = public.auth_tenant_id())', t);
    execute format('create policy tenant_update on public.%I for update to authenticated using (tenant_id = public.auth_tenant_id()) with check (tenant_id = public.auth_tenant_id())', t);
    del := case when t = 'deal_stock' then 'tenant_id = public.auth_tenant_id() and public.is_owner()' else 'tenant_id = public.auth_tenant_id()' end;
    execute format('create policy tenant_delete on public.%I for delete to authenticated using (%s)', t, del);
    execute format('create index if not exists idx_%s_tenant on public.%I (tenant_id)', t, t);
  end loop;
end
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.aqua_equipment, public.aqua_pressure_tests, public.tow_calls, public.tow_storage, public.deal_stock, public.deal_test_drives from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on public.aqua_equipment, public.aqua_pressure_tests, public.tow_calls, public.tow_storage, public.deal_stock, public.deal_test_drives to authenticated';
  end if;
end
$$;
