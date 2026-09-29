-- =====================================================================
-- X-Files · 0002 package tables
--
-- One set of tables per package, prefixed volt_, gear_, body_, wheel_,
-- fleet_, moto_. They exist for every workshop (one schema), but a
-- workshop only ever sees and uses its own package's screens. Same
-- isolation rules as the core: tenant_id everywhere, composite FKs to
-- parents. Owner-only amounts go to private_amounts, never here.
-- =====================================================================

-- ---------------------------------------------------------------------
-- VOLT · autoelektrika, dijagnostika, elektronika
-- ---------------------------------------------------------------------
create table if not exists public.volt_dtc_custom (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  code            text not null,
  brand           text,
  description_hr  text not null,
  causes          text[] not null default '{}',
  tests           text[] not null default '{}',
  created_at      timestamptz not null default now(),
  unique (tenant_id, code)
);
comment on table public.volt_dtc_custom is 'Workshop''s own codes and causes; overrides the built-in library (config/packages/volt-dtc.ts).';

create table if not exists public.volt_scans (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  job_id                uuid not null,
  kind                  text not null default 'initial' check (kind in ('initial', 'control', 'intermediate')),
  tool                  text,
  scanned_at            timestamptz not null default now(),
  meter_value           numeric(12, 1),
  report_attachment_id  uuid,
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (report_attachment_id, tenant_id) references public.attachments (id, tenant_id) on delete set null (report_attachment_id)
);

create table if not exists public.volt_dtc_findings (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  scan_id               uuid not null,
  job_id                uuid not null,
  module                text not null,
  code                  text not null,
  description           text,
  status                text not null default 'active' check (status in ('active', 'stored', 'intermittent', 'pending')),
  freeze_frame          jsonb not null default '{}'::jsonb,
  cleared               boolean not null default false,
  returned_after_clear  boolean not null default false,
  confirmed_cause       text,
  resolution_note       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (scan_id, tenant_id) references public.volt_scans (id, tenant_id) on delete cascade,
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);
comment on column public.volt_dtc_findings.confirmed_cause is 'What it actually was — feeds the workshop''s "solved cases" lookup.';
create index if not exists idx_volt_dtc_findings_code on public.volt_dtc_findings (tenant_id, code);

create table if not exists public.volt_battery_tests (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  job_id             uuid not null,
  battery_type       text check (battery_type in ('lead', 'efb', 'agm', 'lithium')),
  rest_voltage_v     numeric(5, 2),
  rated_cca_a        int,
  measured_cca_a     int,
  soh_pct            int check (soh_pct between 0 and 100),
  soc_pct            int check (soc_pct between 0 and 100),
  cranking_min_v     numeric(5, 2),
  result             text check (result in ('good', 'recharge', 'replace')),
  registered_in_car  boolean,
  tested_at          timestamptz not null default now(),
  created_by         uuid references auth.users (id) on delete set null,
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);

create table if not exists public.volt_charging_tests (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  job_id            uuid not null,
  idle_voltage_v    numeric(5, 2),
  loaded_voltage_v  numeric(5, 2),
  charge_current_a  numeric(6, 1),
  ripple_mv         int,
  alternator_type   text check (alternator_type in ('classic', 'lin', 'start_stop')),
  result            text check (result in ('ok', 'regulator', 'diodes', 'replace')),
  tested_at         timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);

create table if not exists public.volt_drain_sessions (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  job_id              uuid not null,
  method              text not null default 'clamp' check (method in ('clamp', 'ammeter', 'fuse_voltage_drop')),
  target_ma           int not null default 50 check (target_ma > 0),
  expected_sleep_min  int,
  started_at          timestamptz not null default now(),
  culprit_circuit     text,
  culprit_module      text,
  final_ma            numeric(8, 1),
  verdict             text check (verdict in ('ok', 'too_high')),
  note                text,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);

create table if not exists public.volt_drain_readings (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  session_id    uuid not null,
  t_offset_min  numeric(7, 2) not null check (t_offset_min >= 0),
  current_ma    numeric(9, 1) not null check (current_ma >= 0),
  event         text,
  created_at    timestamptz not null default now(),
  foreign key (session_id, tenant_id) references public.volt_drain_sessions (id, tenant_id) on delete cascade
);
create index if not exists idx_volt_drain_readings_session on public.volt_drain_readings (session_id, t_offset_min);

