-- =====================================================================
-- TaktiX · 0024 AI phone agent
-- The owner's mobile forwards calls it does not take (no answer, busy,
-- declined) to the workshop's AI number at Vapi. The agent knows the
-- caller, offers free slots from the calendar and books one as a job in
-- Prijem; the owner confirms it to the customer.
--   · tenants: the Vapi phone number (its id at Vapi and the number to
--     forward to), set by the tower only
--   · phone_calls: one row per call, written by the server; the owner
--     reads them (summary, transcript, the job it made)
-- =====================================================================

alter table public.tenants add column if not exists phone_agent_number_id text;
alter table public.tenants add column if not exists phone_agent_number text;
create unique index if not exists uq_tenants_phone_agent on public.tenants (phone_agent_number_id) where phone_agent_number_id is not null;

create table if not exists public.phone_calls (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  provider_call_id  text not null unique,
  caller            text,
  started_at        timestamptz,
  ended_at          timestamptz,
  duration_s        int,
  ended_reason      text,
  summary           text,
  transcript        text,
  recording_url     text,
  job_id            uuid,
  cost              numeric(10, 4),
  created_at        timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete set null (job_id)
);
create index if not exists idx_phone_calls_tenant on public.phone_calls (tenant_id, created_at desc);
create index if not exists idx_phone_calls_job on public.phone_calls (job_id);

alter table public.phone_calls enable row level security;
drop policy if exists phone_calls_owner_read on public.phone_calls;
create policy phone_calls_owner_read on public.phone_calls for select to authenticated
  using (tenant_id = public.auth_tenant_id() and public.is_owner());

revoke all on public.phone_calls from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.phone_calls from anon, authenticated';
    execute 'grant select on public.phone_calls to authenticated';
  end if;
end $$;
