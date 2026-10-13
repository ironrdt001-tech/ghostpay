-- Atomic authenticated wallet-to-wallet transfers by public handle or private UPI ID.
-- This function never returns the receiver's private UPI ID to the caller.

create or replace function public.transfer_wallet_balance(
  sender_uid uuid,
  receiver_identifier text,
  transfer_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_uid uuid := auth.uid();
  receiver_user_id uuid;
  sender_handle text;
  sender_balance numeric(14, 2);
  transaction_id uuid;
  normalized_identifier text := lower(btrim(coalesce(receiver_identifier, '')));
  normalized_handle text;
begin
  if authenticated_uid is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if sender_uid is distinct from authenticated_uid then
    raise exception 'SENDER_IDENTITY_MISMATCH' using errcode = '42501';
  end if;
  if transfer_amount is null or transfer_amount <= 0 or transfer_amount <> round(transfer_amount, 2) then
    raise exception 'INVALID_TRANSFER_AMOUNT' using errcode = '22023';
  end if;
  if transfer_amount > 1000000 then
    raise exception 'TRANSFER_AMOUNT_TOO_LARGE' using errcode = '22023';
  end if;
  if normalized_identifier = '' then
    raise exception 'RECEIVER_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Prefer an exact UPI-ID match. The private column is accessed only inside
  -- this SECURITY DEFINER function and is never included in the response.
  select u.id
    into receiver_user_id
    from public.users as u
    where lower(btrim(u.real_upi_id)) = normalized_identifier
    limit 1;

  if receiver_user_id is null then
    normalized_handle := lower(trim(both '@' from normalized_identifier));
    select u.id
      into receiver_user_id
      from public.users as u
      where lower(trim(both '@' from u.alias_handle)) = normalized_handle
      limit 1;
  end if;

  if receiver_user_id is null then
    raise exception 'RECEIVER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if receiver_user_id = authenticated_uid then
    raise exception 'CANNOT_TRANSFER_TO_SELF' using errcode = '22023';
  end if;

  -- Lock in stable order so concurrent opposite transfers cannot deadlock or
  -- spend the same sender balance twice.
  perform u.id
    from public.users as u
    where u.id in (authenticated_uid, receiver_user_id)
    order by u.id
    for update;

  select u.wallet_balance, u.alias_handle
    into sender_balance, sender_handle
    from public.users as u
    where u.id = authenticated_uid;

  if sender_balance is null then
    raise exception 'SENDER_WALLET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if sender_balance < transfer_amount then
    raise exception 'INSUFFICIENT_WALLET_BALANCE' using errcode = 'P0001';
  end if;

  update public.users
    set wallet_balance = wallet_balance - transfer_amount
    where id = authenticated_uid;
  update public.users
    set wallet_balance = wallet_balance + transfer_amount
    where id = receiver_user_id;

  insert into public.transactions (sender_id, receiver_id, amount_inr, sender_name, status)
    values (authenticated_uid, receiver_user_id, transfer_amount, coalesce(nullif(sender_handle, ''), 'GhostPay Wallet'), 'completed')
    returning id into transaction_id;

  return jsonb_build_object(
    'transaction_id', transaction_id,
    'wallet_balance', sender_balance - transfer_amount
  );
end;
$$;

revoke all on function public.transfer_wallet_balance(uuid, text, numeric) from public, anon;
grant execute on function public.transfer_wallet_balance(uuid, text, numeric) to authenticated;

comment on function public.transfer_wallet_balance(uuid, text, numeric) is
  'Atomically transfers an authenticated user wallet balance to another GhostPay user identified by handle or UPI ID, and records a completed transaction.';
