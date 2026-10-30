import { supabase } from './supabase'
import { formatHandle } from './formatters'
import type { Transaction } from './types'

export async function fetchLedgerTransactions(userId: string): Promise<Transaction[]> {
  if (!supabase) return []
  const allRows: Transaction[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, sender_id, receiver_id, amount_inr, status, created_at, sender_name')
      .or(`receiver_id.eq.${userId},sender_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    allRows.push(...((data ?? []) as Transaction[]))
    if (!data || data.length < 1000) break
  }

  const uniqueUserIds = [...new Set(allRows.flatMap(tx => [tx.sender_id, tx.receiver_id]).filter((id): id is string => Boolean(id)))]
  const usersById = new Map<string, { alias_handle: string; avatar_url: string | null }>()
  if (uniqueUserIds.length) {
    const { data: users, error } = await supabase.from('profiles').select('id, alias_handle, avatar_url').in('id', uniqueUserIds)
    if (error) throw error
    for (const user of users ?? []) {
      usersById.set(user.id, { alias_handle: user.alias_handle, avatar_url: user.avatar_url })
    }
  }

  return allRows.map(tx => {
    const direction = tx.sender_id === userId ? 'sent' : 'received'
    const sender = tx.sender_id ? usersById.get(tx.sender_id) : undefined
    const receiver = tx.receiver_id ? usersById.get(tx.receiver_id) : undefined
    const senderHandle = sender?.alias_handle
    const receiverHandle = receiver?.alias_handle
    const isTopUp = String(tx.sender_name || '').toLowerCase().includes('top-up')
    const isWithdrawal = tx.type === 'Withdrawal' || tx.type === 'Settlement' ||
      String(tx.sender_name || '').toLowerCase().includes('withdrawal') ||
      String(tx.sender_name || '').toLowerCase().includes('nodal payout')
    const isShielded = !isTopUp && !isWithdrawal && !tx.sender_id
    const isNodal = isShielded || isWithdrawal || Boolean(tx.sender_id?.startsWith('#') || tx.receiver_id?.startsWith('#'))
    const type = isWithdrawal ? 'Withdrawal' : isShielded ? 'shielded_link' : isTopUp ? 'top_up' : 'p2p'

    const counterpartyLabel = isWithdrawal
      ? tx.sender_name || 'Bank Withdrawal'
      : direction === 'sent'
      ? receiverHandle ? formatHandle(receiverHandle) : tx.recipient_upi || tx.sender_name || 'GhostPay User'
      : tx.sender_name || (senderHandle ? formatHandle(senderHandle) : 'Anonymous Sender')
    return {
      ...tx,
      direction,
      counterpartyLabel,
      counterpartyAvatarUrl: direction === 'sent' ? receiver?.avatar_url ?? null : sender?.avatar_url ?? null,
      counterpartyUserId: direction === 'sent' ? tx.receiver_id ?? null : tx.sender_id ?? null,
      type,
      isNodal,
    }
  })
}

export { processWithdrawal } from './ledgerTransactions'

