-- Simulated checkout is external demo fiat and may be used to test a user's
-- own payment page. Only wallet transfers enforce the self-transfer guard.
create or replace function public.simulate_escrow_payment(
  p_receiver_handle text,
  p_amount numeric,
  p_sender_name text default null,
  p_use_wallet boolean default false
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
  transaction_id uuid;
  normalized_handle text := lower(trim(both '@' from coalesce(p_receiver_handle, '')));
  resolved_sender_name text := coalesce(nullif(left(btrim(p_sender_name), 80), ''), 'Anonymous');
begin
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'INVALID_PAYMENT_AMOUNT' using errcode = '22023';
  end if;
  if p_amount > 1000000 then
    raise exception 'PAYMENT_AMOUNT_TOO_LARGE' using errcode = '22023';
  end if;
  if normalized_handle !~ '^[a-z0-9_][a-z0-9_.]{2,29}$' then
    raise exception 'INVALID_RECEIVER_HANDLE' using errcode = '22023';
  end if;
  if p_use_wallet and sender_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select u.id
    into receiver_user_id
    from public.users as u
    where u.alias_handle = normalized_handle;
  if receiver_user_id is null then
    raise exception 'RECEIVER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_use_wallet and sender_user_id = receiver_user_id then
    raise exception 'CANNOT_TRANSFER_TO_SELF' using errcode = '22023';
  end if;

  if p_use_wallet then
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
  else
    perform u.id
      from public.users as u
      where u.id = receiver_user_id
      for update;
  end if;

  update public.users
    set wallet_balance = wallet_balance + p_amount
    where id = receiver_user_id;

  insert into public.transactions (sender_id, receiver_id, amount_inr, sender_name, status)
    values (sender_user_id, receiver_user_id, p_amount, resolved_sender_name, 'completed')
    returning id into transaction_id;

  if sender_user_id is not null then
    select u.wallet_balance
      into sender_balance
      from public.users as u
      where u.id = sender_user_id;
  end if;

  return jsonb_build_object(
    'transaction_id', transaction_id,
    'wallet_balance', sender_balance
  );
end;
$$;

revoke all on function public.simulate_escrow_payment(text, numeric, text, boolean) from public;
grant execute on function public.simulate_escrow_payment(text, numeric, text, boolean) to anon, authenticated;
