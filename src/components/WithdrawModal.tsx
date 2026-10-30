import { useState } from 'react'
import type { FormEvent } from 'react'

import { BankIcon, SpinnerIcon } from './Icons'
import { GPButton, GPModal } from './GhostPayModalKit'
import { playChaChingSound, unlockAudioEngine } from '../lib/audio'
import { formatMoneyParts } from '../lib/formatters'
import { triggerHaptic } from '../lib/haptics'
import { executeWithdrawal } from '../lib/ledgerTransactions'
import { supabase } from '../lib/supabase'
import type { Transaction } from '../lib/types'

interface WithdrawModalProps {
  walletBalance: number
  realUpiId?: string
  realLegalName?: string
  userId: string
  onClose: () => void
  onSuccess: (withdrawnAmount: number, newBalance: number, newTx?: Transaction) => Promise<void> | void
  onToast: (kind: 'success' | 'error', message: string) => void
}

const POPULAR_BANKS = [
  { name: 'HDFC Bank', ifsc: 'HDFC0' },
  { name: 'SBI', ifsc: 'SBIN0' },
  { name: 'ICICI Bank', ifsc: 'ICIC0' },
  { name: 'Axis Bank', ifsc: 'UTIB0' },
  { name: 'Kotak', ifsc: 'KKBK0' },
  { name: 'Other', ifsc: '' },
]

