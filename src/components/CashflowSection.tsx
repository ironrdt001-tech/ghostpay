import { formatMoneyParts } from '../lib/formatters'
import type { CashflowDay } from '../lib/types'

interface CashflowSectionProps {
  sevenDayData: CashflowDay[]
  totalReceived: number
  totalSent: number
}

export function CashflowSection({ sevenDayData, totalReceived, totalSent }: CashflowSectionProps) {
  const netFlow = totalReceived - totalSent
  const maxDayValue = Math.max(...sevenDayData.flatMap(day => [day.received, day.sent]), 100)

  const receivedParts = formatMoneyParts(totalReceived)
  const sentParts = formatMoneyParts(totalSent)
  const netParts = formatMoneyParts(Math.abs(netFlow))

  return (
    <div className="surface-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div>
          <h2 className="text-section-title">7-day cashflow</h2>
          <p className="text-secondary" style={{ marginTop: '2px' }}>
            Completed money received and sent
          </p>
        </div>
      </div>

      {/* Typographic Ledger Strip (Replaces 3 giant equal stat boxes) */}
      <div className="cashflow-strip surface-inset">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Received</span>
          <span className="tabular-nums" style={{ color: 'var(--semantic-credit-text)', fontWeight: 500 }}>
            +{receivedParts.full}
          </span>
        </div>
        <div style={{ color: 'var(--border-strong)' }}>·</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Sent</span>
          <span className="tabular-nums" style={{ color: 'var(--semantic-debit-text)', fontWeight: 500 }}>
            -{sentParts.full}
          </span>
        </div>
        <div style={{ color: 'var(--border-strong)' }}>·</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Net flow</span>
          <span
            className="tabular-nums"
            style={{
              color: netFlow >= 0 ? 'var(--semantic-credit-text)' : 'var(--semantic-debit-text)',
              fontWeight: 500,
            }}
          >
            {netFlow >= 0 ? '+' : '-'}{netParts.full}
          </span>
        </div>
      </div>

      {/* Dual Bar Chart */}
      <div className="cashflow-bars-container" role="img" aria-label="Dual bar chart showing daily received and sent totals over the last seven days">
        {sevenDayData.map(day => {
          const recHeight = day.received > 0 ? Math.max(Math.round((day.received / maxDayValue) * 88), 6) : 3
          const sentHeight = day.sent > 0 ? Math.max(Math.round((day.sent / maxDayValue) * 88), 6) : 3

          return (
            <div key={day.key} className="chart-day-column">
              <div className="chart-bars-track">
                <div
                  title={`Received: ₹${day.received.toLocaleString('en-IN')}`}
                  className={`chart-bar ${day.received > 0 ? 'credit' : 'empty'}`}
                  style={{ height: `${recHeight}px` }}
                />
                <div
                  title={`Sent: ₹${day.sent.toLocaleString('en-IN')}`}
                  className={`chart-bar ${day.sent > 0 ? 'debit' : 'empty'}`}
                  style={{ height: `${sentHeight}px` }}
                />
              </div>
              <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>{day.dayName}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{day.dateLabel}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
