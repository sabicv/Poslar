-- =====================================================================
-- Poslar · 0034 Tjedna sigurnosna kopija i mjerač prostora (Toranj)
-- Once a week every table goes, as JSON, into one ZIP in the private
-- "backups" bucket (the last eight are kept); the tower lists them for
-- download, so a copy can also live off Supabase. The tower also sees how
-- much room the database and the files take. Service role only.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backups', 'backups', false, 524288000, array['application/zip'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The tables to copy (ephemeral limit counters left out).
create or replace function public.backup_tables()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select table_name::text
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
    and table_name not in ('intake_attempts', 'registration_attempts')
  order by table_name
$$;

-- One page of one table, as a JSON array.
create or replace function public.backup_table(p_table text, p_offset int default 0, p_limit int default 5000)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not exists (select 1 from public.backup_tables() t where t = p_table) then
    raise exception 'backup: unknown table %', p_table;
  end if;
  execute format('select coalesce(jsonb_agg(r), ''[]''::jsonb) from (select * from public.%I order by ctid offset %s limit %s) r', p_table, greatest(p_offset, 0), least(greatest(p_limit, 1), 20000))
    into v;
  return v;
end
$$;

-- Room taken: the database, and the files per bucket.
create or replace function public.platform_storage()
returns table (bucket text, files bigint, bytes bigint)
language plpgsql
stable
security definer
set search_path = public, storage
as $$
begin
  return query select 'database'::text, 0::bigint, pg_database_size(current_database())::bigint;
  return query execute 'select bucket_id::text, count(*)::bigint, coalesce(sum((metadata->>''size'')::bigint), 0)::bigint from storage.objects group by bucket_id';
end
$$;

do $$
begin
  revoke all on function public.backup_tables() from public;
  revoke all on function public.backup_table(text, int, int) from public;
  revoke all on function public.platform_storage() from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.backup_tables() from anon, authenticated';
    execute 'revoke all on function public.backup_table(text, int, int) from anon, authenticated';
    execute 'revoke all on function public.platform_storage() from anon, authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.backup_tables() to service_role';
    execute 'grant execute on function public.backup_table(text, int, int) to service_role';
    execute 'grant execute on function public.platform_storage() to service_role';
  end if;
end
$$;
