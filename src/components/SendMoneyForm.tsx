import { useState, useEffect, type FormEvent } from 'react'
import { unlockAudioEngine, playChaChingSound } from '../lib/audio'
import { supabase } from '../lib/supabase'
import { formatHandle, formatMoneyParts } from '../lib/formatters'
import { RecentPeople } from './RecentPeople'
import { ArrowRightIcon, ShieldCheckIcon, SpinnerIcon } from './Icons'
import { triggerHaptic } from '../lib/haptics'
import type { RecentPerson } from '../lib/types'

interface SendMoneyFormProps {
  userId: string
  recentPeople: RecentPerson[]
  onSuccess: (newBalance?: number) => Promise<void>
  onToast: (kind: 'success' | 'error', message: string) => void
  disabled?: boolean
  initialRecipient?: string
  initialAmount?: string
}

export function SendMoneyForm({
  userId,
  recentPeople,
  onSuccess,
  onToast,
  disabled = false,
  initialRecipient = '',
  initialAmount = '',
}: SendMoneyFormProps) {
  const [recipient, setRecipient] = useState(initialRecipient)
  const [amount, setAmount] = useState(initialAmount)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (initialRecipient) {
      setRecipient(initialRecipient)
    }
  }, [initialRecipient])

  useEffect(() => {
    if (initialAmount) {
      setAmount(initialAmount)
    }
  }, [initialAmount])

  const cleanRecipient = recipient.trim()
  const isUpiId = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(cleanRecipient)
  const isHandle = cleanRecipient.length > 0 && !isUpiId

  const numAmount = parseFloat(amount) || 0
  const hasValidAmount = Number.isFinite(numAmount) && numAmount > 0

  // Dynamic button label calculation
  const actionLabel = hasValidAmount && cleanRecipient
    ? `Send ${formatMoneyParts(numAmount).full} to ${isHandle ? formatHandle(cleanRecipient) : cleanRecipient}`
    : hasValidAmount
    ? 'Enter recipient to send'
    : 'Enter amount to send'

  function addPreset(preset: number) {
    const current = parseFloat(amount) || 0
    const next = Math.round((current + preset) * 100) / 100
    setAmount(String(next))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    triggerHaptic()
    // 1. Mobile-safe Web Audio unlock called synchronously on the very first line before any await
    unlockAudioEngine()
    event.preventDefault()

    if (!supabase) {
      onToast('error', 'Connect your GhostPay account to send money.')
      return
    }

    if (!cleanRecipient) {
      onToast('error', 'Enter a recipient handle or UPI ID.')
      return
    }

    const transferAmount = Number(amount)
    if (!Number.isFinite(transferAmount) || transferAmount <= 0 || Math.round(transferAmount * 100) !== transferAmount * 100) {
      onToast('error', 'Enter a valid amount with up to two decimal places.')
      return
    }

    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('transfer_wallet_balance', {
        sender_uid: userId,
        receiver_identifier: cleanRecipient,
        transfer_amount: transferAmount,
      })

      if (error) {
        const msg = error.message.toUpperCase()
        if (msg.includes('INSUFFICIENT_WALLET_BALANCE')) {
          throw new Error('Insufficient wallet balance for this transfer.')
        }
        if (msg.includes('RECEIVER_NOT_FOUND')) {
          throw new Error('Recipient not found. Check the @handle or UPI ID.')
        }
        if (msg.includes('CANNOT_TRANSFER_TO_SELF')) {
          throw new Error('You cannot send money to your own account.')
        }
        if (msg.includes('INVALID_TRANSFER_AMOUNT') || msg.includes('TRANSFER_AMOUNT_TOO_LARGE')) {
          throw new Error('Enter a valid transfer amount.')
        }
        throw new Error(error.message)
      }

      const result = data as { wallet_balance?: number } | null
      // 2. Play rising 4-note chime upon confirmation
      playChaChingSound()

      setRecipient('')
      setAmount('')
      onToast('success', `Sent ${formatMoneyParts(transferAmount).full} successfully.`)

      const updatedBalance = result?.wallet_balance !== undefined ? Number(result.wallet_balance) : undefined
      await onSuccess(updatedBalance)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transfer failed. Please try again.'
      onToast('error', message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="surface-card" style={{ padding: 'var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h2 className="text-section-title">Send money</h2>
        <p className="text-secondary" style={{ marginTop: '2px' }}>
          Instant zero-fee transfer to any @handle or UPI ID
        </p>
      </div>

      <RecentPeople
        people={recentPeople.filter(person => {
          const raw = (person.handle || person.label || '').trim()
          const id = raw.replace(/^@+/, '').trim()
          if (!id || id.startsWith('#') || id.includes(' ') || /\s/.test(id)) return false
          const lower = id.toLowerCase()
          return (
            lower !== 'anonymous sender' &&
            lower !== 'anonymous' &&
            lower !== 'ghostpay user' &&
            lower !== 'ghostpay wallet'
          )
        })}
        selectedRecipient={recipient}
        onSelectPerson={handle => setRecipient(handle)}
      />

      <form onSubmit={handleSubmit} className="field-stack">
        <label className="field-label">
          <span>Recipient @handle or UPI ID</span>
          <div className="input-with-prefix">
            <input
              type="text"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck="false"
              placeholder="@username or name@okaxis"
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              disabled={busy || disabled}
              required
            />
          </div>
          {cleanRecipient && (
            <div className={`verification-caption ${isHandle ? 'verified' : ''}`}>
              <ShieldCheckIcon size={13} strokeWidth={2} />
              <span>
                {isHandle
                  ? 'Verified GhostPay handle · Instant internal settlement'
                  : 'External UPI ID · Routed via nodal escrow'}
              </span>
            </div>
          )}
        </label>

        <label className="field-label">
          <span>Amount (₹)</span>
          <div className="input-with-prefix">
            <span className="input-prefix" style={{ fontSize: '18px' }}>₹</span>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              max="1000000"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              disabled={busy || disabled}
              className="tabular-nums"
              required
            />
          </div>
          <div className="chip-group" style={{ marginTop: '4px' }}>
            {[100, 500, 1000].map(val => (
              <button
                key={val}
                type="button"
                disabled={busy || disabled}
                onClick={() => addPreset(val)}
                className="chip-btn"
              >
                +₹{val.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        </label>

        <button
          type="submit"
          className="btn-primary btn-full"
          disabled={busy || disabled || !hasValidAmount || !cleanRecipient}
          onClick={() => triggerHaptic()}
          style={{ marginTop: 'var(--space-2)' }}
        >
          {busy ? (
            <>
              <SpinnerIcon size={16} />
              <span>Sending securely...</span>
            </>
          ) : (
            <>
              <span>{actionLabel}</span>
              <ArrowRightIcon size={16} strokeWidth={2} />
            </>
          )}
        </button>
      </form>
    </div>
  )
}
