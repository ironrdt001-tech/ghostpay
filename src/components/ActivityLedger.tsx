import { useState, useMemo } from 'react'
import { formatMoneyParts, formatIstTime, groupTransactionsByDate } from '../lib/formatters'
import { ArrowIncomingIcon, ArrowOutgoingIcon, SearchIcon } from './Icons'
import type { Transaction } from '../lib/types'

interface ActivityLedgerProps {
  transactions: Transaction[]
  activeFilter: 'all' | 'received' | 'sent'
  onChangeFilter: (filter: 'all' | 'received' | 'sent') => void
  onSelectTx: (tx: Transaction) => void
  busy?: boolean
}

export function ActivityLedger({
  transactions,
  activeFilter,
  onChangeFilter,
  onSelectTx,
  busy = false,
}: ActivityLedgerProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTransactions = useMemo(() => {
    let list = transactions

    if (activeFilter === 'received') {
      list = list.filter(tx => tx.direction === 'received')
    } else if (activeFilter === 'sent') {
      list = list.filter(tx => tx.direction === 'sent')
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
  }, [transactions, activeFilter, searchQuery])

  const grouped = useMemo(() => {
    return groupTransactionsByDate(filteredTransactions)
  }, [filteredTransactions])

  return (
    <div className="surface-card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: 'var(--space-6) var(--space-6) var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 className="text-section-title">Recent activity</h2>
            <p className="text-secondary" style={{ marginTop: '2px' }}>
              Your incoming and outgoing GhostPay settlements
            </p>
          </div>

          {/* Segmented Filter Pills */}
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
            {searchQuery ? 'Try clearing your search query.' : 'Share your payment link to receive your first payment.'}
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
