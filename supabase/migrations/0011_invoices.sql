-- 0011 · Račun iz naloga
--
-- A job becomes an invoice document in one tap: a number per workshop and
-- year (1/2026, 2/2026…), a private link for the customer, and a place for
-- the number of the fiscal receipt issued in the workshop's own till.
-- Only the owner issues or changes any of it.

alter table public.jobs add column if not exists invoice_number int;
alter table public.jobs add column if not exists invoice_year int;
alter table public.jobs add column if not exists invoice_issued_at timestamptz;
alter table public.jobs add column if not exists invoice_fiscal_ref text;
alter table public.jobs add column if not exists invoice_token uuid default gen_random_uuid();
update public.jobs set invoice_token = gen_random_uuid() where invoice_token is null;
alter table public.jobs alter column invoice_token set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_invoice_fiscal_ref_len') then
    alter table public.jobs add constraint jobs_invoice_fiscal_ref_len check (invoice_fiscal_ref is null or length(invoice_fiscal_ref) <= 80);
  end if;
end $$;

create unique index if not exists uq_jobs_invoice_token on public.jobs (invoice_token);
create unique index if not exists uq_jobs_invoice_no on public.jobs (tenant_id, invoice_year, invoice_number) where invoice_number is not null;

comment on column public.jobs.invoice_number is 'Invoice number within invoice_year, per workshop; assigned by issue_invoice().';
comment on column public.jobs.invoice_fiscal_ref is 'Number of the fiscal receipt issued in the workshop''s own till.';

-- Workers never issue, renumber or re-link an invoice, not even through the API.
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
  ) then
    raise exception 'Samo voditelj izdaje račun.';
  end if;
  return new;
end
$$;

drop trigger if exists trg_protect_invoice_fields on public.jobs;
create trigger trg_protect_invoice_fields
  before update on public.jobs
  for each row execute function public.protect_invoice_fields();

-- The next number for this workshop and year, assigned once and in order:
-- the workshop row is locked while the number is taken.
create or replace function public.issue_invoice(p_job_id uuid)
returns table (o_number int, o_year int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_number int;
  v_year   int;
  v_next   int;
begin
  if not public.is_owner() then
    raise exception 'Samo voditelj izdaje račun.';
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
  perform 1 from public.tenants t where t.id = v_tenant for update;
  v_year := extract(year from (now() at time zone 'Europe/Zagreb'))::int;
  select coalesce(max(j.invoice_number), 0) + 1 into v_next
    from public.jobs j
   where j.tenant_id = v_tenant and j.invoice_year = v_year;
  update public.jobs
     set invoice_number = v_next, invoice_year = v_year, invoice_issued_at = now()
   where id = p_job_id;
  return query select v_next, v_year;
end
$$;

revoke all on function public.issue_invoice(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.issue_invoice(uuid) to authenticated';
  end if;
end $$;
