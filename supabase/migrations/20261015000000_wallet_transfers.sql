-- Wallet balances are funded only by trusted server-side operations. Clients
-- can read their own balance and request an atomic transfer through the RPC.
alter table public.users
  add column if not exists wallet_balance numeric(14, 2) not null default 0
  check (wallet_balance >= 0);

grant select (wallet_balance) on table public.users to authenticated;

create table if not exists public.wallet_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users (id) on delete restrict,
  receiver_id uuid not null references public.users (id) on delete restrict,
  amount_inr numeric(14, 2) not null check (amount_inr > 0),
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

alter table public.wallet_transfers enable row level security;
revoke all on table public.wallet_transfers from public, anon, authenticated;
grant select on table public.wallet_transfers to authenticated;
grant all on table public.wallet_transfers to service_role;

create policy "users can read their own wallet transfers"
  on public.wallet_transfers
  for select
  to authenticated
  using (
    sender_id = (select auth.uid())
    or receiver_id = (select auth.uid())
  );

create index if not exists wallet_transfers_sender_created_idx
  on public.wallet_transfers (sender_id, created_at desc);
create index if not exists wallet_transfers_receiver_created_idx
  on public.wallet_transfers (receiver_id, created_at desc);

create or replace function public.transfer_ghostpay_wallet(
  p_receiver_handle text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_user_id uuid := auth.uid();
  receiver_user_id uuid;
  sender_balance numeric(14, 2);
  transfer_id uuid;
  normalized_handle text := lower(trim(both '@' from coalesce(p_receiver_handle, '')));
begin
  if sender_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'INVALID_TRANSFER_AMOUNT' using errcode = '22023';
  end if;
  if p_amount > 1000000000 then
    raise exception 'TRANSFER_AMOUNT_TOO_LARGE' using errcode = '22023';
  end if;
  if normalized_handle !~ '^[a-z0-9_][a-z0-9_.]{2,29}$' then
    raise exception 'INVALID_RECEIVER_HANDLE' using errcode = '22023';
  end if;

  select u.id
    into receiver_user_id
    from public.users as u
    where u.alias_handle = normalized_handle;

  if receiver_user_id is null then
    raise exception 'RECEIVER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if receiver_user_id = sender_user_id then
    raise exception 'CANNOT_TRANSFER_TO_SELF' using errcode = '22023';
  end if;

  -- Lock both accounts in a consistent order to avoid double-spends and
  -- reduce deadlocks when opposite-direction transfers happen concurrently.
  perform u.id
    from public.users as u
    where u.id in (sender_user_id, receiver_user_id)
    order by u.id
    for update;

  select u.wallet_balance
    into sender_balance
    from public.users as u
    where u.id = sender_user_id;

  if sender_balance is null then
    raise exception 'SENDER_WALLET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if sender_balance < p_amount then
    raise exception 'INSUFFICIENT_WALLET_BALANCE' using errcode = 'P0001';
  end if;

  update public.users
    set wallet_balance = wallet_balance - p_amount
    where id = sender_user_id;
  update public.users
    set wallet_balance = wallet_balance + p_amount
    where id = receiver_user_id;

  insert into public.wallet_transfers (sender_id, receiver_id, amount_inr)
    values (sender_user_id, receiver_user_id, p_amount)
    returning id into transfer_id;

  return jsonb_build_object(
    'transfer_id', transfer_id,
    'wallet_balance', sender_balance - p_amount
  );
end;
$$;

revoke all on function public.transfer_ghostpay_wallet(text, numeric) from public, anon;
grant execute on function public.transfer_ghostpay_wallet(text, numeric) to authenticated;

comment on column public.users.wallet_balance is
  'GhostPay wallet balance. Only trusted server operations may fund wallets; transfers use transfer_ghostpay_wallet.';
