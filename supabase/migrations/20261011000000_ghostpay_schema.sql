-- GhostPay Phase 1: schema and access controls.
-- Public clients can discover aliases, but cannot select private identity columns.

create type public.transaction_status as enum (
  'pending_collection',
  'escrowed',
  'payout_successful',
  'failed'
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  alias_handle text not null unique,
  real_legal_name text not null,
  real_upi_id text not null,
  kyc_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.users (id) on delete set null,
  receiver_id uuid not null references public.users (id) on delete restrict,
  amount_inr numeric not null check (amount_inr > 0),
  status public.transaction_status not null default 'pending_collection',
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.transactions enable row level security;

-- Column grants prevent anon/authenticated clients from selecting private identity
-- fields even though alias rows are publicly discoverable.
revoke all on table public.users from public, anon, authenticated;
grant select (alias_handle) on table public.users to anon, authenticated;
grant insert (id, alias_handle, real_legal_name, real_upi_id)
  on table public.users to authenticated;
grant all on table public.users to service_role;

create policy "aliases are publicly readable"
  on public.users
  for select
  to anon, authenticated
  using (true);

create policy "users can create their own profile"
  on public.users
  for insert
  to authenticated
  with check (id = (select auth.uid()));

-- Do not grant client-side writes to transactions. Checkout creation and all
-- status transitions must be performed by trusted backend code.
revoke all on table public.transactions from public, anon, authenticated;
grant select on table public.transactions to authenticated;
grant all on table public.transactions to service_role;

create policy "users can read their own transactions"
  on public.transactions
  for select
  to authenticated
  using (
    sender_id = (select auth.uid())
    or receiver_id = (select auth.uid())
  );

create index transactions_sender_id_idx on public.transactions (sender_id);
create index transactions_receiver_id_created_at_idx
  on public.transactions (receiver_id, created_at desc);

comment on column public.users.real_legal_name is
  'Private banking identity. Never grant client roles access.';
comment on column public.users.real_upi_id is
  'Private payout destination. Backend service_role only.';
