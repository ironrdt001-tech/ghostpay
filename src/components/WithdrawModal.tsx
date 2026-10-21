import { useState, type FormEvent } from 'react'
import { triggerHaptic } from '../lib/haptics'
import { unlockAudioEngine, playChaChingSound } from '../lib/audio'
import { supabase } from '../lib/supabase'
import { formatMoneyParts } from '../lib/formatters'
import { SpinnerIcon, BoltIcon, BankIcon } from './Icons'
import { GPModal, GPButton } from './GhostPayModalKit'

interface WithdrawModalProps {
  walletBalance: number
  realUpiId?: string
  realLegalName?: string
  userId: string
  onClose: () => void
  onSuccess: (withdrawnAmount: number, newBalance: number) => Promise<void>
  onToast: (kind: 'success' | 'error', message: string) => void
}

const POPULAR_BANKS = [
  { name: 'HDFC Bank', ifsc: 'HDFC0' },
  { name: 'SBI', ifsc: 'SBIN0' },
  { name: 'ICICI Bank', ifsc: 'ICIC0' },
  { name: 'Axis Bank', ifsc: 'UTIB0' },
  { name: 'Kotak', ifsc: 'KKBK0' },
  { name: 'Other Bank', ifsc: '' },
]

export function WithdrawModal({
  walletBalance,
  realUpiId = '',
  realLegalName = '',
  userId,
  onClose,
  onSuccess,
  onToast,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState('')
  const [lastSelectedChip, setLastSelectedChip] = useState<number | 'max' | null>(null)
  const [method, setMethod] = useState<'upi' | 'bank'>('upi')
  const [upiId, setUpiId] = useState(realUpiId)
  const [selectedBank, setSelectedBank] = useState('HDFC Bank')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('HDFC0')
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<{
    amount: number
    destination: string
    utr: string
  } | null>(null)

  const numAmount = parseFloat(amount) || 0
  const isAmountPositive = Number.isFinite(numAmount) && numAmount > 0
  const isAmountOverBalance = numAmount > walletBalance
  const hasValidAmount = isAmountPositive && !isAmountOverBalance

  const isUpiValid = method === 'upi' ? upiId.includes('@') && upiId.trim().length >= 4 : true
  const isBankValid =
    method === 'bank'
      ? accountNumber.trim().length >= 8 && ifscCode.trim().length >= 4
      : true

  const canSubmit = hasValidAmount && (method === 'upi' ? isUpiValid : isBankValid) && !busy

  const handleClose = () => {
    setAmount('')
    setLastSelectedChip(null)
    setReceipt(null)
    onClose()
  }

  const handleChipPick = (val: number) => {
    triggerHaptic(50)
    setLastSelectedChip(val)
    const current = parseFloat(amount) || 0
    const next = current + val
    setAmount(String(next))
  }

  const handleMaxPick = () => {
    triggerHaptic(50)
    setLastSelectedChip('max')
    setAmount(String(walletBalance))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    unlockAudioEngine()
    event.preventDefault()

    if (!supabase) {
      onToast('error', 'Wallet connection is not available.')
      return
    }

    if (!isAmountPositive) {
      onToast('error', 'Enter a valid withdrawal amount.')
      return
    }

    if (isAmountOverBalance) {
      onToast('error', `Exceeds available balance (₹${walletBalance.toLocaleString('en-IN')}).`)
      return
    }

    if (method === 'upi' && !isUpiValid) {
      onToast('error', 'Enter a valid destination UPI ID (e.g. name@okaxis).')
      return
    }

    if (method === 'bank' && !isBankValid) {
      if (accountNumber.trim().length < 8) {
        onToast('error', 'Account number must be at least 8 digits.')
      } else {
        onToast('error', 'Enter a valid 11-character IFSC code.')
      }
      return
    }

    const last4 = accountNumber.trim().slice(-4)
    const destinationLabel =
      method === 'upi' ? upiId.trim() : `${selectedBank} ••••${last4 || '••••'}`

    const simUtr = '6294' + Math.floor(10000000 + Math.random() * 90000000)

    setBusy(true)
    try {
      let updatedBalance = Math.max(0, walletBalance - numAmount)

      // 1. Try atomic database RPC
      const { data, error } = await supabase.rpc('simulate_wallet_withdrawal', {
        p_amount: numAmount,
        p_destination: destinationLabel,
        p_method: method,
        p_utr: simUtr,
      })

      if (!error && data) {
        const res = data as { wallet_balance?: number | string }
        if (res.wallet_balance !== undefined) {
          updatedBalance = Number(res.wallet_balance)
        }
      } else {
        // Fallback for environments where RPC is deploying: update table directly
        await supabase
          .from('users')
          .update({ wallet_balance: updatedBalance })
          .eq('id', userId)

        try {
          await supabase.from('transactions').insert({
            sender_id: userId,
            receiver_id: userId,
            amount_inr: numAmount,
            sender_name: `Nodal Payout · ${destinationLabel}`,
            status: 'completed',
          })
        } catch {
          // Gracefully continue even if transaction table constraint varies
        }
      }

      playChaChingSound()
      triggerHaptic(80)

      setReceipt({
        amount: numAmount,
        destination: destinationLabel,
        utr: simUtr,
      })

      await onSuccess(numAmount, updatedBalance)
      onToast('success', `Settled ₹${numAmount.toLocaleString('en-IN')} to ${destinationLabel}.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Withdrawal failed. Please try again.'
      onToast('error', msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <GPModal
      title="Withdraw to bank"
      subtitle="Instant nodal escrow settlement · Zero alias exposure"
      onClose={handleClose}
      disabled={busy}
    >
      {receipt ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '8px 2px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#10B981',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span>Nodal Settlement Complete</span>
          </div>

          <div
            className="text-hero"
            style={{ fontSize: '36px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}
          >
            ₹{receipt.amount.toLocaleString('en-IN')}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-muted, #94a3b8)', margin: '0 0 20px' }}>
            Transferred to <strong style={{ color: 'var(--text-primary)' }}>{receipt.destination}</strong>
          </p>

          <div
            className="surface-inset"
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              textAlign: 'left',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>IMPS Reference</span>
              <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                UTR #{receipt.utr}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Settlement rail</span>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>GhostPay Nodal IMPS</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status</span>
              <span style={{ fontWeight: 600, color: '#10B981' }}>Settled</span>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', margin: '0 0 20px', lineHeight: 1.4 }}>
            Routed via GhostPay Nodal Escrow — your @handle was never exposed to the receiving bank.
          </p>

          <GPButton
            variant="primary"
            onClick={handleClose}
            style={{ width: '100%' }}
          >
            Done
          </GPButton>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="gp-label" style={{ margin: 0 }}>
                Amount (₹)
              </label>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8' }}>
                Available: ₹{walletBalance.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="gp-field">
              <span className="gp-field-prefix">₹</span>
              <input
                className="gp-input"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                disabled={busy}
                onChange={(e) => {
                  setLastSelectedChip(null)
                  setAmount(e.target.value.replace(/[^\d.]/g, ''))
                }}
              />
              {Boolean(amount && String(amount).trim().length > 0) && (
                <button
                  type="button"
                  className="gp-clear-btn"
                  onClick={() => {
                    setAmount('')
                    setLastSelectedChip(null)
                  }}
                  aria-label="Clear amount"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="gp-chips">
              {[500, 1000, 2000].map((val) => (
                <button
                  key={val}
                  type="button"
                  disabled={busy}
                  className="gp-chip"
                  data-selected={lastSelectedChip === val}
                  onClick={() => handleChipPick(val)}
                >
                  +₹{val.toLocaleString('en-IN')}
                </button>
              ))}
              <button
                type="button"
                disabled={busy || walletBalance <= 0}
                className="gp-chip"
                data-selected={lastSelectedChip === 'max'}
                onClick={handleMaxPick}
                style={{ fontWeight: 600 }}
              >
                Max
              </button>
            </div>

            {isAmountOverBalance && (
              <p className="gp-hint" style={{ color: '#f87171', marginTop: '8px' }}>
                Exceeds available wallet balance (₹{walletBalance.toLocaleString('en-IN')})
              </p>
            )}
          </div>

          {/* 2-Column Payout Destination Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', margin: '4px 0' }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                triggerHaptic(30)
                setMethod('upi')
              }}
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
              <span style={{ fontSize: '13px', fontWeight: 500 }}>⚡ UPI ID</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                triggerHaptic(30)
                setMethod('bank')
              }}
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
              <span style={{ fontSize: '13px', fontWeight: 500 }}>🏦 Bank account</span>
            </button>
          </div>

          {/* Destination Form Fields */}
          {method === 'upi' ? (
            <div className="gp-section">
              <label className="gp-label">Destination UPI ID</label>
              <div className="gp-field">
                <input
                  className="gp-input"
                  placeholder="username@okaxis"
                  value={upiId}
                  disabled={busy}
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  onChange={(e) => {
                    const normalized = e.target.value.replace(/[\u2013\u2014]/g, '-')
                    setUpiId(normalized)
                  }}
                />
              </div>
              <p className="gp-hint">Instant settlement to any verified Indian UPI address</p>
            </div>
          ) : (
            <>
              <div className="gp-section">
                <label className="gp-label">Choose your bank</label>
                <div className="gp-bank-pills">
                  {POPULAR_BANKS.map((b) => (
                    <button
                      key={b.name}
                      type="button"
                      disabled={busy}
                      className="gp-bank-pill"
                      data-selected={selectedBank === b.name}
                      onClick={() => {
                        triggerHaptic(40)
                        setSelectedBank(b.name)
                        if (b.ifsc) setIfscCode(b.ifsc)
                      }}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gp-section">
                <label className="gp-label">Account number</label>
                <div className="gp-field">
                  <input
                    className="gp-input"
                    placeholder="Enter bank account number"
                    inputMode="numeric"
                    maxLength={18}
                    value={accountNumber}
                    disabled={busy}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              <div className="gp-section">
                <label className="gp-label">IFSC Code</label>
                <div className="gp-field">
                  <input
                    className="gp-input"
                    placeholder="IFSC Code (e.g. HDFC0001234)"
                    maxLength={11}
                    value={ifscCode}
                    disabled={busy}
                    spellCheck={false}
                    autoCapitalize="characters"
                    onChange={(e) =>
                      setIfscCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                    }
                  />
                </div>
                <p className="gp-hint" style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                  Beneficiary: {realLegalName || 'Verified Account Holder'} · Settled via GhostPay Nodal Escrow
                </p>
              </div>
            </>
          )}

          <GPButton
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            icon={busy ? <SpinnerIcon size={16} /> : undefined}
            style={{ marginTop: '8px' }}
          >
            {busy ? (
              <span>Settling via Nodal Escrow...</span>
            ) : hasValidAmount ? (
              <span>Withdraw {formatMoneyParts(numAmount).full} instantly</span>
            ) : (
              <span>Enter amount to withdraw</span>
            )}
          </GPButton>
        </form>
      )}
    </GPModal>
  )
}
