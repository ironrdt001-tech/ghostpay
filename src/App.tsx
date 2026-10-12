import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Activity, ArrowDownLeft, ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Copy, Download, Eye, EyeOff, FileCheck2, LockKeyhole, LogOut, Moon, Plus, QrCode, Shield, ShieldCheck, Sparkles, Sun, UploadCloud, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { formatHandle, supabase } from './lib/supabase'

type Profile = { id: string; alias_handle: string; real_legal_name?: string; real_upi_id?: string; avatar_url?: string | null; kyc_status?: 'unverified' | 'pending' | 'approved' }
type Transaction = { id: string; amount_inr: number; status: string; created_at: string; sender_alias?: string }
type DemoTransaction = Transaction & { receiver_id: string; sender_alias: string; status: 'simulated' }

function Brand({ light = false }: { light?: boolean }) {
  return <Link className={`brand ${light ? 'brand-light' : ''}`} to="/" aria-label="GhostPay home"><span className="brand-mark"><Shield size={17} strokeWidth={2.4} /></span><span>ghostpay</span></Link>
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return window.localStorage.getItem('ghostpay.theme') === 'dark' ? 'dark' : 'light' }
    catch { return 'light' }
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try { window.localStorage.setItem('ghostpay.theme', theme) } catch { /* storage can be disabled */ }
  }, [theme])

  function toggleTheme() {
    setTheme(current => current === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setSession(null)
      else setSession(data.session)
      setAuthReady(true)
    }).catch(() => { setSession(null); setAuthReady(true) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!authReady) return <div className="loading-screen"><Brand /><span className="spinner" /></div>

  return <>
    <Routes>
    <Route path="/" element={session ? <AuthenticatedRedirect session={session} /> : <AuthPage />} />
    <Route path="/login" element={session ? <AuthenticatedRedirect session={session} /> : <AuthPage initialMode="sign-in" />} />
    <Route path="/signup" element={session ? <AuthenticatedRedirect session={session} /> : <AuthPage initialMode="create-account" />} />
    <Route path="/onboarding" element={session ? <OnboardingPage session={session} /> : <Navigate to="/" replace />} />
    <Route path="/dashboard" element={session ? <DashboardPage session={session} theme={theme} onToggleTheme={toggleTheme} /> : <Navigate to="/" replace />} />
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
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (!supabase) { setError('Connect your Supabase project to continue.'); return }
    const cleanHandle = handle.trim().replace(/^@+/, '').toLowerCase()
    if (mode === 'create-account' && !/^[a-z0-9_][a-z0-9_.]{2,29}$/.test(cleanHandle)) {
      setError('Choose a handle with 3–30 letters, numbers, dots, or underscores.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'sign-in') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) { setError(authError.message); return }
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
        <div className="auth-mode-toggle" role="tablist" aria-label="Authentication mode"><button type="button" role="tab" aria-selected={!creatingAccount} className={!creatingAccount ? 'active' : ''} onClick={() => setMode('sign-in')}>Sign In</button><button type="button" role="tab" aria-selected={creatingAccount} className={creatingAccount ? 'active' : ''} onClick={() => setMode('create-account')}>Create Account</button></div>
        <form onSubmit={submit} className="form-stack">
          {creatingAccount && <label>Claim your @handle<div className="auth-handle-input"><span>@</span><input autoComplete="username" maxLength={30} placeholder="yourname" value={handle} onChange={event => setHandle(event.target.value.replace(/^@+/, ''))} required /></div><small>Your public payment link. You can use letters, numbers, dots, and underscores.</small></label>}
          <label>Email address<input autoComplete="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Password<div className="password-wrap"><input autoComplete={creatingAccount ? 'new-password' : 'current-password'} minLength={creatingAccount ? 8 : undefined} type={showPassword ? 'text' : 'password'} placeholder={creatingAccount ? 'At least 8 characters' : 'Enter your password'} value={password} onChange={e => setPassword(e.target.value)} required /><button className="reveal" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          {error && <p className="error-note">{error}</p>}
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

function DashboardPage({ session, theme, onToggleTheme }: { session: Session; theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [demoTransactions, setDemoTransactions] = useState<DemoTransaction[]>([])
  const [chartReady, setChartReady] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [kycOpen, setKycOpen] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setError('Connect your Supabase project to load your dashboard.'); setBusy(false); return }
      const client = supabase
      async function loadRealRows() {
        const rows: Transaction[] = []
        for (let from = 0; ; from += 1000) {
          const { data, error } = await client.from('transactions').select('id, amount_inr, status, created_at').eq('receiver_id', session.user.id).order('created_at', { ascending: false }).range(from, from + 999)
          if (error) return { rows: null as Transaction[] | null, error }
          rows.push(...(data ?? []) as Transaction[])
          if (!data || data.length < 1000) return { rows, error: null }
        }
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
        client.from('users').select('id, alias_handle, real_legal_name, real_upi_id, avatar_url, kyc_status').eq('id', session.user.id).maybeSingle(),
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

  const recentTransactions: Transaction[] = [...transactions, ...demoTransactions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
  const transactionCount = transactions.length + demoTransactions.length
  const settledTransactions = transactions.filter(tx => tx.status === 'payout_successful')
  const totalVolume = settledTransactions.reduce((sum, tx) => sum + Number(tx.amount_inr), 0)
  const now = Date.now()
  const todaysRevenue = settledTransactions.filter(tx => {
    const timestamp = new Date(tx.created_at).getTime()
    return timestamp >= now - 24 * 60 * 60 * 1000 && timestamp <= now
  }).reduce((sum, tx) => sum + Number(tx.amount_inr), 0)
  const activityDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - (6 - index))
    const nextDay = new Date(day)
    nextDay.setDate(nextDay.getDate() + 1)
    const volume = settledTransactions.filter(tx => {
      const timestamp = new Date(tx.created_at).getTime()
      return timestamp >= day.getTime() && timestamp < nextDay.getTime()
    }).reduce((sum, tx) => sum + Number(tx.amount_inr), 0)
    return { label: day.toLocaleDateString('en-IN', { weekday: 'short' }), date: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), volume }
  })
  const chartMaximum = Math.max(...activityDays.map(day => day.volume), 0)
  const chartBucket = (volume: number) => chartMaximum ? Math.max(10, Math.ceil(volume / chartMaximum * 10) * 10) : 0
  const avatarUrl = profile?.avatar_url && /^https?:\/\//i.test(profile.avatar_url) ? profile.avatar_url : null
  const kycStatus = profile?.kyc_status ?? 'unverified'
  const revenueLocked = kycStatus !== 'approved'

  async function copyLink() {
    if (!profile) return
    await navigator.clipboard.writeText(`${window.location.origin}/${formatHandle(profile.alias_handle)}`)
    setCopied(true); window.setTimeout(() => setCopied(false), 1800)
  }

  async function signOut() { await supabase?.auth.signOut() }
  return <main className="dashboard-page">
    <header className="dashboard-topbar"><Brand /><div className="topbar-actions"><span className="secure-pill"><span /> SECURE SPACE</span><button className="icon-button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><button className="icon-button" onClick={signOut} aria-label="Sign out"><LogOut size={17} /></button><div className="avatar">{avatarUrl ? <img src={avatarUrl} alt="Profile" /> : <span className={`avatar-monogram ${profile?.avatar_url?.startsWith('preset:') ? `avatar-${profile.avatar_url.slice(7)}` : ''}`}>{profile?.avatar_url?.startsWith('preset:') ? profile.avatar_url.slice(7, 8).toUpperCase() : session.user.email?.slice(0, 1).toUpperCase() ?? 'G'}</span>}</div></div></header>
    <div className="dashboard-container">
      <div className="dashboard-welcome"><div><div className="form-eyebrow">YOUR PRIVATE WORKSPACE</div><h1>Good to see you<span>.</span></h1><p>Here’s what’s happening with your payments.</p></div><div className="dashboard-actions"><button className="button button-secondary" onClick={() => setQrOpen(true)} disabled={!profile}><QrCode size={16} /> Share QR Code</button><button className="button button-outline" onClick={() => setEditOpen(true)} disabled={!profile}><Plus size={17} /> Edit profile</button></div></div>
      {error && <div className="notice-error">{error}</div>}
      <section className="receive-card"><div className="receive-copy"><span className="receive-label"><span className="pulse-dot" /> READY TO RECEIVE</span><h2>Your Shielded Link</h2><p>Share your link with clients. Your personal details stay private.</p><div className="link-field"><div className="link-icon"><Shield size={16} /></div><span className="link-prefix">{window.location.host}/</span><strong>{profile ? formatHandle(profile.alias_handle) : '…'}</strong><button onClick={copyLink} disabled={!profile} aria-label="Copy Link">{copied ? <Check size={17} /> : <Copy size={17} />}<span>{copied ? 'Copied!' : 'Copy Link'}</span></button></div></div></section>
      <div className={`revenue-gate ${revenueLocked ? 'is-locked' : ''}`}><div className="revenue-sections" aria-hidden={revenueLocked}>
      <section className="analytics-section" aria-labelledby="analytics-title"><div className="analytics-heading"><div><div className="form-eyebrow">PERFORMANCE</div><h2 id="analytics-title">Analytics</h2></div><span className="analytics-note">Settled payouts only</span></div>
        <div className="stats-grid"><section className="stat-card"><span className="stat-caption">TOTAL VOLUME</span><div className={`stat-value numeric-data ${totalVolume > 0 ? 'revenue-positive' : ''}`}>₹{busy ? '—' : totalVolume.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><span className="stat-sub">Successfully paid out</span></section><section className="stat-card"><span className="stat-caption">TODAY’S REVENUE</span><div className={`stat-value numeric-data ${todaysRevenue > 0 ? 'revenue-positive' : ''}`}>₹{busy ? '—' : todaysRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><span className="stat-sub">Last 24 hours</span></section><section className="stat-card"><span className="stat-caption">TOTAL TRANSACTIONS</span><div className="stat-value numeric-data">{busy ? '—' : transactionCount.toLocaleString('en-IN')}</div><span className="stat-sub">Real and demo records</span></section></div>
        <section className="activity-card"><div className="activity-heading"><div><h3>Recent 7-Day Activity</h3><p>Daily settled payout volume · demo records excluded</p></div><span className="activity-legend"><i /> Volume</span></div>{busy ? <div className="transactions-loading"><span className="spinner" /></div> : transactionCount === 0 ? <div className="activity-empty"><Activity size={27} strokeWidth={1.25} /><p>No recent activity</p></div> : <div className={`activity-chart ${chartReady ? 'is-ready' : ''}`} role="img" aria-label="Settled payout volume over the last seven days">{activityDays.map(day => <div className="activity-day" key={day.date} title={`${day.date}: ₹${day.volume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}><span className="activity-value numeric-data">{day.volume ? `₹${day.volume.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : ''}</span><div className="activity-track"><div className={`activity-bar-fill height-${chartBucket(day.volume)}`} /></div><span className="activity-label">{day.label}</span><span className="activity-date numeric-data">{day.date}</span></div>)}</div>}</section>
      </section>
      <section className="transactions-card"><div className="section-title"><div><h2>Recent Transactions</h2><p>Supabase records · simulated payments are marked test only.</p></div><button className="text-button">View all <ChevronRight size={16} /></button></div>{busy ? <div className="transactions-loading"><span className="spinner" /></div> : recentTransactions.length === 0 ? <div className="empty-state"><div className="empty-icon"><ArrowDownLeft size={20} /></div><p>No payments received yet. Share your link to get paid safely.</p><button className="button button-secondary" onClick={copyLink}><Copy size={15} /> Copy Link</button></div> : <div className="transaction-list">{recentTransactions.map(tx => <div className="transaction-row" key={tx.id}><div className="transaction-symbol"><ArrowDownLeft size={18} /></div><div className="transaction-main"><strong>{tx.sender_alias || 'Anonymous'}</strong><span className="transaction-date numeric-data">{new Date(tx.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div><div className={`transaction-state ${tx.status === 'payout_successful' ? 'status-success' : ''}`}>{tx.status === 'simulated' ? 'test only' : tx.status.replaceAll('_', ' ')}</div><strong className="transaction-amount numeric-data">₹{Number(tx.amount_inr).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>)}</div>}</section>
      </div>{revenueLocked && <div className="kyc-gate-overlay"><section className="kyc-gate-card" aria-live="polite">{kycStatus === 'pending' ? <><div className="kyc-gate-icon pending"><FileCheck2 size={22} /></div><span className="kyc-status-pill">VERIFICATION IN REVIEW</span><h2>Verification Pending</h2><p>Your business details are under review. Revenue analytics will be available once verification is complete.</p></> : <><div className="kyc-gate-icon"><ShieldCheck size={22} /></div><span className="kyc-status-pill">SECURE YOUR PAYOUTS</span><h2>Unlock your analytics</h2><p>Complete business verification to review revenue and transaction activity.</p><button className="button button-primary kyc-cta" onClick={() => setKycOpen(true)}>Complete Business Verification <ArrowRight size={16} /></button><span className="kyc-gate-foot"><LockKeyhole size={13} /> Your submitted details stay private</span></>}</section></div>}</div>
      <footer className="dashboard-footer"><span><LockKeyhole size={13} /> Your privacy is always on.</span><button aria-label="Help"><CircleHelp size={15} /> Help & support</button></footer>
    </div>
    {editOpen && profile && <EditProfileModal profile={profile} onClose={() => setEditOpen(false)} onSaved={updated => { setProfile(updated); setEditOpen(false) }} />}
    {qrOpen && profile && <ShareQrModal handle={profile.alias_handle} onClose={() => setQrOpen(false)} />}
    {kycOpen && profile && <KycModal profile={profile} onClose={() => setKycOpen(false)} onSubmitted={() => { setProfile(current => current ? { ...current, kyc_status: 'pending' } : current); setKycOpen(false) }} />}
  </main>
}

function KycModal({ profile, onClose, onSubmitted }: { profile: Profile; onClose: () => void; onSubmitted: () => void }) {
  const [step, setStep] = useState(0)
  const [legalName, setLegalName] = useState(profile.real_legal_name ?? '')
  const [taxId, setTaxId] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [routingCode, setRoutingCode] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadTimer = useRef<number | null>(null)
  const finishTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (uploadTimer.current !== null) window.clearInterval(uploadTimer.current)
    if (finishTimer.current !== null) window.clearTimeout(finishTimer.current)
  }, [])

  function beginFakeUpload(file?: File) {
    if (!file) return
    setDocumentName(file.name)
    setUploadProgress(0)
    if (uploadTimer.current !== null) window.clearInterval(uploadTimer.current)
    uploadTimer.current = window.setInterval(() => setUploadProgress(current => {
      const next = Math.min(current + 10, 100)
      if (next === 100 && uploadTimer.current !== null) {
        window.clearInterval(uploadTimer.current)
        uploadTimer.current = null
      }
      return next
    }), 90)
  }

  function nextStep() {
    setError('')
    if (step === 0 && (!legalName.trim() || !taxId.trim())) { setError('Enter your legal name and Tax ID / PAN to continue.'); return }
    if (step === 1 && uploadProgress < 100) { setError('Add an identity document and wait for the upload to finish.'); return }
    setStep(current => Math.min(current + 1, 2))
  }

  async function submitVerification(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!accountNumber.trim() || !routingCode.trim()) { setError('Enter your account number and IFSC / routing code.'); return }
    if (!supabase) { setError('Connect your Supabase project to submit verification.'); return }
    setBusy(true)
    try {
      await new Promise(resolve => window.setTimeout(resolve, 2000))
      const { error: updateError } = await supabase.from('users').update({ kyc_status: 'pending' }).eq('id', profile.id)
      if (updateError) throw updateError
      setBusy(false)
      setSubmitted(true)
      finishTimer.current = window.setTimeout(onSubmitted, 1500)
    } catch (submitError) {
      setBusy(false)
      setError(submitError instanceof Error ? submitError.message : 'Verification could not be submitted. Please try again.')
    }
  }

  const stepLabels = ['Business Details', 'Identity Document', 'Payout Details']
  return <div className="modal-backdrop kyc-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy && !submitted) onClose() }}>
    <section className="profile-modal kyc-modal" role="dialog" aria-modal="true" aria-labelledby="kyc-modal-title">
      <header className="modal-heading kyc-modal-heading"><div><div className="form-eyebrow">BUSINESS VERIFICATION</div><h2 id="kyc-modal-title">{submitted ? 'Verification Pending' : 'Complete your profile'}</h2></div>{!busy && !submitted && <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={17} /></button>}</header>
      {submitted ? <div className="kyc-success-state" role="status"><div className="kyc-success-ring"><Check size={26} /></div><span className="kyc-status-pill">SUBMITTED FOR REVIEW</span><h3>Verification Pending</h3><p>Your details have been submitted securely. We’ll update your dashboard when review is complete.</p></div> : <>
        <div className="kyc-step-meta"><span>STEP {step + 1} OF 3</span><span>{stepLabels[step]}</span></div>
        <div className="kyc-step-track" aria-label={`Step ${step + 1} of 3`}>{stepLabels.map((label, index) => <span key={label} className={index <= step ? 'active' : ''} />)}</div>
        <form className="kyc-form" onSubmit={submitVerification}>
          {step === 0 && <div className="kyc-fields"><p className="kyc-step-intro">Tell us about the business receiving payments.</p><label>Legal Name<input className="kyc-input" autoComplete="name" value={legalName} onChange={event => setLegalName(event.target.value)} placeholder="Name registered with your bank" /></label><label>Tax ID / PAN<input className="kyc-input" autoCapitalize="characters" value={taxId} onChange={event => setTaxId(event.target.value.toUpperCase())} placeholder="Enter your PAN or tax ID" /></label><p className="kyc-private-note"><LockKeyhole size={14} /> Details are used for this mock verification only.</p></div>}
          {step === 1 && <div className="kyc-fields"><p className="kyc-step-intro">Add one identity document to continue.</p><input ref={inputRef} type="file" accept="image/*,.pdf" className="kyc-file-input" onChange={event => beginFakeUpload(event.target.files?.[0])} /><button type="button" className={`kyc-upload-zone ${dragging ? 'is-dragging' : ''}`} onClick={() => inputRef.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); beginFakeUpload(event.dataTransfer.files?.[0]) }}><span className="kyc-upload-icon"><UploadCloud size={22} /></span><strong>{documentName || 'Drop your identity document here'}</strong><span>{documentName ? 'Click to choose a different file' : 'or browse files · PDF, PNG, or JPG'}</span>{uploadProgress > 0 && <div className="kyc-upload-progress" aria-label={`Upload progress ${uploadProgress}%`}><i style={{ width: `${uploadProgress}%` }} /></div>}{uploadProgress === 100 && <small className="kyc-upload-complete"><Check size={13} /> Document ready</small>}</button><p className="kyc-private-note"><LockKeyhole size={14} /> The mock upload runs locally. Your document is not stored.</p></div>}
          {step === 2 && <div className="kyc-fields"><p className="kyc-step-intro">Add the account where payouts should arrive.</p><label>Account Number<input className="kyc-input numeric-data" inputMode="numeric" autoComplete="off" value={accountNumber} onChange={event => setAccountNumber(event.target.value.replace(/\s/g, ''))} placeholder="Enter account number" /></label><label>IFSC / Routing Code<input className="kyc-input" autoCapitalize="characters" value={routingCode} onChange={event => setRoutingCode(event.target.value.toUpperCase())} placeholder="e.g., ABCD0123456" /></label><p className="kyc-private-note"><LockKeyhole size={14} /> Payout details stay in this demo session.</p></div>}
          {error && <p className="error-note kyc-error" role="alert">{error}</p>}
          <div className="kyc-form-actions">{step > 0 && <button type="button" className="button button-secondary" disabled={busy} onClick={() => { setError(''); setStep(current => current - 1) }}><ArrowLeft size={16} /> Back</button>}{step < 2 ? <button type="button" className="button button-primary kyc-next-button" onClick={nextStep}>Continue <ArrowRight size={16} /></button> : <button type="submit" className="button button-primary kyc-next-button" disabled={busy}>{busy ? <><span className="spinner auth-button-spinner" /> Submitting verification…</> : <>Submit Verification <ArrowRight size={16} /></>}</button>}</div>
        </form>
      </>}
    </section>
  </div>
}

function ShareQrModal({ handle, onClose }: { handle: string; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState(false)
  const publicUrl = `${window.location.origin}/@${handle.replace(/^@+/, '')}`
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(publicUrl)}`

  async function downloadQr() {
    setError('')
    setDownloading(true)
    let objectUrl: string | null = null
    try {
      const response = await fetch(qrImageUrl, { mode: 'cors', referrerPolicy: 'no-referrer' })
      if (!response.ok) throw new Error('The QR image could not be downloaded. Please try again.')
      const imageBlob = await response.blob()
      objectUrl = URL.createObjectURL(imageBlob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `ghostpay-${handle.replace(/^@+/, '')}-qr.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'The QR image could not be downloaded. Please try again.')
    } finally {
      if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl as string), 1000)
      setDownloading(false)
    }
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="profile-modal qr-modal" role="dialog" aria-modal="true" aria-labelledby="share-qr-title">
      <header className="modal-heading"><div><div className="form-eyebrow">SHARE YOUR LINK</div><h2 id="share-qr-title">Your payment QR</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={17} /></button></header>
      <div className="qr-image-frame">{imageError ? <p className="qr-image-error" role="status">QR preview could not load. Check your connection and try again.</p> : <img src={qrImageUrl} width="250" height="250" alt={`QR code linking to ${publicUrl}`} referrerPolicy="no-referrer" onError={() => setImageError(true)} />}</div>
      <p className="qr-share-url">{publicUrl}</p>
      <button className="button button-primary full-button qr-download-button" onClick={downloadQr} disabled={downloading}>{downloading ? 'Preparing download…' : <><Download size={17} /> Download QR</>}</button>
      {error && <p className="error-note qr-error" role="alert">{error}</p>}
      <p className="modal-privacy"><LockKeyhole size={13} /> QRServer generates this image from your public payment link.</p>
    </section>
  </div>
}

