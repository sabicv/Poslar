-- =====================================================================
-- Poslar · 0031 Automatske poruke preko WhatsApp Business (Meta Cloud API)
-- One shared Poslar number writes to customers on behalf of a workshop
-- (approved templates: appointment confirmed, reminder the day before,
-- job ready, body-shop stage). Every message in and out is kept here, so
-- a customer's reply or photo finds its way back to the workshop and the
-- job it answers. Written only by the server.
-- =====================================================================

create table if not exists public.whatsapp_messages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  job_id      uuid,
  phone       text not null,
  direction   text not null check (direction in ('out', 'in')),
  kind        text not null,
  body        text,
  wa_id       text unique,
  status      text,
  created_at  timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete set null (job_id)
);
create index if not exists idx_whatsapp_phone on public.whatsapp_messages (phone, created_at desc);
create index if not exists idx_whatsapp_job on public.whatsapp_messages (job_id) where job_id is not null;

alter table public.whatsapp_messages enable row level security;
drop policy if exists whatsapp_messages_owner on public.whatsapp_messages;
create policy whatsapp_messages_owner on public.whatsapp_messages for select to authenticated
  using (tenant_id = public.auth_tenant_id() and public.is_owner());
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke insert, update, delete on public.whatsapp_messages from authenticated';
    execute 'grant select on public.whatsapp_messages to authenticated';
  end if;
end
$$;

-- The day-before reminder goes once per appointment; a new time gets a new one.
alter table public.jobs add column if not exists reminder_sent_at timestamptz;

create or replace function public.reset_appointment_reminder()
returns trigger
language plpgsql
as $$
begin
  if new.scheduled_start is distinct from old.scheduled_start then
    new.reminder_sent_at := null;
  end if;
  return new;
end
$$;
drop trigger if exists trg_jobs_reset_reminder on public.jobs;
create trigger trg_jobs_reset_reminder before update of scheduled_start on public.jobs
  for each row execute function public.reset_appointment_reminder();