create table if not exists public.volt_voltage_drops (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  job_id         uuid not null,
  circuit        text not null,
  condition      text,
  measured_v     numeric(6, 3) not null,
  max_allowed_v  numeric(6, 3),
  verdict        text check (verdict in ('ok', 'too_high')),
  created_at     timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);

create table if not exists public.volt_live_data (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  job_id         uuid not null,
  module         text,
  captured_at    timestamptz not null default now(),
  condition      text check (condition in ('idle', 'rpm_2500', 'warm', 'load', 'road_test')),
  parameter      text not null,
  value          numeric(14, 4),
  value_text     text,
  unit           text,
  ref_min        numeric(14, 4),
  ref_max        numeric(14, 4),
  verdict        text check (verdict in ('ok', 'out_of_range')),
  attachment_id  uuid,
  created_at     timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (attachment_id, tenant_id) references public.attachments (id, tenant_id) on delete set null (attachment_id)
);

create table if not exists public.volt_module_interventions (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  job_id                uuid not null,
  module                text not null,
  kind                  text not null check (kind in (
                          'coding', 'adaptation', 'software_update', 'programming', 'remap', 'immo_key',
                          'dpf_service_regen', 'dpf_sensor_adaptation', 'egr_adaptation', 'service_reset', 'calibration')),
  tool                  text,
  sw_before             text,
  sw_after              text,
  backup_attachment_id  uuid,
  voltage_stabilized    boolean not null default false,
  result                text check (result in ('success', 'partial', 'reverted')),
  notes                 text,
  compliance_ack        boolean not null default false,
  performed_by          uuid references auth.users (id) on delete set null,
  performed_at          timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  -- A backup that a remap points at can't be deleted on its own (no action =
  -- checked at the end of the statement, so deleting the whole job still works).
  foreign key (backup_attachment_id, tenant_id) references public.attachments (id, tenant_id) on delete no action,
  constraint volt_intervention_backup_required
    check (kind not in ('remap', 'programming') or result is null or backup_attachment_id is not null),
  constraint volt_intervention_compliance_required
    check (kind not in ('remap', 'dpf_service_regen', 'dpf_sensor_adaptation', 'egr_adaptation') or compliance_ack)
);
comment on column public.volt_module_interventions.compliance_ack is 'Confirms the job does not remove emission controls on a road vehicle (illegal in the EU/HR).';

create table if not exists public.volt_keys (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  asset_id         uuid not null,
  job_id           uuid,
  key_type         text check (key_type in ('remote', 'flip', 'keyless', 'card', 'mechanical')),
  transponder      text,
  programmed_now   int check (programmed_now is null or programmed_now >= 0),
  total_after      int check (total_after is null or total_after >= 0),
  lost_disabled    boolean not null default false,
  method           text check (method in ('obd', 'eeprom', 'oem_online')),
  notes            text,
  created_at       timestamptz not null default now(),
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade,
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete set null (job_id)
);
comment on table public.volt_keys is 'Key records. Immobiliser PINs and security codes are never stored.';

