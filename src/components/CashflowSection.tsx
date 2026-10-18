import { formatMoneyParts } from '../lib/formatters'
import type { CashflowDay } from '../lib/types'

interface CashflowSectionProps {
  sevenDayData: CashflowDay[]
  totalReceived: number
  totalSent: number
}

function formatCompactAmount(amt: number): string {
  if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(1)}Cr`
  if (amt >= 100000) return `₹${(amt / 100000).toFixed(1)}L`
  if (amt >= 1000) return `₹${(amt / 1000).toFixed(1)}k`
  return `₹${Math.round(amt).toLocaleString('en-IN')}`
}

export function CashflowSection({ sevenDayData }: CashflowSectionProps) {
  // Dynamically compute the 7-day metrics from the user's real transactions array
  const sevenDayReceived = sevenDayData.reduce((sum, d) => sum + Number(d.received || 0), 0)
  const sevenDaySent = sevenDayData.reduce((sum, d) => sum + Number(d.sent || 0), 0)
  const netFlow = sevenDayReceived - sevenDaySent

  const maxDayValue = Math.max(...sevenDayData.flatMap(day => [day.received, day.sent]), 100)
  const maxBarHeight = 82

  const recParts = formatMoneyParts(sevenDayReceived)
  const sentParts = formatMoneyParts(sevenDaySent)
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

      {/* Responsive Metrics Grid */}
      <div className="cashflow-metrics-grid">
        {/* Item 1: Received */}
        <div className="cashflow-metric-cell">
          <span className="cashflow-metric-label">Received</span>
          <span className="cashflow-metric-value" style={{ color: 'var(--semantic-credit-text)' }}>
            +{recParts.full}
          </span>
        </div>

        {/* Item 2: Sent */}
        <div className="cashflow-metric-cell">
          <span className="cashflow-metric-label">Sent</span>
          <span className="cashflow-metric-value" style={{ color: 'var(--semantic-debit-text)' }}>
            -{sentParts.full}
          </span>
        </div>

        {/* Item 3: Full-width bottom row on mobile / 3rd column on desktop */}
        <div className="cashflow-metric-cell net-row">
          <span className="cashflow-metric-label">Net cashflow (7d)</span>
          <span
            className="cashflow-metric-value"
            style={{
              color: netFlow >= 0 ? 'var(--semantic-credit-text)' : 'var(--semantic-debit-text)',
            }}
          >
            {netFlow >= 0 ? '+' : '-'}{netParts.full}
          </span>
        </div>
      </div>

      {/* Structured Track Pills Bar Chart */}
      <div className="cashflow-bars-container" role="img" aria-label="Dual bar chart showing daily received and sent totals over the last seven days">
        {sevenDayData.map(day => {
          const dayVolume = Number(day.received || 0) + Number(day.sent || 0)
          const recHeight = day.received > 0 ? Math.max(Math.round((day.received / maxDayValue) * maxBarHeight), 8) : 6
          const sentHeight = day.sent > 0 ? Math.max(Math.round((day.sent / maxDayValue) * maxBarHeight), 8) : 6

          return (
            <div key={day.key} className="chart-day-column">
              <div className="chart-day-track-pill">
                {dayVolume > 0 && (
                  <span className="chart-day-amount-badge">
                    {formatCompactAmount(dayVolume)}
                  </span>
                )}
                <div
                  title={`Received: ₹${day.received.toLocaleString('en-IN')}`}
                  className={`chart-day-pill-bar ${day.received > 0 ? 'credit' : 'empty'}`}
                  style={{ height: `${recHeight}px` }}
                />
                <div
                  title={`Sent: ₹${day.sent.toLocaleString('en-IN')}`}
                  className={`chart-day-pill-bar ${day.sent > 0 ? 'debit' : 'empty'}`}
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
