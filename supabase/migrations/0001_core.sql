-- =====================================================================
-- X-Files · 0001 core schema
--
-- Shared by all six packages (Volt, Gear, Body, Wheel, Fleet, Moto).
-- Every tenant-scoped table carries tenant_id, and child rows point at
-- their parent through (id, tenant_id) composite foreign keys, so a row
-- can never reference another workshop's data — not even by a bug.
-- Row Level Security for these tables is in 0005_rls.sql.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin create type public.package_id as enum ('volt', 'gear', 'body', 'wheel', 'fleet', 'moto'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tenant_status as enum ('trial', 'active', 'suspended'); exception when duplicate_object then null; end $$;
do $$ begin create type public.staff_role as enum ('owner', 'worker'); exception when duplicate_object then null; end $$;
do $$ begin create type public.job_phase as enum ('intake', 'diagnosis', 'awaiting_approval', 'awaiting_parts', 'in_progress', 'quality_check', 'ready', 'collected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('unpaid', 'paid'); exception when duplicate_object then null; end $$;
do $$ begin create type public.line_kind as enum ('labor', 'part', 'material', 'package', 'sublet', 'fee'); exception when duplicate_object then null; end $$;
do $$ begin create type public.line_priority as enum ('urgent', 'recommended', 'optional'); exception when duplicate_object then null; end $$;
do $$ begin create type public.line_approval as enum ('proposed', 'approved', 'declined', 'deferred'); exception when duplicate_object then null; end $$;
do $$ begin create type public.line_source as enum ('manual', 'template', 'inspection', 'estimate', 'service_plan'); exception when duplicate_object then null; end $$;
do $$ begin create type public.inspection_status as enum ('ok', 'warn', 'crit', 'not_checked', 'na'); exception when duplicate_object then null; end $$;
do $$ begin create type public.meter_unit as enum ('km', 'mth'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attachment_visibility as enum ('internal', 'customer', 'insurer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attachment_stage as enum ('before', 'during', 'after'); exception when duplicate_object then null; end $$;
do $$ begin create type public.message_kind as enum ('task', 'help'); exception when duplicate_object then null; end $$;
do $$ begin create type public.message_status as enum ('open', 'taken', 'done'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Workshops, staff, platform admins
-- ---------------------------------------------------------------------
create table if not exists public.tenants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) > 1),
  slug            text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  package         public.package_id not null,
  status          public.tenant_status not null default 'trial',
  trial_ends_at   timestamptz,
  status_note     text,
  domain          text,
  oib             text check (oib is null or oib ~ '^[0-9]{11}$'),
  phone           text,
  email           text,
  address         text,
  city            text,
  logo_url        text,
  enabled_modules text[] not null default '{}',
  vocabulary      jsonb not null default '{}'::jsonb,
  settings        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on column public.tenants.package is 'Chosen once at registration; only the platform admin can change it.';
comment on column public.tenants.enabled_modules is 'Optional modules switched on beyond the package defaults (config/tenant.config.ts).';

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  full_name   text,
  phone       text,
  role        public.staff_role not null default 'worker',
  created_at  timestamptz not null default now(),
  unique (id, tenant_id)
);
comment on column public.profiles.role is 'owner = voditelj servisa (finances, locking, settings); worker = radnik (operations, no amounts).';

create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
comment on table public.platform_admins is 'SaaS operator accounts. Not members of any workshop.';

-- ---------------------------------------------------------------------
-- Access helpers used by every policy
-- ---------------------------------------------------------------------

-- The caller's workshop, or null when it is suspended or its trial ran
-- out — which locks every tenant policy at once.
create or replace function public.auth_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.tenant_id
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where p.id = auth.uid()
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
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'owner' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- Price lists (owner only)
-- ---------------------------------------------------------------------
create table if not exists public.price_lists (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  name              text not null,
  labor_rates       jsonb not null default '{}'::jsonb,
  parts_markup_pct  numeric(6, 2) not null default 0,
  discount_pct      numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  is_default        boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (id, tenant_id)
);
comment on column public.price_lists.labor_rates is 'Hourly rate per work type, e.g. {"mechanical": 45, "electrical": 55, "field": 60}.';

-- ---------------------------------------------------------------------
-- Customers and the objects they bring in
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  kind           text not null default 'person' check (kind in ('person', 'company')),
  first_name     text,
  last_name      text,
  company_name   text,
  oib            text check (oib is null or oib ~ '^[0-9]{11}$'),
  phone          text,
  email          text,
  address        text,
  city           text,
  notes          text,
  price_list_id  uuid,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (price_list_id, tenant_id) references public.price_lists (id, tenant_id) on delete set null (price_list_id),
  check (coalesce(nullif(btrim(company_name), ''), nullif(btrim(last_name), ''), nullif(btrim(first_name), '')) is not null)
);

create table if not exists public.assets (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  client_id             uuid not null,
  parent_asset_id       uuid,
  asset_type            text not null check (asset_type in (
                          'car', 'van', 'truck', 'tractor_unit', 'bus', 'trailer', 'semi_trailer', 'machine',
                          'tractor', 'implement', 'motorcycle', 'scooter', 'atv', 'jetski', 'boat', 'outboard', 'inboard')),
  identifier            text,
  vin                   text,
  make                  text,
  model                 text,
  variant               text,
  year                  int check (year between 1900 and 2100),
  engine_code           text,
  fuel                  text check (fuel is null or fuel in ('petrol', 'diesel', 'hybrid', 'plugin', 'electric', 'lpg', 'cng')),
  power_kw              numeric(7, 1),
  internal_number       text,
  meter_primary_unit    public.meter_unit not null default 'km',
  meter_secondary_unit  public.meter_unit,
  paint_code            text,
  notes                 text,
  is_demo               boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade,
  foreign key (parent_asset_id, tenant_id) references public.assets (id, tenant_id) on delete set null (parent_asset_id),
  check (parent_asset_id is null or parent_asset_id <> id)
);
comment on table public.assets is 'The object serviced: car, truck, machine, motorcycle, boat, engine. parent_asset_id links a trailer to its truck or an engine to its boat.';
create index if not exists idx_assets_identifier on public.assets (tenant_id, lower(identifier));
create index if not exists idx_assets_client on public.assets (client_id);
create index if not exists idx_assets_parent on public.assets (parent_asset_id);

-- ---------------------------------------------------------------------
-- Work orders
-- ---------------------------------------------------------------------
create table if not exists public.jobs (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  number           int not null default 0,
  client_id        uuid not null,
  asset_id         uuid not null,
  phase            public.job_phase not null default 'intake',
  sub_status       text,
  complaint        text,
  diagnosis_notes  text,
  work_summary     text,
  meter_in         numeric(12, 1) check (meter_in is null or meter_in >= 0),
  meter_out        numeric(12, 1) check (meter_out is null or meter_out >= 0),
  meter_unit       public.meter_unit,
  promised_at      timestamptz,
  bay              text,
  assigned_to      uuid,
  source           text not null default 'workshop' check (source in ('workshop', 'qr', 'phone', 'fleet_request', 'field')),
  is_urgent        boolean not null default false,
  payment_status   public.payment_status not null default 'unpaid',
  paid_at          timestamptz,
  locked_at        timestamptz,
  finished_at      timestamptz,
  collected_at     timestamptz,
  created_by       uuid references auth.users (id) on delete set null,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, number),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade,
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade,
  foreign key (assigned_to, tenant_id) references public.profiles (id, tenant_id) on delete set null (assigned_to)
);
comment on column public.jobs.phase is 'Universal lifecycle used by logic (archive, analytics). Packages name their steps in sub_status.';
create index if not exists idx_jobs_phase on public.jobs (tenant_id, phase);
create index if not exists idx_jobs_asset on public.jobs (asset_id);
create index if not exists idx_jobs_client on public.jobs (client_id);