const avatarPresets = ['blue', 'indigo', 'violet', 'amber', 'slate']

function EditProfileModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (profile: Profile) => void }) {
  const [fullName, setFullName] = useState(profile.real_legal_name ?? '')
  const [upi, setUpi] = useState(profile.real_upi_id ?? '')
  const [alias, setAlias] = useState(profile.alias_handle)
  const [avatar, setAvatar] = useState(profile.avatar_url && (/^https?:\/\//i.test(profile.avatar_url) || profile.avatar_url.startsWith('preset:')) ? profile.avatar_url : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault(); setError('')
    if (!supabase) { setError('Connect your Supabase project to update your profile.'); return }
    const cleanAlias = alias.trim().replace(/^@+/, '').toLowerCase()
    if (!/^[a-z0-9_][a-z0-9_.]{2,29}$/.test(cleanAlias)) { setError('Use 3–30 letters, numbers, dots, or underscores for your alias.'); return }
    const cleanAvatar = avatar.trim()
    if (cleanAvatar.startsWith('preset:') && !avatarPresets.includes(cleanAvatar.slice(7))) { setError('Choose one of the available avatar presets.'); return }
    if (cleanAvatar && !cleanAvatar.startsWith('preset:')) {
      try { if (!['http:', 'https:'].includes(new URL(cleanAvatar).protocol)) throw new Error() }
      catch { setError('Enter a valid image URL or choose an avatar preset.'); return }
    }
    setBusy(true)
    const { error: handleClaimError } = await supabase.from('profiles').upsert({ id: profile.id, alias_handle: cleanAlias }, { onConflict: 'id' })
    if (handleClaimError) {
      setError(handleClaimError.code === '23505' ? 'That alias is already taken. Try another one.' : handleClaimError.message)
      setBusy(false)
      return
    }
    const { data, error: updateError } = await supabase.from('users').update({
      real_legal_name: fullName.trim(),
      real_upi_id: upi.trim(),
      alias_handle: cleanAlias,
      avatar_url: cleanAvatar || null,
    }).eq('id', profile.id).select('id, alias_handle, real_legal_name, real_upi_id, avatar_url').single()
    if (updateError) {
      await supabase.from('profiles').upsert({ id: profile.id, alias_handle: profile.alias_handle }, { onConflict: 'id' })
      setError(updateError.code === '23505' ? 'That alias is already taken. Try another one.' : updateError.message)
      setBusy(false)
      return
    }
    onSaved(data)
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <header className="modal-heading"><div><div className="form-eyebrow">YOUR ACCOUNT</div><h2 id="edit-profile-title">Edit profile</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={17} /></button></header>
      <form className="form-stack" onSubmit={save}>
        <label>Full Name<input autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} required /></label>
        <label>UPI ID<input autoCapitalize="none" value={upi} onChange={event => setUpi(event.target.value)} placeholder="name@bank" required /></label>
        <label>Chosen Handle / Alias<div className="alias-input"><span>@</span><input autoCapitalize="none" value={alias} onChange={event => setAlias(event.target.value)} required /></div></label>
        <fieldset className="avatar-picker"><legend>Avatar / PFP</legend><div className="avatar-presets">{avatarPresets.map(preset => <button key={preset} type="button" className={`avatar-preset avatar-${preset} ${avatar === `preset:${preset}` ? 'selected' : ''}`} aria-label={`Choose ${preset} avatar`} aria-pressed={avatar === `preset:${preset}`} onClick={() => setAvatar(`preset:${preset}`)}>{preset.slice(0, 1).toUpperCase()}</button>)}</div><label>Or use an image URL<input type="url" placeholder="https://example.com/avatar.png" value={avatar.startsWith('preset:') ? '' : avatar} onChange={event => setAvatar(event.target.value)} /></label></fieldset>
        {error && <p className="error-note">{error}</p>}
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}<Check size={16} /></button></div>
      </form>
      <p className="modal-privacy"><LockKeyhole size={13} /> Banking details are visible only to you.</p>
    </section>
  </div>
}

