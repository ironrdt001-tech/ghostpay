import { useState, useEffect, type FormEvent } from 'react'
import { unlockAudioEngine, playChaChingSound } from '../lib/audio'
import { supabase } from '../lib/supabase'
import { formatMoneyParts } from '../lib/formatters'
import { CloseIcon, SpinnerIcon, BoltIcon, BankIcon } from './Icons'

interface TopUpModalProps {
  onClose: () => void
  onSuccess: (newBalance: number) => Promise<void>
  onToast: (kind: 'success' | 'error', message: string) => void
}

export function TopUpModal({ onClose, onSuccess, onToast }: TopUpModalProps) {
  const [amount, setAmount] = useState('500')
  const [method, setMethod] = useState<'upi' | 'bank'>('upi')
  const [busy, setBusy] = useState(false)

  const numAmount = parseFloat(amount) || 0
  const hasValidAmount = Number.isFinite(numAmount) && numAmount >= 1 && numAmount <= 100000

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, busy])

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
      onClose()
      await onSuccess(updatedBalance)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Top-up failed. Please try again.'
      onToast('error', message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-scrim" role="presentation" onClick={() => { if (!busy) onClose() }}>
      <section
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="topup-dialog-title"
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 id="topup-dialog-title" className="text-section-title">Add money to wallet</h2>
            <p className="text-secondary" style={{ marginTop: '2px' }}>
              Instant simulated credit to test GhostPay transfers
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-icon"
            style={{ width: '32px', height: '32px' }}
            aria-label="Close modal"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="field-stack">
          <label className="field-label">
            <span>Amount (₹)</span>
            <div className="input-with-prefix">
              <span className="input-prefix" style={{ fontSize: '18px' }}>₹</span>
              <input
                type="number"
                min="1"
                max="100000"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                disabled={busy}
                className="tabular-nums"
                required
              />
            </div>

            <div className="chip-group" style={{ marginTop: '4px' }}>
              {[500, 1000, 2000, 5000].map(val => (
                <button
                  key={val}
                  type="button"
                  disabled={busy}
                  onClick={() => setAmount(String(val))}
                  className={`chip-btn ${numAmount === val ? 'active' : ''}`}
                >
                  +₹{val.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </label>

          {/* Payment Method selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', margin: 'var(--space-2) 0' }}>
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

          <button
            type="submit"
            disabled={busy || !hasValidAmount}
            className="btn-primary btn-full"
            style={{ marginTop: 'var(--space-2)' }}
          >
            {busy ? (
              <>
                <SpinnerIcon size={16} />
                <span>Crediting wallet...</span>
              </>
            ) : (
              <span>Add {formatMoneyParts(numAmount).full} instantly</span>
            )}
          </button>
        </form>
      </section>
    </div>
  )
}
