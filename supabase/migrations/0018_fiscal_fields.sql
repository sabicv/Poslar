-- =====================================================================
-- TaktiX · 0018 what a Croatian invoice carries for fiscalization
--   · payment method (cash, card, bank transfer, other)
--   · business premises and billing device marks, so the number reads
--     12/PP1/1 and runs in order per premises and device
--   · the operator (who issued it)
-- Set when the invoice is issued, never changed afterwards. A workshop
-- that has not set its premises and device keeps numbering as before
-- (12/2026). Sending to the Tax Administration comes with the provider.
-- =====================================================================

alter table public.jobs add column if not exists invoice_payment_method text;
alter table public.jobs add column if not exists invoice_premises text;
alter table public.jobs add column if not exists invoice_device text;
alter table public.jobs add column if not exists invoice_operator text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_invoice_payment_method_check') then
    alter table public.jobs add constraint jobs_invoice_payment_method_check
      check (invoice_payment_method is null or invoice_payment_method in ('cash', 'card', 'transfer', 'other'));
  end if;
end
$$;

-- One sequence per year, premises and device.
drop index if exists public.uq_jobs_invoice_no;
create unique index if not exists uq_jobs_invoice_no_v2
  on public.jobs (tenant_id, invoice_year, coalesce(invoice_premises, ''), coalesce(invoice_device, ''), invoice_number)
  where invoice_number is not null;

-- Workers still can't touch any of it.
create or replace function public.protect_invoice_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_owner() and (
       new.invoice_number is distinct from old.invoice_number
    or new.invoice_year is distinct from old.invoice_year
    or new.invoice_issued_at is distinct from old.invoice_issued_at
    or new.invoice_fiscal_ref is distinct from old.invoice_fiscal_ref
    or new.invoice_token is distinct from old.invoice_token
    or new.invoice_payment_method is distinct from old.invoice_payment_method
    or new.invoice_premises is distinct from old.invoice_premises
    or new.invoice_device is distinct from old.invoice_device
    or new.invoice_operator is distinct from old.invoice_operator
  ) then
    raise exception 'Samo voditelj izdaje račun.';
  end if;
  return new;
end
$$;

-- Issue: the next number for this year, premises and device; the payment
-- method and the operator's name go on with it.
drop function if exists public.issue_invoice(uuid);
create or replace function public.issue_invoice(p_job_id uuid, p_method text default 'transfer')
returns table (o_number int, o_year int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant   uuid;
  v_number   int;
  v_year     int;
  v_next     int;
  v_premises text;
  v_device   text;
  v_operator text;
begin
  if not public.is_owner() then
    raise exception 'Samo voditelj izdaje račun.';
  end if;
  if p_method is null or p_method not in ('cash', 'card', 'transfer', 'other') then
    raise exception 'invoice_payment_method';
  end if;
  select j.tenant_id, j.invoice_number, j.invoice_year into v_tenant, v_number, v_year
    from public.jobs j
   where j.id = p_job_id and j.tenant_id = public.auth_tenant_id()
     for update;
  if not found then
    raise exception 'job_not_found';
  end if;
  if v_number is not null then
    return query select v_number, v_year;
    return;
  end if;
  select nullif(btrim(t.settings -> 'fiscal' ->> 'premises'), ''), nullif(btrim(t.settings -> 'fiscal' ->> 'device'), '')
    into v_premises, v_device
    from public.tenants t where t.id = v_tenant for update;
  select coalesce(nullif(btrim(p.full_name), ''), 'Voditelj') into v_operator from public.profiles p where p.id = auth.uid();
  v_year := extract(year from (now() at time zone 'Europe/Zagreb'))::int;
  select coalesce(max(j.invoice_number), 0) + 1 into v_next
    from public.jobs j
   where j.tenant_id = v_tenant and j.invoice_year = v_year
     and coalesce(j.invoice_premises, '') = coalesce(v_premises, '')
     and coalesce(j.invoice_device, '') = coalesce(v_device, '');
  update public.jobs
     set invoice_number = v_next, invoice_year = v_year, invoice_issued_at = now(),
         invoice_payment_method = p_method, invoice_premises = v_premises, invoice_device = v_device,
         invoice_operator = v_operator
   where id = p_job_id;
  return query select v_next, v_year;
end
$$;

revoke all on function public.issue_invoice(uuid, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.issue_invoice(uuid, text) from anon';
    execute 'grant execute on function public.issue_invoice(uuid, text) to authenticated';
  end if;
end $$;
