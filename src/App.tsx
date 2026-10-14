import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Activity, ArrowLeft, ArrowRight, Check, CircleHelp, Copy, Download, LockKeyhole, Moon, QrCode, Share2, Shield, ShieldCheck, Sparkles, Sun, X } from 'lucide-react'
import { toBlob } from 'html-to-image'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import type { Session } from '@supabase/supabase-js'
import { formatHandle, supabase } from './lib/supabase'

type Profile = { id: string; alias_handle: string; real_legal_name?: string; real_upi_id?: string; avatar_url?: string | null; wallet_balance?: number }
type Transaction = { id: string; amount_inr: number; status: string; created_at: string; sender_id?: string | null; receiver_id?: string; sender_alias?: string; sender_name?: string; direction?: 'sent' | 'received'; counterpartyLabel?: string }
type DemoTransaction = Transaction & { receiver_id: string; sender_alias: string; status: 'simulated' }

async function fetchLedgerTransactions(userId: string): Promise<Transaction[]> {
  if (!supabase) return []
  const allRows: Transaction[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, sender_id, receiver_id, amount_inr, status, created_at, sender_name')
      .or(`receiver_id.eq.${userId},sender_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    allRows.push(...(data ?? []) as Transaction[])
    if (!data || data.length < 1000) break
  }

  const uniqueUserIds = [...new Set(allRows.flatMap(tx => [tx.sender_id, tx.receiver_id]).filter((id): id is string => Boolean(id)))]
  const aliasesById = new Map<string, string>()
  if (uniqueUserIds.length) {
    const { data: users, error } = await supabase.from('users').select('id, alias_handle').in('id', uniqueUserIds)
    if (error) throw error
    for (const user of users ?? []) aliasesById.set(user.id, user.alias_handle)
  }

  return allRows.map(tx => {
    const direction = tx.sender_id === userId ? 'sent' : 'received'
    const senderHandle = tx.sender_id ? aliasesById.get(tx.sender_id) : undefined
    const receiverHandle = aliasesById.get(tx.receiver_id ?? '')
    const counterpartyLabel = direction === 'sent'
      ? receiverHandle ? formatHandle(receiverHandle) : tx.sender_name || 'GhostPay User'
      : tx.sender_name || (senderHandle ? formatHandle(senderHandle) : 'Anonymous Sender')
    return { ...tx, direction, counterpartyLabel }
  })
}

function Brand({ light = false }: { light?: boolean }) {
  return <Link className={`brand ${light ? 'brand-light' : ''}`} to="/" aria-label="GhostPay home"><span className="brand-mark"><Shield size={17} strokeWidth={2.4} /></span><span>ghostpay</span></Link>
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const logoutReset = useRef(false)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    if (session && !logoutReset.current) {
      try { window.localStorage.setItem('ghostpay.theme', theme) } catch { /* storage can be disabled */ }
    }
  }, [session, theme])

  function toggleTheme() {
    setTheme(current => current === 'dark' ? 'light' : 'dark')
  }

  function resetThemeForLogout() {
    logoutReset.current = true
    setTheme('light')
    document.documentElement.classList.remove('dark')
    try { window.localStorage.removeItem('ghostpay.theme') } catch { /* storage can be disabled */ }
  }

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) { setSession(null); resetThemeForLogout() }
      else {
        setSession(data.session)
        if (data.session) {
          logoutReset.current = false
          try { setTheme(window.localStorage.getItem('ghostpay.theme') === 'dark' ? 'dark' : 'light') } catch { setTheme('light') }
        } else resetThemeForLogout()
      }
      setAuthReady(true)
    }).catch(() => { setSession(null); resetThemeForLogout(); setAuthReady(true) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) {
        logoutReset.current = false
        try { setTheme(window.localStorage.getItem('ghostpay.theme') === 'dark' ? 'dark' : 'light') } catch { setTheme('light') }
      } else resetThemeForLogout()
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!authReady) return <div className="loading-screen"><Brand /><span className="spinner" /></div>

  return <>
    <Routes>
    <Route path="/" element={session ? <AuthenticatedRedirect session={session} /> : <AuthPage />} />
    <Route path="/login" element={session ? <AuthenticatedRedirect session={session} /> : <AuthPage initialMode="sign-in" />} />
    <Route path="/signup" element={session ? <AuthenticatedRedirect session={session} /> : <AuthPage initialMode="create-account" />} />
    <Route path="/onboarding" element={session ? <OnboardingPage session={session} /> : <Navigate to="/" replace />} />
    <Route path="/dashboard" element={session ? <DashboardPage session={session} theme={theme} onToggleTheme={toggleTheme} onResetTheme={resetThemeForLogout} /> : <Navigate to="/" replace />} />
    <Route path="/payment/return" element={<PaymentReturnPage />} />
    <Route path="/payment/success" element={<PaymentSuccessPage />} />
    {/* Public profile route: React Router params must be a full segment, so /:handle supports /@alias. */}
    <Route path="/:handle" element={<PaymentPage />} />
    <Route path="*" element={<Navigate to={session ? '/dashboard' : '/'} replace />} />
    </Routes>
  </>
}

function AuthPage({ initialMode = 'sign-in' }: { initialMode?: 'sign-in' | 'create-account' }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'sign-in' | 'create-account'>(initialMode)
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [authToast, setAuthToast] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const toastTimer = useRef<number | null>(null)

  function showAuthToast(text: string) {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    setAuthToast(text)
    toastTimer.current = window.setTimeout(() => { setAuthToast(''); toastTimer.current = null }, 5000)
  }

  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current) }, [])

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage(''); setAuthToast('')
    if (!supabase) { setError('Connect your Supabase project to continue.'); return }
    const cleanHandle = handle.trim().replace(/^@+/, '').toLowerCase()
    if (mode === 'create-account' && !/^[a-z0-9_][a-z0-9_.]{2,29}$/.test(cleanHandle)) {
      setError('Choose a handle with 3–30 letters, numbers, dots, or underscores.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'sign-in') {
        const identifier = email.trim()
        const isHandle = identifier.startsWith('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
        let data: { user: { id: string } | null } | null = null
        let authError: { message: string } | null = null
        if (isHandle) {
          const { data: userEmail, error: rpcError } = await supabase.rpc('get_email_for_handle', { p_handle: identifier })
          if (rpcError) { setError(rpcError.message); return }
          if (typeof userEmail !== 'string' || !userEmail.trim()) {
            showAuthToast('Handle not found')
            return
          }
          const result = await supabase.auth.signInWithPassword({ email: userEmail, password })
          data = result.data
          authError = result.error
        } else {
          const result = await supabase.auth.signInWithPassword({ email: identifier, password })
          data = result.data
          authError = result.error
        }
        if (authError) { setError(authError.message); return }
        if (!data?.user) { setError('Sign-in did not return an active session. Please try again.'); return }
        const { data: profile, error: profileError } = await supabase.from('users').select('id').eq('id', data.user.id).maybeSingle()
        if (profileError) { setError(profileError.message); return }
        navigate(profile ? '/dashboard' : '/onboarding', { replace: true })
        return
      }

      const { data: existingHandle, error: handleError } = await supabase.from('profiles').select('id').eq('alias_handle', cleanHandle).maybeSingle()
      if (handleError) { setError(handleError.message); return }
      if (existingHandle) { setError('That handle is already taken. Try another one.'); return }
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { alias_handle: cleanHandle } },
      })
      if (signupError) {
        setError(signupError.code === '23505' ? 'That handle is already taken. Try another one.' : signupError.message)
        return
      }
      if (data.session) navigate('/onboarding', { replace: true })
      else setMessage('Account created. Check your email to confirm it, then sign in to continue.')
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const creatingAccount = mode === 'create-account'
  return <main className="auth-layout">
    <section className="auth-visual">
      <div className="visual-top"><Brand light /><span className="secure-note"><LockKeyhole size={13} /> PRIVATE BY DESIGN</span></div>
      <div className="visual-content">
        <div className="visual-kicker"><span /> YOUR WORK. YOUR PRIVACY.</div>
        <h1>Get paid.<br /><em>Stay private.</em></h1>
        <p>One simple link for your work. Your personal details stay yours.</p>
        <div className="privacy-card"><div className="privacy-card-icon"><ShieldCheck size={23} /></div><div><strong>Your identity stays shielded</strong><span>Only your public alias is shared with clients.</span></div><Check className="privacy-check" size={18} /></div>
      </div>
      <div className="visual-footer"><span>Payments, with a little more peace of mind.</span><span>© GhostPay</span></div>
      <div className="visual-orb orb-one" /><div className="visual-orb orb-two" />
    </section>
    <section className="auth-main">
      <div className="auth-mobile-brand"><Brand /></div>
      <div className="auth-form-wrap">
        <div className="form-eyebrow"><Sparkles size={14} /> {creatingAccount ? 'GET STARTED' : 'WELCOME BACK'}</div>
        <h2>{creatingAccount ? 'Create your account' : 'Sign in to GhostPay'}</h2><p className="form-intro">{creatingAccount ? 'Claim your private payment link in a few steps.' : 'Your next payment is just a link away.'}</p>
        <div className="auth-mode-toggle" role="tablist" aria-label="Authentication mode"><button type="button" role="tab" aria-selected={!creatingAccount} className={!creatingAccount ? 'active' : ''} onClick={() => { setMode('sign-in'); setAuthToast('') }}>Sign In</button><button type="button" role="tab" aria-selected={creatingAccount} className={creatingAccount ? 'active' : ''} onClick={() => { setMode('create-account'); setAuthToast('') }}>Create Account</button></div>
        <form onSubmit={submit} className="form-stack">
          {creatingAccount && <label>Claim your @handle<div className="auth-handle-input"><span>@</span><input autoComplete="username" maxLength={30} placeholder="yourname" value={handle} onChange={event => setHandle(event.target.value.replace(/^@+/, ''))} required /></div><small>Your public payment link. You can use letters, numbers, dots, and underscores.</small></label>}
          <label>{creatingAccount ? 'Email address' : 'Email or @handle'}<input autoComplete={creatingAccount ? 'email' : 'username'} type={creatingAccount ? 'email' : 'text'} placeholder={creatingAccount ? 'you@example.com' : 'you@example.com or @yourname'} value={email} onChange={e => { setEmail(e.target.value); setAuthToast(''); setError('') }} required /></label>
          <label>Password<input autoComplete={creatingAccount ? 'new-password' : 'current-password'} minLength={creatingAccount ? 8 : undefined} type="password" placeholder={creatingAccount ? 'At least 8 characters' : 'Enter your password'} value={password} onChange={e => setPassword(e.target.value)} required /></label>
          {error && <p className="error-note">{error}</p>}
          {authToast && <div className="auth-error-toast" role="alert">{authToast}</div>}
          {message && <p className="success-note" role="status">{message}</p>}
          <button className="button button-primary full-button" disabled={busy}>{busy ? <><span className="spinner auth-button-spinner" /> {creatingAccount ? 'Creating account…' : 'Signing in…'}</> : <>{creatingAccount ? 'Create Account' : 'Sign In'}<ArrowRight size={17} /></>}</button>
        </form>
        <p className="terms-note"><LockKeyhole size={13} /> Your banking details are encrypted and kept private.</p>
      </div>
      <span className="mobile-copyright">© GhostPay · Payments, with a little more peace of mind.</span>
    </section>
  </main>
}

function AuthenticatedRedirect({ session }: { session: Session }) {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    async function resolveDestination() {
      if (!supabase) { navigate('/', { replace: true }); return }
      try {
        const { data, error } = await supabase.from('users').select('id').eq('id', session.user.id).maybeSingle()
        if (!active) return
        navigate(!error && data ? '/dashboard' : '/onboarding', { replace: true })
      } catch {
        if (active) navigate('/onboarding', { replace: true })
      } finally {
        if (active) setChecking(false)
      }
    }
    void resolveDestination()
    return () => { active = false }
  }, [navigate, session.user.id])

  return checking ? <div className="loading-screen"><Brand /><span className="spinner" /></div> : null
}

function OnboardingPage({ session }: { session: Session }) {
  const navigate = useNavigate()
  const [alias, setAlias] = useState(() => typeof session.user.user_metadata.alias_handle === 'string' ? session.user.user_metadata.alias_handle : '')
  const [legalName, setLegalName] = useState('')
  const [upi, setUpi] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    if (!supabase) { setError('Connect your Supabase project to continue.'); return }
    const cleanAlias = alias.trim().replace(/^@+/, '').toLowerCase()
    if (!/^[a-z0-9_][a-z0-9_.]{2,29}$/.test(cleanAlias)) { setError('Use 3–30 letters, numbers, dots, or underscores for your alias.'); return }
    setBusy(true)
    const { error: claimError } = await supabase.from('profiles').upsert({ id: session.user.id, alias_handle: cleanAlias }, { onConflict: 'id' })
    if (claimError) { setError(claimError.code === '23505' ? 'That alias is already taken. Try another one.' : claimError.message); setBusy(false); return }
    const { error: insertError } = await supabase.from('users').insert({ id: session.user.id, alias_handle: cleanAlias, real_legal_name: legalName.trim(), real_upi_id: upi.trim() })
    if (insertError) { setError(insertError.code === '23505' ? 'That alias is already taken. Try another one.' : insertError.message); setBusy(false); return }
    navigate('/dashboard')
  }

  return <main className="onboarding-page">
    <header className="topbar"><Brand /><Link to="/dashboard" className="quiet-link">Already set up? <span>Go to dashboard <ArrowRight size={14} /></span></Link></header>
    <section className="onboard-shell">
      <div className="onboard-progress"><span className="progress-dot active">1</span><span className="progress-line" /><span className="progress-dot">2</span><small>ACCOUNT SETUP <b>·</b> YOUR DETAILS</small></div>
      <div className="onboard-heading"><div className="icon-tile"><ShieldCheck size={22} /></div><div><div className="form-eyebrow">A SAFER WAY TO GET PAID</div><h1>Set up your shield</h1><p>Choose what people see. Keep the rest just for you.</p></div></div>
      <form className="onboard-card form-stack" onSubmit={submit}>
        <label>Choose your public alias (e.g., @yourname)<div className="alias-input"><span>@</span><input value={alias} onChange={e => setAlias(e.target.value)} placeholder="yourname" autoCapitalize="none" required /></div><small>This is the name clients will see on your payment page.</small></label>
        <div className="private-section"><div className="private-heading"><LockKeyhole size={15} /><span>PRIVATE BANKING DETAILS</span><span className="private-badge">ONLY YOU & GHOSTPAY</span></div>
          <label>Enter your legal bank name (Kept strictly private)<input value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Name on your bank account" autoComplete="name" required /></label>
          <label>Enter your real UPI ID (Kept strictly private)<input value={upi} onChange={e => setUpi(e.target.value)} placeholder="name@bank" autoCapitalize="none" required /></label>
        </div>
        {error && <p className="error-note">{error}</p>}
        <button className="button button-primary full-button" disabled={busy}>{busy ? 'Securing your account…' : 'Secure My Account'}<ArrowRight size={17} /></button>
        <p className="privacy-foot"><Shield size={14} /> Your private details are never shown to people who pay you.</p>
      </form>
    </section>
  </main>
}

function DashboardPage({ session, theme, onToggleTheme, onResetTheme }: { session: Session; theme: 'light' | 'dark'; onToggleTheme: () => void; onResetTheme: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [demoTransactions, setDemoTransactions] = useState<DemoTransaction[]>([])
  const [chartReady, setChartReady] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(true)
  const [qrOpen, setQrOpen] = useState(false)
  const [txFilter, setTxFilter] = useState<'all' | 'received' | 'sent'>('all')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false)
  const [editHandle, setEditHandle] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileEditError, setProfileEditError] = useState('')
  const [editFullName, setEditFullName] = useState('')
  const [editUpi, setEditUpi] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const [transferRecipient, setTransferRecipient] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferBusy, setTransferBusy] = useState(false)
  const [transferToast, setTransferToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const transferToastTimer = useRef<number | null>(null)

  function showTransferToast(kind: 'success' | 'error', message: string) {
    if (transferToastTimer.current !== null) window.clearTimeout(transferToastTimer.current)
    setTransferToast({ kind, message })
    transferToastTimer.current = window.setTimeout(() => {
      setTransferToast(null)
      transferToastTimer.current = null
    }, 4000)
  }

  useEffect(() => () => {
    if (transferToastTimer.current !== null) window.clearTimeout(transferToastTimer.current)
  }, [])

  useEffect(() => {
    if (!profileMenuOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setProfileMenuOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [profileMenuOpen])

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setError('Connect your Supabase project to load your dashboard.'); setBusy(false); return }
      const client = supabase
      async function loadRealRows() {
        try { return { rows: await fetchLedgerTransactions(session.user.id), error: null as Error | null } }
        catch (loadError) { return { rows: null as Transaction[] | null, error: loadError as Error } }
      }
      async function loadDemoRows() {
        const rows: DemoTransaction[] = []
        for (let from = 0; ; from += 1000) {
          const { data, error } = await client.from('demo_transactions').select('id, amount_inr, sender_alias, status, created_at').eq('receiver_id', session.user.id).order('created_at', { ascending: false }).range(from, from + 999)
          if (error) return { rows: null as DemoTransaction[] | null, error }
          rows.push(...(data ?? []) as DemoTransaction[])
          if (!data || data.length < 1000) return { rows, error: null }
        }
      }
      const [profileResult, txResult, demoResult] = await Promise.all([
        client.from('users').select('id, alias_handle, real_legal_name, real_upi_id, avatar_url, wallet_balance').eq('id', session.user.id).maybeSingle(),
        loadRealRows(),
        loadDemoRows(),
      ])
      if (!active) return
      if (profileResult.error || txResult.error || demoResult.error) setError(profileResult.error?.message ?? txResult.error?.message ?? demoResult.error?.message ?? '')
      if (profileResult.data) setProfile(profileResult.data)
      const realRows = txResult.rows
      const demoRows = demoResult.rows
      if (realRows) setTransactions(realRows)
      if (demoRows) setDemoTransactions(current => {
        const rowsById = new Map([...demoRows, ...current].map(tx => [tx.id, tx]))
        return [...rowsById.values()]
      })
      setBusy(false)
    }
    void load()
    return () => { active = false }
  }, [session.user.id])

  useEffect(() => {
    if (busy) return
    setChartReady(false)
    const frame = window.requestAnimationFrame(() => setChartReady(true))
    return () => window.cancelAnimationFrame(frame)
  }, [busy])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const channel = client
      .channel('public:demo_transactions')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'demo_transactions',
        filter: `receiver_id=eq.${session.user.id}`,
      }, payload => {
        const incoming = payload.new as DemoTransaction
        if (incoming.receiver_id !== session.user.id) return
        setDemoTransactions(current => current.some(tx => tx.id === incoming.id)
          ? current
          : [incoming, ...current])
      })
      .subscribe()

    return () => { void client.removeChannel(channel) }
  }, [session.user.id])

  const ledgerTransactions: Transaction[] = [
    ...transactions,
    ...demoTransactions.map(tx => ({ ...tx, direction: 'received' as const, counterpartyLabel: tx.sender_alias || 'Anonymous Sender' })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const completedTransactions = transactions.filter(tx => tx.status === 'completed')
  const receivedTransactions = completedTransactions.filter(tx => tx.direction === 'received')
  const sentTransactions = completedTransactions.filter(tx => tx.direction === 'sent')
  const totalReceived = receivedTransactions.reduce((sum, tx) => sum + Number(tx.amount_inr), 0)
  const totalSent = sentTransactions.reduce((sum, tx) => sum + Number(tx.amount_inr), 0)
  const receivedCount = receivedTransactions.length
  const sentCount = sentTransactions.length
  const sevenDayData = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - (6 - index))
    const nextDay = new Date(day)
    nextDay.setDate(nextDay.getDate() + 1)
    const dayTransactions = completedTransactions.filter(tx => {
      const timestamp = new Date(tx.created_at).getTime()
      return timestamp >= day.getTime() && timestamp < nextDay.getTime()
    })
    const received = dayTransactions.filter(tx => tx.direction === 'received').reduce((sum, tx) => sum + Number(tx.amount_inr), 0)
    const sent = dayTransactions.filter(tx => tx.direction === 'sent').reduce((sum, tx) => sum + Number(tx.amount_inr), 0)
    return {
      key: day.toISOString().slice(0, 10),
      dayName: day.toLocaleDateString('en-IN', { weekday: 'short' }),
      dateLabel: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      received,
      sent,
    }
  })
  const sevenDayReceived = sevenDayData.reduce((sum, day) => sum + day.received, 0)
  const sevenDaySent = sevenDayData.reduce((sum, day) => sum + day.sent, 0)
  const maxDayValue = Math.max(...sevenDayData.flatMap(day => [day.received, day.sent]), 100)
  const allTx = ledgerTransactions
  const receivedTx = ledgerTransactions.filter(tx => tx.direction === 'received')
  const sentTx = ledgerTransactions.filter(tx => tx.direction === 'sent')
  const filteredTransactions = txFilter === 'all' ? allTx : txFilter === 'received' ? receivedTx : sentTx
  const avatarUrl = profile?.avatar_url && /^https?:\/\//i.test(profile.avatar_url) ? profile.avatar_url : null

  async function copyLink() {
    if (!profile) return
    await navigator.clipboard.writeText(`${window.location.origin}/${formatHandle(profile.alias_handle)}`)
    setCopied(true); window.setTimeout(() => setCopied(false), 1800)
  }

  async function refreshAfterTransfer(fallbackBalance?: number) {
    if (!supabase) return
    const client = supabase
    const { data: wallet, error: walletError } = await client.from('users').select('wallet_balance').eq('id', session.user.id).single()
    if (walletError) {
      if (fallbackBalance !== undefined) setProfile(current => current ? { ...current, wallet_balance: fallbackBalance } : current)
      throw walletError
    }
    setProfile(current => current ? { ...current, wallet_balance: Number(wallet.wallet_balance) } : current)

    setTransactions(await fetchLedgerTransactions(session.user.id))
  }

  async function submitTransfer(event: FormEvent) {
    event.preventDefault()
    if (!supabase) { showTransferToast('error', 'Connect your GhostPay account to send money.'); return }
    const recipient = transferRecipient.trim()
    const amount = Number(transferAmount)
    if (!recipient) { showTransferToast('error', 'Enter a recipient handle or UPI ID.'); return }
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
      showTransferToast('error', 'Enter a valid amount with up to two decimal places.')
      return
    }
    setTransferBusy(true)
    try {
      const { data, error: transferError } = await supabase.rpc('transfer_wallet_balance', {
        sender_uid: session.user.id,
        receiver_identifier: recipient,
        transfer_amount: amount,
      })
      if (transferError) {
        const message = transferError.message.toUpperCase()
        if (message.includes('INSUFFICIENT_WALLET_BALANCE')) throw new Error('Insufficient wallet balance for this transfer.')
        if (message.includes('RECEIVER_NOT_FOUND')) throw new Error('Recipient not found. Check the @handle or UPI ID.')
        if (message.includes('CANNOT_TRANSFER_TO_SELF')) throw new Error('You can’t send money to your own account.')
        if (message.includes('INVALID_TRANSFER_AMOUNT') || message.includes('TRANSFER_AMOUNT_TOO_LARGE')) throw new Error('Enter a valid transfer amount.')
        throw new Error(transferError.message)
      }
      const result = data as { wallet_balance?: number } | null
      setTransferRecipient('')
      setTransferAmount('')
      if (result?.wallet_balance !== undefined) {
        setProfile(current => current ? { ...current, wallet_balance: Number(result.wallet_balance) } : current)
      }
      showTransferToast('success', 'Money sent securely.')
      try {
        await refreshAfterTransfer(result?.wallet_balance === undefined ? undefined : Number(result.wallet_balance))
      } catch {
        // The transfer already succeeded; keep the balance returned by the RPC and
        // allow a later dashboard refresh to reconcile any transient read failure.
      }
    } catch (transferFailure) {
      showTransferToast('error', transferFailure instanceof Error ? transferFailure.message : 'Transfer failed. Please try again.')
    } finally {
      setTransferBusy(false)
    }
  }

  function openProfileEditor() {
    setProfileMenuOpen(false)
    setEditHandle(profile?.alias_handle ?? '')
    setEditEmail(session.user.email ?? '')
    setEditPassword('')
    setEditFullName(profile?.real_legal_name ?? '')
    setEditUpi(profile?.real_upi_id ?? '')
    setEditAvatar(profile?.avatar_url ?? '')
    setProfileEditError('')
    setEditProfileModalOpen(true)
  }

  async function handleSaveProfileAndAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setProfileEditError('Connect your Supabase project to update your account.'); return }
    const cleanedHandle = editHandle.trim().replace(/^@+/, '').toLowerCase()
    if (!cleanedHandle) { setProfileEditError('Handle cannot be empty.'); return }
    if (!/^[a-z0-9_][a-z0-9_.]{2,29}$/.test(cleanedHandle)) {
      setProfileEditError('Use 3–30 letters, numbers, dots, or underscores for your handle.')
      return
    }
    if (editPassword.trim().length > 0 && editPassword.trim().length < 6) {
      setProfileEditError('New password must be at least 6 characters.')
      return
    }
    const cleanedAvatar = editAvatar.trim()
    if (cleanedAvatar.startsWith('preset:') && !avatarPresets.includes(cleanedAvatar.slice(7))) {
      setProfileEditError('Choose one of the available avatar presets.')
      return
    }
    if (cleanedAvatar && !cleanedAvatar.startsWith('preset:')) {
      try { if (!['http:', 'https:'].includes(new URL(cleanedAvatar).protocol)) throw new Error() }
      catch { setProfileEditError('Enter a valid image URL or choose an avatar preset.'); return }
    }

    setIsSavingProfile(true)
    setProfileEditError('')
    const aliasChanged = cleanedHandle !== profile?.alias_handle
    let databaseProfileUpdated = false
    let updatedProfile: Profile | null = null
    try {
      if (aliasChanged) {
        const { error: handleErr } = await supabase.from('profiles').upsert({ id: session.user.id, alias_handle: cleanedHandle }, { onConflict: 'id' })
        if (handleErr) throw handleErr
      }

      const { data: savedProfile, error: profileErr } = await supabase.from('users').update({
        alias_handle: cleanedHandle,
        real_legal_name: editFullName.trim(),
        real_upi_id: editUpi.trim(),
        avatar_url: cleanedAvatar || null,
      }).eq('id', session.user.id).select('id, alias_handle, real_legal_name, real_upi_id, avatar_url, wallet_balance').single()
      if (profileErr) throw profileErr
      updatedProfile = savedProfile
      databaseProfileUpdated = true

      const authUpdates: { email?: string; password?: string } = {}
      if (editEmail.trim() && editEmail.trim() !== session.user.email) authUpdates.email = editEmail.trim()
      if (editPassword.trim().length > 0) authUpdates.password = editPassword.trim()
      if (Object.keys(authUpdates).length > 0) {
        const { error: authErr } = await supabase.auth.updateUser(authUpdates)
        if (authErr) throw authErr
      }

      if (updatedProfile) setProfile(updatedProfile)
      setEditPassword('')
      setEditProfileModalOpen(false)
      showTransferToast('success', authUpdates.email
        ? 'Profile updated. Check your inbox to confirm your new email.'
        : 'Profile and account settings updated.')
    } catch (saveError) {
      if (aliasChanged) {
        await supabase.from('profiles').upsert({ id: session.user.id, alias_handle: profile?.alias_handle ?? '' }, { onConflict: 'id' })
      }
      if (databaseProfileUpdated && profile) {
        await supabase.from('users').update({
          alias_handle: profile.alias_handle,
          real_legal_name: profile.real_legal_name,
          real_upi_id: profile.real_upi_id,
          avatar_url: profile.avatar_url,
        }).eq('id', session.user.id)
      }
      const message = saveError instanceof Error ? saveError.message : 'Profile update failed. Please try again.'
      setProfileEditError(message)
      showTransferToast('error', `Error: ${message}`)
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function signOut() {
    onResetTheme()
    await supabase?.auth.signOut()
  }
  return <main className="dashboard-page">
    <header className="dashboard-topbar"><Brand /><div className="topbar-actions"><span className="secure-pill"><span /> SECURE SPACE</span><button className="icon-button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><div className="profile-menu-wrap" ref={profileMenuRef}><button type="button" className="avatar profile-avatar-button" onClick={() => setProfileMenuOpen(open => !open)} aria-label="Open profile menu" aria-expanded={profileMenuOpen} disabled={!profile}>{avatarUrl ? <img src={avatarUrl} alt="Profile" /> : <span className={`avatar-monogram ${profile?.avatar_url?.startsWith('preset:') ? `avatar-${profile.avatar_url.slice(7)}` : ''}`}>{profile?.avatar_url?.startsWith('preset:') ? profile.avatar_url.slice(7, 8).toUpperCase() : profile?.alias_handle?.slice(0, 1).toUpperCase() ?? session.user.email?.slice(0, 1).toUpperCase() ?? 'G'}</span>}</button>{profileMenuOpen && <div className="profile-dropdown" role="menu"><div className="profile-dropdown-identity"><strong>{formatHandle(profile?.alias_handle ?? '')}</strong><span>{session.user.email ?? 'Email unavailable'}</span></div><button type="button" role="menuitem" onClick={openProfileEditor}>Edit Profile &amp; Email</button><button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); setQrOpen(true) }}>Share QR Code</button><button type="button" role="menuitem" className="profile-dropdown-signout" onClick={signOut}>Sign Out</button></div>}</div></div></header>
    <div className="dashboard-container">
      <div className="dashboard-welcome"><div><div className="form-eyebrow">YOUR PRIVATE WORKSPACE</div><h1>Good to see you<span>.</span></h1><p>Here’s what’s happening with your payments.</p></div><div className="dashboard-actions"><button className="button button-secondary" onClick={() => setQrOpen(true)} disabled={!profile}><QrCode size={16} /> Share QR Code</button></div></div>
      {error && <div className="notice-error">{error}</div>}
      <section className="receive-card"><div className="receive-copy"><span className="receive-label"><span className="pulse-dot" /> READY TO RECEIVE</span><h2>Your Shielded Link</h2><p>Share your link with clients. Your personal details stay private.</p><div className="link-field"><div className="link-icon"><Shield size={16} /></div><span className="link-prefix">{window.location.host}/</span><strong>{profile ? formatHandle(profile.alias_handle) : '…'}</strong><button onClick={copyLink} disabled={!profile} aria-label="Copy Link">{copied ? <Check size={17} /> : <Copy size={17} />}<span>{copied ? 'Copied!' : 'Copy Link'}</span></button></div></div></section>
      <section className="send-money-card" aria-labelledby="send-money-title">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', paddingBottom: '22px', marginBottom: '22px', borderBottom: '1px solid rgba(148, 163, 184, 0.16)' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2563EB', marginBottom: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.18)' }} />
              AVAILABLE WALLET BALANCE
            </div>
            <div style={{ fontSize: 'clamp(34px, 5vw, 46px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
              {busy ? '—' : `₹${Number(profile?.wallet_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div id="send-money-title" style={{ fontSize: '16px', fontWeight: 700 }}>Send Money</div>
            <div style={{ fontSize: '13px', opacity: 0.7 }}>Instant zero-fee transfer to any @handle or UPI ID</div>
          </div>
        </div>
        <form className="send-money-form" onSubmit={submitTransfer}>
          <label>Recipient @handle or UPI ID<input autoCapitalize="none" autoComplete="off" placeholder="@username or name@bank" value={transferRecipient} onChange={event => setTransferRecipient(event.target.value)} disabled={transferBusy} required /></label>
          <label>Amount (₹)<input inputMode="decimal" type="number" min="0.01" max="1000000" step="0.01" placeholder="0.00" value={transferAmount} onChange={event => setTransferAmount(event.target.value)} disabled={transferBusy} required /></label>
          <button className="button button-primary send-money-submit" disabled={transferBusy || busy || !profile}>{transferBusy ? <><span className="spinner auth-button-spinner" /> Sending securely…</> : <>Send Securely <ArrowRight size={16} /></>}</button>
        </form>
      </section>
      <section className="analytics-section" aria-labelledby="analytics-title">
        <div className="analytics-heading"><div><div className="form-eyebrow">PERFORMANCE</div><h2 id="analytics-title">Analytics</h2></div><span className="analytics-note">Completed transactions</span></div>
        <div className="stats-grid">
          <section className="stat-card"><span className="stat-caption">TOTAL RECEIVED</span><div className="stat-value numeric-data cashflow-received">{busy ? '—' : `+₹${totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</div><span className="stat-sub">{receivedCount} incoming payments</span></section>
          <section className="stat-card"><span className="stat-caption">TOTAL SENT</span><div className="stat-value numeric-data cashflow-sent">{busy ? '—' : `-₹${totalSent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</div><span className="stat-sub">{sentCount} outgoing transfers</span></section>
          <section className="stat-card"><span className="stat-caption">TOTAL TRANSACTIONS</span><div className="stat-value numeric-data cashflow-total">{busy ? '—' : (receivedCount + sentCount).toLocaleString('en-IN')}</div><span className="stat-sub">{receivedCount} received · {sentCount} sent</span></section>
        </div>
        <section className="activity-card">
          <div className="activity-heading"><div><h3>Recent 7-Day Activity</h3><p>Completed money received and sent</p></div>
            <div className="cashflow-legend">
              <span className="cashflow-legend-received"><i />Received (+₹{sevenDayReceived.toLocaleString('en-IN')})</span>
              <span className="cashflow-legend-sent"><i />Sent (-₹{sevenDaySent.toLocaleString('en-IN')})</span>
            </div>
          </div>
          {busy ? <div className="transactions-loading"><span className="spinner" /></div> : transactions.length === 0 ? <div className="activity-empty"><Activity size={27} strokeWidth={1.25} /><p>No recent activity</p></div> : <div className={`cashflow-chart ${chartReady ? 'is-ready' : ''}`} role="img" aria-label="Received and sent transaction totals over the last seven days">
            {sevenDayData.map(day => {
              const recHeight = day.received > 0 ? Math.max(Math.round((day.received / maxDayValue) * 140), 14) : 4
              const sentHeight = day.sent > 0 ? Math.max(Math.round((day.sent / maxDayValue) * 140), 14) : 4
              return <div key={day.key} className="cashflow-chart-day">
                <div className="cashflow-chart-values">
                  {day.received > 0 && <span className="cashflow-received">+₹{Math.round(day.received).toLocaleString('en-IN')}</span>}
                  {day.sent > 0 && <span className="cashflow-sent">-₹{Math.round(day.sent).toLocaleString('en-IN')}</span>}
                </div>
                <div className="cashflow-chart-track">
                  <div title={`Received: ₹${day.received}`} className={`cashflow-chart-bar ${day.received > 0 ? 'received' : 'zero'}`} style={{ height: `${recHeight}px` }} />
                  <div title={`Sent: ₹${day.sent}`} className={`cashflow-chart-bar ${day.sent > 0 ? 'sent' : 'zero'}`} style={{ height: `${sentHeight}px` }} />
                </div>
                <div className="cashflow-chart-label"><div>{day.dayName}</div><small>{day.dateLabel}</small></div>
              </div>
            })}
          </div>}
        </section>
      </section>
      <section className="transactions-card">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Recent Transactions</h3>
            <p style={{ fontSize: '13px', opacity: 0.68, margin: '4px 0 0' }}>Your incoming and outgoing GhostPay activity</p>
          </div>
          <div className={`tx-filter-segment active-${txFilter}`} role="tablist" aria-label="Filter transactions">
            <span className="tx-filter-indicator" aria-hidden="true" />
            {[
              { key: 'all', label: `All (${allTx.length})` },
              { key: 'received', label: `Received (${receivedTx.length})` },
              { key: 'sent', label: `Sent (${sentTx.length})` },
            ].map(tab => {
              const filterKey = tab.key as 'all' | 'received' | 'sent'
              const active = txFilter === filterKey
              return <button key={tab.key} type="button" role="tab" aria-selected={active} onClick={() => setTxFilter(filterKey)} className={active ? `active ${filterKey}` : ''}>{tab.label}</button>
            })}
          </div>
        </div>
        {busy ? <div className="transactions-loading"><span className="spinner" /></div> : filteredTransactions.length === 0 ? <div className="ledger-empty ledger-list-empty">{txFilter === 'sent' ? 'No sent transactions yet' : txFilter === 'received' ? 'No received payments yet' : 'No transactions yet'}</div> : <div className="ledger-rows ledger-list-scroll" style={{ maxHeight: '480px', overflowY: 'auto' }}>{filteredTransactions.map(tx => {
          const direction = tx.direction ?? 'received'
          const received = direction === 'received'
          const date = new Date(tx.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
          return <div className="ledger-row" key={tx.id}>
            <div className={`ledger-direction-icon ${received ? 'received' : 'sent'}`} aria-label={received ? 'Received' : 'Sent'}>{received ? '↙' : '↗'}</div>
            <div className="ledger-counterparty"><strong>{tx.counterpartyLabel || tx.sender_name || tx.sender_alias || 'Anonymous Sender'}</strong><span className="numeric-data">{date}</span></div>
            <div className="ledger-amount-status"><strong className={`numeric-data ${received ? 'cashflow-received' : 'cashflow-sent'}`}>{received ? '+' : '-'}₹{Number(tx.amount_inr).toFixed(2)}</strong><span className={received ? 'received' : 'sent'}>{tx.status === 'completed' ? received ? 'Received' : 'Sent' : tx.status.replaceAll('_', ' ')}</span></div>
          </div>
        })}</div>}
      </section>
      <footer className="dashboard-footer"><span><LockKeyhole size={13} /> Your privacy is always on.</span><button aria-label="Help"><CircleHelp size={15} /> Help & support</button></footer>
    </div>
    {qrOpen && profile && <ShareQrModal profile={profile} onClose={() => setQrOpen(false)} />}
    {editProfileModalOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditProfileModalOpen(false) }}>
      <section className="profile-modal account-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-account-title">
        <header className="modal-heading"><div><div className="form-eyebrow">ACCOUNT SETTINGS</div><h2 id="edit-account-title">Edit Profile &amp; Account</h2></div><button type="button" className="icon-button" onClick={() => setEditProfileModalOpen(false)} aria-label="Close"><X size={17} /></button></header>
        <form className="form-stack" onSubmit={handleSaveProfileAndAccount}>
          <label>GhostPay Handle (@handle)<input autoCapitalize="none" value={editHandle} onChange={event => setEditHandle(event.target.value)} required /></label>
          <label>Full Name<input autoComplete="name" value={editFullName} onChange={event => setEditFullName(event.target.value)} required /></label>
          <label>UPI ID<input autoCapitalize="none" value={editUpi} onChange={event => setEditUpi(event.target.value)} required /></label>
          <label>Email Address<input type="email" autoComplete="email" value={editEmail} onChange={event => setEditEmail(event.target.value)} required /></label>
          <label>New Password (optional)<input type="password" autoComplete="new-password" minLength={6} placeholder="Leave blank to keep current" value={editPassword} onChange={event => setEditPassword(event.target.value)} /></label>
          <fieldset className="avatar-picker"><legend>Avatar / PFP</legend><div className="avatar-presets">{avatarPresets.map(preset => <button key={preset} type="button" className={`avatar-preset avatar-${preset} ${editAvatar === `preset:${preset}` ? 'selected' : ''}`} aria-label={`Choose ${preset} avatar`} aria-pressed={editAvatar === `preset:${preset}`} onClick={() => setEditAvatar(`preset:${preset}`)}>{preset.slice(0, 1).toUpperCase()}</button>)}</div><label>Or use an image URL<input type="url" placeholder="https://example.com/avatar.png" value={editAvatar.startsWith('preset:') ? '' : editAvatar} onChange={event => setEditAvatar(event.target.value)} /></label></fieldset>
          {profileEditError && <p className="error-note" role="alert">{profileEditError}</p>}
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setEditProfileModalOpen(false)}>Cancel</button><button className="button button-primary" disabled={isSavingProfile}>{isSavingProfile ? 'Saving…' : 'Save changes'}<Check size={16} /></button></div>
        </form>
        <p className="modal-privacy"><LockKeyhole size={13} /> Your private account details are only visible to you.</p>
      </section>
    </div>}
    {transferToast && <div className={`transfer-toast ${transferToast.kind}`} role={transferToast.kind === 'error' ? 'alert' : 'status'}>{transferToast.message}</div>}
  </main>
}

function ShareQrModal({ profile, onClose }: { profile: Pick<Profile, 'alias_handle'>; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState(false)
  const [shareNotice, setShareNotice] = useState('')
  const shareToastTimer = useRef<number | null>(null)
  const receiverHandle = profile.alias_handle.replace(/^@+/, '')
  const qrPayload = `https://ghostpay-orpin.vercel.app/@${profile.alias_handle}`
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`

  useEffect(() => () => {
    if (shareToastTimer.current !== null) window.clearTimeout(shareToastTimer.current)
  }, [])

  const toast = {
    success(message: string) {
      setError('')
      setShareNotice(message)
      if (shareToastTimer.current !== null) window.clearTimeout(shareToastTimer.current)
      shareToastTimer.current = window.setTimeout(() => { setShareNotice(''); shareToastTimer.current = null }, 2500)
    },
    error(message: string) {
      setShareNotice('')
      setError(message)
    },
  }

  const generateBrandedCardBlob = async (): Promise<Blob> => {
    const cardElement = document.getElementById('ghostpay-export-card');
    if (!cardElement) {
      throw new Error('Card element not found in DOM');
    }

    const blob = await toBlob(cardElement, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });

    if (!blob) {
      throw new Error('Could not render image blob');
    }

    return blob;
  };

  const triggerBlobDownload = (blob: Blob, handle: string) => {
    const dataUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `GhostPay-${handle}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(dataUrl);
  };

  const handleDownloadQR = async () => {
    setError('');
    setDownloading(true);
    try {
      const handle = profile?.alias_handle || 'user';
      const blob = await generateBrandedCardBlob();
      triggerBlobDownload(blob, handle);
      toast.success('Branded QR card downloaded!');
    } catch (downloadError) {
      console.error('Download QR failed:', downloadError);
      const message = downloadError instanceof Error ? downloadError.message : String(downloadError);
      toast.error(`Error: ${message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    try {
      const handle = profile?.alias_handle || 'user';

      // 1. Fetch Quote with Fallback
      let dynamicQuote = "Trust is an expensive thing, cheap people can't afford it.";
      try {
        const quoteRes = await fetch('https://dummyjson.com/quotes/random');
        const quoteData = await quoteRes.json();
        if (quoteData.quote) dynamicQuote = quoteData.quote;
      } catch (apiErr) {
        console.log('Quote fetch failed, using fallback quote.');
      }

      const shareUrl = `https://ghostpay-orpin.vercel.app/@${handle}`;
      const shareText = `Pay me securely here: ${shareUrl}\n\n"${dynamicQuote}"`;
      const blob = await generateBrandedCardBlob();
      const file = new File([blob], `ghostpay-${handle}.png`, { type: 'image/png' });
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isMobile && navigator.share) {
        try {
          await navigator.share({
            files: [file],
            title: 'GhostPay',
            text: shareText
          });
          return;
        } catch (shareErr) {
          console.log('Native share blocked, falling back to download.', shareErr);
        }
      }

      triggerBlobDownload(blob, handle);
      await navigator.clipboard.writeText(shareText);
      toast.success("Card downloaded & text copied!");
    } catch (shareError) {
      console.error('Share system failed:', shareError);
      const message = shareError instanceof Error ? shareError.message : String(shareError);
      toast.error(`Error: ${message}`);
    }
  };

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="profile-modal qr-modal" role="dialog" aria-modal="true" aria-labelledby="share-qr-title">
      <header className="modal-heading"><div><div className="form-eyebrow">PUBLIC PAYMENT LINK</div><h2 id="share-qr-title">Your payment QR</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={17} /></button></header>
      <div className="qr-image-frame">{imageError ? <p className="qr-image-error" role="status">QR preview could not load. Check your connection and try again.</p> : <img src={qrImageUrl} width="250" height="250" alt={`GhostPay payment portal QR for @${receiverHandle}`} referrerPolicy="no-referrer" onError={() => setImageError(true)} />}</div>
      <div className="upi-qr-caption"><h3>Scan to open payment portal.</h3></div>
      <div className="qr-action-row">
        <button className="button qr-action-button qr-share-action" onClick={handleShare}><Share2 size={16} /> Share Profile</button>
        <button className="button qr-action-button qr-download-action" onClick={handleDownloadQR} disabled={downloading}>{downloading ? 'Preparing…' : <><Download size={17} /> Download QR</>}</button>
      </div>
      {shareNotice && <div className="payment-toast" role="status">{shareNotice}</div>}
      {error && <p className="error-note qr-error" role="alert">{error}</p>}
      <p className="modal-privacy"><LockKeyhole size={13} /> Payments route through GhostPay to keep your real identity completely hidden.</p>
    </section>
    <div style={{ position: 'fixed', top: 0, left: 0, zIndex: -9999, opacity: 0.01, pointerEvents: 'none' }}>
      <div
        id="ghostpay-export-card"
        style={{
          width: '380px',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <span style={{ color: '#2563EB', fontWeight: 'bold', fontSize: '20px' }}>ghostpay</span>
        </div>

        <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '16px', backgroundColor: '#f9fafb', marginBottom: '24px' }}>
          <QRCode value={`https://ghostpay-orpin.vercel.app/@${profile.alias_handle}`} size={200} />
        </div>

        <div style={{ fontSize: '16px', color: '#4b5563', fontWeight: '500' }}>
          @{profile.alias_handle}
        </div>
      </div>
    </div>
  </div>
}

const avatarPresets = ['blue', 'indigo', 'violet', 'amber', 'slate']

function PaymentPage() {
  const { handle = '' } = useParams()
  const aliasHandle = handle.replace(/^@+/, '').toLowerCase()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Pick<Profile, 'id' | 'alias_handle'> | null>(null)
  const [visitorSession, setVisitorSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [walletBusy, setWalletBusy] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'upi'>('wallet')
  const [amount, setAmount] = useState('')
  const [senderName, setSenderName] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [paymentStage, setPaymentStage] = useState<'idle' | 'processing' | 'complete'>('idle')
  const toastTimer = useRef<number | null>(null)
  const user = visitorSession?.user
  const canUseWallet = Boolean(user && profile && user.id !== profile.id)
  const selectedPaymentMethod = canUseWallet ? paymentMethod : 'upi'

  function showToast(message: string) {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => { setToast(''); toastTimer.current = null }, 5000)
  }

  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current) }, [])

  useEffect(() => {
    setPaymentMethod(canUseWallet ? 'wallet' : 'upi')
  }, [canUseWallet])

  useEffect(() => {
    let active = true
    if (!supabase) { setAuthReady(true); return }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setVisitorSession(nextSession)
      setAuthReady(true)
    })
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      setVisitorSession(sessionError ? null : data.session)
      setAuthReady(true)
    }).catch(() => { if (active) { setVisitorSession(null); setAuthReady(true) } })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

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
        showToast('Your wallet balance is unavailable right now. You can still use an external UPI app.')
      } else setWalletBalance(data ? Number(data.wallet_balance) : 0)
      setWalletBusy(false)
    })
    return () => { active = false }
  }, [visitorSession?.user.id])

  useEffect(() => {
    let active = true
    async function loadReceiver() {
      if (!supabase) { setError('This payment page is not connected yet.'); return }
      const { data, error: queryError } = await supabase.from('profiles').select('id, alias_handle').eq('alias_handle', aliasHandle).maybeSingle()
      if (!active) return
      if (queryError) setError(queryError.message)
      else if (!data) setError('We couldn’t find this payment link. Check the address and try again.')
      else setProfile(data)
    }
    void loadReceiver()
    return () => { active = false }
  }, [aliasHandle])

  async function startPayment(event: FormEvent) {
    event.preventDefault()
    setError('')
    setToast('')
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0 || Math.round(value * 100) !== value * 100) {
      showToast('Enter a valid amount with up to two decimal places.')
      return
    }
    if (!profile) { showToast('This payment link is not ready yet.'); return }

    if (!supabase) { showToast('Wallet payments are unavailable right now.'); return }
    const useWallet = Boolean(canUseWallet && selectedPaymentMethod === 'wallet')
    if (!useWallet && !senderName.trim()) { showToast('Please enter your name to continue.'); return }
    if (useWallet && walletBalance === null) { showToast('Your wallet balance is still loading. Please try again.'); return }
    const accountAlias = visitorSession && typeof visitorSession.user.user_metadata.alias_handle === 'string'
      ? formatHandle(visitorSession.user.user_metadata.alias_handle)
      : 'GhostPay User'
    const resolvedSenderName = useWallet ? accountAlias : senderName.trim() || (visitorSession ? accountAlias : 'Anonymous')

    setBusy(true)
    setPaymentStage('processing')
    try {
      const { data, error: transferError } = await supabase.rpc('simulate_escrow_payment', {
        p_receiver_handle: profile.alias_handle,
        p_amount: value,
        p_sender_name: resolvedSenderName,
        p_use_wallet: useWallet,
      })
      if (transferError) {
        if (transferError.message.includes('INSUFFICIENT_WALLET_BALANCE')) {
          showToast('Insufficient GhostPay Wallet balance. Choose the simulated payment option instead.')
        } else if (transferError.message.includes('CANNOT_TRANSFER_TO_SELF')) {
          showToast('You can’t send a wallet payment to your own handle.')
        } else showToast('Wallet transfer couldn’t be completed. Please try again.')
        setPaymentStage('idle')
        setBusy(false)
        return
      }
      const transfer = data as { transaction_id?: string; wallet_balance?: number | string | null } | null
      const updatedBalance = transfer?.wallet_balance == null ? null : Number(transfer.wallet_balance)
      if (!transfer?.transaction_id || (updatedBalance !== null && !Number.isFinite(updatedBalance))) throw new Error('Payment confirmation was missing.')
      if (useWallet && updatedBalance !== null) setWalletBalance(updatedBalance)
      setPaymentStage('complete')
      await new Promise(resolve => window.setTimeout(resolve, 650))
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
      setPaymentStage('idle')
      setBusy(false)
      showToast('Wallet transfer couldn’t be completed. Please try again.')
    }
  }

  const formattedWalletBalance = walletBalance === null ? '—' : `₹${walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return <main className="payment-page">
    {toast && <div className="payment-toast" role="alert">{toast}</div>}
    <header className="payment-topbar"><Brand /><span className="secure-pill"><LockKeyhole size={12} /> GHOSTPAY NODAL</span></header>
    <div className="payment-wrap">
      <Link to="/login" className="back-link"><ArrowLeft size={15} /> GhostPay</Link>
      <section className="payment-card">
        <div className="payment-card-top"><div className="receiver-avatar"><Shield size={22} /></div><span className="verified-badge"><ShieldCheck size={13} /> VERIFIED LINK</span></div>
        {paymentStage === 'idle' ? <>
          <div className="form-eyebrow">A PRIVATE PAYMENT</div>
          <h1>{profile ? <>Pay {formatHandle(profile.alias_handle)} Securely</> : `Pay ${formatHandle(aliasHandle)} Securely`}</h1>
          <p className="payment-subtext">Complete a simulated payment to this creator.</p>
          <form onSubmit={startPayment} className="payment-form">
            {authReady && (!visitorSession || selectedPaymentMethod === 'upi') && <label>Your Name<input type="text" maxLength={80} placeholder="Your Name" aria-required="true" value={senderName} onChange={event => setSenderName(event.target.value)} /></label>}
            <label>Amount (₹)<div className="amount-input amount-input-large"><span>₹</span><input className="numeric-data" inputMode="decimal" type="number" min="1" step="0.01" placeholder="0.00" value={amount} onChange={event => setAmount(event.target.value)} required /></div></label>
            {error && <p className="error-note">{error}</p>}
            {!authReady ? <button className="button button-primary full-button" type="button" disabled><span className="spinner auth-button-spinner" /> Checking secure session…</button> : canUseWallet ? <>
              <div className="payment-mode-options" role="radiogroup" aria-label="Payment method">
                <button type="button" role="radio" aria-checked={selectedPaymentMethod === 'wallet'} className={`payment-option ${selectedPaymentMethod === 'wallet' ? 'selected' : ''}`} onClick={() => setPaymentMethod('wallet')}>
                  <span className="payment-option-heading"><span className="payment-option-radio" /> GhostPay Wallet</span>
                  <span className="payment-option-balance">{walletBusy ? 'Loading balance…' : formattedWalletBalance}</span>
                  <span className="payment-option-caption">Available balance</span>
                </button>
                <button type="button" role="radio" aria-checked={selectedPaymentMethod === 'upi'} className={`payment-option ${selectedPaymentMethod === 'upi' ? 'selected' : ''}`} onClick={() => setPaymentMethod('upi')}>
                  <span className="payment-option-heading"><span className="payment-option-radio" /> Simulated Payment</span>
                  <span className="payment-option-balance payment-option-secondary">Simulated nodal checkout</span>
                  <span className="payment-option-caption">Demo checkout · no app opens</span>
                </button>
              </div>
              <button className="button button-primary full-button" disabled={!profile || busy || (selectedPaymentMethod === 'wallet' && (walletBusy || walletBalance === null))}>
                {busy ? <><span className="spinner auth-button-spinner" /> Processing simulation…</> : <>Send Securely <ArrowRight size={17} /></>}
              </button>
            </> : <button className="button button-primary full-button" disabled={!profile || busy}>{busy ? <><span className="spinner auth-button-spinner" /> Processing simulation…</> : <>Send Securely <ArrowRight size={17} /></>}</button>}
          </form>
          <div className="payment-trust"><ShieldCheck size={16} /><span>Your personal details remain hidden from the receiver.</span></div>
        </> : <div className={`payment-progress ${paymentStage}`} aria-live="polite"><div className={`payment-progress-icon ${paymentStage}`}>{paymentStage === 'processing' ? <span className="payment-spinner" aria-hidden="true" /> : <Check size={20} strokeWidth={2} />}</div><h1>{paymentStage === 'processing' ? 'Processing secure payment' : 'Payment simulation complete'}</h1><p>{paymentStage === 'processing' ? 'Your demo transaction is being recorded.' : 'The completed demo payment is recorded.'}</p></div>}
      </section>
      <p className="payment-footer"><LockKeyhole size={12} /> Payments route through GhostPay’s nodal account.</p>
    </div>
  </main>
}
function PaymentReturnPage() {
  return <main className="payment-page"><header className="payment-topbar"><Brand /><span className="secure-pill"><LockKeyhole size={12} /> SECURE PAYMENT</span></header><div className="payment-wrap"><section className="payment-card return-card"><div className="receiver-avatar"><ShieldCheck size={23} /></div><div className="form-eyebrow">PAYMENT STATUS</div><h1>We’re confirming your payment.</h1><p className="payment-subtext">Cashfree is sending us a secure confirmation. You can close this page safely.</p><div className="payment-secure"><ShieldCheck size={16} /><span>We only confirm payments after checking with Cashfree.</span></div></section><p className="payment-footer"><LockKeyhole size={12} /> Protected by GhostPay</p></div></main>
}

function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const receiptState = location.state as {
    amount?: number
    alias?: string
    senderAlias?: string
    paymentMode?: 'wallet' | 'simulated'
    transactionId?: string
  } | null
  const walletTransfer = receiptState?.paymentMode === 'wallet'
  const amount = Number(receiptState?.amount ?? searchParams.get('amount'))
  const alias = receiptState?.alias ?? searchParams.get('alias')
  const senderAlias = receiptState?.senderAlias?.trim() || 'Anonymous'
  const [receiptDate] = useState(() => new Date())
  const [generatedTransactionId] = useState(() => `GP-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`)
  const transactionId = receiptState?.transactionId ?? generatedTransactionId
  const formattedAmount = Number.isFinite(amount) && amount > 0
    ? `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—'
  const receiptTitle = walletTransfer ? 'Wallet transfer receipt' : 'Payment receipt'
  const receiptCaption = walletTransfer ? 'A record of your GhostPay Wallet transfer' : 'A record of your GhostPay demo checkout'

  return <main className="payment-page receipt-print-root">
    <header className="payment-topbar receipt-screen-only"><Brand /><span className="secure-pill"><LockKeyhole size={12} /> {walletTransfer ? 'WALLET TRANSFER' : 'PAYMENT TEST'}</span></header>
    <div className="payment-wrap">
      <section className="payment-card return-card receipt-screen-only">
        <div className="receiver-avatar payment-success-mark"><Check size={23} /></div>
        <div className="form-eyebrow">{walletTransfer ? 'GHOSTPAY WALLET' : 'SIMULATED CHECKOUT'}</div>
        <h1>{walletTransfer ? 'Wallet Transfer Complete' : 'Payment Successful'}</h1>
        <p className="payment-subtext"><span className="numeric-data">{formattedAmount}</span> to {alias ? formatHandle(alias) : 'your creator'}</p>
        <div className="privacy-banner"><ShieldCheck size={16} /><span>{walletTransfer ? 'Your wallet transfer was recorded securely.' : 'This was a simulated payment. No money moved.'}</span></div>
      </section>
      <article className="receipt-card" aria-label="Payment receipt">
        <div className="receipt-brand"><span className="brand-mark"><Shield size={16} /></span><span>ghostpay</span></div>
        <div className="receipt-status"><Check size={16} /> {walletTransfer ? 'WALLET TRANSFER COMPLETE' : 'PAYMENT SIMULATED'}</div>
        <h1>{receiptTitle}</h1>
        <p className="receipt-caption">{receiptCaption}</p>
        <div className="receipt-amount numeric-data">{formattedAmount}</div>
        <dl className="receipt-details">
          <div><dt>Paid by</dt><dd>{senderAlias}</dd></div>
          <div><dt>Paid to</dt><dd>{alias ? formatHandle(alias) : 'Creator'}</dd></div>
          <div><dt>Date</dt><dd className="numeric-data">{receiptDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
          <div><dt>Transaction ID</dt><dd className="numeric-data">{transactionId}</dd></div>
        </dl>
        <p className="receipt-disclaimer">{walletTransfer ? 'Internal GhostPay Wallet transfer · No external UPI app was used.' : 'Demo receipt only · No money was collected or transferred.'}</p>
      </article>
      <button className="button button-primary full-button receipt-download receipt-screen-only" onClick={() => window.print()}><Download size={17} /> Download Receipt</button>
      <Link className="button button-secondary full-button receipt-screen-only" to="/login">Back to GhostPay<ArrowRight size={17} /></Link>
      <p className="payment-footer receipt-screen-only"><LockKeyhole size={12} /> Test checkout complete</p>
    </div>
  </main>
}
export default App