const DEFAULT_BANK_PREFIXES = ['HDFC0', 'SBIN0', 'ICIC0', 'UTIB0', 'KKBK0']

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

  const handleClear = () => {
    setAmount('')
    setLastSelectedChip(null)
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

  const handleBankSelect = (bankName: string, prefix: string) => {
    triggerHaptic(40)
    setSelectedBank(bankName)
    if (!ifscCode || DEFAULT_BANK_PREFIXES.some((p) => ifscCode.startsWith(p))) {
      setIfscCode(prefix)
    }
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
      onToast(
        'error',
        `Amount exceeds available wallet balance (₹${walletBalance.toLocaleString('en-IN')}).`
      )
      return
    }

    if (method === 'upi' && !isUpiValid) {
      onToast('error', 'Enter a valid destination UPI ID (e.g. username@okaxis).')
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
      // Await executeWithdrawal when user confirms the withdrawal transaction
      const withdrawalResult = await executeWithdrawal(userId, numAmount, destinationLabel)
      const updatedBalance = typeof withdrawalResult.newBalance === 'number' && Number.isFinite(withdrawalResult.newBalance) && withdrawalResult.newBalance <= walletBalance - numAmount
        ? withdrawalResult.newBalance
        : Math.max(0, walletBalance - numAmount)
      const newTx = withdrawalResult.transaction || withdrawalResult

      playChaChingSound()
      triggerHaptic(80)

      setReceipt({
        amount: numAmount,
        destination: destinationLabel,
        utr: simUtr,
      })

      // Immediately propagate updated balance and transaction to parent React state
      await onSuccess(numAmount, updatedBalance, newTx)
      onToast('success', `Settled ₹${numAmount.toLocaleString('en-IN')} to ${destinationLabel}.`)
    } catch (err) {
      console.error(err)
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
        <div style={{ position: 'relative', width: '100%' }}>
          {/* Subtle Ambient Radial Backlighting */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '280px',
              height: '180px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(59, 130, 246, 0.10) 50%, transparent 70%)',
              filter: 'blur(32px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '8px 2px',
            }}
          >
            {/* Verified Status Pill (No Emojis) */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
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
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  boxShadow: '0 0 6px #10B981',
                }}
              />
              <span>Nodal Settlement Complete</span>
            </div>

            {/* Large Tabular Amount */}
            <div
              className="text-hero tabular-nums"
              style={{
                fontSize: '36px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '4px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              ₹{receipt.amount.toLocaleString('en-IN')}.00
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-muted, #94a3b8)', margin: '0 0 20px' }}>
              Transferred to <strong style={{ color: 'var(--text-primary)' }}>{receipt.destination}</strong>
            </p>

            {/* 3-Row Metadata Summary Card */}
            <div
              className="surface-inset"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                textAlign: 'left',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Destination</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{receipt.destination}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Settlement rail</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>IMPS Nodal Clearing</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>UTR Reference</span>
                <span
                  className="font-mono tabular-nums"
                  style={{ fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
                >
                  #{receipt.utr}
                </span>
              </div>
            </div>

            {/* Privacy Guarantee Line (Zero Em-Dashes) */}
            <p style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', margin: '0 0 20px', lineHeight: 1.4 }}>
              Routed via GhostPay Nodal Escrow · Your @handle was never exposed to the receiving bank.
            </p>

            <GPButton variant="primary" onClick={handleClose} style={{ width: '100%' }}>
              Done
            </GPButton>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            {/* Header row above Amount */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="gp-label" style={{ margin: 0 }}>
                Amount (₹)
              </label>
              <span
                className="tabular-nums"
                style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}
              >
                Available: ₹{walletBalance.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Input with inline Clear button */}
            <div className="gp-field">
              <span className="gp-field-prefix">₹</span>
              <input
                className="gp-input tabular-nums"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                disabled={busy}
                style={{ fontVariantNumeric: 'tabular-nums' }}
                onChange={(e) => {
                  setLastSelectedChip(null)
                  setAmount(e.target.value.replace(/[^\d.]/g, ''))
                }}
              />
              {Boolean(amount && String(amount).trim().length > 0) && (
                <button
                  type="button"
                  className="gp-clear-btn"
                  onClick={handleClear}
                  aria-label="Clear amount"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Chips: Additive + Max */}
            <div className="gp-chips">
              {[500, 1000, 2000].map((val) => (
                <button
                  key={val}
                  type="button"
                  disabled={busy}
                  className="gp-chip tabular-nums"
                  data-selected={lastSelectedChip === val}
                  onClick={() => handleChipPick(val)}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
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
                Amount exceeds available wallet balance (₹{walletBalance.toLocaleString('en-IN')})
              </p>
            )}
          </div>

          {/* 2-Column Payout Rail Selector (Zero Emojis, Crisp 6px Glowing Dot) */}
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
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: method === 'upi' ? '#60a5fa' : '#64748b',
                  boxShadow: method === 'upi' ? '0 0 6px rgba(96, 165, 250, 0.7)' : 'none',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 500 }}>Instant UPI</span>
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
              <BankIcon size={15} strokeWidth={1.75} />
              <span style={{ fontSize: '13px', fontWeight: 500 }}>Bank account</span>
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
                    const normalized = e.target.value.replace(/[\u2013\u2014\u2212]/g, '-')
                    setUpiId(normalized)
                  }}
                />
              </div>
              <p className="gp-hint">Instant settlement to any verified Indian UPI address</p>
            </div>
          ) : (
            <>
              {/* Selectable Bank Pills Row */}
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
                      onClick={() => handleBankSelect(b.name, b.ifsc)}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Account Number Field */}
              <div className="gp-section">
                <label className="gp-label">Account number</label>
                <div className="gp-field">
                  <input
                    className="gp-input tabular-nums"
                    placeholder="Enter bank account number"
                    inputMode="numeric"
                    maxLength={18}
                    value={accountNumber}
                    disabled={busy}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              {/* IFSC Code Field */}
              <div className="gp-section">
                <label className="gp-label">IFSC code</label>
                <div className="gp-field">
                  <input
                    className="gp-input font-mono"
                    placeholder="IFSC code (e.g. HDFC0001234)"
                    maxLength={11}
                    value={ifscCode}
                    disabled={busy}
                    spellCheck={false}
                    autoCapitalize="characters"
                    style={{ letterSpacing: '0.04em' }}
                    onChange={(e) =>
                      setIfscCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                    }
                  />
                </div>
                {/* Beneficiary Trust Line (Zero Em-Dashes) */}
                <p className="gp-hint" style={{ fontSize: '12px', color: '#64748b' }}>
                  Beneficiary: {realLegalName || 'Verified Account Holder'} · Settled via GhostPay Nodal Escrow
                </p>
              </div>
            </>
          )}

          {/* Primary Bottom Blue CTA Button */}
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