-- Per-workshop running number (Nalog 42), taken under a lock so two
-- simultaneous intakes never get the same one.
create or replace function public.set_job_number()
returns trigger
language plpgsql
as $$
begin
  if new.number is null or new.number = 0 then
    perform pg_advisory_xact_lock(hashtext('job_number:' || new.tenant_id::text));
    select coalesce(max(number), 0) + 1 into new.number from public.jobs where tenant_id = new.tenant_id;
  end if;
  return new;
end
$$;

-- Money and unlocking belong to the owner. Service-role calls (seed,
-- registration) have no auth.uid() and pass.
create or replace function public.enforce_job_owner_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_owner() then
    return new;
  end if;
  if new.payment_status is distinct from old.payment_status or new.paid_at is distinct from old.paid_at then
    raise exception 'Samo voditelj servisa mijenja naplatu.' using errcode = '42501';
  end if;
  if old.locked_at is not null and new.locked_at is null then
    raise exception 'Samo voditelj servisa otključava nalog.' using errcode = '42501';
  end if;
  return new;
end
$$;

create table if not exists public.meter_readings (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  asset_id    uuid not null,
  job_id      uuid,
  unit        public.meter_unit not null,
  value       numeric(12, 1) not null check (value >= 0),
  read_at     timestamptz not null default now(),
  source      text not null default 'manual' check (source in ('intake', 'handover', 'driver', 'field', 'manual', 'telematics')),
  photo_id    uuid,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade,
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete set null (job_id)
);
create index if not exists idx_meter_readings_asset on public.meter_readings (asset_id, read_at desc);

