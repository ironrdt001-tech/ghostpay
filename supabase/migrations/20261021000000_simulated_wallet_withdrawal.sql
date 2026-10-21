-- Simulated wallet withdrawal to external bank account or UPI ID.
-- Performs atomic balance deduction and transaction ledger entry.

create or replace function public.simulate_wallet_withdrawal(
  p_amount numeric,
  p_destination text,
  p_method text default 'upi',
  p_utr text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_uid uuid := auth.uid();
  updated_balance numeric(14, 2);
  current_balance numeric(14, 2);
  transaction_id uuid;
  transaction_created_at timestamptz;
  dest_label text;
begin
  if authenticated_uid is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'INVALID_WITHDRAWAL_AMOUNT' using errcode = '22023';
  end if;

  perform u.id
    from public.users as u
    where u.id = authenticated_uid
    for update;

  select wallet_balance into current_balance
    from public.users
    where id = authenticated_uid;

  if current_balance is null or current_balance < p_amount then
    raise exception 'INSUFFICIENT_WALLET_BALANCE' using errcode = 'P0001';
  end if;

  update public.users
    set wallet_balance = wallet_balance - p_amount
    where id = authenticated_uid
    returning wallet_balance into updated_balance;

  dest_label := coalesce(nullif(btrim(p_destination), ''), 'Nodal Account');

  insert into public.transactions (sender_id, receiver_id, amount_inr, sender_name, status)
    values (authenticated_uid, authenticated_uid, p_amount, 'Nodal Payout · ' || dest_label, 'completed')
    returning id, created_at into transaction_id, transaction_created_at;

  return jsonb_build_object(
    'transaction_id', transaction_id,
    'created_at', transaction_created_at,
    'wallet_balance', updated_balance,
    'utr', p_utr
  );
end;
$$;

revoke all on function public.simulate_wallet_withdrawal(numeric, text, text, text) from public, anon;
grant execute on function public.simulate_wallet_withdrawal(numeric, text, text, text) to authenticated;

comment on function public.simulate_wallet_withdrawal(numeric, text, text, text) is
  'Demo-only simulated wallet withdrawal that atomically deducts from authenticated wallet balance and logs a payout transaction.';
