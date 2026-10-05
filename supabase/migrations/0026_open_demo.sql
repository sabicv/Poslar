-- Open demo (Vedran, 2026-10-05): a visitor taps "Isprobaj demo verziju"
-- and gets a demo workshop of their own, full of examples, with no e-mail
-- or password. The server makes a throwaway login for it (app_metadata
-- guest) and deletes the workshop a while after its 24 hours.
--
-- Those taps are limited per IP like sign-ups, but counted apart, so a
-- visitor who tried a few demos can still register.
alter table public.registration_attempts add column if not exists kind text not null default 'register';
create index if not exists idx_registration_attempts_kind on public.registration_attempts (kind, ip_hash, created_at);
