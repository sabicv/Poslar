-- =====================================================================
-- Poslar · 0032 Plaćanje karticom (Paddle, Merchant of Record)
-- A workshop can pay its subscription by card: Paddle runs the checkout,
-- the VAT and the invoice, and tells us by webhook. The workshop's Paddle
-- customer and subscription are kept here; a card payment is a row in
-- subscription_payments like a bank transfer, once per Paddle transaction.
-- Server only (not in the owner's column grant).
-- =====================================================================

alter table public.tenants add column if not exists paddle_customer_id text;
alter table public.tenants add column if not exists paddle_subscription_id text;
alter table public.tenants add column if not exists paddle_status text;
create unique index if not exists uq_tenants_paddle_subscription on public.tenants (paddle_subscription_id) where paddle_subscription_id is not null;

alter table public.subscription_payments add column if not exists provider text not null default 'manual';
alter table public.subscription_payments add column if not exists provider_ref text;
create unique index if not exists uq_subscription_payments_ref on public.subscription_payments (provider, provider_ref) where provider_ref is not null;
