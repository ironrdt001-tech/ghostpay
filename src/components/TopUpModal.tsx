import { useState, type FormEvent } from 'react'
import { triggerHaptic } from '../lib/haptics'
import { unlockAudioEngine, playChaChingSound } from '../lib/audio'
import { supabase } from '../lib/supabase'
import { formatMoneyParts } from '../lib/formatters'
import { SpinnerIcon, BoltIcon, BankIcon } from './Icons'
import { GPModal, GPAmountField, GPChips, GPButton } from './GhostPayModalKit'

interface TopUpModalProps {
  onClose: () => void
  onSuccess: (newBalance: number) => Promise<void>
  onToast: (kind: 'success' | 'error', message: string) => void
}

export function TopUpModal({ onClose, onSuccess, onToast }: TopUpModalProps) {
  const [amount, setAmount] = useState('500')
  const [lastSelectedChip, setLastSelectedChip] = useState<number | null>(500)
  const [method, setMethod] = useState<'upi' | 'bank'>('upi')
  const [busy, setBusy] = useState(false)

  const numAmount = parseFloat(amount) || 0
  const hasValidAmount = Number.isFinite(numAmount) && numAmount >= 1 && numAmount <= 100000

  const handleClose = () => {
    setAmount('500')
    setLastSelectedChip(500)
    setMethod('upi')
    onClose()
  }

  const handleChipPick = (val: number) => {
    triggerHaptic(50)
    setLastSelectedChip(val)
    const next = String((parseFloat(amount) || 0) + val)
    setAmount(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // 1. Mobile-safe Web Audio unlock called synchronously on very first line before await
    unlockAudioEngine()
    event.preventDefault()

    if (!supabase) {
      onToast('error', 'Wallet is not connected.')
      return
    }

    if (!hasValidAmount) {
      onToast('error', 'Enter a top-up amount between ₹1 and ₹1,00,000.')
      return
    }

    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('simulate_wallet_top_up', {
        p_amount: numAmount,
        p_method: method,
      })

      if (error) throw error

      const result = data as { wallet_balance?: number | string } | null
      const updatedBalance = Number(result?.wallet_balance)
      if (!Number.isFinite(updatedBalance)) {
        throw new Error('Top-up confirmation was incomplete.')
      }

      // 2. Play rising 4-note GPay chime on completion
      playChaChingSound()
      onToast('success', `${formatMoneyParts(numAmount).full} added to your wallet.`)
      handleClose()
      await onSuccess(updatedBalance)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Top-up failed. Please try again.'
      onToast('error', message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <GPModal
      title="Add money to wallet"
      subtitle="Instant simulated credit to test GhostPay transfers"
      onClose={handleClose}
      disabled={busy}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <GPAmountField
            value={amount}
            onChange={(val) => {
              setLastSelectedChip(null)
              setAmount(val)
            }}
            disabled={busy}
            required
          />
          <GPChips
            amount={lastSelectedChip ?? amount}
            options={[500, 1000, 2000, 5000]}
            onPick={handleChipPick}
            disabled={busy}
          />
        </div>

        {/* Payment Method selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', margin: '4px 0' }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => setMethod('upi')}
            className={`surface-inset ${method === 'upi' ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: 'var(--space-3) var(--space-4)',
              cursor: 'pointer',
              borderColor: method === 'upi' ? 'var(--accent-primary)' : 'var(--border-subtle)',
              backgroundColor: method === 'upi' ? 'var(--accent-subtle)' : 'var(--bg-inset)',
              color: method === 'upi' ? 'var(--accent-text)' : 'var(--text-secondary)',
            }}
          >
            <BoltIcon size={16} strokeWidth={2} />
            <span style={{ fontSize: '13px', fontWeight: 500 }}>UPI instant</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => setMethod('bank')}
            className={`surface-inset ${method === 'bank' ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: 'var(--space-3) var(--space-4)',
              cursor: 'pointer',
              borderColor: method === 'bank' ? 'var(--accent-primary)' : 'var(--border-subtle)',
              backgroundColor: method === 'bank' ? 'var(--accent-subtle)' : 'var(--bg-inset)',
              color: method === 'bank' ? 'var(--accent-text)' : 'var(--text-secondary)',
            }}
          >
            <BankIcon size={16} strokeWidth={1.75} />
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Nodal bank</span>
          </button>
        </div>

        <GPButton
          type="submit"
          variant="primary"
          disabled={busy || !hasValidAmount}
          icon={busy ? <SpinnerIcon size={16} /> : undefined}
          style={{ marginTop: '8px' }}
        >
          {busy ? (
            <span>Crediting wallet...</span>
          ) : (
            <span>Add {formatMoneyParts(numAmount).full} instantly</span>
          )}
        </GPButton>
      </form>
    </GPModal>
  )
}
