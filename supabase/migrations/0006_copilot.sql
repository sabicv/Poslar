-- =====================================================================
-- X-Files · 0006 AI Kopilot
--
-- Every briefing, question and answer on a work order is kept: it is part
-- of the job's record (who asked what, what the assistant said), it lets a
-- briefing be reused while the job hasn't changed (fast, and no second
-- charge), and it is the usage log behind the daily limit and the Super
-- Admin cost overview. Append-only for staff; the owner may delete.
-- =====================================================================

create table if not exists public.copilot_messages (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  job_id         uuid not null,
  user_id        uuid references auth.users (id) on delete set null,
  role           text not null check (role in ('user', 'assistant')),
  kind           text not null check (kind in ('briefing', 'question', 'answer')),
  content        text not null check (length(content) between 1 and 20000),
  model          text,
  context_hash   text,
  input_tokens   int check (input_tokens is null or input_tokens >= 0),
  output_tokens  int check (output_tokens is null or output_tokens >= 0),
  created_at     timestamptz not null default now(),
  foreign key (job_id, tenant_id) references public.jobs (id, tenant_id) on delete cascade,
  check ((role = 'user') = (kind = 'question'))
);
comment on table public.copilot_messages is 'AI Kopilot history per work order: briefings, questions, answers, token usage.';
create index if not exists idx_copilot_messages_job on public.copilot_messages (job_id, created_at);
create index if not exists idx_copilot_messages_tenant on public.copilot_messages (tenant_id, created_at);

alter table public.copilot_messages enable row level security;

drop policy if exists copilot_select on public.copilot_messages;
create policy copilot_select on public.copilot_messages for select to authenticated
  using (tenant_id = public.auth_tenant_id());

drop policy if exists copilot_insert on public.copilot_messages;
create policy copilot_insert on public.copilot_messages for insert to authenticated
  with check (tenant_id = public.auth_tenant_id() and user_id = auth.uid());

drop policy if exists copilot_delete on public.copilot_messages;
create policy copilot_delete on public.copilot_messages for delete to authenticated
  using (tenant_id = public.auth_tenant_id() and public.is_owner());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.copilot_messages from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.copilot_messages from authenticated';
    execute 'grant select, insert, delete on public.copilot_messages to authenticated';
  end if;
end
$$;
