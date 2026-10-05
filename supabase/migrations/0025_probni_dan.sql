-- =====================================================================
-- TaktiX · 0025 the 24-hour trial ("probni dan")
-- A new workshop opens as a copy of its trade's sample workshop (slug
-- uzorak-<package>, settings.sample = true), every date moved so the
-- sample's "today" is today. After 24 hours the owner either starts the
-- 30 free days (the samples go, whatever the owner entered stays) or
-- leaves a review and the workshop is deleted.
--
-- The copy finds the tables by itself (every table with a tenant_id), so
-- a new module is copied without touching this file. Ids are new, links
-- between copied rows follow them, the sample's people become the new
-- owner, tokens and QR codes are new, and file paths move to the new
-- workshop's folder (the server copies the files).
-- =====================================================================

alter table public.tenants add column if not exists sample_until timestamptz;
alter table public.tenants add column if not exists news_consent_at timestamptz;
comment on column public.tenants.sample_until is 'End of the 24-hour trial on sample data; null once the owner moves to real work (or for a workshop that never had samples). Server only.';
comment on column public.tenants.news_consent_at is 'When the owner asked for news about new features (registration); null = not asked. Server only.';

-- Which rows of a workshop came from the sample (removed when the owner
-- moves to real work). Server only: no policies.
create table if not exists public.sample_rows (
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  table_name  text not null,
  row_id      uuid not null,
  primary key (tenant_id, table_name, row_id)
);
alter table public.sample_rows enable row level security;

-- Old id → new id while copying. Server only: no policies.
create table if not exists public.sample_map (
  target  uuid not null,
  old     uuid not null,
  new     uuid not null,
  primary key (target, old)
);
alter table public.sample_map enable row level security;

-- What a workshop that left after the trial told us (the workshop itself
-- is deleted). Read in the tower. Server only: no policies.
create table if not exists public.trial_feedback (
  id            uuid primary key default gen_random_uuid(),
  workshop      text not null,
  owner_name    text,
  email         text,
  package       public.package_id,
  stars         int not null check (stars between 1 and 5),
  body          text check (body is null or length(body) <= 4000),
  may_publish   boolean not null default false,
  news_consent  boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table public.trial_feedback enable row level security;
create index if not exists idx_trial_feedback_created on public.trial_feedback (created_at desc);

-- The tables a sample workshop is copied from: every table with a
-- tenant_id except the people, the price list and own templates (the new
-- workshop has its own), and the platform's own records.
create or replace function public.sample_tables()
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
   where c.relkind = 'r'
     and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped)
     and c.relname not in (
       'profiles', 'price_lists', 'templates', 'template_prices', 'sample_rows',
       'registration_attempts', 'intake_attempts', 'subscription_payments',
       'support_tickets', 'support_messages', 'app_errors', 'ai_usage', 'help_videos'
     )
$$;

-- Those tables, parents before children. Two tables that point at each
-- other (a job and its maintenance plan) are broken where the link may be
-- empty: that link is filled in after both are copied.
create or replace function public.sample_order()
returns text[]
language plpgsql
stable
set search_path = public
as $$
declare
  v_all      text[] := public.sample_tables();
  v_done     text[] := '{}';
  v_progress boolean;
  t          text;
