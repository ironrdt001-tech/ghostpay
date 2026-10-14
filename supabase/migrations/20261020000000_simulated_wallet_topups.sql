-- Demo-only wallet top-ups. The RPC performs the balance change and ledger
-- insert atomically; it does not collect or verify real funds.

create or replace function public.simulate_wallet_top_up(
  p_amount numeric,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_uid uuid := auth.uid();
  updated_balance numeric(14, 2);
  transaction_id uuid;
  transaction_created_at timestamptz;
  method_label text;
begin
  if authenticated_uid is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000 or p_amount <> round(p_amount, 2) then
    raise exception 'INVALID_TOP_UP_AMOUNT' using errcode = '22023';
  end if;
  if p_method is null or p_method not in ('upi', 'bank') then
    raise exception 'INVALID_TOP_UP_METHOD' using errcode = '22023';
  end if;

  method_label := case p_method
    when 'upi' then 'UPI'
    else 'Bank'
  end;

  perform u.id
    from public.users as u
    where u.id = authenticated_uid
    for update;

  update public.users
    set wallet_balance = wallet_balance + p_amount
    where id = authenticated_uid
    returning wallet_balance into updated_balance;

  if updated_balance is null then
    raise exception 'WALLET_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.transactions (sender_id, receiver_id, amount_inr, sender_name, status)
    values (null, authenticated_uid, p_amount, 'Simulated Wallet Top-Up (' || method_label || ')', 'completed')
    returning id, created_at into transaction_id, transaction_created_at;

  return jsonb_build_object(
    'transaction_id', transaction_id,
    'created_at', transaction_created_at,
    'wallet_balance', updated_balance
  );
end;
$$;

revoke all on function public.simulate_wallet_top_up(numeric, text) from public, anon;
grant execute on function public.simulate_wallet_top_up(numeric, text) to authenticated;

comment on function public.simulate_wallet_top_up(numeric, text) is
  'Demo-only top-up that atomically credits an authenticated GhostPay wallet and records a completed transaction. No real funds are collected.';