-- ---------------------------------------------------------------------
-- Line items and their prices
-- ---------------------------------------------------------------------
create table if not exists public.job_lines (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  job_id                uuid not null,
  sort                  int not null default 0,
  kind                  public.line_kind not null default 'labor',
  code                  text,
  description           text not null check (length(btrim(description)) > 0),
  qty                   numeric(10, 2) not null default 1 check (qty >= 0),
  unit                  text not null default 'kom',
  priority              public.line_priority,
  approval              public.line_approval not null default 'approved',
  declined_reason       text,
  remind_at             date,
  source                public.line_source not null default 'manual',
  inspection_result_id  uuid,
  template_code         text,
  technician_id         uuid,
  time_spent_h          numeric(6, 2),
  warranty_months       int check (warranty_months is null or warranty_months >= 0),
  warranty_km           int check (warranty_km is null or warranty_km >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (technician_id, tenant_id) references public.profiles (id, tenant_id) on delete set null (technician_id)
);
comment on table public.job_lines is 'Labour, parts and materials per line. Prices live in job_line_prices, which only the owner can read.';

create table if not exists public.job_line_prices (
  job_line_id     uuid primary key,
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  unit_price      numeric(12, 2) not null default 0 check (unit_price >= 0),
  purchase_price  numeric(12, 2) check (purchase_price is null or purchase_price >= 0),
  discount_pct    numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  vat_rate        numeric(5, 2) not null default 25 check (vat_rate between 0 and 100),
  updated_at      timestamptz not null default now(),
  foreign key (job_line_id, tenant_id) references public.job_lines (id, tenant_id) on delete cascade
);

-- Any other amount a worker must not see (storage fees, approved
-- insurance amounts, material costs) is kept here, owner only.
create table if not exists public.private_amounts (
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  entity      text not null,
  entity_id   uuid not null,
  field       text not null,
  amount      numeric(12, 2) not null,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, entity, entity_id, field)
);
comment on table public.private_amounts is 'Owner-only amounts for package records, e.g. (wheel_storage_stays, <id>, fee).';

-- Totals per job over approved lines. security_invoker: a worker reading
-- it gets nothing, because job_line_prices is invisible to them.
create or replace view public.job_totals
with (security_invoker = true) as
select
  l.job_id,
  l.tenant_id,
  round(sum(l.qty * p.unit_price * (1 - p.discount_pct / 100)), 2) as net_total,
  round(sum(l.qty * p.unit_price * (1 - p.discount_pct / 100) * (1 + p.vat_rate / 100)), 2) as gross_total
from public.job_lines l
join public.job_line_prices p on p.job_line_id = l.id
where l.approval = 'approved'
group by l.job_id, l.tenant_id;

-- A locked job's lines and prices are final. Service role passes.
create or replace function public.guard_locked_job_lines()
returns trigger
language plpgsql
as $$
declare
  v_job_id uuid;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_table_name = 'job_line_prices' then
    select job_id into v_job_id
    from public.job_lines
    where id = case when tg_op = 'DELETE' then old.job_line_id else new.job_line_id end;
  else
    v_job_id := case when tg_op = 'DELETE' then old.job_id else new.job_id end;
  end if;
  if exists (select 1 from public.jobs where id = v_job_id and locked_at is not null) then
    raise exception 'Nalog je zaključan.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

