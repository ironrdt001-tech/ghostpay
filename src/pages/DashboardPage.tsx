import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'

import { ActivityLedger } from '../components/ActivityLedger'
import { BalanceHeader } from '../components/BalanceHeader'
import { Brand } from '../components/Brand'
import { EditProfileModal } from '../components/EditProfileModal'
import { CheckIcon, MoonIcon, SunIcon } from '../components/Icons'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { QrScannerModal } from '../components/QrScannerModal'
import { ReceiptModal } from '../components/ReceiptModal'
import { SendMoneyForm } from '../components/SendMoneyForm'
import { ShareQrModal } from '../components/ShareQrModal'
import { ShieldedLinkBar } from '../components/ShieldedLinkBar'
import { TopUpModal } from '../components/TopUpModal'
import { WithdrawModal } from '../components/WithdrawModal'
import { formatHandle } from '../lib/formatters'
import { parsePaymentQrCode } from '../lib/qr'
import { supabase } from '../lib/supabase'
import { fetchLedgerTransactions } from '../lib/transactions'
import type { ActivityFilter, DemoTransaction, Profile, RecentPerson, Transaction } from '../lib/types'

interface DashboardPageProps {
  session: Session
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onResetTheme: () => void
}

export function DashboardPage({ session, theme, onToggleTheme, onResetTheme }: DashboardPageProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [demoTransactions, setDemoTransactions] = useState<DemoTransaction[]>([])
  const [busy, setBusy] = useState(true)

  // URL-synced transaction filter state
  const urlFilter = searchParams.get('filter') as ActivityFilter | null
  const activeTxFilter: ActivityFilter =
    urlFilter === 'received' || urlFilter === 'sent' || urlFilter === '7d' ? urlFilter : 'all'

  function handleFilterChange(newFilter: ActivityFilter) {
    const nextParams = new URLSearchParams(searchParams)
    if (newFilter === 'all') {
      nextParams.delete('filter')
    } else {
      nextParams.set('filter', newFilter)
    }
    setSearchParams(nextParams, { replace: true })
  }

  // Modals state
  const [qrOpen, setQrOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [qrRequestAmount, setQrRequestAmount] = useState('')
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

  // Scanner prefill state for Send form
  const [prefilledRecipient, setPrefilledRecipient] = useState('')
  const [prefilledAmount, setPrefilledAmount] = useState('')

  // Profile menu dropdown
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  // Active tab for mobile bottom bar
  const [mobileTab, setMobileTab] = useState<'home' | 'send' | 'activity'>('home')

  // Toast notification state
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const toastTimer = useRef<number | null>(null)

  function showToast(kind: 'success' | 'error', message: string) {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    setToast({ kind, message })
    toastTimer.current = window.setTimeout(() => {
      setToast(null)
      toastTimer.current = null
    }, 4000)
  }

  function handleQrScanSuccess(rawCode: string) {
    const parsed = parsePaymentQrCode(rawCode)
    setIsScannerOpen(false)
    setMobileTab('send')

    if (parsed?.recipient) {
      setPrefilledRecipient(parsed.recipient)
    }
    if (parsed?.amount) {
      setPrefilledAmount(parsed.amount)
    }

    setTimeout(() => {
      const sendEl = document.getElementById('send-money-section')
      if (sendEl) {
        sendEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 120)

    showToast('success', parsed?.recipient ? `Ready to pay ${parsed.recipient}` : 'Payment QR detected.')
  }

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
  }, [])

  // Balance hide/show toggle persisted in localStorage
  const [hideBalance, setHideBalance] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('ghostpay_hide_balance') === 'true'
    } catch {
      return false
    }
  })

  function toggleHideBalance() {
    setHideBalance(prev => {
      const next = !prev
      try {
        window.localStorage.setItem('ghostpay_hide_balance', String(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }

  // Outside click and escape for profile menu
  useEffect(() => {
    if (!profileMenuOpen) return
    function handleClickOutside(event: PointerEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileMenuOpen(false)
    }
    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [profileMenuOpen])

  // Centralized fetch function to populate dashboard data and guarantee sync with Supabase
  const loadDashboardData = useCallback(async () => {
    if (!supabase) {
      setBusy(false)
      return
    }

    try {
      const [profileRes, txRes, demoRes] = await Promise.all([
        supabase.from('users').select('id, alias_handle, real_legal_name, real_upi_id, avatar_url, wallet_balance').eq('id', session.user.id).maybeSingle(),
        fetchLedgerTransactions(session.user.id),
        supabase.from('demo_transactions').select('id, amount_inr, sender_alias, status, created_at').eq('receiver_id', session.user.id).order('created_at', { ascending: false }).limit(500),
      ])

      if (profileRes.data) {
        setProfile(profileRes.data as Profile)
      }
      if (txRes) {
        setTransactions(prev => {
          const serverIds = new Set(txRes.map(r => r.id))
          const localOptimistic = prev.filter(t => !serverIds.has(t.id))
          return [...localOptimistic, ...txRes]
        })
      }
      if (demoRes.data) {
        setDemoTransactions(demoRes.data as DemoTransaction[])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load data.'
      showToast('error', msg)
    } finally {
      setBusy(false)
    }
  }, [session.user.id])

  // Initial data loading
  useEffect(() => {
    void loadDashboardData()
  }, [loadDashboardData])

  // Real-time postgres changes subscription
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('public:demo_transactions')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'demo_transactions',
        filter: `receiver_id=eq.${session.user.id}`,
      }, payload => {
        const incoming = payload.new as DemoTransaction
        if (incoming.receiver_id !== session.user.id) return
        setDemoTransactions(current => current.some(tx => tx.id === incoming.id) ? current : [incoming, ...current])
      })
      .subscribe()

    return () => { void supabase?.removeChannel(channel) }
  }, [session.user.id])

  // Refresh helper
  async function refreshWalletAndTransactions(fallbackBalance?: number) {
    if (!supabase) return
    try {
      const { data: wallet, error } = await supabase.from('users').select('wallet_balance').eq('id', session.user.id).single()
      if (error) {
        if (fallbackBalance !== undefined) {
          setProfile(p => p ? { ...p, wallet_balance: fallbackBalance } : p)
        }
        return
      }
      setProfile(p => p ? { ...p, wallet_balance: Number(wallet.wallet_balance) } : p)
      const freshRows = await fetchLedgerTransactions(session.user.id)
      setTransactions(prev => {
        const serverIds = new Set(freshRows.map(r => r.id))
        const localOptimistic = prev.filter(t => !serverIds.has(t.id))
        return [...localOptimistic, ...freshRows]
      })
    } catch {
      // Reconcile on subsequent refreshes
    }
  }

  // Combined and sorted ledger rows
  const allLedgerRows: Transaction[] = useMemo(() => {
    return [
      ...transactions,
      ...demoTransactions.map(tx => ({
        ...tx,
        direction: 'received' as const,
        counterpartyLabel: tx.sender_alias || 'Anonymous Sender',
        type: 'shielded_link',
        isNodal: true,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [transactions, demoTransactions])

  // 1-Tap Recent People row
  const recentPeople: RecentPerson[] = useMemo(() => {
    const seen = new Set<string>()
    const list: RecentPerson[] = []
    const currentUserId = session.user.id
    const ownHandleClean = (profile?.alias_handle || '').trim().replace(/^@+/, '').toLowerCase()

    for (const tx of transactions) {
      if (tx.counterpartyUserId === currentUserId) continue

      // Exclude top-ups
      const isTopUp = String(tx.sender_name || '').toLowerCase().includes('top-up') ||
        String(tx.counterpartyLabel || '').toLowerCase().includes('top-up')
      if (isTopUp) continue

      // Exclude anonymous, nodal, or shielded link payments
      const isShielded = !tx.sender_id ||
        tx.type === 'shielded' ||
        tx.type === 'shielded_link' ||
        Boolean(tx.isNodal) ||
        String(tx.type || '').toLowerCase().includes('shielded') ||
        String(tx.type || '').toLowerCase().includes('nodal')
      if (isShielded) continue

      // Exclude if any ID or label starts with '#'
      if (
        tx.sender_id?.startsWith('#') ||
        tx.receiver_id?.startsWith('#') ||
        tx.sender_alias?.startsWith('#') ||
        tx.counterpartyLabel?.startsWith('#') ||
        tx.counterpartyUserId?.startsWith('#') ||
        tx.sender_name?.startsWith('#')
      ) {
        continue
      }

      const rawHandle = (tx.counterpartyLabel || tx.sender_name || tx.sender_alias || '').trim()
      if (!rawHandle || rawHandle.startsWith('#')) continue

      // Clean handle (strip leading @)
      const cleanKey = rawHandle.replace(/^@+/, '').trim().toLowerCase()
      if (!cleanKey || cleanKey.startsWith('#')) continue

      // Strictly ensure no ID with spaces (like "@hoja ache se pls") is ever allowed
      if (cleanKey.includes(' ') || /\s/.test(cleanKey)) continue

      // Exclude known generic labels
      if (
        cleanKey === 'anonymous sender' ||
        cleanKey === 'anonymous' ||
        cleanKey === 'ghostpay user' ||
        cleanKey === 'ghostpay wallet' ||
        cleanKey === ownHandleClean ||
        seen.has(cleanKey)
      ) {
        continue
      }

      seen.add(cleanKey)
      list.push({
        handle: `@${cleanKey}`,
        label: cleanKey,
        avatarUrl: tx.counterpartyAvatarUrl,
      })
      if (list.length >= 5) break
    }
    return list
  }, [transactions, session.user.id, profile?.alias_handle])

  async function handleSignOut() {
    onResetTheme()
    await supabase?.auth.signOut()
  }

  const avatarUrl = profile?.avatar_url || (typeof session.user.user_metadata?.avatar_url === 'string' ? session.user.user_metadata.avatar_url : null)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-canvas)' }}>
      {/* Toast Notification Banner */}
      {toast && (
        <div className={`toast-banner ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
          {toast.kind === 'success' && <CheckIcon size={14} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header Navigation */}
      <header
        style={{
          height: '64px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-6)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <Brand />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {/* Theme switcher */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="btn-icon"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          </button>

          {/* Profile Avatar & Dropdown */}
          <div style={{ position: 'relative' }} ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen(open => !open)}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-inset)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
              }}
              aria-label="Profile menu"
              aria-expanded={profileMenuOpen}
            >
              {avatarUrl && !avatarUrl.startsWith('preset:') ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {profile?.alias_handle?.charAt(0).toUpperCase() ?? session.user.email?.charAt(0).toUpperCase() ?? 'G'}
                </span>
              )}
            </button>

            {profileMenuOpen && (
              <div
                className="surface-elevated"
                style={{
                  position: 'absolute',
                  top: '46px',
                  right: 0,
                  width: '220px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  zIndex: 40,
                }}
                role="menu"
              >
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
                  <div className="font-mono" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {formatHandle(profile?.alias_handle ?? '')}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {session.user.email}
                  </div>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    setEditProfileOpen(true)
                  }}
                  className="btn-ghost"
                  style={{ width: '100%', justifyContent: 'flex-start', minHeight: '36px', fontSize: '13px' }}
                >
                  Edit profile
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="btn-ghost"
                  style={{ width: '100%', justifyContent: 'flex-start', minHeight: '36px', fontSize: '13px', color: 'var(--semantic-debit-text)' }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container: Desktop 2-Column Asymmetric Layout */}
      <main className="dashboard-layout">
        <div className="dashboard-grid">
          {/* Left Primary Column */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Signature Split-Decimal Balance Header */}
            <BalanceHeader
              balance={profile?.wallet_balance ?? 0}
              hideBalance={hideBalance}
              onToggleHideBalance={toggleHideBalance}
              onOpenTopUp={() => setTopUpOpen(true)}
              onOpenWithdraw={() => setWithdrawOpen(true)}
              busy={busy}
            />

            {/* Compact Shielded Handle Link Bar */}
            <ShieldedLinkBar
              handle={profile?.alias_handle ?? ''}
              onOpenQr={() => setQrOpen(true)}
            />

            {/* Send Money Surface */}
            <div id="send-money-section" className="send-section" style={{ scrollMarginTop: '80px' }}>
              <SendMoneyForm
                userId={session.user.id}
                recentPeople={recentPeople}
                onSuccess={refreshWalletAndTransactions}
                onToast={showToast}
                disabled={busy || !profile}
                initialRecipient={prefilledRecipient}
                initialAmount={prefilledAmount}
              />
            </div>
          </div>

          {/* Right Statement Column */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Flat Activity Ledger (Statement List, 1px Hairlines, No Cards Inside Cards) */}
            <div id="activity-ledger-section" className="activity-section" style={{ scrollMarginTop: '80px' }}>
              <ActivityLedger
                transactions={allLedgerRows}
                activeFilter={activeTxFilter}
                onChangeFilter={handleFilterChange}
                onSelectTx={tx => setSelectedTx(tx)}
                busy={busy}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={mobileTab}
        onSelectTab={tab => {
          setMobileTab(tab)
          if (tab === 'home') {
            window.scrollTo({ top: 0, behavior: 'smooth' })
          } else if (tab === 'send') {
            const sendEl = document.getElementById('send-money-section')
            if (sendEl) {
              sendEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          } else if (tab === 'activity') {
            const actEl = document.getElementById('activity-ledger-section')
            if (actEl) {
              actEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }
        }}
        onOpenScan={() => setIsScannerOpen(true)}
        onOpenProfile={() => setEditProfileOpen(true)}
      />

      {/* Full-screen Native Live Camera QR Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSuccess={handleQrScanSuccess}
        onToast={showToast}
      />

      {qrOpen && profile && (
        <ShareQrModal
          handle={profile.alias_handle}
          requestAmount={qrRequestAmount}
          setRequestAmount={setQrRequestAmount}
          onClose={() => setQrOpen(false)}
          onToast={showToast}
        />
      )}

      {topUpOpen && (
        <TopUpModal
          onClose={() => setTopUpOpen(false)}
          onSuccess={async (newBalance: number) => {
            setProfile(p => p ? { ...p, wallet_balance: newBalance } : p)
            await refreshWalletAndTransactions(newBalance)
          }}
          onToast={showToast}
        />
      )}

      {withdrawOpen && (
        <WithdrawModal
          walletBalance={profile?.wallet_balance ?? 0}
          realUpiId={profile?.real_upi_id || profile?.upi_id || ''}
          realLegalName={profile?.real_legal_name || profile?.full_name || ''}
          userId={session.user.id}
          onClose={() => setWithdrawOpen(false)}
          onSuccess={async (withdrawnAmount: number, newBalance: number, newTx?: Transaction) => {
            const withdrawAmount = Number(withdrawnAmount) || 0

            // Instantly decrement the local React balance state by the withdrawn amount
            setProfile(prev => {
              if (!prev) return prev
              const currentBalance = typeof prev.wallet_balance === 'number' ? prev.wallet_balance : 0
              const decrementedBalance = typeof newBalance === 'number' && Number.isFinite(newBalance) && newBalance <= currentBalance - withdrawAmount
                ? newBalance
                : Math.max(0, currentBalance - withdrawAmount)
              return {
                ...prev,
                wallet_balance: decrementedBalance,
              }
            })

            // Immediately update the local transaction history array
            if (newTx) {
              setTransactions(prev => [newTx, ...prev.filter(t => t.id !== newTx.id)])
            }

            // Guarantee sync with Supabase by calling the centralized fetch function
            await loadDashboardData()
          }}
          onToast={showToast}
        />
      )}

      {editProfileOpen && profile && (
        <EditProfileModal
          profile={profile}
          userEmail={session.user.email ?? ''}
          onClose={() => setEditProfileOpen(false)}
          onSuccess={updated => setProfile(updated)}
          onToast={showToast}
        />
      )}

      {selectedTx && (
        <ReceiptModal
          tx={selectedTx}
          onClose={() => setSelectedTx(null)}
          onToast={showToast}
        />
      )}
    </div>
  )
}
