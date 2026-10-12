import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Copy, Download, Eye, EyeOff, LockKeyhole, LogOut, Moon, Plus, QrCode, Shield, ShieldCheck, Sparkles, Sun, WalletCards, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { formatHandle, supabase } from './lib/supabase'

type Profile = { id: string; alias_handle: string; real_legal_name?: string; real_upi_id?: string; avatar_url?: string | null }
type Transaction = { id: string; amount_inr: number; status: string; created_at: string; sender_alias?: string }
type DemoTransaction = Transaction & { receiver_id: string; sender_alias: string; status: 'simulated' }

function Brand({ light = false }: { light?: boolean }) {
  return <Link className={`brand ${light ? 'brand-light' : ''}`} to="/login" aria-label="GhostPay home"><span className="brand-mark"><Shield size={17} strokeWidth={2.4} /></span><span>ghostpay</span></Link>
}

function playCelebrationChord(context: AudioContext) {
  const now = context.currentTime
  const master = context.createGain()
  master.gain.setValueAtTime(0.0001, now)
  master.gain.exponentialRampToValueAtTime(0.075, now + 0.08)
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.15)
  master.connect(context.destination)
  for (const frequency of [523.25, 659.25, 783.99]) {
    const oscillator = context.createOscillator()
    const voice = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    voice.gain.value = 0.28
    oscillator.connect(voice).connect(master)
    oscillator.start(now)
    oscillator.stop(now + 1.2)
  }
  window.setTimeout(() => { void context.close() }, 1500)
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return window.localStorage.getItem('ghostpay.theme') === 'dark' ? 'dark' : 'light' }
    catch { return 'light' }
  })
  const [showDarkModeJoke, setShowDarkModeJoke] = useState(false)
  const themeTimer = useRef<number | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try { window.localStorage.setItem('ghostpay.theme', theme) } catch { /* storage can be disabled */ }
  }, [theme])

  useEffect(() => () => {
    if (themeTimer.current !== null) window.clearTimeout(themeTimer.current)
  }, [])

  function toggleTheme() {
    if (themeTimer.current !== null) return
    if (theme === 'dark') {
      setTheme('light')
      setShowDarkModeJoke(false)
      return
    }
    setShowDarkModeJoke(true)
    themeTimer.current = window.setTimeout(() => {
      setTheme('dark')
      setShowDarkModeJoke(false)
      themeTimer.current = null
    }, 1500)
  }

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!authReady) return <div className="loading-screen"><Brand /><span className="spinner" /></div>

  return <>
    <Routes>
    <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
    <Route path="/signup" element={session ? <Navigate to="/onboarding" replace /> : <SignupPage />} />
    <Route path="/onboarding" element={session ? <OnboardingPage session={session} /> : <Navigate to="/login" replace />} />
    <Route path="/dashboard" element={session ? <DashboardPage session={session} theme={theme} onToggleTheme={toggleTheme} themePending={showDarkModeJoke} /> : <Navigate to="/login" replace />} />
    <Route path="/payment/return" element={<PaymentReturnPage />} />
    <Route path="/payment/success" element={<PaymentSuccessPage />} />
    {/* Public profile route: React Router params must be a full segment, so /:handle supports /@alias. */}
    <Route path="/:handle" element={<PaymentPage />} />
    <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
    </Routes>
    {showDarkModeJoke && <div className="theme-toast" role="status">💳 Premium Dark Mode: $100 Payment Gateway Required... Just joking dw! 😉</div>}
  </>
}

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    if (!supabase) { setError('Connect your Supabase project to continue.'); return }
    setBusy(true)
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(authError.message); setBusy(false); return }
    const { data: profile } = await supabase.from('users').select('id, alias_handle').eq('id', data.user.id).maybeSingle()
    navigate(profile ? '/dashboard' : '/onboarding')
    setBusy(false)
  }

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
        <div className="form-eyebrow"><Sparkles size={14} /> WELCOME BACK</div>
        <h2>Sign in to GhostPay</h2><p className="form-intro">Your next payment is just a link away.</p>
        <form onSubmit={submit} className="form-stack">
          <label>Email address<input autoComplete="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Password<div className="password-wrap"><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required /><button className="reveal" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          {error && <p className="error-note">{error}</p>}
          <button className="button button-primary full-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}<ArrowRight size={17} /></button>
        </form>
        <div className="auth-divider"><span /> <b>NEW TO GHOSTPAY?</b> <span /></div>
        <Link className="button button-secondary full-button" to="/signup">Create your account<ArrowRight size={17} /></Link>
        <p className="terms-note"><LockKeyhole size={13} /> Your banking details are encrypted and kept private.</p>
      </div>
      <span className="mobile-copyright">© GhostPay · Payments, with a little more peace of mind.</span>
    </section>
  </main>
}