-- ---------------------------------------------------------------------
-- Templates (workshop-specific; package defaults live in the app config)
-- ---------------------------------------------------------------------
create table if not exists public.templates (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants (id) on delete cascade,
  package                   public.package_id not null,
  code                      text not null,
  name                      text not null,
  description               text,
  lines                     jsonb not null default '[]'::jsonb,
  inspection_template_code  text,
  applies_to                jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.inspection_templates (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  package     public.package_id not null,
  code        text not null,
  name        text not null,
  sections    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, code)
);
comment on column public.inspection_templates.sections is '[{title, items: [{code, label, unit?, warnBelow?, critBelow?, warnAbove?, critAbove?}]}]';

-- ---------------------------------------------------------------------
-- Inspections (DVI, driver checks, seasonal protocols, final checks)
-- ---------------------------------------------------------------------
create table if not exists public.inspections (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  job_id         uuid not null,
  template_code  text not null,
  title          text not null,
  performed_by   uuid,
  meter_value    numeric(12, 1),
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (performed_by, tenant_id) references public.profiles (id, tenant_id) on delete set null (performed_by)
);

create table if not exists public.inspection_results (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  inspection_id  uuid not null,
  item_code      text not null,
  status         public.inspection_status not null default 'not_checked',
  measure_value  numeric(10, 2),
  measure_unit   text,
  note           text,
  photo_ids      uuid[] not null default '{}',
  job_line_id    uuid,
  updated_at     timestamptz not null default now(),
  unique (id, tenant_id),
  unique (inspection_id, item_code),
  foreign key (inspection_id, tenant_id) references public.inspections (id, tenant_id) on delete cascade,
  foreign key (job_line_id, tenant_id) references public.job_lines (id, tenant_id) on delete set null (job_line_id)
);

alter table public.job_lines drop constraint if exists job_lines_inspection_result_fk;
alter table public.job_lines
  add constraint job_lines_inspection_result_fk
  foreign key (inspection_result_id, tenant_id) references public.inspection_results (id, tenant_id) on delete set null (inspection_result_id);

-- ---------------------------------------------------------------------
-- Condition report at intake and handover
-- ---------------------------------------------------------------------
create table if not exists public.condition_reports (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  job_id          uuid not null,
  kind            text not null default 'intake' check (kind in ('intake', 'handover')),
  diagram         text not null default 'car' check (diagram in ('car', 'truck', 'moto', 'atv', 'boat')),
  marks           jsonb not null default '[]'::jsonb,
  equipment       jsonb not null default '[]'::jsonb,
  fuel_level      text check (fuel_level is null or fuel_level in ('0', '1/4', '1/2', '3/4', '1')),
  signer_name     text,
  signature_path  text,
  signed_at       timestamptz,
  staff_id        uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, tenant_id),
  unique (job_id, kind),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (staff_id, tenant_id) references public.profiles (id, tenant_id) on delete set null (staff_id)
);
comment on column public.condition_reports.marks is '[{zone, code: O|U|P|K|L|N, size?, note?, photoId?}]';

-- ---------------------------------------------------------------------
-- Files: photos, documents, backups
-- ---------------------------------------------------------------------
create table if not exists public.attachments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  job_id      uuid,
  asset_id    uuid,
  path        text not null unique,
  mime        text,
  size_bytes  int,
  tag         text,
  caption     text,
  visibility  public.attachment_visibility not null default 'internal',
  stage       public.attachment_stage,
  zone        text,
  angle       text,
  sha256      text,
  has_thumb   boolean not null default false,
  taken_at    timestamptz,
  gps_lat     double precision,
  gps_lng     double precision,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (id, tenant_id),
  check (job_id is not null or asset_id is not null),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade
);
comment on column public.attachments.sha256 is 'Hash of the original file: proof for insurers that the photo was not altered.';
create index if not exists idx_attachments_job on public.attachments (job_id);

alter table public.meter_readings drop constraint if exists meter_readings_photo_fk;
alter table public.meter_readings
  add constraint meter_readings_photo_fk
  foreign key (photo_id, tenant_id) references public.attachments (id, tenant_id) on delete set null (photo_id);

