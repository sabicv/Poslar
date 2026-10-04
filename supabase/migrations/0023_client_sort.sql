-- =====================================================================
-- TaktiX · 0023 customers in alphabetical order
-- A stored sort key: surname then first name for a person, the company
-- name for a company, compared the Croatian way (Č after C, Š after S,
-- Ž after Z) where the database has the Croatian collation.
-- =====================================================================

do $$
declare
  v_collate text := case when exists (select 1 from pg_collation where collname = 'hr-x-icu') then ' collate "hr-x-icu"' else '' end;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clients' and column_name = 'sort_name') then
    execute 'alter table public.clients add column sort_name text' || v_collate || $sql$
      generated always as (
        lower(btrim(
          coalesce(
            case when kind = 'company' then nullif(btrim(company_name), '') end,
            nullif(btrim(last_name), ''),
            nullif(btrim(company_name), ''),
            ''
          ) || ' ' || coalesce(case when kind = 'company' then '' else first_name end, '')
        ))
      ) stored
    $sql$;
  end if;
end
$$;

create index if not exists idx_clients_sort on public.clients (tenant_id, sort_name);
