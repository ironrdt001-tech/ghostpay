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
  const maxBarHeight = 78

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

      {/* Stacked 2-row layout that never overflows on mobile */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '12px',
          backgroundColor: 'var(--bg-inset, rgba(148, 163, 184, 0.1))',
          border: '1px solid var(--border-subtle, rgba(148, 163, 184, 0.18))',
          borderRadius: '14px',
          padding: '14px',
          marginBottom: 'var(--space-4)',
        }}
      >
        {/* Left box: Received */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Received</div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#10B981',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            +{recParts.full}
          </div>
        </div>

        {/* Right box: Sent */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Sent</div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#F43F5E',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            -{sentParts.full}
          </div>
        </div>

        {/* Bottom row: Net flow */}
        <div
          style={{
            gridColumn: '1 / -1',
            borderTop: '1px solid var(--border-subtle, rgba(148, 163, 184, 0.18))',
            paddingTop: '10px',
            marginTop: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '12px', opacity: 0.7 }}>Net flow</span>
          <span
            className="tabular-nums"
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: netFlow >= 0 ? '#10B981' : '#F43F5E',
            }}
          >
            {netFlow >= 0 ? '+' : '-'}{netParts.full}
          </span>
        </div>
      </div>

      {/* Structured Track Pills Bar Chart */}
      <div
        className="cashflow-bars-container"
        role="img"
        aria-label="Dual bar chart showing daily received and sent totals over the last seven days"
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '148px', paddingTop: 'var(--space-2)', gap: '8px' }}
      >
        {sevenDayData.map(day => {
          const dayVolume = Number(day.received || 0) + Number(day.sent || 0)
          const recHeight = day.received > 0 ? Math.max(Math.round((day.received / maxDayValue) * maxBarHeight), 8) : 6
          const sentHeight = day.sent > 0 ? Math.max(Math.round((day.sent / maxDayValue) * maxBarHeight), 8) : 6

          return (
            <div
              key={day.key}
              className="chart-day-column"
              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}
            >
              {/* Visible vertical pill track */}
              <div
                style={{
                  height: '108px',
                  width: '100%',
                  backgroundColor: 'rgba(148, 163, 184, 0.12)',
                  borderRadius: '10px',
                  padding: '6px 4px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: '4px',
                  position: 'relative',
                }}
              >
                {dayVolume > 0 && (
                  <span
                    className="tabular-nums"
                    style={{
                      position: 'absolute',
                      top: '5px',
                      left: 0,
                      right: 0,
                      textAlign: 'center',
                      fontSize: '10px',
                      fontWeight: 500,
                      color: 'var(--text-muted, #6B7280)',
                      lineHeight: 1,
                      pointerEvents: 'none',
                    }}
                  >
                    {formatCompactAmount(dayVolume)}
                  </span>
                )}
                <div
                  title={`Received: ₹${day.received.toLocaleString('en-IN')}`}
                  style={{
                    width: '8px',
                    borderRadius: '999px',
                    height: `${recHeight}px`,
                    backgroundColor: day.received > 0 ? '#10B981' : 'rgba(148, 163, 184, 0.35)',
                    minHeight: '6px',
                    transition: 'height 240ms ease',
                  }}
                />
                <div
                  title={`Sent: ₹${day.sent.toLocaleString('en-IN')}`}
                  style={{
                    width: '8px',
                    borderRadius: '999px',
                    height: `${sentHeight}px`,
                    backgroundColor: day.sent > 0 ? '#F43F5E' : 'rgba(148, 163, 184, 0.35)',
                    minHeight: '6px',
                    transition: 'height 240ms ease',
                  }}
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
