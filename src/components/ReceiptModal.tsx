import { useEffect } from 'react'
import { formatMoneyParts, generateUtrNumber, formatIstDateTime } from '../lib/formatters'
import { CloseIcon, CopyIcon, ArrowIncomingIcon, ArrowOutgoingIcon } from './Icons'
import type { Transaction } from '../lib/types'

interface ReceiptModalProps {
  tx: Transaction
  onClose: () => void
  onToast: (kind: 'success' | 'error', message: string) => void
}

export function ReceiptModal({ tx, onClose, onToast }: ReceiptModalProps) {
  const isReceived = tx.direction === 'received'
  const parts = formatMoneyParts(tx.amount_inr)
  const utr = `GP${generateUtrNumber(tx)}`
  const isTopUp = Boolean(
    (tx.sender_name && /top-?up/i.test(tx.sender_name)) ||
    (tx.counterpartyLabel && /top-?up/i.test(tx.counterpartyLabel))
  )
  const isPrivateRoute = Boolean(
    tx.sender_id?.startsWith('#') ||
    tx.receiver_id?.startsWith('#') ||
    tx.sender_alias?.startsWith('#') ||
    tx.counterpartyLabel?.startsWith('#') ||
    tx.counterpartyUserId?.startsWith('#') ||
    tx.type === 'shielded' ||
    tx.type === 'shielded_link' ||
    Boolean(tx.isNodal) ||
    (!isTopUp && !tx.sender_id)
  )
  const isInternal = Boolean(tx.sender_id && !isPrivateRoute)
  const rawName = (tx.counterpartyLabel || tx.sender_name || tx.sender_alias || '').trim()
  let counterparty = rawName || 'GhostPay User'
  if (isPrivateRoute) {
    if (counterparty.startsWith('#')) {
      // already prefixed
    } else {
      const clean = counterparty.replace(/^@+/, '').trim()
      const lower = clean.toLowerCase()
      if (!clean || lower === 'anonymous' || lower === 'anonymous sender' || lower === 'ghostpay user' || clean.includes(' ')) {
        counterparty = '#HiddenSender'
      } else {
        counterparty = `#${clean}`
      }
    }
  }
  const railName = isTopUp ? 'Wallet top-up' : isInternal ? 'GhostPay Internal P2P' : 'Shielded Nodal Escrow'
  const dateFormatted = formatIstDateTime(tx.created_at)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleShareOrCopy() {
    const text = `GhostPay Verified Receipt\nAmount: ${isReceived ? '+' : '-'}${parts.full}\n${isReceived ? 'From' : 'To'}: ${counterparty}\nUTR: ${utr}\nRail: ${railName}\nTimestamp: ${dateFormatted}\nStatus: Settled`

    try {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if (isMobile && navigator.share) {
        await navigator.share({ title: 'GhostPay payment receipt', text })
        onToast('success', 'Receipt shared.')
      } else {
        await navigator.clipboard.writeText(text)
        onToast('success', `Receipt and UTR (${utr}) copied to clipboard.`)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      onToast('error', 'Could not copy receipt.')
    }
  }

  return (
    <div
      className="modal-scrim"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="modal-sheet no-scrollbar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-dialog-title"
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Transaction receipt
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            style={{ width: '32px', height: '32px' }}
            aria-label="Close receipt"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <div style={{ textAlign: 'center', margin: 'var(--space-2) 0 var(--space-5)' }}>
          <div
            className={`ledger-icon-circle ${isReceived ? 'credit' : 'debit'}`}
            style={{ width: '48px', height: '48px', margin: '0 auto var(--space-3)' }}
          >
            {isReceived ? <ArrowIncomingIcon size={20} strokeWidth={2} /> : <ArrowOutgoingIcon size={20} strokeWidth={2} />}
          </div>

          <div
            className="text-hero tabular-nums"
            style={{
              color: isReceived ? 'var(--semantic-credit-text)' : 'var(--semantic-debit-text)',
              marginBottom: 'var(--space-1)',
            }}
          >
            {isReceived ? '+' : '-'}{parts.full}
          </div>

          <p className="text-secondary" style={{ fontSize: '14px' }}>
            {isReceived ? 'Received from ' : 'Sent to '}
            <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{counterparty}</strong>
          </p>
        </div>

        {/* Status Timeline */}
        <div className="status-timeline">
          <div className="status-step complete">
            <span className="status-step-dot" />
            <span>Initiated</span>
          </div>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--semantic-credit-text)', margin: '0 8px', marginTop: '-14px' }} />
          <div className="status-step complete">
            <span className="status-step-dot" />
            <span>Escrow verified</span>
          </div>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--semantic-credit-text)', margin: '0 8px', marginTop: '-14px' }} />
          <div className="status-step complete">
            <span className="status-step-dot" />
            <span>Settled</span>
          </div>
        </div>

        {/* Ledger Details */}
        <div
          className="surface-inset"
          style={{
            padding: 'var(--space-4)',
            margin: 'var(--space-5) 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <span style={{ color: 'var(--text-muted)' }}>UTR reference</span>
            <span className="font-mono tabular-nums" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
              {utr}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Timestamp</span>
            <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {dateFormatted}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Payment rail</span>
            <span style={{ color: 'var(--text-primary)' }}>
              {railName}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Status</span>
            <span style={{ color: 'var(--semantic-credit-text)', fontWeight: 500 }}>
              Settled
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleShareOrCopy}
          className="btn-primary btn-full"
        >
          <CopyIcon size={15} />
          <span>Copy receipt & UTR</span>
        </button>
      </section>
    </div>
  )
}