-- ---------------------------------------------------------------------
-- Customer approval by link
-- ---------------------------------------------------------------------
create table if not exists public.approvals (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  job_id          uuid not null,
  token           uuid not null unique default gen_random_uuid(),
  status          text not null default 'sent' check (status in ('sent', 'viewed', 'decided', 'expired')),
  sent_via        text check (sent_via is null or sent_via in ('whatsapp', 'sms', 'email', 'link')),
  sent_at         timestamptz not null default now(),
  viewed_at       timestamptz,
  decided_at      timestamptz,
  expires_at      timestamptz not null default (now() + interval '14 days'),
  decisions       jsonb not null default '[]'::jsonb,
  signer_name     text,
  signature_path  text,
  ip              text,
  user_agent      text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- Reminders, documents, events, internal messages
-- ---------------------------------------------------------------------
create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  client_id   uuid,
  asset_id    uuid,
  job_id      uuid,
  kind        text not null check (kind in ('service', 'season', 'compliance', 'retorque', 'declined_work', 'storage', 'battery', 'custom')),
  title       text not null,
  due_date    date,
  due_meter   numeric(12, 1),
  due_unit    public.meter_unit,
  channel     text not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'email', 'internal')),
  status      text not null default 'planned' check (status in ('planned', 'sent', 'snoozed', 'done', 'cancelled')),
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  check (due_date is not null or due_meter is not null),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete cascade,
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade,
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);
create index if not exists idx_reminders_due on public.reminders (tenant_id, status, due_date);

create table if not exists public.documents (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  job_id           uuid,
  asset_id         uuid,
  kind             text not null,
  title            text not null,
  path             text not null unique,
  version          int not null default 1,
  contains_prices  boolean not null default false,
  sent_to          text,
  sent_at          timestamptz,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (asset_id, tenant_id) references public.assets (id, tenant_id) on delete cascade
);
comment on column public.documents.contains_prices is 'Priced documents (invoice, estimate) are owner-only.';

create table if not exists public.job_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  job_id      uuid not null,
  event_type  text not null,
  actor_id    uuid references auth.users (id) on delete set null,
  message     text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade
);
create index if not exists idx_job_events_job on public.job_events (job_id, created_at desc);

create table if not exists public.job_messages (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  job_id       uuid,
  sender_id    uuid not null,
  receiver_id  uuid,
  kind         public.message_kind not null,
  body         text not null check (length(btrim(body)) > 0),
  photo_path   text,
  reply_to_id  uuid references public.job_messages (id) on delete set null,
  status       public.message_status not null default 'open',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (kind = 'help' or receiver_id is not null),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  foreign key (sender_id, tenant_id) references public.profiles (id, tenant_id) on delete cascade,
  foreign key (receiver_id, tenant_id) references public.profiles (id, tenant_id) on delete cascade
);
comment on table public.job_messages is 'task = owner → worker; help = worker → owners ("Trebam pomoć"). Part of the job''s permanent record.';
create index if not exists idx_job_messages_job on public.job_messages (job_id, created_at);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
drop trigger if exists trg_jobs_number on public.jobs;
create trigger trg_jobs_number before insert on public.jobs
  for each row execute function public.set_job_number();

drop trigger if exists trg_jobs_owner_fields on public.jobs;
create trigger trg_jobs_owner_fields before update on public.jobs
  for each row execute function public.enforce_job_owner_fields();

drop trigger if exists trg_job_lines_locked on public.job_lines;
create trigger trg_job_lines_locked before insert or update or delete on public.job_lines
  for each row execute function public.guard_locked_job_lines();

drop trigger if exists trg_job_line_prices_locked on public.job_line_prices;
create trigger trg_job_line_prices_locked before insert or update or delete on public.job_line_prices
  for each row execute function public.guard_locked_job_lines();

do $$
declare
  t text;
begin
  foreach t in array array[
    'tenants', 'clients', 'assets', 'jobs', 'job_lines', 'job_line_prices', 'private_amounts',
    'templates', 'inspection_templates', 'inspection_results', 'condition_reports', 'job_messages'
  ] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;
