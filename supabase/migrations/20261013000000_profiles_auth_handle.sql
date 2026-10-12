-- Keep authentication handle claims in a minimal public profile table.
-- Banking identity remains in public.users and is never copied here.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  alias_handle text not null unique
    check (alias_handle ~ '^[a-z0-9_][a-z0-9_.]{2,29}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select (id, alias_handle) on table public.profiles to anon, authenticated;
grant insert (id, alias_handle) on table public.profiles to authenticated;
grant update (alias_handle) on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

create policy "public can read claimed handles"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

create policy "users can create their own claimed handle"
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "users can update their own claimed handle"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Backfill the handle already in use by existing GhostPay accounts.
insert into public.profiles (id, alias_handle)
select id, alias_handle
from public.users
where alias_handle ~ '^[a-z0-9_][a-z0-9_.]{2,29}$'
on conflict (id) do nothing;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_handle text;
begin
  claimed_handle := lower(trim(both '@' from coalesce(new.raw_user_meta_data ->> 'alias_handle', '')));

  -- Allow users created outside the GhostPay signup screen to finish auth;
  -- they can claim a handle during onboarding.
  if claimed_handle = '' then
    return new;
  end if;

  if claimed_handle !~ '^[a-z0-9_][a-z0-9_.]{2,29}$' then
    raise exception 'Invalid GhostPay handle.' using errcode = '23514';
  end if;

  if exists (select 1 from public.users where alias_handle = claimed_handle) then
    raise exception 'That handle is already taken.' using errcode = '23505';
  end if;

  insert into public.profiles (id, alias_handle)
  values (new.id, claimed_handle);

  return new;
end;
$$;

revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_ghostpay_profile on auth.users;
create trigger on_auth_user_created_ghostpay_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

comment on table public.profiles is
  'Public GhostPay alias claims, separate from private banking identity in public.users.';