function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (!supabase) { setError('Connect your Supabase project to continue.'); return }
    setBusy(true)
    const { data, error: signupError } = await supabase.auth.signUp({ email, password })
    if (signupError) { setError(signupError.message); setBusy(false); return }
    if (data.session) navigate('/onboarding')
    else setMessage('Check your email to confirm your account, then sign in to continue.')
    setBusy(false)
  }

  return <main className="auth-layout signup-layout"><section className="auth-visual"><div className="visual-top"><Brand light /><span className="secure-note"><LockKeyhole size={13} /> PRIVATE BY DESIGN</span></div><div className="visual-content"><div className="visual-kicker"><span /> A BETTER WAY TO GET PAID</div><h1>Your work.<br /><em>Your name.</em></h1><p>Make a public alias your clients can trust, while your real banking details stay private.</p><div className="privacy-card"><div className="privacy-card-icon"><ShieldCheck size={23} /></div><div><strong>Private from the first step</strong><span>Your legal name and UPI ID stay shielded.</span></div><Check className="privacy-check" size={18} /></div></div><div className="visual-footer"><span>Payments, with a little more peace of mind.</span><span>© GhostPay</span></div><div className="visual-orb orb-one" /><div className="visual-orb orb-two" /></section><section className="auth-main"><div className="auth-mobile-brand"><Brand /></div><div className="auth-form-wrap"><div className="form-eyebrow"><Sparkles size={14} /> GET STARTED</div><h2>Create your account</h2><p className="form-intro">Start with a secure GhostPay login.</p><form onSubmit={submit} className="form-stack"><label>Email address<input autoComplete="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Password<input autoComplete="new-password" type="password" minLength={8} placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} required /></label>{error && <p className="error-note">{error}</p>}{message && <p className="success-note">{message}</p>}<button className="button button-primary full-button" disabled={busy}>{busy ? 'Creating account…' : 'Create Account'}<ArrowRight size={17} /></button></form><div className="auth-divider"><span /> ALREADY HAVE AN ACCOUNT? <span /></div><Link className="button button-secondary full-button" to="/login">Sign in<ArrowRight size={17} /></Link><p className="terms-note"><LockKeyhole size={13} /> Your banking details are encrypted and kept private.</p></div><span className="mobile-copyright">© GhostPay · Payments, with a little more peace of mind.</span></section></main>
}

