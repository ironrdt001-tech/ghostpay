-- Migration: Add kyc_verifications table and policies for identity verification

create table if not exists public.kyc_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legal_full_name text not null,
  pan_number text not null,
  status text not null default 'verified' check (status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kyc_verifications_user_id_key unique (user_id)
);

alter table public.kyc_verifications enable row level security;

revoke all on table public.kyc_verifications from public, anon, authenticated;
grant select, insert, update on table public.kyc_verifications to authenticated;
grant all on table public.kyc_verifications to service_role;

create policy "users can view own kyc verification"
  on public.kyc_verifications
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users can submit own kyc verification"
  on public.kyc_verifications
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users can update own kyc verification"
  on public.kyc_verifications
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Grant select on users.kyc_verified to authenticated users
grant select (kyc_verified) on table public.users to authenticated;

-- Function and trigger to sync kyc_verified flag on public.users
create or replace function public.sync_user_kyc_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'verified' then
    update public.users
    set kyc_verified = true
    where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_kyc_verification_sync on public.kyc_verifications;
create trigger on_kyc_verification_sync
  after insert or update on public.kyc_verifications
  for each row execute function public.sync_user_kyc_status();
