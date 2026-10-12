-- Persist frontend checkout simulations separately from the real payout ledger.
-- A public buyer can create only a constrained test record; clients cannot
-- write to public.transactions or mark a real payout as successful.

-- Public checkout needs the receiver UUID to create a demo record. The private
-- identity columns remain unavailable to anon and authenticated roles.
grant select (id, alias_handle) on public.users to anon, authenticated;

create table public.demo_transactions (
  id uuid primary key default gen_random_uuid(),
  receiver_id uuid not null references public.users (id) on delete cascade,
  amount_inr numeric not null check (amount_inr > 0 and amount_inr <= 100000),
  sender_alias text not null default 'Anonymous'
    check (char_length(sender_alias) between 1 and 80),
  status text not null default 'simulated' check (status = 'simulated'),
  created_at timestamptz not null default now()
);

alter table public.demo_transactions enable row level security;

revoke all on table public.demo_transactions from public, anon, authenticated;
grant insert (receiver_id, amount_inr, sender_alias)
  on public.demo_transactions to anon, authenticated;
grant select on public.demo_transactions to authenticated;
grant all on public.demo_transactions to service_role;

create policy "buyers can create constrained demo payments"
  on public.demo_transactions
  for insert
  to anon, authenticated
  with check (status = 'simulated');

create policy "recipients can read their demo payments"
  on public.demo_transactions
  for select
  to authenticated
  using (receiver_id = (select auth.uid()));

create index demo_transactions_receiver_id_created_at_idx
  on public.demo_transactions (receiver_id, created_at desc);

comment on table public.demo_transactions is
  'Frontend checkout simulations only; never used for real payout settlement.';
