-- =====================================================================
-- TaktiX · 0020 referrals
-- A workshop that signs up through another's link remembers who sent it.
-- When it pays for the first time, the one who sent it gets a month free
-- (recorded once, by the tower when the payment is entered).
-- Neither column is in the owner's grant.
--
-- Also: the demo flag in settings spares a workshop from billing, so
-- only TaktiX sets it. The owner may write settings (fiscal marks, first
-- steps), but the flag keeps its old value whatever the owner sends.
-- =====================================================================

alter table public.tenants add column if not exists referred_by uuid references public.tenants (id) on delete set null;
alter table public.tenants add column if not exists referral_rewarded_at timestamptz;
create index if not exists idx_tenants_referred_by on public.tenants (referred_by);

create or replace function public.keep_demo_flag()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and (new.settings -> 'demo') is distinct from (old.settings -> 'demo') then
    new.settings := case
      when old.settings ? 'demo' then jsonb_set(coalesce(new.settings, '{}'::jsonb), '{demo}', old.settings -> 'demo')
      else coalesce(new.settings, '{}'::jsonb) - 'demo'
    end;
  end if;
  return new;
end
$$;

drop trigger if exists trg_tenants_keep_demo on public.tenants;
create trigger trg_tenants_keep_demo before update of settings on public.tenants
  for each row execute function public.keep_demo_flag();
