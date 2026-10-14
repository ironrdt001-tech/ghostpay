import { formatMoneyParts } from '../lib/formatters'
import { EyeIcon, EyeOffIcon } from './Icons'

interface BalanceHeaderProps {
  balance: number
  hideBalance: boolean
  onToggleHideBalance: () => void
  onOpenTopUp: () => void
  busy?: boolean
}

export function BalanceHeader({
  balance,
  hideBalance,
  onToggleHideBalance,
  onOpenTopUp,
  busy = false,
}: BalanceHeaderProps) {
  const parts = formatMoneyParts(balance)

  return (
    <div className="surface-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--semantic-credit-text)' }} />
          <span>Available balance</span>
        </div>
        <button
          type="button"
          onClick={onOpenTopUp}
          className="btn-secondary"
          style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px', borderRadius: 'var(--radius-pill)', color: 'var(--semantic-credit-text)', borderColor: 'var(--border-subtle)' }}
        >
          + Add money
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div className="text-hero tabular-nums" style={{ userSelect: 'none' }}>
          {hideBalance ? (
            <span style={{ letterSpacing: '0.08em' }}>₹••••••</span>
          ) : busy ? (
            <span style={{ opacity: 0.4 }}>₹...</span>
          ) : (
            <span className="split-amount">
              <span className="split-amount-currency">{parts.currency}</span>
              <span className="split-amount-integer">{parts.integer}</span>
              <span className="split-amount-decimal">{parts.decimal}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleHideBalance}
          className="btn-icon"
          title={hideBalance ? 'Show balance' : 'Hide balance'}
          aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
        >
          {hideBalance ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
        </button>
      </div>
    </div>
  )
}
