export interface Profile {
  id: string
  alias_handle: string
  real_legal_name?: string
  real_upi_id?: string
  full_name?: string
  upi_id?: string
  avatar_url?: string | null
  wallet_balance?: number
  kyc_verified?: boolean
}

export interface KycVerification {
  id: string
  user_id: string
  legal_full_name: string
  pan_number: string
  status: 'pending' | 'verified' | 'rejected'
  created_at: string
  updated_at?: string
}

export interface Transaction {
  id: string
  amount_inr: number
  status: string
  created_at: string
  sender_id?: string | null
  receiver_id?: string
  sender_alias?: string
  sender_name?: string
  recipient_upi?: string
  direction?: 'sent' | 'received'
  counterpartyLabel?: string
  counterpartyAvatarUrl?: string | null
  counterpartyUserId?: string | null
  type?: string
  isNodal?: boolean
}

export type DemoTransaction = Transaction & {
  receiver_id: string
  sender_alias: string
  status: 'simulated'
}

export interface RecentPerson {
  handle: string
  label: string
  avatarUrl?: string | null
}

export interface CashflowDay {
  key: string
  dayName: string
  dateLabel: string
  received: number
  sent: number
}

export type ActivityFilter = 'all' | 'received' | 'sent' | '7d'

