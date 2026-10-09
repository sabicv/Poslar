-- =====================================================================
-- Poslar · 0038 KPD codes on line items (prep for F1 fiscalisation)
--   The actual F1 send waits on an intermediary. The code on the line
--   is what the till / intermediary will need.
-- =====================================================================
alter table public.job_lines
  add column if not exists kpd_code text
  check (kpd_code is null or kpd_code ~ '^[0-9]{6}$');
comment on column public.job_lines.kpd_code is 'KPD (NKD) 6-digit product code for the fiscal invoice line. Null until the owner fills it or a template default applies.';

-- Prefer the name stored in settings.fiscal.operator (the till's operator)
-- over the owner's profile, so the printed invoice matches the fiscal till.
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
