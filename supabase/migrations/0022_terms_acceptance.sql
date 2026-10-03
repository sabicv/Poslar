-- =====================================================================
-- TaktiX · 0022 terms acceptance
-- When a workshop's owner accepted the terms of use and the data
-- processing agreement at registration, and which version (the date it
-- took effect). Written by the server only; not in the owner's grant.
-- =====================================================================

alter table public.tenants add column if not exists terms_accepted_at timestamptz;
alter table public.tenants add column if not exists terms_version text;