-- ---------------------------------------------------------------------
-- GEAR · automehanika, pogonski sklop
-- ---------------------------------------------------------------------
create table if not exists public.gear_service_plans (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  make         text,
  model        text,
  engine_code  text,
  year_from    int,
  year_to      int,
  source       text not null default 'workshop' check (source in ('oem', 'manual_book', 'workshop')),
  items        jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on column public.gear_service_plans.items is '[{taskCode, label, intervalKm?, intervalMonths?, laborHours?, parts?: [...]}]';

create table if not exists public.gear_asset_schedule (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  asset_id         uuid not null,
  task_code        text not null,
  label            text not null,
  interval_km      int check (interval_km is null or interval_km > 0),
  interval_months  int check (interval_months is null or interval_months > 0),
  last_done_meter  numeric(12, 1),
  last_done_date   date,
  next_due_meter   numeric(12, 1),
  next_due_date    date,
  updated_at       timestamptz not null default now(),
  unique (asset_id, task_code),
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade,
  check (interval_km is not null or interval_months is not null)
);

create table if not exists public.gear_labor_norms (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  task_code    text not null,
  description  text not null,
  hours        numeric(6, 2) not null check (hours >= 0),
  applies_to   jsonb not null default '{}'::jsonb,
  source       text not null default 'workshop' check (source in ('licensed', 'workshop')),
  created_at   timestamptz not null default now()
);

create table if not exists public.gear_suppliers (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  name             text not null,
  contact          text,
  phone            text,
  email            text,
  delivery_days    int,
  cutoff_time      time,
  customer_number  text,
  created_at       timestamptz not null default now(),
  unique (id, tenant_id)
);

create table if not exists public.gear_parts (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  job_line_id        uuid not null unique,
  job_id             uuid not null,
  catalog_number     text,
  oe_number          text,
  brand              text,
  supplier_id        uuid,
  supplier_order_no  text,
  order_status       text not null default 'to_order' check (order_status in ('to_order', 'ordered', 'arrived', 'installed', 'returned')),
  serial_or_lot      text,
  installed_meter    numeric(12, 1),
  installed_date     date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (job_line_id, tenant_id) references public.job_lines (id, tenant_id) on delete cascade,
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (supplier_id, tenant_id) references public.gear_suppliers (id, tenant_id) on delete set null (supplier_id)
);
comment on table public.gear_parts is 'Part details for a job line of kind part. Purchase price is in job_line_prices (owner only).';

create table if not exists public.gear_warranty_claims (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  part_id          uuid not null,
  asset_id         uuid not null,
  failed_at_meter  numeric(12, 1),
  failed_date      date,
  symptom          text,
  status           text not null default 'reported' check (status in ('reported', 'at_supplier', 'approved', 'rejected')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (part_id, tenant_id) references public.gear_parts (id, tenant_id) on delete cascade,
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- BODY · limarija, lakirnica, procjena štete
-- ---------------------------------------------------------------------
create table if not exists public.insurers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  name        text not null,
  contact     text,
  email       text,
  phone       text,
  portal_url  text,
  created_at  timestamptz not null default now(),
  unique (id, tenant_id)
);

create table if not exists public.body_estimates (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  job_id              uuid not null,
  version             int not null default 1 check (version >= 1),
  status              text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'supplement', 'rejected')),
  insurer_id          uuid,
  claim_number        text,
  policy_number       text,
  loss_date           date,
  loss_type           text check (loss_type in ('collision', 'parking', 'hail', 'wildlife', 'vandalism', 'other')),
  assessor_name       text,
  inspected_at        timestamptz,
  external_report_id  uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, tenant_id),
  unique (job_id, version),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (insurer_id, tenant_id) references public.insurers (id, tenant_id) on delete set null (insurer_id),
  foreign key (external_report_id, tenant_id) references public.attachments (id, tenant_id) on delete set null (external_report_id)
);
comment on table public.body_estimates is 'Version 1 is the estimate, 2+ are supplements. The approved amount is in private_amounts.';

create table if not exists public.body_panel_damages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  estimate_id     uuid not null,
  zone            text not null,
  damage_type     text check (damage_type in ('scratch', 'dent', 'crack', 'deformation', 'break', 'corrosion')),
  size            text check (size in ('small', 'medium', 'large')),
  operation       text not null check (operation in ('repair', 'replace', 'remove_install', 'refinish', 'polish', 'pdr')),
  hours_body      numeric(5, 2) not null default 0 check (hours_body >= 0),
  hours_prep      numeric(5, 2) not null default 0 check (hours_prep >= 0),
  hours_paint     numeric(5, 2) not null default 0 check (hours_paint >= 0),
  hours_assembly  numeric(5, 2) not null default 0 check (hours_assembly >= 0),
  part_line_id    uuid,
  photo_ids       uuid[] not null default '{}',
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (estimate_id, zone),
  foreign key (estimate_id, tenant_id) references public.body_estimates (id, tenant_id) on delete cascade,
  foreign key (part_line_id, tenant_id) references public.job_lines (id, tenant_id) on delete set null (part_line_id)
);

create table if not exists public.body_paint_jobs (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants (id) on delete cascade,
  job_id               uuid not null unique,
  paint_code           text,
  paint_name           text,
  paint_system         text,
  coat_structure       text check (coat_structure in ('single', 'two_stage', 'three_stage')),
  color_match          text check (color_match in ('recipe', 'spectro', 'test_panel', 'tinting')),
  variant              text,
  test_panel_photo_id  uuid,
  panels               text[] not null default '{}',
  blend_panels         text[] not null default '{}',
  booth_temp_c         numeric(4, 1),
  booth_humidity_pct   int check (booth_humidity_pct is null or booth_humidity_pct between 0 and 100),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (test_panel_photo_id, tenant_id) references public.attachments (id, tenant_id) on delete set null (test_panel_photo_id)
);