function PaymentPage() {
  const { handle = '' } = useParams()
  const aliasHandle = handle.replace(/^@+/, '').toLowerCase()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [amount, setAmount] = useState('')
  const [senderAlias, setSenderAlias] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [paymentStage, setPaymentStage] = useState<'idle' | 'processing' | 'complete'>('idle')

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setError('This payment page is not connected yet.'); return }
      const { data, error: queryError } = await supabase.from('users').select('id, alias_handle').eq('alias_handle', aliasHandle).maybeSingle()
      if (!active) return
      if (queryError) {
        setError(queryError.message)
      } else if (!data) setError('We couldn’t find this payment link. Check the address and try again.')
      else setProfile(data)
    }
    void load()
    return () => { active = false }
  }, [aliasHandle])

  async function startPayment(event: FormEvent) {
    event.preventDefault(); setError('')
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) { setError('Enter an amount greater than ₹0.'); return }
    if (!profile) { setError('This payment link is not ready yet.'); return }
    if (!supabase) { setError('This payment page is not connected yet.'); return }
    setBusy(true)
    setPaymentStage('processing')
    const cleanSenderAlias = senderAlias.trim().slice(0, 80) || 'Anonymous'
    const { error: insertError } = await supabase.from('demo_transactions').insert({
      receiver_id: profile.id,
      amount_inr: value,
      sender_alias: cleanSenderAlias,
    })
    if (insertError) {
      setError(insertError.message)
      setBusy(false)
      setPaymentStage('idle')
      return
    }
    await new Promise(resolve => window.setTimeout(resolve, 2000))
    setPaymentStage('complete')
    await new Promise(resolve => window.setTimeout(resolve, 650))
    navigate('/payment/success', { state: { amount: value, alias: profile.alias_handle, senderAlias: cleanSenderAlias } })
  }

  return <main className="payment-page"><header className="payment-topbar"><Brand /><span className="secure-pill"><LockKeyhole size={12} /> PAYMENT TEST</span></header><div className="payment-wrap"><Link to="/login" className="back-link"><ArrowLeft size={15} /> GhostPay</Link><section className="payment-card"><div className="payment-card-top"><div className="receiver-avatar"><Shield size={22} /></div><span className="verified-badge"><ShieldCheck size={13} /> VERIFIED LINK</span></div>{paymentStage === 'idle' ? <><div className="form-eyebrow">A PRIVATE PAYMENT</div><h1>{profile ? <>Pay {formatHandle(profile.alias_handle)} Securely</> : `Pay ${formatHandle(aliasHandle)} Securely`}</h1><p className="payment-subtext">Your real identity is hidden from the receiver.</p><div className="privacy-banner"><LockKeyhole size={16} /><span>Your payment details are protected by GhostPay.</span></div><form onSubmit={startPayment} className="payment-form"><label>Your Name / Alias<input maxLength={80} placeholder="e.g., Alex / Twitter Client" value={senderAlias} onChange={e => setSenderAlias(e.target.value)} /></label><label>Amount (₹)<div className="amount-input"><span>₹</span><input className="numeric-data" inputMode="decimal" type="number" min="1" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required /></div></label>{error && <p className="error-note">{error}</p>}<button className="button button-primary full-button" disabled={busy || !profile}>{busy ? 'Saving test payment…' : 'Pay via UPI'}<ArrowRight size={17} /></button></form><div className="payment-secure"><ShieldCheck size={16} /><span>Supabase demo record · No payment will be collected</span></div></> : <div className={`payment-progress ${paymentStage}`} aria-live="polite"><div className={`payment-progress-icon ${paymentStage}`}>{paymentStage === 'processing' ? <span className="payment-spinner" aria-hidden="true" /> : <Check size={20} strokeWidth={2} />}</div><h1>{paymentStage === 'processing' ? 'Processing payment' : 'Payment successful'}</h1><p>{paymentStage === 'processing' ? 'Please wait while we confirm your payment.' : 'Your payment has been recorded.'}</p></div>}</section><p className="payment-footer"><LockKeyhole size={12} /> GhostPay test checkout</p></div></main>
}