function OnboardingPage({ session }: { session: Session }) {
  const navigate = useNavigate()
  const [alias, setAlias] = useState('')
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

function DashboardPage({ session, theme, onToggleTheme, themePending }: { session: Session; theme: 'light' | 'dark'; onToggleTheme: () => void; themePending: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [demoTransactions, setDemoTransactions] = useState<DemoTransaction[]>([])
  const [balance, setBalance] = useState(0)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

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
        client.from('users').select('id, alias_handle, real_legal_name, real_upi_id, avatar_url').eq('id', session.user.id).maybeSingle(),
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
      const paidOut = (realRows ?? []).filter(tx => tx.status === 'payout_successful')
      setBalance(paidOut.reduce((sum, tx) => sum + Number(tx.amount_inr), 0))
      setBusy(false)
    }
    void load()
    return () => { active = false }
  }, [session.user.id])

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
  const simulatedTotal = demoTransactions.reduce((sum, tx) => sum + Number(tx.amount_inr), 0)
  const transactionCount = transactions.length + demoTransactions.length

  async function copyLink() {
    if (!profile) return
    await navigator.clipboard.writeText(`${window.location.origin}/${formatHandle(profile.alias_handle)}`)
    setCopied(true); window.setTimeout(() => setCopied(false), 1800)
  }

  async function signOut() { await supabase?.auth.signOut() }
  return <main className="dashboard-page">
    <header className="dashboard-topbar"><Brand /><div className="topbar-actions"><span className="secure-pill"><span /> SECURE SPACE</span><button className="icon-button" onClick={onToggleTheme} disabled={themePending} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><button className="icon-button" onClick={signOut} aria-label="Sign out"><LogOut size={17} /></button><div className="avatar">{profile?.avatar_url?.startsWith('emoji:') ? profile.avatar_url.slice(6) : profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" /> : session.user.email?.slice(0, 1).toUpperCase() ?? 'G'}</div></div></header>
    <div className="dashboard-container">
      <div className="dashboard-welcome"><div><div className="form-eyebrow">YOUR PRIVATE WORKSPACE</div><h1>Good to see you<span>.</span></h1><p>Here’s what’s happening with your payments.</p></div><div className="dashboard-actions"><button className="button button-secondary" onClick={() => setQrOpen(true)} disabled={!profile}><QrCode size={16} /> Share QR Code</button><button className="button button-outline" onClick={() => setEditOpen(true)} disabled={!profile}><Plus size={17} /> Edit profile</button></div></div>
      {error && <div className="notice-error">{error}</div>}
      <section className="receive-card"><div className="receive-copy"><span className="receive-label"><span className="pulse-dot" /> READY TO RECEIVE</span><h2>Your Shielded Link</h2><p>Share your link with clients. Your personal details stay private.</p><div className="link-field"><div className="link-icon"><Shield size={16} /></div><span className="link-prefix">{window.location.host}/</span><strong>{profile ? formatHandle(profile.alias_handle) : '…'}</strong><button onClick={copyLink} disabled={!profile} aria-label="Copy Link">{copied ? <Check size={17} /> : <Copy size={17} />}<span>{copied ? 'Copied!' : 'Copy Link'}</span></button></div></div><div className="receive-art"><div className="art-halo" /><div className="art-ring ring-back" /><div className="art-ring ring-front" /><div className="art-shield"><ShieldCheck size={43} /></div><span className="art-spark spark-a">✦</span><span className="art-spark spark-b">✧</span></div></section>
      <div className="stats-grid"><section className="stat-card"><div className="stat-top"><span className="stat-icon green"><WalletCards size={18} /></span><span className="stat-caption">TOTAL RECEIVED</span></div><div className="stat-value">₹{busy ? '—' : balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><span className="stat-sub">Successfully paid out</span></section><section className="stat-card"><div className="stat-top"><span className="stat-icon peach"><ArrowDownLeft size={18} /></span><span className="stat-caption">TRANSACTIONS</span></div><div className="stat-value">{busy ? '—' : transactionCount}</div><span className="stat-sub">Real and demo records</span></section><section className="stat-card shield-stat"><div className="stat-top"><span className="stat-icon lilac"><ShieldCheck size={18} /></span><span className="stat-caption">PRIVACY STATUS</span></div><div className="stat-value status-value">Protected <Check size={17} /></div><span className="stat-sub">Your details remain private</span></section><section className="stat-card"><div className="stat-top"><span className="stat-icon peach"><Check size={18} /></span><span className="stat-caption">TEST TOTAL</span></div><div className="stat-value">₹{busy ? '—' : simulatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><span className="stat-sub">Supabase demo records only</span></section></div>
      <section className="transactions-card"><div className="section-title"><div><h2>Recent Transactions</h2><p>Supabase records · simulated payments are marked test only.</p></div><button className="text-button">View all <ChevronRight size={16} /></button></div>{busy ? <div className="transactions-loading"><span className="spinner" /></div> : recentTransactions.length === 0 ? <div className="empty-state"><div className="empty-icon"><ArrowDownLeft size={20} /></div><p>No payments received yet. Share your link to get paid safely.</p><button className="button button-secondary" onClick={copyLink}><Copy size={15} /> Copy Link</button></div> : <div className="transaction-list">{recentTransactions.map(tx => <div className="transaction-row" key={tx.id}><div className="transaction-symbol"><ArrowDownLeft size={18} /></div><div className="transaction-main"><strong>{tx.sender_alias || 'Anonymous'}</strong><span>{new Date(tx.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div><div className="transaction-state">{tx.status === 'simulated' ? 'test only' : tx.status.replaceAll('_', ' ')}</div><strong className="transaction-amount">₹{Number(tx.amount_inr).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>)}</div>}</section>
      <footer className="dashboard-footer"><span><LockKeyhole size={13} /> Your privacy is always on.</span><button aria-label="Help"><CircleHelp size={15} /> Help & support</button></footer>
    </div>
    {editOpen && profile && <EditProfileModal profile={profile} onClose={() => setEditOpen(false)} onSaved={updated => { setProfile(updated); setEditOpen(false) }} />}
    {qrOpen && profile && <ShareQrModal handle={profile.alias_handle} onClose={() => setQrOpen(false)} />}
  </main>
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

const avatarPresets = ['emoji:🌿', 'emoji:🌙', 'emoji:🦊', 'emoji:🌻', 'emoji:🐳']

function EditProfileModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (profile: Profile) => void }) {
  const [fullName, setFullName] = useState(profile.real_legal_name ?? '')
  const [upi, setUpi] = useState(profile.real_upi_id ?? '')
  const [alias, setAlias] = useState(profile.alias_handle)
  const [avatar, setAvatar] = useState(profile.avatar_url ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault(); setError('')
    if (!supabase) { setError('Connect your Supabase project to update your profile.'); return }
    const cleanAlias = alias.trim().replace(/^@+/, '').toLowerCase()
    if (!/^[a-z0-9_][a-z0-9_.]{2,29}$/.test(cleanAlias)) { setError('Use 3–30 letters, numbers, dots, or underscores for your alias.'); return }
    const cleanAvatar = avatar.trim()
    if (cleanAvatar && !cleanAvatar.startsWith('emoji:')) {
      try { if (!['http:', 'https:'].includes(new URL(cleanAvatar).protocol)) throw new Error() }
      catch { setError('Enter a valid image URL or choose an avatar preset.'); return }
    }
    setBusy(true)
    const { data, error: updateError } = await supabase.from('users').update({
      real_legal_name: fullName.trim(),
      real_upi_id: upi.trim(),
      alias_handle: cleanAlias,
      avatar_url: cleanAvatar || null,
    }).eq('id', profile.id).select('id, alias_handle, real_legal_name, real_upi_id, avatar_url').single()
    if (updateError) {
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
        <fieldset className="avatar-picker"><legend>Avatar / PFP</legend><div className="avatar-presets">{avatarPresets.map(preset => <button key={preset} type="button" className={`avatar-preset ${avatar === preset ? 'selected' : ''}`} aria-label={`Choose ${preset.slice(6)} avatar`} aria-pressed={avatar === preset} onClick={() => setAvatar(preset)}>{preset.slice(6)}</button>)}</div><label>Or use an image URL<input type="url" placeholder="https://example.com/avatar.png" value={avatar.startsWith('emoji:') ? '' : avatar} onChange={event => setAvatar(event.target.value)} /></label></fieldset>
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
  const [paymentStage, setPaymentStage] = useState<'idle' | 'launching' | 'complete'>('idle')

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
    setPaymentStage('launching')
    let audioContext: AudioContext | null = null
    try {
      audioContext = new window.AudioContext()
      void audioContext.resume().catch(() => undefined)
    } catch { /* continue checkout if Web Audio is unavailable */ }
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
      if (audioContext) void audioContext.close()
      return
    }
    await new Promise(resolve => window.setTimeout(resolve, 2000))
    setPaymentStage('complete')
    if (audioContext) playCelebrationChord(audioContext)
    await new Promise(resolve => window.setTimeout(resolve, 900))
    navigate('/payment/success', { state: { amount: value, alias: profile.alias_handle, senderAlias: cleanSenderAlias } })
  }

  return <main className="payment-page"><header className="payment-topbar"><Brand /><span className="secure-pill"><LockKeyhole size={12} /> PAYMENT TEST</span></header><div className="payment-wrap"><Link to="/login" className="back-link"><ArrowLeft size={15} /> GhostPay</Link><section className="payment-card"><div className="payment-card-top"><div className="receiver-avatar"><Shield size={22} /></div><span className="verified-badge"><ShieldCheck size={13} /> VERIFIED LINK</span></div>{paymentStage === 'idle' ? <><div className="form-eyebrow">A PRIVATE PAYMENT</div><h1>{profile ? <>Pay {formatHandle(profile.alias_handle)} Securely</> : `Pay ${formatHandle(aliasHandle)} Securely`}</h1><p className="payment-subtext">Your real identity is hidden from the receiver.</p><div className="privacy-banner"><LockKeyhole size={16} /><span>Your payment details are protected by GhostPay.</span></div><form onSubmit={startPayment} className="payment-form"><label>Your Name / Alias<input maxLength={80} placeholder="e.g., Alex / Twitter Client" value={senderAlias} onChange={e => setSenderAlias(e.target.value)} /></label><label>Amount (₹)<div className="amount-input"><span>₹</span><input inputMode="decimal" type="number" min="1" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required /></div></label>{error && <p className="error-note">{error}</p>}<button className="button button-primary full-button" disabled={busy || !profile}>{busy ? 'Saving test payment…' : 'Pay via UPI'}<ArrowRight size={17} /></button></form><div className="payment-secure"><ShieldCheck size={16} /><span>Supabase demo record · No payment will be collected</span></div></> : <div className={`payment-animation ${paymentStage}`} aria-live="polite"><div className="moon-target">🌕</div>{paymentStage === 'launching' ? <div className="rocket-flight" aria-hidden="true">🚀</div> : <div className="paid-badge"><Check size={20} /> Payment Complete · Paid</div>}<h1>{paymentStage === 'launching' ? 'Sending you to the moon…' : 'Payment complete!'}</h1><p>{paymentStage === 'launching' ? 'Your private test checkout is in orbit.' : 'Your simulated payment is safely recorded.'}</p></div>}</section><p className="payment-footer"><LockKeyhole size={12} /> GhostPay test checkout</p></div></main>
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
  return <main className="payment-page receipt-print-root"><header className="payment-topbar receipt-screen-only"><Brand /><span className="secure-pill"><LockKeyhole size={12} /> PAYMENT TEST</span></header><div className="payment-wrap"><section className="payment-card return-card receipt-screen-only"><div className="receiver-avatar"><Check size={23} /></div><div className="form-eyebrow">SIMULATED CHECKOUT</div><h1>Payment Successful</h1><p className="payment-subtext">{formattedAmount} to {alias ? formatHandle(alias) : 'your creator'}</p><div className="privacy-banner"><ShieldCheck size={16} /><span>This was a simulated payment. No money moved.</span></div></section><article className="receipt-card" aria-label="Payment receipt"><div className="receipt-brand"><span className="brand-mark"><Shield size={16} /></span><span>ghostpay</span></div><div className="receipt-status"><Check size={16} /> PAYMENT SIMULATED</div><h1>Payment receipt</h1><p className="receipt-caption">A record of your GhostPay demo checkout</p><div className="receipt-amount">{formattedAmount}</div><dl className="receipt-details"><div><dt>Paid by</dt><dd>{senderAlias}</dd></div><div><dt>Paid to</dt><dd>{alias ? formatHandle(alias) : 'Creator'}</dd></div><div><dt>Date</dt><dd>{receiptDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div><div><dt>Transaction ID</dt><dd>{transactionId}</dd></div></dl><p className="receipt-disclaimer">Demo receipt only · No money was collected or transferred.</p></article><button className="button button-primary full-button receipt-download receipt-screen-only" onClick={() => window.print()}><Download size={17} /> Download Receipt</button><Link className="button button-secondary full-button receipt-screen-only" to="/login">Back to GhostPay<ArrowRight size={17} /></Link><p className="payment-footer receipt-screen-only"><LockKeyhole size={12} /> Test checkout complete</p></div></main>
}

export default App
