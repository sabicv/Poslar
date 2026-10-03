-- =====================================================================
-- TaktiX · 0015 Toranj (the operator's tower)
--   · tenants: plan (Basic, Standard, Premium), term (monthly or 24
--     months), paid until, internal notes, AI quota override. None of
--     these is in the owner's column grant, so a workshop can't touch them.
--   · subscription_payments: what a workshop paid and for how long
--   · support_tickets / support_messages: "Javi problem" and the replies
--   · app_errors: errors from browsers and the server, grouped
--   · ai_usage: every photo read and Kopilot answer, for quotas and cost
-- Payments, errors and AI usage are read and written only by the server
-- (service role); no policy lets a signed-in user near them.
-- =====================================================================

alter table public.tenants add column if not exists plan text not null default 'basic';
alter table public.tenants add column if not exists billing_term text not null default 'monthly';
alter table public.tenants add column if not exists paid_until date;
alter table public.tenants add column if not exists admin_notes text;
alter table public.tenants add column if not exists ai_quota jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_plan_check') then
    alter table public.tenants add constraint tenants_plan_check check (plan in ('basic', 'standard', 'premium'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_billing_term_check') then
    alter table public.tenants add constraint tenants_billing_term_check check (billing_term in ('monthly', '24m'));
  end if;
end
$$;
comment on column public.tenants.ai_quota is 'Per-workshop override of the plan''s monthly AI quota, e.g. {"scan": 500, "copilot": 300}. Null = plan default (config/plans.ts).';

-- Payments ---------------------------------------------------------------
create table if not exists public.subscription_payments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  amount      numeric(10, 2) not null check (amount >= 0),
  months      int not null check (months between 1 and 36),
  paid_on     date not null default current_date,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_subscription_payments_tenant on public.subscription_payments (tenant_id, paid_on desc);

-- Support ----------------------------------------------------------------
create table if not exists public.support_tickets (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  user_id          uuid references auth.users (id) on delete set null,
  status           text not null default 'open' check (status in ('open', 'answered', 'closed')),
  page_url         text,
  user_agent       text,
  tenant_unread    boolean not null default false,
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists idx_support_tickets_tenant on public.support_tickets (tenant_id, last_message_at desc);
create index if not exists idx_support_tickets_status on public.support_tickets (status, last_message_at desc);

create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  author_id   uuid references auth.users (id) on delete set null,
  from_admin  boolean not null default false,
  body        text not null check (length(btrim(body)) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index if not exists idx_support_messages_ticket on public.support_messages (ticket_id, created_at);

-- Errors -----------------------------------------------------------------
create table if not exists public.app_errors (
  id              uuid primary key default gen_random_uuid(),
  fingerprint     text not null unique,
  source          text not null check (source in ('client', 'server', 'action')),
  message         text not null,
  stack           text,
  url             text,
  digest          text,
  user_agent      text,
  count           int not null default 1,
  first_seen      timestamptz not null default now(),
  last_seen       timestamptz not null default now(),
  last_tenant_id  uuid references public.tenants (id) on delete set null,
  last_user_id    uuid references auth.users (id) on delete set null,
  status          text not null default 'open' check (status in ('open', 'resolved')),
  resolved_at     timestamptz
);
create index if not exists idx_app_errors_status on public.app_errors (status, last_seen desc);

-- One row per kind of error: the same error again raises the count, and a
-- resolved error that comes back is reopened.
create or replace function public.log_app_error(
  p_fingerprint text, p_source text, p_message text, p_stack text, p_url text,
  p_digest text, p_user_agent text, p_tenant uuid, p_user uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_errors (fingerprint, source, message, stack, url, digest, user_agent, last_tenant_id, last_user_id)
  values (p_fingerprint, p_source, left(p_message, 1000), left(p_stack, 8000), left(p_url, 500), left(p_digest, 100), left(p_user_agent, 300), p_tenant, p_user)
  on conflict (fingerprint) do update set
    count = public.app_errors.count + 1,
    last_seen = now(),
    url = excluded.url,
    digest = coalesce(excluded.digest, public.app_errors.digest),
    user_agent = excluded.user_agent,
    last_tenant_id = coalesce(excluded.last_tenant_id, public.app_errors.last_tenant_id),
    last_user_id = coalesce(excluded.last_user_id, public.app_errors.last_user_id),
    status = 'open',
    resolved_at = null;
end
$$;
revoke all on function public.log_app_error(text, text, text, text, text, text, text, uuid, uuid) from public;
do $$
begin
  -- Supabase grants new functions to anon and authenticated by default.
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.log_app_error(text, text, text, text, text, text, text, uuid, uuid) from anon, authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.log_app_error(text, text, text, text, text, text, text, uuid, uuid) to service_role';
  end if;
end
$$;

-- AI usage ---------------------------------------------------------------
create table if not exists public.ai_usage (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  user_id        uuid references auth.users (id) on delete set null,
  kind           text not null check (kind in ('scan', 'copilot')),
  model          text,
  input_tokens   int not null default 0,
  output_tokens  int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists idx_ai_usage_tenant_month on public.ai_usage (tenant_id, kind, created_at desc);

-- Row Level Security ------------------------------------------------------
alter table public.subscription_payments enable row level security;
alter table public.app_errors enable row level security;
alter table public.ai_usage enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- A ticket is seen by the person who wrote it and by the owner.
drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets for select to authenticated
  using (tenant_id = public.auth_tenant_id() and (user_id = auth.uid() or public.is_owner()));
drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages for select to authenticated
  using (
    tenant_id = public.auth_tenant_id()
    and exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.is_owner()))
  );

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.subscription_payments, public.app_errors, public.ai_usage, public.support_tickets, public.support_messages from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    -- Writing goes through the server; the app only reads its own tickets.
    execute 'revoke all on public.subscription_payments, public.app_errors, public.ai_usage, public.support_tickets, public.support_messages from authenticated';
    execute 'grant select on public.support_tickets, public.support_messages to authenticated';
  end if;
end
$$;
