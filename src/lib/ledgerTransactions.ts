import { supabase } from './supabase'
import type { Transaction } from './types'

export interface ProcessWithdrawalResult extends Transaction {
  success: boolean
  newBalance: number
  wallet_balance: number
  transaction: Transaction
  data?: Transaction
}

/**
 * Executes a withdrawal by atomically updating the user's balance via Supabase RPC
 * and recording a new row in the transactions ledger.
 *
 * @param userId - The authenticated user's ID
 * @param amount - The withdrawal amount in INR
 * @param destination - The destination UPI ID or Bank account label
 */
export async function executeWithdrawal(
  userId: string,
  amount: number | string,
  destination: string
): Promise<ProcessWithdrawalResult> {
  const withdrawAmount = Math.abs(typeof amount === 'string' ? parseFloat(amount) || 0 : amount)
  if (!withdrawAmount || withdrawAmount <= 0) {
    throw new Error('Enter a valid withdrawal amount.')
  }

  const destLabel = (typeof destination === 'string' ? destination : String(destination || '')).trim() || 'Bank Account'
  const negativeAmount = -withdrawAmount

  let resolvedUid = userId
  let updatedBalance: number | null = null
  let insertedTxId: string | null = null
  let insertedCreatedAt: string | null = null

  if (!supabase) {
    throw new Error('Wallet connection is not available.')
  }

  if (!resolvedUid) {
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (authData?.user?.id) {
        resolvedUid = authData.user.id
      }
    } catch (err) {
      console.error('[executeWithdrawal] Auth user resolution failed:', err)
    }
  }

  // Exact Supabase RPC call: process_withdrawal with { p_user_id, p_amount, p_destination }
  const { data, error } = await supabase.rpc('process_withdrawal', {
    p_user_id: resolvedUid,
    p_amount: withdrawAmount,
    p_destination: destLabel,
  })

  if (error) {
    console.error('[executeWithdrawal] supabase.rpc process_withdrawal failed:', error)
    throw error
  }

  if (data !== null && data !== undefined) {
    if (typeof data === 'number') {
      updatedBalance = data
    } else if (typeof data === 'object') {
      const res = (typeof data === 'string' ? JSON.parse(data) : data) as Record<string, unknown>
      if (res.new_balance !== undefined && res.new_balance !== null) updatedBalance = Number(res.new_balance)
      else if (res.wallet_balance !== undefined && res.wallet_balance !== null) updatedBalance = Number(res.wallet_balance)
      else if (res.balance !== undefined && res.balance !== null) updatedBalance = Number(res.balance)

      if (res.transaction_id) insertedTxId = String(res.transaction_id)
      else if (res.id) insertedTxId = String(res.id)
      if (res.created_at) insertedCreatedAt = String(res.created_at)
    }
  }

  const finalBalance = updatedBalance !== null ? updatedBalance : 0
  const txId = insertedTxId || `wdr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const createdAt = insertedCreatedAt || new Date().toISOString()

  const transaction: Transaction = {
    id: txId,
    amount_inr: negativeAmount,
    status: 'completed',
    created_at: createdAt,
    sender_id: resolvedUid || null,
    receiver_id: resolvedUid || undefined,
    sender_name: `Withdrawal · ${destLabel}`,
    counterpartyLabel: `Withdrawal · ${destLabel}`,
    direction: 'sent',
    type: 'Withdrawal',
    isNodal: true,
  }

  return {
    ...transaction,
    success: true,
    newBalance: finalBalance,
    wallet_balance: finalBalance,
    transaction,
    data: transaction,
  }
}

// Backward-compatible alias
export { executeWithdrawal as processWithdrawal }
