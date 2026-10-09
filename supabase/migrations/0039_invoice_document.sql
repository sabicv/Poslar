-- =====================================================================
-- Poslar · 0039 invoice as a document
--   A job invoice has a life of its own: draft → issued → sent →
--   fiscalized, or rejected (same number, send again) or voided (storno;
--   the number stays used, no gap). Paddle's subscription events that
--   arrive out of order must not overwrite a newer one.
-- =====================================================================

alter table public.jobs add column if not exists invoice_status text;
alter table public.jobs add column if not exists invoice_sent_at timestamptz;
alter table public.jobs add column if not exists invoice_rejected_at timestamptz;
alter table public.jobs add column if not exists invoice_voided_at timestamptz;

update public.jobs
   set invoice_status = case
     when invoice_number is null then 'draft'
     when invoice_fiscal_ref is not null then 'fiscalized'
     else 'issued'
   end
 where invoice_status is null;

alter table public.jobs alter column invoice_status set default 'draft';
alter table public.jobs alter column invoice_status set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_invoice_status_check') then
    alter table public.jobs add constraint jobs_invoice_status_check
      check (invoice_status in ('draft', 'issued', 'sent', 'fiscalized', 'rejected', 'voided'));
  end if;
end
$$;

comment on column public.jobs.invoice_status is 'draft (no number), issued, sent, fiscalized, rejected (same number, may resend), voided (storno; number kept).';
comment on column public.jobs.invoice_sent_at is 'When the owner sent the customer the invoice link (WhatsApp or copy).';
comment on column public.jobs.invoice_voided_at is 'Storno: the number stays used so the sequence has no gap.';

alter table public.tenants add column if not exists paddle_event_at timestamptz;
comment on column public.tenants.paddle_event_at is 'occurred_at of the last applied Paddle subscription.* event; older events are ignored.';

-- Workers still cannot touch any invoice field.
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
  ) then
    raise exception 'Samo voditelj izdaje račun.';
  end if;
  return new;
end
$$;

-- Issue: next number for this year, premises and device. A voided
-- invoice keeps its number; it is not issued again.
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
  select coalesce(max(j.invoice_number), 0) + 1 into v_next
    from public.jobs j
   where j.tenant_id = v_tenant and j.invoice_year = v_year
     and coalesce(j.invoice_premises, '') = coalesce(v_premises, '')
     and coalesce(j.invoice_device, '') = coalesce(v_device, '');
  update public.jobs
     set invoice_number = v_next, invoice_year = v_year, invoice_issued_at = now(),
         invoice_payment_method = p_method, invoice_premises = v_premises, invoice_device = v_device,
         invoice_operator = v_operator, invoice_status = 'issued'
   where id = p_job_id;
  return query select v_next, v_year;
end
$$;