begin
  while cardinality(v_done) < cardinality(v_all) loop
    v_progress := false;
    foreach t in array v_all loop
      continue when t = any (v_done);
      if not exists (
        select 1
          from pg_constraint k
          join pg_class p on p.oid = k.confrelid
         where k.contype = 'f'
           and k.conrelid = format('public.%I', t)::regclass
           and k.confrelid <> k.conrelid
           and p.relname::text = any (v_all)
           and not (p.relname::text = any (v_done))
      ) then
        v_done := v_done || t;
        v_progress := true;
      end if;
    end loop;
    if not v_progress then
      -- Stuck on a cycle: take a table of the cycle whose missing parents
      -- are all optional links.
      with recursive edges as (
        select c.relname::text as child, p.relname::text as parent
          from pg_constraint k
          join pg_class c on c.oid = k.conrelid
          join pg_class p on p.oid = k.confrelid
         where k.contype = 'f' and k.conrelid <> k.confrelid
           and c.relname::text = any (v_all) and not (c.relname::text = any (v_done))
           and p.relname::text = any (v_all) and not (p.relname::text = any (v_done))
      ), reach (start, node) as (
        select child, parent from edges
        union
        select r.start, e.parent from reach r join edges e on e.child = r.node
      )
      select x into t
        from unnest(v_all) x
       where not (x = any (v_done))
         and exists (select 1 from reach r where r.start = x and r.node = x)
         and not exists (
           select 1
             from pg_constraint k
             join pg_class p on p.oid = k.confrelid
             join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
            where k.contype = 'f'
              and k.conrelid = format('public.%I', x)::regclass
              and k.confrelid <> k.conrelid
              and p.relname::text = any (v_all)
              and not (p.relname::text = any (v_done))
              and a.attname <> 'tenant_id'
              and a.attnotnull
         )
       order by x
       limit 1;
      if t is null then
        raise exception 'sample_order_cycle: %', array(select x from unnest(v_all) x where not (x = any (v_done)));
      end if;
      v_done := v_done || t;
    end if;
  end loop;
  return v_done;
end
$$;

-- The links copied empty because their target comes later in the order
-- (the cycle breaks above): table, column.
create or replace function public.sample_late_links(p_order text[])
returns table (table_name text, column_name text)
language sql
stable
set search_path = public
as $$
  select distinct c.relname::text, a.attname::text
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_class p on p.oid = k.confrelid
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
   where k.contype = 'f'
     and k.conrelid <> k.confrelid
     and c.relname::text = any (p_order)
     and p.relname::text = any (p_order)
     and array_position(p_order, p.relname::text) > array_position(p_order, c.relname::text)
     and a.attname <> 'tenant_id'
$$;

-- Every file path a workshop's rows point to (photos with their thumbnails,
-- signatures, documents).
create or replace function public.sample_paths(p_tenant uuid)
returns text[]
language plpgsql
stable
set search_path = public
as $$
declare
  c     record;
  v_out text[] := '{}';
  v_add text[];
begin
  for c in
    select table_name::text as t, column_name::text as col
      from information_schema.columns
     where table_schema = 'public' and data_type = 'text'
       and table_name::text = any (public.sample_tables())
       and (column_name = 'path' or column_name like '%\_path')
  loop
    execute format('select coalesce(array_agg(%1$I), ''{}'') from public.%2$I where tenant_id = $1 and %1$I is not null', c.col, c.t) into v_add using p_tenant;
    v_out := v_out || v_add;
  end loop;
  v_out := v_out || array(select a.path || '.thumb.jpg' from public.attachments a where a.tenant_id = p_tenant and a.has_thumb);
  return v_out;
end
$$;

