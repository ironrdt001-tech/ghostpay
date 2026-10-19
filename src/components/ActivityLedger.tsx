import { useState, useMemo, useEffect } from 'react'
import { formatMoneyParts, formatCompactRupee, formatIstTime, groupTransactionsByDate } from '../lib/formatters'
import { ArrowIncomingIcon, ArrowOutgoingIcon, SearchIcon, ChevronDownIcon } from './Icons'
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

function formatTransactionCounterparty(tx: Transaction): { displayName: string; isOneWay: boolean } {
  const counterpartId = (tx.direction === 'sent'
    ? (tx.receiver_id || tx.counterpartyUserId)
    : (tx.sender_id || tx.counterpartyUserId)) || ''

  const isOneWay = Boolean(
    counterpartId.startsWith('#') ||
    (tx.sender_id && tx.sender_id.startsWith('#')) ||
    (tx.receiver_id && tx.receiver_id.startsWith('#')) ||
    (tx.sender_alias && tx.sender_alias.startsWith('#')) ||
    (tx.counterpartyLabel && tx.counterpartyLabel.startsWith('#')) ||
    (tx.counterpartyUserId && tx.counterpartyUserId.startsWith('#')) ||
    (tx.sender_name && tx.sender_name.startsWith('#'))
  )

  const rawName = (
    tx.counterpartyLabel ||
    tx.sender_name ||
    tx.sender_alias ||
    (counterpartId.startsWith('#') ? counterpartId : '') ||
    'GhostPay User'
  ).trim()

  const displayName = isOneWay
    ? (rawName.startsWith('#') ? rawName : `#${rawName.replace(/^@+/, '')}`)
    : rawName

  return { displayName, isOneWay }
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
  dayTransactions: Transaction[]
}

