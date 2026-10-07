-- =====================================================================
-- Poslar · 0028 founder price
-- The first 50 workshops pay the founder price for 24 months
-- (config/plans.ts). The server sets founder_until at sign-up, the tower
-- can change it; the owner can't (it is not among the tenant columns
-- granted to authenticated users in 0005).
-- =====================================================================

alter table public.tenants add column if not exists founder_until date;

-- Workshops already working on Poslar get it too; demo workshops, the
-- trade samples and visitors' open demos don't.
update public.tenants
   set founder_until = (current_date + interval '24 months')::date
 where founder_until is null
   and slug not like 'demo-%'
   and slug not like 'uzorak-%'
   and coalesce((settings ->> 'guest')::boolean, false) = false
   and coalesce((settings ->> 'demo')::boolean, false) = false;
