-- =====================================================================
-- X-Files · 0005 Row Level Security
--
-- Rule of the house: a signed-in user sees and changes only rows whose
-- tenant_id is their own workshop (auth_tenant_id()). On top of that:
--   · money (prices, private amounts, price lists, fleet invoices) is
--     owner-only at the database level, not just hidden in the UI;
--   · deleting customers, objects and work orders is owner-only;
--   · job history (job_events) is append-only.
-- Anonymous visitors get nothing; public pages go through server code.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Standard tenant tables: select/insert/update for the workshop,
-- delete for the workshop (or its owner where listed).
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  owner_delete text[] := array['clients', 'assets', 'jobs'];
  del_condition text;
begin
  foreach t in array array[
    -- core
    'clients', 'assets', 'meter_readings', 'jobs', 'job_lines', 'inspections', 'inspection_results',
    'condition_reports', 'attachments', 'reminders',
    -- volt
    'volt_dtc_custom', 'volt_scans', 'volt_dtc_findings', 'volt_battery_tests', 'volt_charging_tests',
    'volt_drain_sessions', 'volt_drain_readings', 'volt_voltage_drops', 'volt_live_data',
    'volt_module_interventions', 'volt_keys',
    -- gear
    'gear_service_plans', 'gear_asset_schedule', 'gear_labor_norms', 'gear_suppliers', 'gear_parts', 'gear_warranty_claims',
    -- body
    'insurers', 'body_estimates', 'body_panel_damages', 'body_paint_jobs', 'body_paint_mix_lines',
    'body_material_usage', 'body_production_phases', 'body_adas_calibrations',
    -- wheel
    'wheel_storage_locations', 'wheel_tire_sets', 'wheel_tires', 'wheel_rims', 'wheel_storage_stays',
    'wheel_alignments', 'wheel_alignment_values', 'wheel_torque_specs', 'wheel_torque_records',
    'wheel_balancing', 'wheel_repairs', 'wheel_tpms', 'wheel_inventory',
    -- fleet
    'fleet_accounts', 'fleet_pm_plans', 'fleet_asset_pm', 'fleet_compliance_items', 'fleet_service_requests',
    'fleet_driver_checks', 'fleet_field_jobs', 'fleet_downtime',
    -- moto
    'moto_vessel_details', 'moto_engine_details', 'moto_equipment_items', 'moto_seasonal_protocols',
    'moto_storage_locations', 'moto_storage_stays'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format('drop policy if exists tenant_delete on public.%I', t);

    execute format('create policy tenant_select on public.%I for select to authenticated using (tenant_id = public.auth_tenant_id())', t);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (tenant_id = public.auth_tenant_id())', t);
    execute format('create policy tenant_update on public.%I for update to authenticated using (tenant_id = public.auth_tenant_id()) with check (tenant_id = public.auth_tenant_id())', t);

    del_condition := case when t = any (owner_delete)
      then 'tenant_id = public.auth_tenant_id() and public.is_owner()'
      else 'tenant_id = public.auth_tenant_id()' end;
    execute format('create policy tenant_delete on public.%I for delete to authenticated using (%s)', t, del_condition);

    execute format('create index if not exists idx_%s_tenant on public.%I (tenant_id)', t, t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Owner-only tables (money)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['price_lists', 'job_line_prices', 'private_amounts', 'fleet_invoices'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (tenant_id = public.auth_tenant_id() and public.is_owner()) with check (tenant_id = public.auth_tenant_id() and public.is_owner())',
      t
    );
    execute format('create index if not exists idx_%s_tenant on public.%I (tenant_id)', t, t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Templates: everyone reads, the owner edits
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['templates', 'inspection_templates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('drop policy if exists owner_write on public.%I', t);
    execute format('create policy tenant_select on public.%I for select to authenticated using (tenant_id = public.auth_tenant_id())', t);
    execute format(
      'create policy owner_write on public.%I for all to authenticated using (tenant_id = public.auth_tenant_id() and public.is_owner()) with check (tenant_id = public.auth_tenant_id() and public.is_owner())',
      t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Workshops, staff, platform admins
-- ---------------------------------------------------------------------
alter table public.tenants enable row level security;
drop policy if exists tenants_select_own on public.tenants;
create policy tenants_select_own on public.tenants for select to authenticated
  using (id = public.auth_tenant_id());
drop policy if exists tenants_update_owner on public.tenants;
create policy tenants_update_owner on public.tenants for update to authenticated
  using (id = public.auth_tenant_id() and public.is_owner())
  with check (id = public.auth_tenant_id() and public.is_owner());

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or tenant_id = public.auth_tenant_id());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or (tenant_id = public.auth_tenant_id() and public.is_owner()))
  with check (id = auth.uid() or (tenant_id = public.auth_tenant_id() and public.is_owner()));

alter table public.platform_admins enable row level security;
drop policy if exists platform_admins_self on public.platform_admins;
create policy platform_admins_self on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Documents: priced ones are owner-only
-- ---------------------------------------------------------------------
alter table public.documents enable row level security;
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select to authenticated
  using (tenant_id = public.auth_tenant_id() and (not contains_prices or public.is_owner()));
drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents for all to authenticated
  using (tenant_id = public.auth_tenant_id() and (not contains_prices or public.is_owner()))
  with check (tenant_id = public.auth_tenant_id() and (not contains_prices or public.is_owner()));

-- ---------------------------------------------------------------------
-- Approvals: the owner sends them; everyone in the workshop sees status
-- ---------------------------------------------------------------------
alter table public.approvals enable row level security;
drop policy if exists approvals_select on public.approvals;
create policy approvals_select on public.approvals for select to authenticated
  using (tenant_id = public.auth_tenant_id());
drop policy if exists approvals_owner_write on public.approvals;
create policy approvals_owner_write on public.approvals for all to authenticated
  using (tenant_id = public.auth_tenant_id() and public.is_owner())
  with check (tenant_id = public.auth_tenant_id() and public.is_owner());

-- ---------------------------------------------------------------------
-- Job history: append-only
-- ---------------------------------------------------------------------
alter table public.job_events enable row level security;
drop policy if exists job_events_select on public.job_events;
create policy job_events_select on public.job_events for select to authenticated
  using (tenant_id = public.auth_tenant_id());
drop policy if exists job_events_insert on public.job_events;
create policy job_events_insert on public.job_events for insert to authenticated
  with check (tenant_id = public.auth_tenant_id());

-- ---------------------------------------------------------------------
-- Internal messages: sender, receiver and owners
-- ---------------------------------------------------------------------
alter table public.job_messages enable row level security;
drop policy if exists job_messages_select on public.job_messages;
create policy job_messages_select on public.job_messages for select to authenticated
  using (
    tenant_id = public.auth_tenant_id()
    and (sender_id = auth.uid() or receiver_id = auth.uid() or public.is_owner())
  );
drop policy if exists job_messages_insert on public.job_messages;
create policy job_messages_insert on public.job_messages for insert to authenticated
  with check (
    tenant_id = public.auth_tenant_id()
    and sender_id = auth.uid()
    and (kind = 'help' or public.is_owner())
  );
drop policy if exists job_messages_update on public.job_messages;
create policy job_messages_update on public.job_messages for update to authenticated
  using (
    tenant_id = public.auth_tenant_id()
    and (receiver_id = auth.uid() or sender_id = auth.uid() or public.is_owner())
  )
  with check (tenant_id = public.auth_tenant_id());
drop policy if exists job_messages_delete on public.job_messages;
create policy job_messages_delete on public.job_messages for delete to authenticated
  using (tenant_id = public.auth_tenant_id() and public.is_owner() and job_id is null);

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on all tables in schema public to authenticated';
    -- A workshop edits its profile, never its package, status or trial.
    execute 'revoke insert, update, delete on public.tenants from authenticated';
    execute 'grant update (name, oib, phone, email, address, city, logo_url, enabled_modules, vocabulary, settings) on public.tenants to authenticated';
    -- Staff and roles are created by the server; people edit only their name and phone.
    execute 'revoke insert, update, delete on public.profiles from authenticated';
    execute 'grant update (full_name, phone) on public.profiles to authenticated';
    execute 'revoke insert, update, delete on public.platform_admins from authenticated';
  end if;
end
$$;