create table if not exists public.body_paint_mix_lines (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  paint_job_id    uuid not null,
  sort            int not null default 0,
  component_code  text not null,
  target_g        numeric(8, 1) check (target_g is null or target_g >= 0),
  actual_g        numeric(8, 1) check (actual_g is null or actual_g >= 0),
  foreign key (paint_job_id, tenant_id) references public.body_paint_jobs (id, tenant_id) on delete cascade
);

create table if not exists public.body_material_usage (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  job_id      uuid not null,
  material    text not null check (material in ('basecoat', 'clearcoat', 'primer', 'filler', 'thinner', 'hardener', 'abrasive', 'masking', 'other')),
  qty         numeric(10, 1) not null check (qty >= 0),
  unit        text not null check (unit in ('g', 'ml', 'kom')),
  created_at  timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);

create table if not exists public.body_production_phases (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  job_id       uuid not null,
  phase        text not null check (phase in ('disassembly', 'bodywork', 'prep', 'paint', 'assembly', 'polish', 'quality', 'wash')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  worker_id    uuid,
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (worker_id, tenant_id) references public.profiles (id, tenant_id) on delete set null (worker_id),
  check (finished_at is null or finished_at >= started_at)
);

create table if not exists public.body_adas_calibrations (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  job_id                uuid not null,
  system                text not null check (system in ('front_camera', 'radar', 'parking_sensors', 'surround_cameras', 'blind_spot')),
  procedure             text check (procedure in ('static', 'dynamic')),
  result                text check (result in ('success', 'failed')),
  report_attachment_id  uuid,
  performed_at          timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (report_attachment_id, tenant_id) references public.attachments (id, tenant_id) on delete set null (report_attachment_id)
);

-- ---------------------------------------------------------------------
-- WHEEL · vulkanizeri, geometrija, hotel za gume
-- ---------------------------------------------------------------------
create table if not exists public.wheel_storage_locations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  sector      text not null,
  rack        int not null check (rack > 0),
  shelf       int not null check (shelf > 0),
  slot        int not null check (slot > 0),
  capacity    int not null default 1 check (capacity > 0),
  indoor      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, sector, rack, shelf, slot)
);

create table if not exists public.wheel_tire_sets (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  client_id          uuid not null,
  asset_id           uuid,
  season             text not null check (season in ('summer', 'winter', 'all_season')),
  width              int check (width between 100 and 400),
  aspect             int check (aspect between 20 and 100),
  rim_diameter       numeric(4, 1) check (rim_diameter between 10 and 26),
  load_index         text,
  speed_index        text,
  brand              text,
  model              text,
  on_rims            boolean not null default false,
  rim_material       text check (rim_material in ('alloy', 'steel')),
  rim_size           text,
  rim_et             int,
  bolts_included     boolean not null default false,
  lock_key_location  text,
  status             text not null default 'on_vehicle' check (status in ('on_vehicle', 'stored', 'released', 'disposed')),
  qr_code            text not null unique default encode(gen_random_bytes(6), 'hex'),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade,
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete set null (asset_id)
);

create table if not exists public.wheel_tires (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  set_id           uuid not null,
  position         text not null check (position in ('FL', 'FR', 'RL', 'RR', 'SPARE')),
  dot_week         int check (dot_week between 1 and 53),
  dot_year         int check (dot_year between 1990 and 2100),
  tread_inner_mm   numeric(4, 1) check (tread_inner_mm between 0 and 30),
  tread_middle_mm  numeric(4, 1) check (tread_middle_mm between 0 and 30),
  tread_outer_mm   numeric(4, 1) check (tread_outer_mm between 0 and 30),
  measured_at      timestamptz,
  damage           text check (damage in ('none', 'cut', 'bulge', 'sidewall_cracks', 'bead_damage')),
  repairable       boolean,
  qr_code          text not null unique default encode(gen_random_bytes(6), 'hex'),
  unique (set_id, position),
  foreign key (set_id, tenant_id) references public.wheel_tire_sets (id, tenant_id) on delete cascade
);

