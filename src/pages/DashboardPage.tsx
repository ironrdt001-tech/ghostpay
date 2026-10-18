import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fetchLedgerTransactions } from '../lib/transactions'
import { formatHandle } from '../lib/formatters'
import { Brand } from '../components/Brand'
import { BalanceHeader } from '../components/BalanceHeader'
import { ShieldedLinkBar } from '../components/ShieldedLinkBar'
import { SendMoneyForm } from '../components/SendMoneyForm'
import { ActivityLedger } from '../components/ActivityLedger'
import { ReceiptModal } from '../components/ReceiptModal'
import { ShareQrModal } from '../components/ShareQrModal'
import { TopUpModal } from '../components/TopUpModal'
import { EditProfileModal } from '../components/EditProfileModal'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { SunIcon, MoonIcon, CheckIcon } from '../components/Icons'
import type { Profile, Transaction, DemoTransaction, RecentPerson, ActivityFilter } from '../lib/types'

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
  const [qrRequestAmount, setQrRequestAmount] = useState('')
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

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

  // Initial data loading
  useEffect(() => {
    let active = true

    async function loadData() {
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

        if (!active) return

        if (profileRes.data) {
          setProfile(profileRes.data as Profile)
        }
        if (txRes) {
          setTransactions(txRes)
        }
        if (demoRes.data) {
          setDemoTransactions(demoRes.data as DemoTransaction[])
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not load data.'
        showToast('error', msg)
      } finally {
        if (active) setBusy(false)
      }
    }

    void loadData()
    return () => { active = false }
  }, [session.user.id])

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
      setTransactions(freshRows)
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
      if (tx.sender_name?.startsWith('Simulated Wallet Top-Up')) continue

      const rawHandle = (tx.counterpartyLabel || tx.sender_name || tx.sender_alias || '').trim()
      const cleanKey = rawHandle.trim().replace(/^@+/, '').toLowerCase()

      if (
        cleanKey &&
        cleanKey !== 'anonymous sender' &&
        cleanKey !== 'ghostpay user' &&
        cleanKey !== 'ghostpay wallet' &&
        cleanKey !== ownHandleClean &&
        !seen.has(cleanKey)
      ) {
        seen.add(cleanKey)
        list.push({
          handle: `@${cleanKey}`,
          label: cleanKey,
          avatarUrl: tx.counterpartyAvatarUrl,
        })
      }
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
              busy={busy}
            />

            {/* Compact Shielded Handle Link Bar */}
            <ShieldedLinkBar
              handle={profile?.alias_handle ?? ''}
              onOpenQr={() => setQrOpen(true)}
            />

            {/* Send Money Surface */}
            <div id="send-money-section">
              <SendMoneyForm
                userId={session.user.id}
                recentPeople={recentPeople}
                onSuccess={refreshWalletAndTransactions}
                onToast={showToast}
                disabled={busy || !profile}
              />
            </div>
          </div>

          {/* Right Statement Column */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Flat Activity Ledger (Statement List, 1px Hairlines, No Cards Inside Cards) */}
            <div id="activity-ledger-section">
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
        onOpenQr={() => setQrOpen(true)}
        onOpenProfile={() => setEditProfileOpen(true)}
      />

      {/* Modals */}
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
