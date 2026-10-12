-- Persist only the mock review state. KYC form fields and documents are not
-- stored by this demo flow.
alter table public.users
  add column if not exists kyc_status text not null default 'unverified'
  check (kyc_status in ('unverified', 'pending', 'approved'));

-- Preserve the prior verified state for accounts that already passed KYC.
update public.users
set kyc_status = 'approved'
where kyc_verified = true and kyc_status = 'unverified';

grant select (kyc_status) on table public.users to authenticated;
grant update (kyc_status) on table public.users to authenticated;

create or replace function public.guard_client_kyc_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.kyc_status is distinct from old.kyc_status
     and coalesce(auth.role(), '') <> 'service_role'
     and not (old.kyc_status = 'unverified' and new.kyc_status = 'pending') then
    raise exception 'Clients may only submit unverified accounts for review.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_client_kyc_status() from public, anon, authenticated;

drop trigger if exists guard_client_kyc_status on public.users;
create trigger guard_client_kyc_status
  before update of kyc_status on public.users
  for each row execute function public.guard_client_kyc_status();

comment on column public.users.kyc_status is
  'KYC review state. Authenticated clients may move unverified to pending; service_role controls approval.';
