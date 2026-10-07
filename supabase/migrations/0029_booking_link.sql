-- =====================================================================
-- Poslar · 0029 "Rezerviraj termin"
-- A workshop's public booking page (/termin/<intake_token>): the customer
-- picks a free slot and the job lands in Prijem (source 'booking'). The
-- owner switches it on and off; limits against fake bookings reuse
-- intake_attempts (kind 'booking').
-- =====================================================================

alter table public.tenants add column if not exists booking_enabled boolean not null default true;

alter table public.jobs drop constraint if exists jobs_source_check;
alter table public.jobs add constraint jobs_source_check check (source in ('workshop', 'qr', 'phone', 'fleet_request', 'field', 'booking'));

alter table public.intake_attempts drop constraint if exists intake_attempts_kind_check;
alter table public.intake_attempts add constraint intake_attempts_kind_check check (kind in ('submit', 'scan', 'booking'));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant update (booking_enabled) on public.tenants to authenticated';
  end if;
end
$$;
