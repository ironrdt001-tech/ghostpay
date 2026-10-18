import { useState, useMemo, useEffect } from 'react'
import { formatMoneyParts, formatIstTime, groupTransactionsByDate } from '../lib/formatters'
import { ArrowIncomingIcon, ArrowOutgoingIcon, SearchIcon } from './Icons'
import type { Transaction, ActivityFilter, CashflowDay } from '../lib/types'

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

export function ActivityLedger({
  transactions,
  activeFilter,
  onChangeFilter,
  onSelectTx,
  busy = false,
}: ActivityLedgerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const [hoveredDayKey, setHoveredDayKey] = useState<string | null>(null)

  // Clear day selection if user leaves 7d tab
  useEffect(() => {
    if (activeFilter !== '7d') {
      setSelectedDayKey(null)
      setHoveredDayKey(null)
    }
  }, [activeFilter])

  const completedTransactions = useMemo(() => {
    return transactions.filter(tx => tx.status === 'completed')
  }, [transactions])

  // Compute 7-day breakdown and today's metrics
  const { sevenDays, todayData, sevenDayTotals } = useMemo(() => {
    const now = new Date()
    const days: CashflowDay[] = Array.from({ length: 7 }, (_, index) => {
      const d = new Date(now)
      d.setDate(now.getDate() - (6 - index))
      const istKey = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
      const dayName = d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })
      const dateLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })

      const dayTxs = completedTransactions.filter(tx => getIstDateKey(tx.created_at) === istKey)
      const rec = dayTxs.filter(tx => tx.direction === 'received').reduce((sum, tx) => sum + Number(tx.amount_inr || 0), 0)
      const sent = dayTxs.filter(tx => tx.direction === 'sent').reduce((sum, tx) => sum + Number(tx.amount_inr || 0), 0)

      return {
        key: istKey,
        dayName,
        dateLabel,
        received: rec,
        sent: sent,
      }
    })

    const today = days[6] || { received: 0, sent: 0 }
    const totalRec = days.reduce((sum, d) => sum + d.received, 0)
    const totalSent = days.reduce((sum, d) => sum + d.sent, 0)

    return {
      sevenDays: days,
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
    }
  }, [completedTransactions])

  // Summary strip metrics based on active tab
  const is7d = activeFilter === '7d'
  const activeReceived = is7d ? sevenDayTotals.received : todayData.received
  const activeSent = is7d ? sevenDayTotals.sent : todayData.sent
  const activeNet = is7d ? sevenDayTotals.net : todayData.net
  const activeVolume = activeReceived + activeSent

  const recParts = formatMoneyParts(activeReceived)
  const sentParts = formatMoneyParts(activeSent)
  const netParts = formatMoneyParts(Math.abs(activeNet))

  // Inspected day for 7d chart hover/tap caption
  const inspectedDay = useMemo(() => {
    const targetKey = hoveredDayKey || selectedDayKey
    return targetKey ? sevenDays.find(d => d.key === targetKey) || null : null
  }, [hoveredDayKey, selectedDayKey, sevenDays])

  const maxDayValue = useMemo(() => {
    return Math.max(...sevenDays.flatMap(d => [d.received, d.sent]), 100)
  }, [sevenDays])

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
        const sevenDayKeys = new Set(sevenDays.map(d => d.key))
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
  }, [transactions, activeFilter, selectedDayKey, sevenDays, searchQuery])

  const grouped = useMemo(() => {
    return groupTransactionsByDate(filteredTransactions)
  }, [filteredTransactions])

  return (
    <div className="surface-card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: 'var(--space-6) var(--space-6) var(--space-4)' }}>
        {/* Section Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 className="text-section-title">Recent activity</h2>
            <p className="text-secondary" style={{ marginTop: '2px' }}>
              Your incoming and outgoing GhostPay settlements
            </p>
          </div>
        </div>

        {/* Sleek, compact Cashflow Summary Strip directly below header */}
        <div
          style={{
            backgroundColor: 'var(--bg-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            padding: '14px',
            marginBottom: 'var(--space-4)',
          }}
        >
          {/* Top 2-column grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '12px',
            }}
          >
            {/* Left box: Received */}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>
                {is7d ? '7d received' : 'Today received'}
              </div>
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
              <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>
                {is7d ? '7d sent' : 'Today sent'}
              </div>
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
          </div>

          {/* Bottom hairline row */}
          <div
            style={{
              borderTop: '1px solid var(--border-subtle, rgba(148, 163, 184, 0.18))',
              paddingTop: '10px',
              marginTop: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', opacity: 0.7 }}>
                {is7d ? '7d net flow' : "Today's net flow"}
              </span>
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

            {/* Thin 6px proportional split bar */}
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
                        backgroundColor: '#10B981',
                        height: '100%',
                        transition: 'width 240ms ease',
                      }}
                      title={`Received: ₹${activeReceived.toLocaleString('en-IN')}`}
                    />
                  )}
                  {activeSent > 0 && (
                    <div
                      style={{
                        width: `${(activeSent / activeVolume) * 100}%`,
                        backgroundColor: '#F43F5E',
                        height: '100%',
                        transition: 'width 240ms ease',
                      }}
                      title={`Sent: ₹${activeSent.toLocaleString('en-IN')}`}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Clean Baseline Chart revealed only when 7 days tab is selected */}
        {is7d && (
          <div
            style={{
              backgroundColor: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '14px',
              padding: '14px',
              marginBottom: 'var(--space-4)',
            }}
          >
            {/* Caption right above the chart */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              <span style={{ fontWeight: 500, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span>{inspectedDay ? `${inspectedDay.dayName}, ${inspectedDay.dateLabel}` : '7-day daily settlement'}</span>
                {selectedDayKey && (
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
                    Show all
                  </button>
                )}
              </span>
              <span className="tabular-nums" style={{ fontSize: '12px' }}>
                <span style={{ color: '#10B981', fontWeight: 600 }}>
                  +{formatMoneyParts(inspectedDay ? inspectedDay.received : sevenDayTotals.received).full}
                </span>
                <span style={{ margin: '0 4px', opacity: 0.5 }}>·</span>
                <span style={{ color: '#F43F5E', fontWeight: 600 }}>
                  -{formatMoneyParts(inspectedDay ? inspectedDay.sent : sevenDayTotals.sent).full}
                </span>
              </span>
            </div>

            {/* Minimalist 92px baseline chart */}
            <div
              role="img"
              aria-label="7-day cashflow baseline chart"
              style={{
                height: '92px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: '8px',
                borderBottom: '1px solid var(--border-subtle, rgba(148, 163, 184, 0.25))',
                paddingBottom: '0',
              }}
            >
              {sevenDays.map(day => {
                const isSelected = selectedDayKey === day.key
                const isHovered = hoveredDayKey === day.key
                const isActiveDay = day.received > 0 || day.sent > 0
                const recH = day.received > 0 ? Math.max(Math.round((day.received / maxDayValue) * 76), 6) : 0
                const sentH = day.sent > 0 ? Math.max(Math.round((day.sent / maxDayValue) * 76), 6) : 0

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
                    onMouseEnter={() => setHoveredDayKey(day.key)}
                    onMouseLeave={() => setHoveredDayKey(null)}
                    title={`${day.dayName}, ${day.dateLabel}: +₹${day.received.toLocaleString('en-IN')} / -₹${day.sent.toLocaleString('en-IN')}`}
                    style={{
                      flex: 1,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      cursor: 'pointer',
                      padding: '0 2px',
                      backgroundColor: isSelected
                        ? 'rgba(37, 99, 235, 0.08)'
                        : isHovered
                        ? 'rgba(148, 163, 184, 0.1)'
                        : 'transparent',
                      borderRadius: '6px 6px 0 0',
                      transition: 'background-color 150ms ease',
                    }}
                  >
                    {isActiveDay ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          gap: '4px',
                          width: '100%',
                          height: '100%',
                        }}
                      >
                        {day.received > 0 ? (
                          <div
                            style={{
                              width: '6px',
                              height: `${recH}px`,
                              backgroundColor: '#10B981',
                              borderRadius: '3px 3px 0 0',
                              transition: 'height 200ms ease',
                            }}
                          />
                        ) : (
                          <div style={{ width: '6px', height: '2px', backgroundColor: 'rgba(148, 163, 184, 0.35)', borderRadius: '1px' }} />
                        )}
                        {day.sent > 0 ? (
                          <div
                            style={{
                              width: '6px',
                              height: `${sentH}px`,
                              backgroundColor: '#F43F5E',
                              borderRadius: '3px 3px 0 0',
                              transition: 'height 200ms ease',
                            }}
                          />
                        ) : (
                          <div style={{ width: '6px', height: '2px', backgroundColor: 'rgba(148, 163, 184, 0.35)', borderRadius: '1px' }} />
                        )}
                      </div>
                    ) : (
                      /* Empty days show a single 14px x 2px neutral dash on the baseline */
                      <div
                        style={{
                          width: '14px',
                          height: '2px',
                          backgroundColor: 'var(--border-strong, #CBD5E1)',
                          borderRadius: '1px',
                          marginBottom: '0px',
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Day labels below baseline */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', paddingTop: '6px' }}>
              {sevenDays.map(day => {
                const isSelected = selectedDayKey === day.key
                const isHovered = hoveredDayKey === day.key
                return (
                  <div
                    key={day.key}
                    onClick={() => setSelectedDayKey(prev => prev === day.key ? null : day.key)}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: isSelected || isHovered ? 600 : 500,
                        color: isSelected
                          ? 'var(--accent-primary, #2563EB)'
                          : isHovered
                          ? 'var(--text-primary)'
                          : 'var(--text-secondary)',
                      }}
                    >
                      {day.dayName}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {day.dateLabel}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Segmented Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
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
              ? 'No transactions on this selected day. Click "Show all" to view all 7 days.'
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