export function ActivityLedger({
  transactions,
  activeFilter,
  onChangeFilter,
  onSelectTx,
  busy = false,
}: ActivityLedgerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null)

  const is7d = activeFilter === '7d'

  const completedTransactions = useMemo(() => {
    return transactions.filter(tx => tx.status === 'completed')
  }, [transactions])

  // Always generate exact last 7 consecutive local calendar days: index 0 = Today down to index 6 = 6 days ago
  const { sevenDaysReverse, todayData, sevenDayTotals } = useMemo(() => {
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
        dayTransactions: dayTxs,
      }
    })

    const today = days[0] || { received: 0, sent: 0 }
    const totalRec = days.reduce((sum, d) => sum + d.received, 0)
    const totalSent = days.reduce((sum, d) => sum + d.sent, 0)

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
    }
  }, [completedTransactions])

  // Collapse accordion when navigating away from 7d
  useEffect(() => {
    if (activeFilter !== '7d') {
      setExpandedDayKey(null)
    }
  }, [activeFilter])

  // Active expanded day object
  const expandedDay = useMemo(() => {
    return expandedDayKey ? sevenDaysReverse.find(d => d.key === expandedDayKey) || null : null
  }, [expandedDayKey, sevenDaysReverse])

  // Summary numbers: selected day > 7-day total > today
  const activeReceived = is7d
    ? (expandedDay ? expandedDay.received : sevenDayTotals.received)
    : todayData.received
  const activeSent = is7d
    ? (expandedDay ? expandedDay.sent : sevenDayTotals.sent)
    : todayData.sent
  const activeNet = activeReceived - activeSent
  const activeVolume = activeReceived + activeSent

  const recParts = formatMoneyParts(activeReceived)
  const sentParts = formatMoneyParts(activeSent)
  const netParts = formatMoneyParts(Math.abs(activeNet))

  // Filtered transactions for the All/Received/Sent statement list
  const filteredTransactions = useMemo(() => {
    if (is7d) return []

    let list = transactions
    if (activeFilter === 'received') {
      list = list.filter(tx => tx.direction === 'received')
    } else if (activeFilter === 'sent') {
      list = list.filter(tx => tx.direction === 'sent')
    }

    const query = searchQuery.trim().toLowerCase()
    if (query) {
      list = list.filter(tx => {
        const { displayName } = formatTransactionCounterparty(tx)
        const counterparty = displayName.toLowerCase()
        const amountStr = String(tx.amount_inr || '')
        return counterparty.includes(query) || amountStr.includes(query)
      })
    }

    return list
  }, [transactions, activeFilter, is7d, searchQuery])

  const grouped = useMemo(() => {
    return groupTransactionsByDate(filteredTransactions)
  }, [filteredTransactions])

  function getTabStyle(tab: ActivityFilter) {
    const isActive = activeFilter === tab
    if (!isActive) return undefined

    if (tab === 'received') {
      return {
        background: 'rgba(16, 185, 129, 0.15)',
        color: '#10B981',
        border: '1px solid rgba(16, 185, 129, 0.25)',
      }
    }
    if (tab === 'sent') {
      return {
        background: 'rgba(244, 63, 94, 0.15)',
        color: '#F43F5E',
        border: '1px solid rgba(244, 63, 94, 0.25)',
      }
    }
    return {
      background: 'rgba(37, 99, 235, 0.15)',
      color: '#3B82F6',
      border: '1px solid rgba(59, 130, 246, 0.4)',
    }
  }

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
              style={getTabStyle('all')}
              onClick={() => onChangeFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'received'}
              className={`segmented-tab ${activeFilter === 'received' ? 'active' : ''}`}
              style={getTabStyle('received')}
              onClick={() => onChangeFilter('received')}
            >
              Received
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'sent'}
              className={`segmented-tab ${activeFilter === 'sent' ? 'active' : ''}`}
              style={getTabStyle('sent')}
              onClick={() => onChangeFilter('sent')}
            >
              Sent
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === '7d'}
              className={`segmented-tab ${activeFilter === '7d' ? 'active' : ''}`}
              style={getTabStyle('7d')}
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
            marginBottom: is7d ? 0 : 'var(--space-4)',
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
                {is7d ? (expandedDay ? expandedDay.dayTitle : 'Last 7 days') : 'Today'}
              </span>
              {is7d && expandedDayKey && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    setExpandedDayKey(null)
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
                ? (expandedDay ? 'Daily breakdown' : `${sevenDaysReverse[6]?.dateLabel || ''} - ${sevenDaysReverse[0]?.dateLabel || ''}`)
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

          {/* 3. 7-day chronological accordion stack inside summary card when on 7 days */}
          {is7d && (
            <div
              style={{
                marginTop: '16px',
                paddingTop: '14px',
                borderTop: '1px solid var(--border-subtle, rgba(148, 163, 184, 0.16))',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {sevenDaysReverse.map(day => {
                const isActive = day.txnCount > 0
                const isExpanded = expandedDayKey === day.key
                const dayNet = day.received - day.sent
                const dayNetParts = formatMoneyParts(Math.abs(dayNet))

                if (isActive) {
                  return (
                    <div
                      key={day.key}
                      style={{
                        borderRadius: '12px',
                        background: isExpanded ? 'rgba(37, 99, 235, 0.08)' : 'rgba(148, 163, 184, 0.05)',
                        border: isExpanded ? '1px solid var(--accent-primary, #2563EB)' : '1px solid transparent',
                        overflow: 'hidden',
                        transition: 'background-color 160ms ease, border-color 160ms ease',
                      }}
                    >
                      {/* Day Header Row */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedDayKey(prev => (prev === day.key ? null : day.key))}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setExpandedDayKey(prev => (prev === day.key ? null : day.key))
                          }
                        }}
                        style={{
                          position: 'sticky',
                          top: '0px',
                          zIndex: 20,
                          backdropFilter: 'blur(16px)',
                          WebkitBackdropFilter: 'blur(16px)',
                          backgroundColor: isExpanded ? 'rgba(15, 23, 42, 0.85)' : 'transparent',
                          borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                        title={`${day.dayTitle} · Click to ${isExpanded ? 'collapse' : 'expand'} transactions`}
                      >
                        {/* Left column */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {day.dayTitle}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {day.txnCount === 1 ? '1 txn' : `${day.txnCount} txns`}
                          </div>
                        </div>

                        {/* Right column: Single clean Net Flow + chevron */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div
                              className="tabular-nums"
                              style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: dayNet >= 0 ? '#10B981' : '#F43F5E',
                                fontVariantNumeric: 'tabular-nums',
                                lineHeight: 1.25,
                              }}
                            >
                              {dayNet >= 0 ? '+' : '-'}{dayNetParts.full}
                            </div>
                            {day.received > 0 && day.sent > 0 && (
                              <div
                                className="tabular-nums"
                                style={{
                                  fontSize: '11px',
                                  opacity: 0.6,
                                  marginTop: '2px',
                                  lineHeight: 1.2,
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                +{formatCompactRupee(day.received)} · -{formatCompactRupee(day.sent)}
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isExpanded ? 'var(--accent-primary, #2563EB)' : 'var(--text-muted, #6B7280)',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 200ms ease, color 200ms ease',
                            }}
                          >
                            <ChevronDownIcon size={16} strokeWidth={2.2} />
                          </div>
                        </div>
                      </div>

                      {/* Smooth Animated Dropdown Drawer (0fr -> 1fr grid transition) */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateRows: isExpanded ? '1fr' : '0fr',
                          transition: 'grid-template-rows 0.3s ease-out',
                        }}
                      >
                        <div style={{ overflow: 'hidden', minHeight: 0 }}>
                          <div
                            style={{
                              borderTop: '1px solid var(--border-subtle, rgba(148, 163, 184, 0.18))',
                              padding: '6px 8px',
                              backgroundColor: 'var(--bg-surface, #FFFFFF)',
                              borderBottomLeftRadius: '12px',
                              borderBottomRightRadius: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                            }}
                          >
                            {day.dayTransactions.map(tx => {
                              const isReceived = tx.direction === 'received'
                              const parts = formatMoneyParts(tx.amount_inr)
                              const isTopUp = String(tx.sender_name || '').toLowerCase().includes('top-up') ||
                                String(tx.counterpartyLabel || '').toLowerCase().includes('top-up')
                              const rail = isTopUp ? 'Wallet top-up' : tx.sender_id ? 'Internal P2P' : 'Shielded link'
                              const { displayName: counterparty, isOneWay } = formatTransactionCounterparty(tx)

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
                                  style={{
                                    padding: '8px 10px',
                                    borderRadius: '8px',
                                  }}
                                >
                                  <div className="ledger-item-left">
                                    <div className={`ledger-icon-circle ${isReceived ? 'credit' : 'debit'}`} style={{ width: '32px', height: '32px' }}>
                                      {isReceived ? (
                                        <ArrowIncomingIcon size={14} strokeWidth={2} />
                                      ) : (
                                        <ArrowOutgoingIcon size={14} strokeWidth={2} />
                                      )}
                                    </div>
                                    <div className="ledger-item-info">
                                      <span className="ledger-item-title" style={{ fontSize: '13px' }}>{counterparty}</span>
                                      <div className="ledger-item-subtitle" style={{ fontSize: '11px' }}>
                                        <span className="tabular-nums">{formatIstTime(tx.created_at)}</span>
                                        <span>·</span>
                                        <span className="rail-tag">{rail}</span>
                                        {isOneWay && <span className="one-way-warning">🔒 One-way private route</span>}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="ledger-item-right">
                                    <span className={`ledger-amount ${isReceived ? 'credit' : 'debit'}`} style={{ fontSize: '14px' }}>
                                      {isReceived ? '+' : '-'}{parts.full}
                                    </span>
                                    <span className="ledger-status" style={{ fontSize: '10px' }}>
                                      {tx.status === 'completed' ? (isReceived ? 'Received' : 'Sent') : tx.status.replaceAll('_', ' ')}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }

                // Quiet Days (0 transactions)
                return (
                  <div
                    key={day.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      opacity: 0.5,
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {day.dayTitle}
                    </div>
                    <div
                      className="tabular-nums"
                      style={{
                        textAlign: 'right',
                        fontSize: '12px',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--text-muted)',
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

        {/* Search input - only shown on All, Received, Sent */}
        {!is7d && (
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
        )}
      </div>

      {/* Normal transaction statement list - only shown on All, Received, Sent */}
      {!is7d && (
        busy ? (
          <div style={{ padding: 'var(--space-10) var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading transactions...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div style={{ padding: 'var(--space-10) var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '14px', marginBottom: '4px' }}>No transactions found</p>
            <span style={{ fontSize: '12px' }}>
              {searchQuery
                ? 'Try clearing your search query.'
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
                  const { displayName: counterparty, isOneWay } = formatTransactionCounterparty(tx)

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
                            {isOneWay && <span className="one-way-warning">🔒 One-way private route</span>}
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
        )
      )}
    </div>
  )
}