-- Copy the sample workshop p_source into the new, empty workshop p_target
-- and start its 24 hours. Returns the files to copy (from → to).
create or replace function public.clone_sample(p_source uuid, p_target uuid)
returns table (from_path text, to_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner  uuid;
  v_days   int;
  v_src    text := p_source::text;
  v_tgt    text := p_target::text;
  v_order  text[] := public.sample_order();
  v_late   text[] := array(select l.table_name || '.' || l.column_name from public.sample_late_links(public.sample_order()) l);
  v_cols   text;
  v_vals   text;
  v_expr   text;
  t        text;
  c        record;
begin
  if not exists (select 1 from public.tenants where id = p_source and settings ->> 'sample' = 'true') then
    raise exception 'sample_source';
  end if;
  if exists (select 1 from public.jobs where tenant_id = p_target) or exists (select 1 from public.clients where tenant_id = p_target) then
    raise exception 'sample_target_not_empty';
  end if;
  select id into v_owner from public.profiles where tenant_id = p_target and role = 'owner' limit 1;
  if v_owner is null then
    raise exception 'sample_target_owner';
  end if;
  -- Whole days, so a job booked for 10:00 "today" in the sample is at 10:00 today.
  select (now() at time zone 'Europe/Zagreb')::date - (created_at at time zone 'Europe/Zagreb')::date into v_days
    from public.tenants where id = p_source;

  delete from public.sample_map where target = p_target;
  -- The sample's people are the new owner; its price list is the new one.
  insert into public.sample_map (target, old, new)
  select p_target, p.id, v_owner from public.profiles p where p.tenant_id = p_source;
  insert into public.sample_map (target, old, new)
  select p_target, pl.id, (select id from public.price_lists where tenant_id = p_target order by is_default desc limit 1)
    from public.price_lists pl where pl.tenant_id = p_source
      and exists (select 1 from public.price_lists where tenant_id = p_target);
  update public.price_lists t
     set labor_rates = s.labor_rates
    from public.price_lists s
   where t.tenant_id = p_target and t.is_default and s.tenant_id = p_source and s.is_default;

  foreach t in array v_order loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'id' and data_type = 'uuid') then
      execute format('insert into public.sample_map (target, old, new) select $1, id, gen_random_uuid() from public.%I where tenant_id = $2', t) using p_target, p_source;
    end if;
  end loop;

  foreach t in array v_order loop
    v_cols := '';
    v_vals := '';
    for c in
      select a.attname::text as name,
             format_type(a.atttypid, a.atttypmod) as type,
             pg_get_expr(d.adbin, d.adrelid) as def,
             exists (select 1 from pg_constraint k where k.conrelid = a.attrelid and k.contype in ('f', 'p') and a.attnum = any (k.conkey)) as keyed,
             exists (select 1 from pg_index i where i.indrelid = a.attrelid and i.indisunique and not i.indisprimary and i.indnatts = 1 and i.indkey[0] = a.attnum) as unique1
        from pg_attribute a
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = format('public.%I', t)::regclass
         and a.attnum > 0 and not a.attisdropped
         and a.attgenerated = '' and a.attidentity <> 'a'
       order by a.attnum
    loop
      v_expr := case
        when c.name = 'tenant_id' then format('%L::uuid', v_tgt)
        when (t || '.' || c.name) = any (v_late) then 'null'
        when c.name = 'is_demo' then 'true'
        -- Sample invoices number in their own series, so the workshop's
        -- real invoices still start at 1.
        when t = 'jobs' and c.name = 'invoice_premises' then 'case when s.invoice_number is not null then ''PRIMJER'' else s.invoice_premises end'
        when c.type = 'uuid' and c.unique1 and not c.keyed then coalesce(c.def, 'gen_random_uuid()')
        when c.type = 'uuid' then format('coalesce((select m.new from public.sample_map m where m.target = %L and m.old = s.%I), s.%I)', v_tgt, c.name, c.name)
        when c.type = 'text' and (c.name = 'path' or c.name like '%\_path') then
          format('case when s.%1$I like %2$L then %3$L || substr(s.%1$I, %4$s) else s.%1$I end', c.name, v_src || '/%', v_tgt, length(v_src) + 1)
        when c.unique1 and not c.keyed then coalesce(c.def, format('s.%I || ''-'' || left(gen_random_uuid()::text, 8)', c.name))
        when c.type in ('timestamp with time zone', 'timestamp without time zone') then format('s.%I + make_interval(days => %s)', c.name, v_days)
        when c.type = 'date' then format('s.%I + %s', c.name, v_days)
        else format('s.%I', c.name)
      end;
      v_cols := v_cols || case when v_cols = '' then '' else ', ' end || quote_ident(c.name);
      v_vals := v_vals || case when v_vals = '' then '' else ', ' end || v_expr;
    end loop;
    execute format('insert into public.%I (%s) select %s from public.%I s where s.tenant_id = %L', t, v_cols, v_vals, t, v_src);
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'id' and data_type = 'uuid') then
      execute format(
        'insert into public.sample_rows (tenant_id, table_name, row_id) select %L, %L, m.new from public.%I s join public.sample_map m on m.target = %L and m.old = s.id where s.tenant_id = %L',
        v_tgt, t, t, v_tgt, v_src
      );
    end if;
  end loop;
  -- The links left empty above, now that both ends exist.
  for c in select * from public.sample_late_links(v_order) loop
    execute format(
      'update public.%1$I x set %2$I = m2.new
         from public.%1$I s
         join public.sample_map m on m.target = %3$L and m.old = s.id
         join public.sample_map m2 on m2.target = %3$L and m2.old = s.%2$I
        where s.tenant_id = %4$L and x.id = m.new',
      c.table_name, c.column_name, v_tgt, v_src
    );
  end loop;
  delete from public.sample_map where target = p_target;

  -- The sample's working hours for the AI phone, and its VAT setting.
  update public.tenants t
     set settings = t.settings
           || coalesce(jsonb_strip_nulls(jsonb_build_object('calendar', s.settings -> 'calendar', 'vat_registered', s.settings -> 'vat_registered')), '{}'::jsonb),
         sample_until = now() + interval '24 hours'
    from public.tenants s
   where t.id = p_target and s.id = p_source;

  return query
    select f, v_tgt || substr(f, length(v_src) + 1)
      from unnest(public.sample_paths(p_source)) f
     where f like v_src || '/%';
