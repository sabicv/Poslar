-- =====================================================================
-- Poslar · 0033 Zajednički Poslar broj
-- One Poslar number for every workshop: the owner forwards unanswered
-- calls from their mobile to it, and the call is matched to the workshop
-- by the number that forwarded it (never by who is calling: GDPR).
-- Digits only, international ("385912345678"). Set by the server after a
-- check that no other workshop has it.
-- =====================================================================

alter table public.tenants add column if not exists phone_forward_from text;
create unique index if not exists uq_tenants_phone_forward_from on public.tenants (phone_forward_from) where phone_forward_from is not null;