function PaymentReturnPage() {
  return <main className="payment-page"><header className="payment-topbar"><Brand /><span className="secure-pill"><LockKeyhole size={12} /> SECURE PAYMENT</span></header><div className="payment-wrap"><section className="payment-card return-card"><div className="receiver-avatar"><ShieldCheck size={23} /></div><div className="form-eyebrow">PAYMENT STATUS</div><h1>We’re confirming your payment.</h1><p className="payment-subtext">Cashfree is sending us a secure confirmation. You can close this page safely.</p><div className="payment-secure"><ShieldCheck size={16} /><span>We only confirm payments after checking with Cashfree.</span></div></section><p className="payment-footer"><LockKeyhole size={12} /> Protected by GhostPay</p></div></main>
}

function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const receiptState = location.state as { amount?: number; alias?: string; senderAlias?: string } | null
  const amount = Number(receiptState?.amount ?? searchParams.get('amount'))
  const alias = receiptState?.alias ?? searchParams.get('alias')
  const senderAlias = receiptState?.senderAlias?.trim() || 'Anonymous'
  const [receiptDate] = useState(() => new Date())
  const [transactionId] = useState(() => `GP-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`)
  const formattedAmount = Number.isFinite(amount) && amount > 0
    ? `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—'
  return <main className="payment-page receipt-print-root"><header className="payment-topbar receipt-screen-only"><Brand /><span className="secure-pill"><LockKeyhole size={12} /> PAYMENT TEST</span></header><div className="payment-wrap"><section className="payment-card return-card receipt-screen-only"><div className="receiver-avatar payment-success-mark"><Check size={23} /></div><div className="form-eyebrow">SIMULATED CHECKOUT</div><h1>Payment Successful</h1><p className="payment-subtext"><span className="numeric-data">{formattedAmount}</span> to {alias ? formatHandle(alias) : 'your creator'}</p><div className="privacy-banner"><ShieldCheck size={16} /><span>This was a simulated payment. No money moved.</span></div></section><article className="receipt-card" aria-label="Payment receipt"><div className="receipt-brand"><span className="brand-mark"><Shield size={16} /></span><span>ghostpay</span></div><div className="receipt-status"><Check size={16} /> PAYMENT SIMULATED</div><h1>Payment receipt</h1><p className="receipt-caption">A record of your GhostPay demo checkout</p><div className="receipt-amount numeric-data">{formattedAmount}</div><dl className="receipt-details"><div><dt>Paid by</dt><dd>{senderAlias}</dd></div><div><dt>Paid to</dt><dd>{alias ? formatHandle(alias) : 'Creator'}</dd></div><div><dt>Date</dt><dd className="numeric-data">{receiptDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div><div><dt>Transaction ID</dt><dd className="numeric-data">{transactionId}</dd></div></dl><p className="receipt-disclaimer">Demo receipt only · No money was collected or transferred.</p></article><button className="button button-primary full-button receipt-download receipt-screen-only" onClick={() => window.print()}><Download size={17} /> Download Receipt</button><Link className="button button-secondary full-button receipt-screen-only" to="/login">Back to GhostPay<ArrowRight size={17} /></Link><p className="payment-footer receipt-screen-only"><LockKeyhole size={12} /> Test checkout complete</p></div></main>
}

export default App
