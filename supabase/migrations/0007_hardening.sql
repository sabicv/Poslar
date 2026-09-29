-- =====================================================================
-- X-Files · 0007 hardening (findings of the independent review, 2026-09-29)
--
-- Every rule here holds for a direct Supabase API call, not only for the
-- app's Server Actions:
--   1. money and locking on jobs: owner only, on INSERT as well as UPDATE
--   2. job numbers are always assigned by the database
--   3. internal messages: staff may change only the status
--   4. job history: the author is always the caller; payment and lock
--      events only from the owner
--   5. customer decision on an approval link: one atomic, all-or-nothing
--      database function
--   6. self-registration attempts (rate limit), service role only
-- =====================================================================

-- 1. Money and locking ---------------------------------------------------
create or replace function public.enforce_job_owner_fields()
returns trigger
language plpgsql
as $$
begin
  -- Service role (seed, registration, customer approval) has no auth.uid().
  if auth.uid() is null or public.is_owner() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.payment_status <> 'unpaid' or new.paid_at is not null then
      raise exception 'Samo voditelj servisa mijenja naplatu.' using errcode = '42501';
    end if;
    if new.locked_at is not null then
      raise exception 'Samo voditelj servisa zaključava nalog.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.payment_status is distinct from old.payment_status or new.paid_at is distinct from old.paid_at then
    raise exception 'Samo voditelj servisa mijenja naplatu.' using errcode = '42501';
  end if;
  if new.locked_at is distinct from old.locked_at then
    raise exception 'Samo voditelj servisa zaključava i otključava nalog.' using errcode = '42501';
  end if;
  return new;
end
$$;

drop trigger if exists trg_jobs_owner_fields on public.jobs;
create trigger trg_jobs_owner_fields before insert or update on public.jobs
  for each row execute function public.enforce_job_owner_fields();

-- 2. Job numbers -----------------------------------------------------------
-- A signed-in user can never choose the number; only trusted server code
-- (imports) may pass one.
create or replace function public.set_job_number()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null or new.number is null or new.number <= 0 then
    perform pg_advisory_xact_lock(hashtext('job_number:' || new.tenant_id::text));
    select coalesce(max(number), 0) + 1 into new.number from public.jobs where tenant_id = new.tenant_id;
  end if;
  return new;
end
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_number_positive') then
    alter table public.jobs add constraint jobs_number_positive check (number > 0);
  end if;
end
$$;

-- 3. Internal messages: only the status can change -------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke update on public.job_messages from authenticated';
    execute 'grant update (status) on public.job_messages to authenticated';
  end if;
end
$$;

drop policy if exists job_messages_update on public.job_messages;
create policy job_messages_update on public.job_messages for update to authenticated
  using (
    tenant_id = public.auth_tenant_id()
    and (receiver_id = auth.uid() or sender_id = auth.uid() or public.is_owner())
  )
  with check (
    tenant_id = public.auth_tenant_id()
    and (receiver_id = auth.uid() or sender_id = auth.uid() or public.is_owner())
  );

-- 4. Job history: honest authorship -----------------------------------------
drop policy if exists job_events_insert on public.job_events;
create policy job_events_insert on public.job_events for insert to authenticated
  with check (
    tenant_id = public.auth_tenant_id()
    and actor_id = auth.uid()
    and (public.is_owner() or event_type not in ('payment', 'lock', 'approval'))
  );

-- 5. Customer decision on an approval link ----------------------------------
-- Locks the approval row, checks status/expiry/lock, requires a decision
-- for every proposed line exactly once, and writes everything or nothing.
create or replace function public.decide_approval(
  p_token      uuid,
  p_signer     text,
  p_decisions  jsonb,
  p_ip         text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approval  public.approvals%rowtype;
  v_locked    timestamptz;
  v_expected  uuid[];
  v_given     uuid[];
  v_approved  int;
  v_total     int;
  v_signer    text := btrim(coalesce(p_signer, ''));
begin
  select * into v_approval from public.approvals where token = p_token for update;
  if not found then
    raise exception 'approval_not_found';
  end if;
  if v_approval.status = 'decided' then
    raise exception 'approval_already_decided';
  end if;
  if v_approval.status = 'expired' or v_approval.expires_at < now() then
    raise exception 'approval_expired';
  end if;
  select locked_at into v_locked from public.jobs where id = v_approval.job_id for update;
  if v_locked is not null then
    raise exception 'approval_job_locked';
  end if;
  if length(v_signer) < 2 or length(v_signer) > 120 then
    raise exception 'approval_signer';
  end if;
  if jsonb_typeof(p_decisions) is distinct from 'array'
     or exists (
       select 1 from jsonb_array_elements(p_decisions) d
       where jsonb_typeof(d) <> 'object'
          or coalesce(d ->> 'decision', '') not in ('approved', 'declined')
          or coalesce(d ->> 'lineId', '') !~* '^[0-9a-f-]{36}$'
     ) then
    raise exception 'approval_invalid';
  end if;

  select coalesce(array_agg(id order by id), '{}') into v_expected
  from public.job_lines where job_id = v_approval.job_id and approval = 'proposed';
  if cardinality(v_expected) = 0 then
    raise exception 'approval_nothing_proposed';
  end if;
  select coalesce(array_agg((d ->> 'lineId')::uuid order by (d ->> 'lineId')::uuid), '{}') into v_given
  from jsonb_array_elements(p_decisions) d;
  if v_given <> v_expected then
    raise exception 'approval_incomplete';
  end if;

  update public.job_lines l
     set approval = (d ->> 'decision')::public.line_approval
    from jsonb_array_elements(p_decisions) d
   where l.id = (d ->> 'lineId')::uuid and l.job_id = v_approval.job_id;

  select count(*) filter (where d ->> 'decision' = 'approved'), count(*)
    into v_approved, v_total
    from jsonb_array_elements(p_decisions) d;

  update public.approvals
     set status = 'decided', decided_at = now(), decisions = p_decisions, signer_name = v_signer,
         ip = left(p_ip, 64), user_agent = left(p_user_agent, 300)
   where id = v_approval.id;

  insert into public.job_events (tenant_id, job_id, event_type, message, metadata)
  values (v_approval.tenant_id, v_approval.job_id, 'approval',
          format('%s odobrio/la %s od %s stavki', v_signer, v_approved, v_total),
          jsonb_build_object('decisions', p_decisions));

  if v_approved > 0 then
    update public.jobs set phase = 'in_progress' where id = v_approval.job_id and phase = 'awaiting_approval';
  end if;

  return jsonb_build_object('approved', v_approved, 'total', v_total);
end
$$;

revoke all on function public.decide_approval(uuid, text, jsonb, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.decide_approval(uuid, text, jsonb, text, text) from anon, authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.decide_approval(uuid, text, jsonb, text, text) to service_role';
  end if;
end
$$;

-- 6. Self-registration attempts (rate limit) --------------------------------
-- Hashed IP only (no raw address stored); read and written by the server.
create table if not exists public.registration_attempts (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_registration_attempts on public.registration_attempts (ip_hash, created_at);
alter table public.registration_attempts enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.registration_attempts from anon, authenticated';
  end if;
end
$$;