create table if not exists public.wheel_rims (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  set_id     uuid not null,
  position   text not null check (position in ('FL', 'FR', 'RL', 'RR', 'SPARE')),
  condition  text check (condition in ('ok', 'curb_rash', 'bent', 'cracked', 'corrosion')),
  photo_id   uuid,
  unique (set_id, position),
  foreign key (set_id, tenant_id) references public.wheel_tire_sets (id, tenant_id) on delete cascade,
  foreign key (photo_id, tenant_id) references public.attachments (id, tenant_id) on delete set null (photo_id)
);

create table if not exists public.wheel_storage_stays (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  set_id           uuid not null,
  location_id      uuid not null,
  checked_in_at    timestamptz not null default now(),
  checked_out_at   timestamptz,
  season_label     text,
  contract_signed  boolean not null default false,
  signature_path   text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  foreign key (set_id, tenant_id) references public.wheel_tire_sets (id, tenant_id) on delete cascade,
  foreign key (location_id, tenant_id) references public.wheel_storage_locations (id, tenant_id) on delete no action,
  check (checked_out_at is null or checked_out_at >= checked_in_at)
);
create unique index if not exists uq_wheel_active_stay on public.wheel_storage_stays (set_id) where checked_out_at is null;
comment on table public.wheel_storage_stays is 'The storage fee is in private_amounts (entity wheel_storage_stays, field fee).';

create table if not exists public.wheel_alignments (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  job_id                uuid not null,
  device                text,
  spec_source           text,
  steering_centered     boolean,
  report_attachment_id  uuid,
  performed_at          timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (report_attachment_id, tenant_id) references public.attachments (id, tenant_id) on delete set null (report_attachment_id)
);

create table if not exists public.wheel_alignment_values (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  alignment_id  uuid not null,
  axle          text not null check (axle in ('front', 'rear')),
  wheel         text not null check (wheel in ('left', 'right', 'total')),
  parameter     text not null check (parameter in ('toe', 'total_toe', 'camber', 'caster', 'thrust')),
  before_value  numeric(7, 3),
  after_value   numeric(7, 3),
  spec_min      numeric(7, 3),
  spec_max      numeric(7, 3),
  unit          text not null default 'deg' check (unit in ('deg', 'min', 'mm')),
  unique (alignment_id, axle, wheel, parameter),
  foreign key (alignment_id, tenant_id) references public.wheel_alignments (id, tenant_id) on delete cascade
);

create table if not exists public.wheel_torque_specs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  make          text not null,
  model         text,
  year_from     int,
  year_to       int,
  torque_nm     int not null check (torque_nm between 20 and 1000),
  bolt_size     text,
  retorque_km   int not null default 50,
  created_at    timestamptz not null default now()
);

create table if not exists public.wheel_torque_records (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  job_id              uuid not null,
  applied_nm          int not null check (applied_nm between 20 and 1000),
  tool                text,
  tool_calibrated_on  date,
  retorque_due        date,
  retorque_done       boolean not null default false,
  created_at          timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);

create table if not exists public.wheel_balancing (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  job_id          uuid not null,
  position        text not null check (position in ('FL', 'FR', 'RL', 'RR')),
  weight_inner_g  int check (weight_inner_g is null or weight_inner_g >= 0),
  weight_outer_g  int check (weight_outer_g is null or weight_outer_g >= 0),
  created_at      timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);

create table if not exists public.wheel_repairs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  job_id       uuid not null,
  position     text not null check (position in ('FL', 'FR', 'RL', 'RR', 'SPARE')),
  damage_zone  text not null check (damage_zone in ('tread', 'shoulder', 'sidewall')),
  method       text check (method in ('plug', 'patch', 'combo')),
  -- Only the tread may be repaired; shoulder and sidewall damage means a new tyre.
  allowed      boolean generated always as (damage_zone = 'tread') stored,
  created_at   timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);

create table if not exists public.wheel_tpms (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  job_id        uuid not null,
  position      text not null check (position in ('FL', 'FR', 'RL', 'RR')),
  sensor_id     text,
  battery       text check (battery in ('ok', 'low', 'dead')),
  relearn_done  boolean not null default false,
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);

