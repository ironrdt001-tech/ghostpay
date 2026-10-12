-- Add profile editor support without exposing one user's banking identity to
-- other authenticated users or to anonymous public payment pages.

alter table public.users
  add column avatar_url text
    check (avatar_url is null or char_length(avatar_url) <= 2048);

drop policy if exists "aliases are publicly readable" on public.users;
create policy "aliases are publicly readable"
  on public.users
  for select
  to anon
  using (true);

create policy "users can read their own profile"
  on public.users
  for select
  to authenticated
  using (id = (select auth.uid()));

grant select (real_legal_name, real_upi_id, avatar_url)
  on public.users to authenticated;
grant update (alias_handle, real_legal_name, real_upi_id, avatar_url)
  on public.users to authenticated;

create policy "users can update their own profile"
  on public.users
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
