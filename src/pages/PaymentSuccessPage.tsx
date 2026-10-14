import { useState } from 'react'
import { useSearchParams, useLocation, Link } from 'react-router-dom'
import { formatMoneyParts, formatIstDateTime } from '../lib/formatters'
import { Brand } from '../components/Brand'
import { CheckIcon, DownloadIcon, ArrowRightIcon } from '../components/Icons'

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const receiptState = location.state as {
    amount?: number
    alias?: string
    senderAlias?: string
    paymentMode?: 'wallet' | 'simulated'
    transactionId?: string
  } | null

  const isWallet = receiptState?.paymentMode === 'wallet'
  const amount = Number(receiptState?.amount ?? searchParams.get('amount'))
  const alias = receiptState?.alias ?? searchParams.get('alias') ?? 'creator'
  const senderAlias = receiptState?.senderAlias?.trim() || 'Anonymous'

  const [receiptDate] = useState(() => new Date().toISOString())
  const [generatedTxId] = useState(() => `GP${Math.floor(100000000000 + Math.random() * 900000000000)}`)
  const transactionId = receiptState?.transactionId ? `GP${receiptState.transactionId.replace(/-/g, '').slice(0, 10).toUpperCase()}` : generatedTxId

  const parts = formatMoneyParts(amount)
  const formattedDate = formatIstDateTime(receiptDate)

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-canvas)', paddingBottom: 'var(--space-12)' }}>
      <header
        style={{
          height: '64px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-6)',
        }}
      >
        <Brand />
        <span style={{ fontSize: '12px', color: 'var(--semantic-credit-text)', fontWeight: 500 }}>
          Payment verified
        </span>
      </header>

      <div style={{ maxWidth: '440px', margin: 'var(--space-8) auto', padding: '0 var(--space-4)' }}>
        {/* Receipt Card */}
        <article className="surface-card" style={{ padding: 'var(--space-6)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'var(--semantic-credit-tint)',
                color: 'var(--semantic-credit-text)',
                margin: '0 auto var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckIcon size={24} strokeWidth={2.2} />
            </div>

            <div className="text-hero tabular-nums" style={{ color: 'var(--semantic-credit-text)', marginBottom: '4px' }}>
              +{parts.full}
            </div>

            <h1 className="text-section-title" style={{ fontSize: '18px', marginBottom: '2px' }}>
              {isWallet ? 'Wallet transfer completed' : 'Payment simulation completed'}
            </h1>
            <p className="text-secondary" style={{ fontSize: '13px' }}>
              Paid to @{alias.replace(/^@+/, '')}
            </p>
          </div>

          <div
            className="surface-inset"
            style={{
              padding: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              fontSize: '13px',
              marginBottom: 'var(--space-5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <span style={{ color: 'var(--text-muted)' }}>From</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{senderAlias}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <span style={{ color: 'var(--text-muted)' }}>To</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>@{alias.replace(/^@+/, '')}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Date &amp; Time</span>
              <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{formattedDate}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <span style={{ color: 'var(--text-muted)' }}>UTR reference</span>
              <span className="font-mono tabular-nums" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {transactionId}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Payment rail</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {isWallet ? 'GhostPay Internal P2P' : 'Shielded Nodal Escrow'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary btn-full"
            >
              <DownloadIcon size={15} />
              <span>Download receipt</span>
            </button>

            <Link to="/dashboard" className="btn-primary btn-full">
              <span>Return to dashboard</span>
              <ArrowRightIcon size={15} strokeWidth={2} />
            </Link>
          </div>
        </article>
      </div>
    </main>
  )
}
