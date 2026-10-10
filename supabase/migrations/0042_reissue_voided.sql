-- A voided invoice keeps its number (no gap in the yearly sequence).
-- The same job can then take the next number, after the old one is
-- stored on the job so the sequence still sees it.

alter table public.jobs add column if not exists invoice_void_log jsonb not null default '[]'::jsonb;
comment on column public.jobs.invoice_void_log is 'Numbers already used by a storno on this job: [{number, year, premises, device, voided_at}].';

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
    or new.invoice_status is distinct from old.invoice_status
    or new.invoice_sent_at is distinct from old.invoice_sent_at
    or new.invoice_rejected_at is distinct from old.invoice_rejected_at
    or new.invoice_voided_at is distinct from old.invoice_voided_at
    or new.invoice_void_log is distinct from old.invoice_void_log
  ) then
    raise exception 'Samo voditelj izdaje račun.';
  end if;
  return new;
end
$$;

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
  v_status   text;
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
  select j.tenant_id, j.invoice_number, j.invoice_year, j.invoice_status
    into v_tenant, v_number, v_year, v_status
    from public.jobs j
   where j.id = p_job_id and j.tenant_id = public.auth_tenant_id()
     for update;
  if not found then
    raise exception 'job_not_found';
  end if;
  if v_status = 'voided' then
    raise exception 'invoice_voided';
  end if;
  if v_number is not null then
    return query select v_number, v_year;
    return;
  end if;
  select
    nullif(btrim(t.settings -> 'fiscal' ->> 'premises'), ''),
    nullif(btrim(t.settings -> 'fiscal' ->> 'device'), ''),
    nullif(btrim(t.settings -> 'fiscal' ->> 'operator'), '')
    into v_premises, v_device, v_operator
    from public.tenants t where t.id = v_tenant for update;
  if v_operator is null then
    select coalesce(nullif(btrim(p.full_name), ''), 'Voditelj') into v_operator from public.profiles p where p.id = auth.uid();
  end if;
  v_year := extract(year from (now() at time zone 'Europe/Zagreb'))::int;
  select coalesce(max(n), 0) + 1 into v_next
    from (
      select j.invoice_number as n
        from public.jobs j
       where j.tenant_id = v_tenant and j.invoice_year = v_year
         and coalesce(j.invoice_premises, '') = coalesce(v_premises, '')
         and coalesce(j.invoice_device, '') = coalesce(v_device, '')
         and j.invoice_number is not null
      union all
      select (elem->>'number')::int
        from public.jobs j
        cross join lateral jsonb_array_elements(j.invoice_void_log) elem
       where j.tenant_id = v_tenant
         and (elem->>'year')::int = v_year
         and coalesce(elem->>'premises', '') = coalesce(v_premises, '')
         and coalesce(elem->>'device', '') = coalesce(v_device, '')
    ) used;
  update public.jobs
     set invoice_number = v_next, invoice_year = v_year, invoice_issued_at = now(),
         invoice_payment_method = p_method, invoice_premises = v_premises, invoice_device = v_device,
         invoice_operator = v_operator, invoice_status = 'issued'
   where id = p_job_id;
  return query select v_next, v_year;
end
$$;

-- Park the voided number, then the job is a draft again. Lines stay, so
-- they can be adjusted before the next number is issued.
create or replace function public.reopen_voided_invoice(p_job_id uuid)
returns table (o_number int, o_year int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number   int;
  v_year     int;
  v_status   text;
  v_premises text;
  v_device   text;
  v_voided   timestamptz;
begin
  if not public.is_owner() then
    raise exception 'Samo voditelj izdaje račun.';
  end if;
  select j.invoice_number, j.invoice_year, j.invoice_status, j.invoice_premises, j.invoice_device, j.invoice_voided_at
    into v_number, v_year, v_status, v_premises, v_device, v_voided
    from public.jobs j
   where j.id = p_job_id and j.tenant_id = public.auth_tenant_id()
     for update;
  if not found then
    raise exception 'job_not_found';
  end if;
  if v_status <> 'voided' or v_number is null then
    raise exception 'invoice_not_voided';
  end if;
  update public.jobs
     set invoice_void_log = invoice_void_log || jsonb_build_array(jsonb_build_object(
           'number', v_number,
           'year', v_year,
           'premises', v_premises,
           'device', v_device,
           'voided_at', coalesce(v_voided, now())
         )),
         invoice_number = null,
         invoice_year = null,
         invoice_issued_at = null,
         invoice_fiscal_ref = null,
         invoice_sent_at = null,
         invoice_rejected_at = null,
         invoice_voided_at = null,
         invoice_status = 'draft',
         invoice_token = gen_random_uuid()
   where id = p_job_id;
  return query select v_number, v_year;
end
$$;

grant execute on function public.reopen_voided_invoice(uuid) to authenticated;
