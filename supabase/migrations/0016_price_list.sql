-- =====================================================================
-- TaktiX · 0016 the owner's price list
--   · template_prices: the owner's own price per template line (package
--     templates and his own). Owner only: templates themselves are read
--     by everyone in the workshop, so prices never live in them.
--   · templates.hidden: a package template the workshop doesn't use
--   · the hourly rate is price_lists.labor_rates.hourly (set by the owner;
--     the older "default" key from registration is not used)
-- =====================================================================

create table if not exists public.template_prices (
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  template_code  text not null check (length(template_code) between 1 and 80),
  line_no        int not null check (line_no between 0 and 99),
  price          numeric(10, 2) not null check (price >= 0),
  updated_at     timestamptz not null default now(),
  primary key (tenant_id, template_code, line_no)
);
comment on table public.template_prices is 'Owner-only price per template line (line_no = position in the template). Wins over the hourly rate and the package default.';

alter table public.templates add column if not exists hidden boolean not null default false;

-- Every workshop has its default price list (older ones made by hand may not).
insert into public.price_lists (tenant_id, name, is_default, labor_rates)
select t.id, 'Osnovni cjenik', true, '{}'::jsonb
from public.tenants t
where not exists (select 1 from public.price_lists p where p.tenant_id = t.id and p.is_default);

alter table public.template_prices enable row level security;
drop policy if exists owner_all on public.template_prices;
create policy owner_all on public.template_prices for all to authenticated
  using (tenant_id = public.auth_tenant_id() and public.is_owner())
  with check (tenant_id = public.auth_tenant_id() and public.is_owner());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.template_prices from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select, insert, update, delete on public.template_prices to authenticated';
  end if;
end
$$;
