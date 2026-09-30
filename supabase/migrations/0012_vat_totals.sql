-- Job totals the way the invoice counts them: each line rounded to the
-- cent, VAT once per rate on the sum of its lines, and no VAT at all for a
-- workshop outside the VAT system (tenants.settings.vat_registered = false).
-- Before this, such a workshop saw 25 % VAT on every total in the app while
-- its invoice correctly had none.

create or replace view public.job_totals
with (security_invoker = true) as
with line_amounts as (
  select l.job_id, l.tenant_id, p.vat_rate,
         round(l.qty * p.unit_price * (1 - p.discount_pct / 100), 2) as amount
  from public.job_lines l
  join public.job_line_prices p on p.job_line_id = l.id
  where l.approval = 'approved'
), per_rate as (
  select job_id, tenant_id, vat_rate, sum(amount) as base
  from line_amounts
  group by job_id, tenant_id, vat_rate
)
select
  r.job_id,
  r.tenant_id,
  round(sum(r.base), 2) as net_total,
  round(sum(r.base) + case when coalesce((t.settings ->> 'vat_registered')::boolean, true)
                           then sum(round(r.base * r.vat_rate / 100, 2)) else 0 end, 2) as gross_total
from per_rate r
join public.tenants t on t.id = r.tenant_id
group by r.job_id, r.tenant_id, t.settings;
