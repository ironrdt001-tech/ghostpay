-- Store compressed 256px avatar data URLs and expose only that public image
-- field through the minimal public profile table.

alter table public.users
  drop constraint if exists users_avatar_url_check;

alter table public.users
  add constraint users_avatar_url_size_check
  check (avatar_url is null or char_length(avatar_url) <= 1000000);

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add constraint profiles_avatar_url_size_check
  check (avatar_url is null or char_length(avatar_url) <= 1000000);

update public.profiles as p
  set avatar_url = u.avatar_url
  from public.users as u
  where p.id = u.id
    and p.avatar_url is null
    and u.avatar_url is not null;

grant select (id, alias_handle, avatar_url)
  on table public.profiles to anon, authenticated;
grant insert (id, alias_handle, avatar_url)
  on table public.profiles to authenticated;
grant update (alias_handle, avatar_url)
  on table public.profiles to authenticated;

comment on column public.profiles.avatar_url is
  'Public avatar image URL or compressed square image data URL. No banking identity is stored here.';
