-- =====================================================================
-- TaktiX · 0017 QR self-intake
--   · tenants.intake_token: the secret part of the door QR code's address
--     (/q/<token>); a new one makes old posters stop working
--   · tenants.intake_enabled: the owner switches self-intake on and off
--   · intake_attempts: hashed sender address per submission, for limits
--     against fake or repeated submissions (server only)
-- =====================================================================

alter table public.tenants add column if not exists intake_token uuid default gen_random_uuid();
update public.tenants set intake_token = gen_random_uuid() where intake_token is null;
alter table public.tenants alter column intake_token set not null;
create unique index if not exists uq_tenants_intake_token on public.tenants (intake_token);
alter table public.tenants add column if not exists intake_enabled boolean not null default true;

create table if not exists public.intake_attempts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  ip_hash     text not null,
  kind        text not null default 'submit' check (kind in ('submit', 'scan')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_intake_attempts_lookup on public.intake_attempts (tenant_id, ip_hash, created_at desc);
alter table public.intake_attempts enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.intake_attempts from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.intake_attempts from authenticated';
    -- The owner switches it on and off; the token changes only through the server.
    execute 'grant update (intake_enabled) on public.tenants to authenticated';
  end if;
end
$$;