create table if not exists public.wheel_inventory (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  width         int,
  aspect        int,
  rim_diameter  numeric(4, 1),
  load_index    text,
  speed_index   text,
  brand         text not null,
  model         text,
  season        text not null check (season in ('summer', 'winter', 'all_season')),
  dot           text,
  qty           int not null default 0 check (qty >= 0),
  eu_fuel       text check (eu_fuel in ('A', 'B', 'C', 'D', 'E')),
  eu_wet        text check (eu_wet in ('A', 'B', 'C', 'D', 'E')),
  eu_noise_db   int,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.wheel_inventory is 'Selling and purchase prices are in private_amounts.';

-- ---------------------------------------------------------------------
-- FLEET · teretni program, građevina, flote
-- ---------------------------------------------------------------------
alter table public.assets add column if not exists axle_config text;
alter table public.assets add column if not exists gvw_t numeric(6, 2);

create table if not exists public.fleet_accounts (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants (id) on delete cascade,
  client_id            uuid not null unique,
  fleet_manager_name   text,
  fleet_manager_phone  text,
  fleet_manager_email  text,
  payment_terms_days   int not null default 30 check (payment_terms_days >= 0),
  po_required          boolean not null default false,
  price_list_id        uuid,
  portal_enabled       boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade,
  foreign key (price_list_id, tenant_id) references public.price_lists (id, tenant_id) on delete set null (price_list_id)
);

create table if not exists public.fleet_pm_plans (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  name             text not null,
  applies_to       jsonb not null default '{}'::jsonb,
  interval_mth     int check (interval_mth is null or interval_mth > 0),
  interval_km      int check (interval_km is null or interval_km > 0),
  interval_days    int check (interval_days is null or interval_days > 0),
  checklist_code   text,
  template_code    text,
  created_at       timestamptz not null default now(),
  unique (id, tenant_id),
  check (interval_mth is not null or interval_km is not null or interval_days is not null)
);

create table if not exists public.fleet_asset_pm (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants (id) on delete cascade,
  asset_id                uuid not null,
  plan_id                 uuid not null,
  last_done_mth           numeric(12, 1),
  last_done_km            numeric(12, 1),
  last_done_date          date,
  next_due_mth            numeric(12, 1),
  next_due_km             numeric(12, 1),
  next_due_date           date,
  auto_open_threshold_pct int not null default 90 check (auto_open_threshold_pct between 50 and 100),
  updated_at              timestamptz not null default now(),
  unique (asset_id, plan_id),
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade,
  foreign key (plan_id, tenant_id) references public.fleet_pm_plans (id, tenant_id) on delete cascade
);

create table if not exists public.fleet_compliance_items (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  asset_id            uuid not null,
  kind                text not null check (kind in (
                        'technical_inspection', 'preventive_inspection', 'tachograph', 'cemt_permit', 'adr',
                        'fire_extinguisher', 'insurance', 'registration', 'license')),
  valid_from          date,
  valid_until         date not null,
  document_id         uuid,
  remind_days_before  int[] not null default '{30,14,7}',
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade,
  foreign key (document_id, tenant_id) references public.attachments (id, tenant_id) on delete set null (document_id),
  check (valid_from is null or valid_until >= valid_from)
);
create index if not exists idx_fleet_compliance_due on public.fleet_compliance_items (tenant_id, valid_until);

create table if not exists public.fleet_service_requests (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  asset_id     uuid not null,
  reported_by  text,
  description  text not null check (length(btrim(description)) > 0),
  priority     text not null default 'planned' check (priority in ('vehicle_down', 'urgent', 'planned')),
  photo_ids    uuid[] not null default '{}',
  status       text not null default 'new' check (status in ('new', 'accepted', 'in_job', 'rejected')),
  job_id       uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade,
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete set null (job_id)
);

create table if not exists public.fleet_driver_checks (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  asset_id           uuid not null,
  driver_name        text not null,
  submitted_at       timestamptz not null default now(),
  meter_value        numeric(12, 1) not null check (meter_value >= 0),
  meter_unit         public.meter_unit not null,
  results            jsonb not null default '[]'::jsonb,
  has_defects        boolean not null default false,
  defect_request_id  uuid,
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade,
  foreign key (defect_request_id, tenant_id) references public.fleet_service_requests (id, tenant_id) on delete set null (defect_request_id)
);

create table if not exists public.fleet_field_jobs (
  job_id            uuid primary key,
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  address           text,
  lat               double precision,
  lng               double precision,
  departed_at       timestamptz,
  arrived_at        timestamptz,
  work_started      timestamptz,
  work_finished     timestamptz,
  returned_at       timestamptz,
  travel_km         numeric(7, 1) check (travel_km is null or travel_km >= 0),
  travel_hours      numeric(5, 2) check (travel_hours is null or travel_hours >= 0),
  signer_name       text,
  signature_path    text,
  created_offline   boolean not null default false,
  updated_at        timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);

create table if not exists public.fleet_downtime (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  asset_id   uuid not null,
  job_id     uuid,
  from_at    timestamptz not null,
  to_at      timestamptz,
  reason     text check (reason in ('breakdown', 'waiting_parts', 'planned', 'accident')),
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade,
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete set null (job_id),
  check (to_at is null or to_at >= from_at)
);

-- Invoices carry money: owner only (see 0005_rls.sql).
create table if not exists public.fleet_invoices (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  account_id  uuid not null,
  period      text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  job_ids     uuid[] not null default '{}',
  po_number   text,
  total       numeric(12, 2),
  status      text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  created_at  timestamptz not null default now(),
  unique (account_id, period),
  foreign key (account_id, tenant_id) references public.fleet_accounts (id, tenant_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- MOTO & MARINE · motocikli, quadovi, nautika
-- ---------------------------------------------------------------------
create table if not exists public.moto_vessel_details (
  asset_id          uuid primary key,
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  vessel_name       text,
  registration_mark text,
  length_m          numeric(5, 2) check (length_m is null or length_m > 0),
  beam_m            numeric(5, 2) check (beam_m is null or beam_m > 0),
  hull_material     text check (hull_material in ('grp', 'aluminium', 'wood', 'inflatable', 'steel', 'other')),
  home_port         text,
  berth             text,
  updated_at        timestamptz not null default now(),
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade
);

create table if not exists public.moto_engine_details (
  asset_id                 uuid primary key,
  tenant_id                uuid not null references public.tenants (id) on delete cascade,
  engine_serial            text,
  power_kw                 numeric(6, 1),
  power_hp                 int,
  stroke                   text check (stroke in ('2T', '4T')),
  position                 text check (position in ('single', 'port', 'starboard', 'center')),
  impeller_replaced_mth    numeric(8, 1),
  impeller_replaced_date   date,
  updated_at               timestamptz not null default now(),
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade
);

create table if not exists public.moto_equipment_items (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants (id) on delete cascade,
  condition_report_id  uuid not null,
  item                 text not null,
  qty                  int not null default 1 check (qty > 0),
  condition            text,
  returned             boolean not null default false,
  foreign key (condition_report_id, tenant_id) references public.condition_reports (id, tenant_id) on delete cascade
);

create table if not exists public.moto_seasonal_protocols (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  job_id              uuid not null,
  kind                text not null check (kind in ('winterize', 'dewinterize')),
  inspection_id       uuid,
  fuel_stabilized     boolean not null default false,
  battery_maintained  boolean not null default false,
  anodes_wear_pct     jsonb not null default '{}'::jsonb,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  unique (job_id, kind),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (inspection_id, tenant_id) references public.inspections (id, tenant_id) on delete set null (inspection_id)
);

create table if not exists public.moto_storage_locations (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  area       text not null,
  slot       text not null,
  kind       text not null default 'hall' check (kind in ('hall', 'covered', 'outdoor')),
  unique (id, tenant_id),
  unique (tenant_id, area, slot)
);

create table if not exists public.moto_storage_stays (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  asset_id        uuid not null,
  location_id     uuid not null,
  from_date       date not null default current_date,
  until_date      date,
  battery_checks  jsonb not null default '[]'::jsonb,
  released_at     timestamptz,
  created_at      timestamptz not null default now(),
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade,
  foreign key (location_id, tenant_id) references public.moto_storage_locations (id, tenant_id) on delete no action,
  check (until_date is null or until_date >= from_date)
);
create unique index if not exists uq_moto_active_stay on public.moto_storage_stays (asset_id) where released_at is null;

-- updated_at on package tables that have it
do $$
declare
  t text;
begin
  foreach t in array array[
    'volt_dtc_findings', 'gear_service_plans', 'gear_asset_schedule', 'gear_parts', 'gear_warranty_claims',
    'body_estimates', 'body_panel_damages', 'body_paint_jobs', 'wheel_tire_sets', 'wheel_inventory',
    'fleet_accounts', 'fleet_asset_pm', 'fleet_compliance_items', 'fleet_service_requests', 'fleet_field_jobs',
    'moto_vessel_details', 'moto_engine_details'
  ] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;