end
$$;

-- Move to real work: the sample rows go, whatever the owner entered stays,
-- and so does a sample row the owner's own work still points to (a sample
-- customer given a real job becomes a real customer). Returns the files
-- that no row points to any more (the server deletes them).
create or replace function public.end_sample(p_tenant uuid)
returns table (path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before text[] := public.sample_paths(p_tenant);
  v_order  text[] := public.sample_order();
  v_tracked text[];
  v_cond   text;
  t        text;
  k        record;
  i        int;
begin
  select coalesce(array_agg(distinct table_name), '{}') into v_tracked from public.sample_rows where tenant_id = p_tenant;
  -- A sample job goes whole, with whatever was added to it.
  delete from public.jobs where tenant_id = p_tenant and id in (select row_id from public.sample_rows where tenant_id = p_tenant and table_name = 'jobs');
  -- The rest children before parents; a row is kept while anything still
  -- points to it (a self-reference or a table without its own id goes with it).
  for i in reverse cardinality(v_order) .. 1 loop
    t := v_order[i];
    continue when not (t = any (v_tracked));
    v_cond := '';
    for k in
      select ch.relname::text as child, ca.attname::text as col
        from pg_constraint f
        join pg_class ch on ch.oid = f.conrelid
        join lateral unnest(f.conkey, f.confkey) as u(ck, pk) on true
        join pg_attribute ca on ca.attrelid = f.conrelid and ca.attnum = u.ck
        join pg_attribute pa on pa.attrelid = f.confrelid and pa.attnum = u.pk
       where f.contype = 'f'
         and f.confrelid = format('public.%I', t)::regclass
         and f.conrelid <> f.confrelid
         and pa.attname = 'id'
         and ch.relname::text = any (v_order)
         and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = ch.relname and column_name = 'id' and data_type = 'uuid')
    loop
      v_cond := v_cond || format(' and not exists (select 1 from public.%I c where c.%I = x.id)', k.child, k.col);
    end loop;
    execute format(
      'delete from public.%I x where x.tenant_id = $1 and x.id in (select row_id from public.sample_rows where tenant_id = $1 and table_name = %L)%s',
      t, t, v_cond
    ) using p_tenant;
  end loop;

  -- What stays is real now.
  update public.clients set is_demo = false where tenant_id = p_tenant and is_demo;
  update public.assets set is_demo = false where tenant_id = p_tenant and is_demo;
  update public.jobs set is_demo = false where tenant_id = p_tenant and is_demo;
  delete from public.sample_rows where tenant_id = p_tenant;
  update public.tenants set sample_until = null where id = p_tenant;

  return query
    select b from unnest(v_before) b
    except
    select a from unnest(public.sample_paths(p_tenant)) a;
end
$$;

do $$
declare
  f text;
begin
  foreach f in array array['public.sample_rows', 'public.sample_map', 'public.trial_feedback'] loop
    execute format('revoke all on %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on %s from anon, authenticated', f);
    end if;
  end loop;
  foreach f in array array['public.sample_tables()', 'public.sample_order()', 'public.sample_late_links(text[])', 'public.sample_paths(uuid)', 'public.clone_sample(uuid, uuid)', 'public.end_sample(uuid)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end
$$;
