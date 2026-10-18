import { useState, useMemo, useEffect } from 'react'
import { formatMoneyParts, formatIstTime, groupTransactionsByDate } from '../lib/formatters'
import { ArrowIncomingIcon, ArrowOutgoingIcon, SearchIcon } from './Icons'
import type { Transaction, ActivityFilter } from '../lib/types'

interface ActivityLedgerProps {
  transactions: Transaction[]
  activeFilter: ActivityFilter
  onChangeFilter: (filter: ActivityFilter) => void
  onSelectTx: (tx: Transaction) => void
  busy?: boolean
}

function getIstDateKey(dateString: string): string {
  try {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
  } catch {
    return ''
  }
}

interface DaySummary {
  key: string
  dayOffset: number
  dayTitle: string
  dayName: string
  dateLabel: string
  received: number
  sent: number
  totalVolume: number
  txnCount: number
}

export function ActivityLedger({
  transactions,
  activeFilter,
  onChangeFilter,
  onSelectTx,
  busy = false,
}: ActivityLedgerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)

  // Clear day selection if user leaves 7d tab
  useEffect(() => {
    if (activeFilter !== '7d') {
      setSelectedDayKey(null)
    }
  }, [activeFilter])

  const completedTransactions = useMemo(() => {
    return transactions.filter(tx => tx.status === 'completed')
  }, [transactions])

  // Always generate exact last 7 consecutive local calendar days: index 0 = Today down to index 6 = 6 days ago
  const { sevenDaysReverse, todayData, sevenDayTotals, max7dTotal } = useMemo(() => {
    const now = new Date()
    const days: DaySummary[] = Array.from({ length: 7 }, (_, index) => {
      const d = new Date(now)
      d.setDate(now.getDate() - index)
      const istKey = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
      const dayName = d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })
      const dateLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })

      let displayTitle: string
      if (index === 0) {
        displayTitle = 'Today'
      } else if (index === 1) {
        displayTitle = 'Yesterday'
      } else {
        displayTitle = `${dayName}, ${dateLabel}`
      }

      const dayTxs = completedTransactions.filter(tx => getIstDateKey(tx.created_at) === istKey)
      const rec = dayTxs.filter(tx => tx.direction === 'received').reduce((sum, tx) => sum + Number(tx.amount_inr || 0), 0)
      const sent = dayTxs.filter(tx => tx.direction === 'sent').reduce((sum, tx) => sum + Number(tx.amount_inr || 0), 0)

      return {
        key: istKey,
        dayOffset: index,
        dayTitle: displayTitle,
        dayName,
        dateLabel,
        received: rec,
        sent: sent,
        totalVolume: rec + sent,
        txnCount: dayTxs.length,
      }
    })

    const today = days[0] || { received: 0, sent: 0 }
    const totalRec = days.reduce((sum, d) => sum + d.received, 0)
    const totalSent = days.reduce((sum, d) => sum + d.sent, 0)
    const maxVolume = Math.max(...days.map(d => d.totalVolume), 1)

    return {
      sevenDaysReverse: days,
      todayData: {
        received: today.received,
        sent: today.sent,
        net: today.received - today.sent,
      },
      sevenDayTotals: {
        received: totalRec,
        sent: totalSent,
        net: totalRec - totalSent,
      },
      max7dTotal: maxVolume,
    }
  }, [completedTransactions])

  const is7d = activeFilter === '7d'

  // Selected day object when user clicks a day row
  const selectedDay = useMemo(() => {
    return selectedDayKey ? sevenDaysReverse.find(d => d.key === selectedDayKey) || null : null
  }, [selectedDayKey, sevenDaysReverse])

  // Summary numbers: selected day > 7-day total > today
  const activeReceived = is7d
    ? (selectedDay ? selectedDay.received : sevenDayTotals.received)
    : todayData.received
  const activeSent = is7d
    ? (selectedDay ? selectedDay.sent : sevenDayTotals.sent)
    : todayData.sent
  const activeNet = activeReceived - activeSent
  const activeVolume = activeReceived + activeSent

  const recParts = formatMoneyParts(activeReceived)
  const sentParts = formatMoneyParts(activeSent)
  const netParts = formatMoneyParts(Math.abs(activeNet))

  // Filtered transaction list
  const filteredTransactions = useMemo(() => {
    let list = transactions

    if (activeFilter === 'received') {
      list = list.filter(tx => tx.direction === 'received')
    } else if (activeFilter === 'sent') {
      list = list.filter(tx => tx.direction === 'sent')
    } else if (activeFilter === '7d') {
      if (selectedDayKey) {
        list = list.filter(tx => getIstDateKey(tx.created_at) === selectedDayKey)
      } else {
        const sevenDayKeys = new Set(sevenDaysReverse.map(d => d.key))
        list = list.filter(tx => sevenDayKeys.has(getIstDateKey(tx.created_at)))
      }
    }

    const query = searchQuery.trim().toLowerCase()
    if (query) {
      list = list.filter(tx => {
        const counterparty = (tx.counterpartyLabel || tx.sender_name || tx.sender_alias || '').toLowerCase()
        const amountStr = String(tx.amount_inr || '')
        return counterparty.includes(query) || amountStr.includes(query)
      })
    }

    return list
  }, [transactions, activeFilter, selectedDayKey, sevenDaysReverse, searchQuery])

  const grouped = useMemo(() => {
    return groupTransactionsByDate(filteredTransactions)
  }, [filteredTransactions])

  return (
    <div className="surface-card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: 'var(--space-6) var(--space-6) var(--space-4)' }}>
        {/* Section Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div>
            <h2 className="text-section-title">Recent activity</h2>
            <p className="text-secondary" style={{ marginTop: '2px' }}>
              Your incoming and outgoing GhostPay settlements
            </p>
          </div>
        </div>

        {/* 1. Locked Segmented Pill Bar directly below header and ABOVE summary card */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div className="segmented-pill" role="tablist" aria-label="Filter activity">
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'all'}
              className={`segmented-tab ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => onChangeFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'received'}
              className={`segmented-tab ${activeFilter === 'received' ? 'active' : ''}`}
              onClick={() => onChangeFilter('received')}
            >
              Received
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'sent'}
              className={`segmented-tab ${activeFilter === 'sent' ? 'active' : ''}`}
              onClick={() => onChangeFilter('sent')}
            >
              Sent
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === '7d'}
              className={`segmented-tab ${activeFilter === '7d' ? 'active' : ''}`}
              onClick={() => onChangeFilter('7d')}
            >
              7 days
            </button>
          </div>
        </div>

        {/* 2. Unified Cashflow Summary Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: 'var(--space-4)',
          }}
        >
          {/* Top header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 500, opacity: 0.8, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span>
                {is7d ? (selectedDay ? selectedDay.dayTitle : 'Last 7 days') : 'Today'}
              </span>
              {is7d && selectedDayKey && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    setSelectedDayKey(null)
                  }}
                  style={{
                    fontSize: '11px',
                    padding: '1px 7px',
                    borderRadius: '999px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  Show 7d
                </button>
              )}
            </span>
            <span style={{ fontSize: '12px', opacity: 0.55 }}>
              {is7d
                ? (selectedDay ? 'Selected day' : `${sevenDaysReverse[6]?.dateLabel || ''} - ${sevenDaysReverse[0]?.dateLabel || ''}`)
                : 'Daily summary'}
            </span>
          </div>

          {/* 2-column metrics row: Money in & Money out */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '12px',
            }}
          >
            {/* Left: Money in */}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Money in</div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: '16px',
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

            {/* Right: Money out */}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Money out</div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: '16px',
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
          </div>

          {/* Bottom hairline row: Net flow + 6px proportional split bar */}
          <div
            style={{
              borderTop: '1px solid var(--border-subtle, rgba(148, 163, 184, 0.18))',
              paddingTop: '10px',
              marginTop: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', opacity: 0.7 }}>Net flow</span>
              <span
                className="tabular-nums"
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: activeNet >= 0 ? '#10B981' : '#F43F5E',
                }}
              >
                {activeNet >= 0 ? '+' : '-'}{netParts.full}
              </span>
            </div>

            {/* Proportional 6px split bar */}
            <div
              style={{
                display: 'flex',
                width: '100%',
                height: '6px',
                borderRadius: '999px',
                overflow: 'hidden',
                backgroundColor: 'rgba(148, 163, 184, 0.18)',
                marginTop: '8px',
              }}
            >
              {activeVolume === 0 ? (
                <div style={{ width: '100%', height: '100%', backgroundColor: 'rgba(148, 163, 184, 0.2)' }} />
              ) : (
                <>
                  {activeReceived > 0 && (
                    <div
                      style={{
                        width: `${(activeReceived / activeVolume) * 100}%`,
                        background: 'linear-gradient(180deg, #34D399 0%, #059669 100%)',
                        height: '100%',
                        transition: 'width 240ms ease',
                      }}
                      title={`Money in: ₹${activeReceived.toLocaleString('en-IN')}`}
                    />
                  )}
                  {activeSent > 0 && (
                    <div
                      style={{
                        width: `${(activeSent / activeVolume) * 100}%`,
                        background: 'linear-gradient(180deg, #FB7185 0%, #E11D48 100%)',
                        height: '100%',
                        transition: 'width 240ms ease',
                      }}
                      title={`Money out: ₹${activeSent.toLocaleString('en-IN')}`}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* 3. All 7 consecutive days in reverse chronological order (Today first down to 6 days ago) */}
          {is7d && (
            <div
              style={{
                marginTop: '16px',
                paddingTop: '14px',
                borderTop: '1px solid var(--border-subtle, rgba(148, 163, 184, 0.16))',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {sevenDaysReverse.map(day => {
                const isActive = day.received > 0 || day.sent > 0
                const isSelected = selectedDayKey === day.key
                const dayTotal = day.received + day.sent
                const fillPercent = Math.max(18, Math.round(Math.sqrt(dayTotal / max7dTotal) * 100))
                const recPercent = dayTotal > 0 ? (day.received / dayTotal) * 100 : 0
                const sentPercent = dayTotal > 0 ? (day.sent / dayTotal) * 100 : 0

                if (isActive) {
                  return (
                    <div
                      key={day.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedDayKey(prev => prev === day.key ? null : day.key)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedDayKey(prev => prev === day.key ? null : day.key)
                        }
                      }}
                      title={`${day.dayTitle}: Money in +₹${day.received.toLocaleString('en-IN')} · Money out -₹${day.sent.toLocaleString('en-IN')} (${day.txnCount} txns)`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        background: isSelected ? 'rgba(37, 99, 235, 0.10)' : 'rgba(148, 163, 184, 0.05)',
                        border: isSelected ? '1px solid var(--accent-primary, #2563EB)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 160ms ease',
                      }}
                    >
                      {/* Left column */}
                      <div style={{ minWidth: '105px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {day.dayTitle}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                          {day.txnCount === 1 ? '1 txn' : `${day.txnCount} txns`}
                        </div>
                      </div>

                      {/* Middle column: 8px horizontal pill track */}
                      <div style={{ flex: 1, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                        <div
                          style={{
                            width: '100%',
                            height: '8px',
                            background: 'rgba(148, 163, 184, 0.14)',
                            borderRadius: '999px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${fillPercent}%`,
                              height: '100%',
                              display: 'flex',
                              borderRadius: '999px',
                              overflow: 'hidden',
                              transition: 'width 240ms ease',
                            }}
                          >
                            {day.received > 0 && (
                              <div
                                style={{
                                  width: `${recPercent}%`,
                                  height: '100%',
                                  backgroundColor: '#10B981',
                                }}
                              />
                            )}
                            {day.sent > 0 && (
                              <div
                                style={{
                                  width: `${sentPercent}%`,
                                  height: '100%',
                                  backgroundColor: '#F43F5E',
                                }}
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right column */}
                      <div
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: '13px',
                          fontWeight: 500,
                          minWidth: '95px',
                          flexShrink: 0,
                        }}
                      >
                        {day.received > 0 && day.sent > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 }}>
                            <span style={{ color: '#10B981' }}>+{formatMoneyParts(day.received).full}</span>
                            <span style={{ color: '#F43F5E', fontSize: '12px' }}>-{formatMoneyParts(day.sent).full}</span>
                          </div>
                        ) : day.received > 0 ? (
                          <span style={{ color: '#10B981' }}>+{formatMoneyParts(day.received).full}</span>
                        ) : (
                          <span style={{ color: '#F43F5E' }}>-{formatMoneyParts(day.sent).full}</span>
                        )}
                      </div>
                    </div>
                  )
                }

                // Quiet Days (dayReceived === 0 && daySent === 0)
                return (
                  <div
                    key={day.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      opacity: 0.55,
                      borderRadius: '8px',
                    }}
                  >
                    {/* Left column */}
                    <div style={{ minWidth: '105px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {day.dayTitle}
                    </div>

                    {/* Middle column */}
                    <div style={{ flex: 1, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '100%', borderBottom: '1px dashed rgba(148, 163, 184, 0.22)' }} />
                    </div>

                    {/* Right column */}
                    <div
                      style={{
                        textAlign: 'right',
                        fontSize: '12px',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--text-muted)',
                        minWidth: '95px',
                        flexShrink: 0,
                      }}
                    >
                      No activity · ₹0.00
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Search input */}
        <div className="input-with-prefix" style={{ marginBottom: 'var(--space-2)' }}>
          <span className="input-prefix">
            <SearchIcon size={16} strokeWidth={2} />
          </span>
          <input
            type="search"
            placeholder="Filter by @handle, name, or amount"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Filter transactions"
          />
        </div>
      </div>

      {busy ? (
        <div style={{ padding: 'var(--space-10) var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading transactions...
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div style={{ padding: 'var(--space-10) var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '14px', marginBottom: '4px' }}>No transactions found</p>
          <span style={{ fontSize: '12px' }}>
            {searchQuery
              ? 'Try clearing your search query.'
              : selectedDayKey
              ? 'No transactions on this selected day. Click "Show 7d" to view all 7 days.'
              : activeFilter === '7d'
              ? 'No transactions recorded in the last 7 days.'
              : 'Share your payment link to receive your first payment.'}
          </span>
        </div>
      ) : (
        <div>
          {grouped.map(group => (
            <div key={group.dateLabel}>
              <div className="ledger-group-header">
                {group.dateLabel}
              </div>
              {group.transactions.map(tx => {
                const isReceived = tx.direction === 'received'
                const parts = formatMoneyParts(tx.amount_inr)
                const isTopUp = String(tx.sender_name || '').toLowerCase().includes('top-up') ||
                  String(tx.counterpartyLabel || '').toLowerCase().includes('top-up')
                const rail = isTopUp ? 'Wallet top-up' : tx.sender_id ? 'Internal P2P' : 'Shielded link'
                const counterparty = tx.counterpartyLabel || tx.sender_name || tx.sender_alias || 'GhostPay User'

                return (
                  <div
                    key={tx.id}
                    className="ledger-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectTx(tx)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectTx(tx)
                      }
                    }}
                    title="View verified UTR receipt"
                  >
                    <div className="ledger-item-left">
                      <div className={`ledger-icon-circle ${isReceived ? 'credit' : 'debit'}`}>
                        {isReceived ? (
                          <ArrowIncomingIcon size={16} strokeWidth={2} />
                        ) : (
                          <ArrowOutgoingIcon size={16} strokeWidth={2} />
                        )}
                      </div>
                      <div className="ledger-item-info">
                        <span className="ledger-item-title">{counterparty}</span>
                        <div className="ledger-item-subtitle">
                          <span className="tabular-nums">{formatIstTime(tx.created_at)}</span>
                          <span>·</span>
                          <span className="rail-tag">{rail}</span>
                        </div>
                      </div>
                    </div>

                    <div className="ledger-item-right">
                      <span className={`ledger-amount ${isReceived ? 'credit' : 'debit'}`}>
                        {isReceived ? '+' : '-'}{parts.full}
                      </span>
                      <span className="ledger-status">
                        {tx.status === 'completed' ? (isReceived ? 'Received' : 'Sent') : tx.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


