-- =====================================================================
-- TaktiX · 0021 help videos
-- Short how-to videos, one per topic the app knows (config/help.ts).
-- Vedran pastes a link in the tower; the app shows a "Video" button in
-- Pomoć and next to that screen. Read and written by the server only.
-- =====================================================================

create table if not exists public.help_videos (
  topic      text primary key check (topic ~ '^[a-z_]{2,40}$'),
  url        text not null check (url ~ '^https://' and length(url) <= 500),
  updated_at timestamptz not null default now()
);

alter table public.help_videos enable row level security;
-- No policies: workshops never touch the table; the server reads it.
revoke all on public.help_videos from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.help_videos from anon, authenticated';
  end if;
end $$;
