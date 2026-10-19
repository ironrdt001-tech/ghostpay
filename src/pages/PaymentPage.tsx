import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { unlockAudioEngine, playChaChingSound } from '../lib/audio'
import { formatHandle, formatMoneyParts } from '../lib/formatters'
import { Brand } from '../components/Brand'
import { ArrowLeftIcon, ArrowRightIcon, ShieldCheckIcon, SpinnerIcon, LockIcon } from '../components/Icons'
import type { Profile } from '../lib/types'

export function PaymentPage() {
  const params = useParams()
  const rawTarget = params.handle || params.id || ''
  const aliasHandle = rawTarget.replace(/^@+/, '').toLowerCase()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const requestedAmountParam = searchParams.get('am') || searchParams.get('amount')
  const urlRequestedAmount = useMemo(() => {
    const requested = Number(requestedAmountParam)
    return Number.isFinite(requested) && requested > 0 ? requested : null
  }, [requestedAmountParam])

  const [profile, setProfile] = useState<Pick<Profile, 'id' | 'alias_handle' | 'avatar_url'> | null>(null)
  const [visitorSession, setVisitorSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [walletBusy, setWalletBusy] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'simulated'>('wallet')
  const [amount, setAmount] = useState(() => (urlRequestedAmount === null ? '' : String(urlRequestedAmount)))
  const [senderName, setSenderName] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  const toastTimer = useRef<number | null>(null)
  function showToast(message: string) {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => {
      setToast('')
      toastTimer.current = null
    }, 5000)
  }

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    setAmount(urlRequestedAmount === null ? '' : String(urlRequestedAmount))
  }, [urlRequestedAmount])

  const user = visitorSession?.user
  // GhostPay Wallet option is only available if user is logged in and not paying themselves
  const canUseWallet = Boolean(user && profile && user.id !== profile.id)
  const selectedPaymentMethod = canUseWallet ? paymentMethod : 'simulated'

  useEffect(() => {
    setPaymentMethod(canUseWallet ? 'wallet' : 'simulated')
  }, [canUseWallet])

  // Auth session tracking
  useEffect(() => {
    let active = true
    if (!supabase) {
      setAuthReady(true)
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setVisitorSession(nextSession)
      setAuthReady(true)
    })

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      setVisitorSession(sessionError ? null : data.session)
      setAuthReady(true)
    }).catch(() => {
      if (active) {
        setVisitorSession(null)
        setAuthReady(true)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // Load wallet balance if authenticated
  useEffect(() => {
    let active = true
    if (!supabase || !visitorSession) {
      setWalletBalance(null)
      setWalletBusy(false)
      return
    }

    setWalletBusy(true)
    void supabase.from('users').select('wallet_balance').eq('id', visitorSession.user.id).maybeSingle().then(({ data, error: balanceError }) => {
      if (!active) return
      if (balanceError) {
        setWalletBalance(null)
      } else {
        setWalletBalance(data ? Number(data.wallet_balance) : 0)
      }
      setWalletBusy(false)
    })

    return () => { active = false }
  }, [visitorSession?.user.id])

  // Fetch receiver profile by alias handle
  useEffect(() => {
    let active = true
    async function loadReceiver() {
      if (!supabase) {
        setError('Payment link is not connected.')
        return
      }

      const { data, error: queryError } = await supabase.from('profiles').select('id, alias_handle, avatar_url').eq('alias_handle', aliasHandle).maybeSingle()
      if (!active) return

      if (queryError) {
        setError(queryError.message)
      } else if (!data) {
        if (aliasHandle.startsWith('gp_brn_')) {
          setProfile({
            id: aliasHandle,
            alias_handle: aliasHandle,
            avatar_url: null,
          })
        } else {
          setError('Payment link not found. Check the handle and try again.')
        }
      } else {
        setProfile(data)
      }
    }

    void loadReceiver()
    return () => { active = false }
  }, [aliasHandle])

  const numAmount = parseFloat(amount) || 0
  const hasValidAmount = Number.isFinite(numAmount) && numAmount > 0

  function addPreset(preset: number) {
    const current = parseFloat(amount) || 0
    const next = Math.round((current + preset) * 100) / 100
    setAmount(String(next))
  }

  async function handleStartPayment(event: FormEvent) {
    // 1. Mobile-safe Web Audio unlock called synchronously on the very first line before await
    unlockAudioEngine()
    event.preventDefault()
    setError('')
    setToast('')

    const value = urlRequestedAmount !== null ? urlRequestedAmount : Number(amount)
    if (!Number.isFinite(value) || value <= 0 || Math.round(value * 100) !== value * 100) {
      showToast('Enter a valid payment amount with up to two decimal places.')
      return
    }

    if (!profile) {
      showToast('This payment link is not ready.')
      return
    }

    if (!supabase) {
      showToast('Payment system is not connected.')
      return
    }

    const useWallet = Boolean(canUseWallet && selectedPaymentMethod === 'wallet')
    if (!useWallet && !senderName.trim()) {
      showToast('Please enter your name to proceed.')
      return
    }

    if (useWallet && walletBalance === null) {
      showToast('Wallet balance is still loading. Please try again.')
      return
    }

    const accountAlias = visitorSession && typeof visitorSession.user.user_metadata?.alias_handle === 'string'
      ? formatHandle(visitorSession.user.user_metadata.alias_handle)
      : 'GhostPay User'
    const resolvedSenderName = useWallet ? accountAlias : senderName.trim() || 'Anonymous'

    setBusy(true)
    try {
      const { data, error: transferError } = await supabase.rpc('simulate_escrow_payment', {
        p_receiver_handle: profile.alias_handle,
        p_amount: value,
        p_sender_name: resolvedSenderName,
        p_use_wallet: useWallet,
      })

      if (transferError) {
        if (transferError.message.includes('INSUFFICIENT_WALLET_BALANCE')) {
          showToast('Insufficient wallet balance. Use simulated escrow checkout instead.')
        } else if (transferError.message.includes('CANNOT_TRANSFER_TO_SELF')) {
          showToast('You cannot pay your own handle via wallet.')
        } else {
          showToast('Payment simulation could not be completed.')
        }
        setBusy(false)
        return
      }

      const transfer = data as { transaction_id?: string; wallet_balance?: number | string | null } | null
      const updatedBalance = transfer?.wallet_balance == null ? null : Number(transfer.wallet_balance)

      if (!transfer?.transaction_id || (updatedBalance !== null && !Number.isFinite(updatedBalance))) {
        throw new Error('Payment confirmation was missing.')
      }

      // 2. Rising 4-note chime
      playChaChingSound()

      if (useWallet && updatedBalance !== null) {
        setWalletBalance(updatedBalance)
      }

      await new Promise(resolve => setTimeout(resolve, 350))
      navigate('/payment/success', {
        state: {
          amount: value,
          alias: profile.alias_handle,
          senderAlias: resolvedSenderName,
          paymentMode: useWallet ? 'wallet' : 'simulated',
          transactionId: transfer.transaction_id,
        },
      })
    } catch {
      setBusy(false)
      showToast('Payment simulation failed. Please try again.')
    }
  }

  const formattedWalletBalance = walletBalance === null ? '₹0.00' : `₹${walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const receiverHandleDisplay = profile ? formatHandle(profile.alias_handle) : formatHandle(aliasHandle)
  const actionButtonText = hasValidAmount
    ? `Pay ${formatMoneyParts(numAmount).full} to ${receiverHandleDisplay}`
    : `Pay ${receiverHandleDisplay}`

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-canvas)' }}>
      {toast && (
        <div className="toast-banner error" role="alert">
          <span>{toast}</span>
        </div>
      )}

      <header
        style={{
          height: '64px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-6)',
        }}
      >
        <Brand />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <LockIcon size={12} />
          <span>Shielded nodal escrow</span>
        </div>
      </header>

      <div style={{ maxWidth: '440px', margin: 'var(--space-8) auto', padding: '0 var(--space-4)' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <ArrowLeftIcon size={14} />
          <span>Back to GhostPay</span>
        </Link>

        <section className="surface-card" style={{ padding: 'var(--space-6)' }}>
          {/* Recipient Header */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-inset)',
                border: '1px solid var(--border-strong)',
                margin: '0 auto var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Recipient" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '24px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {aliasHandle.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <h1 className="text-section-title" style={{ fontSize: '22px', marginBottom: '4px' }}>
              Pay {receiverHandleDisplay}
            </h1>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--semantic-credit-text)' }}>
              <ShieldCheckIcon size={14} strokeWidth={2} />
              <span>Identity shielded by GhostPay nodal escrow</span>
            </div>
          </div>

          <form onSubmit={handleStartPayment} className="field-stack">
            {authReady && (!visitorSession || selectedPaymentMethod === 'simulated') && (
              <label className="field-label">
                <span>Your name (shown to recipient)</span>
                <input
                  type="text"
                  maxLength={80}
                  placeholder="Your name or alias"
                  className="field-input"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  disabled={busy}
                  required
                />
              </label>
            )}

            <label className="field-label">
              <span>Amount (₹)</span>
              {urlRequestedAmount !== null && (
                <div style={{ fontSize: '12px', color: 'var(--semantic-credit-text)', marginBottom: '2px' }}>
                  Requested amount: ₹{urlRequestedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              )}
              <div className="input-with-prefix">
                <span className="input-prefix" style={{ fontSize: '20px' }}>₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  className="tabular-nums"
                  value={amount}
                  onChange={e => {
                    if (urlRequestedAmount === null) {
                      setAmount(e.target.value)
                    }
                  }}
                  readOnly={urlRequestedAmount !== null}
                  disabled={busy}
                  required
                  style={urlRequestedAmount !== null ? { cursor: 'not-allowed', opacity: 0.85 } : undefined}
                />
              </div>

              {urlRequestedAmount === null && (
                <div className="chip-group" style={{ marginTop: '4px' }}>
                  {[100, 500, 1000].map(val => (
                    <button
                      key={val}
                      type="button"
                      disabled={busy}
                      onClick={() => addPreset(val)}
                      className="chip-btn"
                    >
                      +₹{val.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              )}
            </label>

            {canUseWallet && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', margin: 'var(--space-2) 0' }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPaymentMethod('wallet')}
                  className={`surface-inset ${selectedPaymentMethod === 'wallet' ? 'active' : ''}`}
                  style={{
                    padding: 'var(--space-3)',
                    cursor: 'pointer',
                    borderColor: selectedPaymentMethod === 'wallet' ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    backgroundColor: selectedPaymentMethod === 'wallet' ? 'var(--accent-subtle)' : 'var(--bg-inset)',
                    color: selectedPaymentMethod === 'wallet' ? 'var(--accent-text)' : 'var(--text-secondary)',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>GhostPay Wallet</div>
                  <div className="tabular-nums" style={{ fontSize: '12px', opacity: 0.8 }}>
                    {walletBusy ? 'Loading...' : formattedWalletBalance}
                  </div>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPaymentMethod('simulated')}
                  className={`surface-inset ${selectedPaymentMethod === 'simulated' ? 'active' : ''}`}
                  style={{
                    padding: 'var(--space-3)',
                    cursor: 'pointer',
                    borderColor: selectedPaymentMethod === 'simulated' ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    backgroundColor: selectedPaymentMethod === 'simulated' ? 'var(--accent-subtle)' : 'var(--bg-inset)',
                    color: selectedPaymentMethod === 'simulated' ? 'var(--accent-text)' : 'var(--text-secondary)',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>Nodal checkout</div>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>Simulated escrow</div>
                </button>
              </div>
            )}

            {error && (
              <div style={{ color: 'var(--semantic-debit-text)', fontSize: '13px' }} role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !profile || !hasValidAmount || (selectedPaymentMethod === 'wallet' && (walletBusy || walletBalance === null))}
              className="btn-primary btn-full"
              style={{ marginTop: 'var(--space-2)' }}
            >
              {busy ? (
                <>
                  <SpinnerIcon size={16} />
                  <span>Processing payment...</span>
                </>
              ) : (
                <>
                  <span>{actionButtonText}</span>
                  <ArrowRightIcon size={16} strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: 'var(--space-4)' }}>
            Personal bank details remain concealed from the receiver.
          </p>
        </section>
      </div>
    </main>
  )
}
