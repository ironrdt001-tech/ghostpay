-- Fix process_withdrawal RPC to use the correct schema column `wallet_balance` instead of `balance`
create or replace function public.process_withdrawal(
  p_user_id uuid,
  p_amount numeric,
  p_destination text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_balance numeric(14, 2);
  current_balance numeric(14, 2);
  transaction_id uuid;
  transaction_created_at timestamptz;
  dest_label text;
begin
  if p_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'INVALID_WITHDRAWAL_AMOUNT' using errcode = '22023';
  end if;

  perform u.id
    from public.users as u
    where u.id = p_user_id
    for update;

  select wallet_balance into current_balance
    from public.users
    where id = p_user_id;

  if current_balance is null or current_balance < p_amount then
    raise exception 'INSUFFICIENT_WALLET_BALANCE' using errcode = 'P0001';
  end if;

  update public.users
    set wallet_balance = wallet_balance - p_amount
    where id = p_user_id
    returning wallet_balance into updated_balance;

  dest_label := coalesce(nullif(btrim(p_destination), ''), 'Nodal Account');

  insert into public.transactions (sender_id, receiver_id, amount_inr, sender_name, status)
    values (p_user_id, p_user_id, p_amount, 'Nodal Payout · ' || dest_label, 'completed')
    returning id, created_at into transaction_id, transaction_created_at;

  return jsonb_build_object(
    'transaction_id', transaction_id,
    'created_at', transaction_created_at,
    'wallet_balance', updated_balance,
    'status', 'completed'
  );
end;
$$;

grant execute on function public.process_withdrawal(uuid, numeric, text) to authenticated, anon;
