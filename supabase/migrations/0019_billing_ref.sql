-- =====================================================================
-- TaktiX · 0019 a payment reference per workshop
-- The number a workshop writes as "poziv na broj" (model HR00) when it
-- pays its subscription, so a bank statement line points to the workshop.
-- Set once, never by the workshop itself (not in the owner's grant).
-- =====================================================================

create sequence if not exists public.tenant_billing_ref_seq start 1001;
alter table public.tenants add column if not exists billing_ref int;
update public.tenants set billing_ref = nextval('public.tenant_billing_ref_seq') where billing_ref is null;
alter table public.tenants alter column billing_ref set default nextval('public.tenant_billing_ref_seq');
alter table public.tenants alter column billing_ref set not null;
create unique index if not exists uq_tenants_billing_ref on public.tenants (billing_ref);
