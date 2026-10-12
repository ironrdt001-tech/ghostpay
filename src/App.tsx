import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Copy, Eye, EyeOff, LockKeyhole, LogOut, Plus, Shield, ShieldCheck, Sparkles, WalletCards } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { formatHandle, supabase } from './lib/supabase'

type Profile = { id: string; alias_handle: string }
type Transaction = { id: string; amount_inr: number; status: string; created_at: string; sender_alias?: string }
type DemoTransaction = Transaction & { sender_alias: string; status: 'simulated' }

function Brand({ light = false }: { light?: boolean }) {
  return <Link className={`brand ${light ? 'brand-light' : ''}`} to="/login" aria-label="GhostPay home"><span className="brand-mark"><Shield size={17} strokeWidth={2.4} /></span><span>ghostpay</span></Link>
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!authReady) return <div className="loading-screen"><Brand /><span className="spinner" /></div>

  return <Routes>
    <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
    <Route path="/signup" element={session ? <Navigate to="/onboarding" replace /> : <SignupPage />} />
    <Route path="/onboarding" element={session ? <OnboardingPage session={session} /> : <Navigate to="/login" replace />} />
    <Route path="/dashboard" element={session ? <DashboardPage session={session} /> : <Navigate to="/login" replace />} />
    <Route path="/payment/return" element={<PaymentReturnPage />} />
    <Route path="/payment/success" element={<PaymentSuccessPage />} />
    {/* Public profile route: React Router params must be a full segment, so /:handle supports /@alias. */}
    <Route path="/:handle" element={<PaymentPage />} />
    <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
  </Routes>
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

function DashboardPage({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [demoTransactions, setDemoTransactions] = useState<DemoTransaction[]>([])
  const [balance, setBalance] = useState(0)
  const [transactionCount, setTransactionCount] = useState(0)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(true)

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
        client.from('users').select('id, alias_handle').eq('id', session.user.id).maybeSingle(),
        loadRealRows(),
        loadDemoRows(),
      ])
      if (!active) return
      if (profileResult.error || txResult.error || demoResult.error) setError(profileResult.error?.message ?? txResult.error?.message ?? demoResult.error?.message ?? '')
      if (profileResult.data) setProfile(profileResult.data)
      const realRows = txResult.rows
      const demoRows = demoResult.rows
      if (realRows) setTransactions(realRows)
      if (demoRows) setDemoTransactions(demoRows)
      const paidOut = (realRows ?? []).filter(tx => tx.status === 'payout_successful')
      setTransactionCount((realRows?.length ?? 0) + (demoRows?.length ?? 0))
      setBalance(paidOut.reduce((sum, tx) => sum + Number(tx.amount_inr), 0))
      setBusy(false)
    }
    void load()
    return () => { active = false }
  }, [session.user.id])

  const recentTransactions: Transaction[] = [...transactions, ...demoTransactions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
  const simulatedTotal = demoTransactions.reduce((sum, tx) => sum + Number(tx.amount_inr), 0)

  async function copyLink() {
    if (!profile) return
    await navigator.clipboard.writeText(`${window.location.origin}/${formatHandle(profile.alias_handle)}`)
    setCopied(true); window.setTimeout(() => setCopied(false), 1800)
  }

  async function signOut() { await supabase?.auth.signOut() }
  return <main className="dashboard-page">
    <header className="dashboard-topbar"><Brand /><div className="topbar-actions"><span className="secure-pill"><span /> SECURE SPACE</span><button className="icon-button" onClick={signOut} aria-label="Sign out"><LogOut size={17} /></button><div className="avatar">{session.user.email?.slice(0, 1).toUpperCase() ?? 'G'}</div></div></header>
    <div className="dashboard-container">
      <div className="dashboard-welcome"><div><div className="form-eyebrow">YOUR PRIVATE WORKSPACE</div><h1>Good to see you<span>.</span></h1><p>Here’s what’s happening with your payments.</p></div><button className="button button-outline" onClick={() => window.location.assign('/onboarding')}><Plus size={17} /> Edit profile</button></div>
      {error && <div className="notice-error">{error}</div>}
      <section className="receive-card"><div className="receive-copy"><span className="receive-label"><span className="pulse-dot" /> READY TO RECEIVE</span><h2>Your Shielded Link</h2><p>Share your link with clients. Your personal details stay private.</p><div className="link-field"><div className="link-icon"><Shield size={16} /></div><span className="link-prefix">{window.location.host}/</span><strong>{profile ? formatHandle(profile.alias_handle) : '…'}</strong><button onClick={copyLink} disabled={!profile} aria-label="Copy Link">{copied ? <Check size={17} /> : <Copy size={17} />}<span>{copied ? 'Copied!' : 'Copy Link'}</span></button></div></div><div className="receive-art"><div className="art-halo" /><div className="art-ring ring-back" /><div className="art-ring ring-front" /><div className="art-shield"><ShieldCheck size={43} /></div><span className="art-spark spark-a">✦</span><span className="art-spark spark-b">✧</span></div></section>
      <div className="stats-grid"><section className="stat-card"><div className="stat-top"><span className="stat-icon green"><WalletCards size={18} /></span><span className="stat-caption">TOTAL RECEIVED</span></div><div className="stat-value">₹{busy ? '—' : balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><span className="stat-sub">Successfully paid out</span></section><section className="stat-card"><div className="stat-top"><span className="stat-icon peach"><ArrowDownLeft size={18} /></span><span className="stat-caption">TRANSACTIONS</span></div><div className="stat-value">{busy ? '—' : transactionCount}</div><span className="stat-sub">Real and demo records</span></section><section className="stat-card shield-stat"><div className="stat-top"><span className="stat-icon lilac"><ShieldCheck size={18} /></span><span className="stat-caption">PRIVACY STATUS</span></div><div className="stat-value status-value">Protected <Check size={17} /></div><span className="stat-sub">Your details remain private</span></section><section className="stat-card"><div className="stat-top"><span className="stat-icon peach"><Check size={18} /></span><span className="stat-caption">TEST TOTAL</span></div><div className="stat-value">₹{busy ? '—' : simulatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><span className="stat-sub">Supabase demo records only</span></section></div>
      <section className="transactions-card"><div className="section-title"><div><h2>Recent Transactions</h2><p>Supabase records · simulated payments are marked test only.</p></div><button className="text-button">View all <ChevronRight size={16} /></button></div>{busy ? <div className="transactions-loading"><span className="spinner" /></div> : recentTransactions.length === 0 ? <div className="empty-state"><div className="empty-icon"><ArrowDownLeft size={20} /></div><p>No payments received yet. Share your link to get paid safely.</p><button className="button button-secondary" onClick={copyLink}><Copy size={15} /> Copy Link</button></div> : <div className="transaction-list">{recentTransactions.map(tx => <div className="transaction-row" key={tx.id}><div className="transaction-symbol"><ArrowDownLeft size={18} /></div><div className="transaction-main"><strong>{tx.sender_alias || 'Anonymous'}</strong><span>{new Date(tx.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div><div className="transaction-state">{tx.status === 'simulated' ? 'test only' : tx.status.replaceAll('_', ' ')}</div><strong className="transaction-amount">₹{Number(tx.amount_inr).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>)}</div>}</section>
      <footer className="dashboard-footer"><span><LockKeyhole size={13} /> Your privacy is always on.</span><button aria-label="Help"><CircleHelp size={15} /> Help & support</button></footer>
    </div>
  </main>
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

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setError('This payment page is not connected yet.'); return }
      const { data, error: queryError } = await supabase.from('users').select('id, alias_handle').eq('alias_handle', aliasHandle).maybeSingle()
      if (!active) return
      if (queryError) {
        console.error('Public alias lookup failed', queryError)
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
    const cleanSenderAlias = senderAlias.trim().slice(0, 80) || 'Anonymous'
    const { error: insertError } = await supabase.from('demo_transactions').insert({
      receiver_id: profile.id,
      amount_inr: value,
      sender_alias: cleanSenderAlias,
    })
    if (insertError) { setError(insertError.message); setBusy(false); return }
    await new Promise(resolve => window.setTimeout(resolve, 2000))
    navigate(`/payment/success?amount=${encodeURIComponent(value)}&alias=${encodeURIComponent(profile.alias_handle)}`)
  }

  return <main className="payment-page"><header className="payment-topbar"><Brand /><span className="secure-pill"><LockKeyhole size={12} /> PAYMENT TEST</span></header><div className="payment-wrap"><Link to="/login" className="back-link"><ArrowLeft size={15} /> GhostPay</Link><section className="payment-card"><div className="payment-card-top"><div className="receiver-avatar"><Shield size={22} /></div><span className="verified-badge"><ShieldCheck size={13} /> VERIFIED LINK</span></div><div className="form-eyebrow">A PRIVATE PAYMENT</div><h1>{profile ? <>Pay {formatHandle(profile.alias_handle)} Securely</> : `Pay ${formatHandle(aliasHandle)} Securely`}</h1><p className="payment-subtext">Your real identity is hidden from the receiver.</p><div className="privacy-banner"><LockKeyhole size={16} /><span>Your payment details are protected by GhostPay.</span></div><form onSubmit={startPayment} className="payment-form"><label>Your Name / Alias<input maxLength={80} placeholder="e.g., Alex / Twitter Client" value={senderAlias} onChange={e => setSenderAlias(e.target.value)} /></label><label>Amount (₹)<div className="amount-input"><span>₹</span><input inputMode="decimal" type="number" min="1" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required /></div></label>{error && <p className="error-note">{error}</p>}<button className="button button-primary full-button" disabled={busy || !profile}>{busy ? 'Saving test payment…' : 'Pay via UPI'}<ArrowRight size={17} /></button></form><div className="payment-secure"><ShieldCheck size={16} /><span>Supabase demo record · No payment will be collected</span></div></section><p className="payment-footer"><LockKeyhole size={12} /> GhostPay test checkout</p></div></main>
}

function PaymentReturnPage() {
  return <main className="payment-page"><header className="payment-topbar"><Brand /><span className="secure-pill"><LockKeyhole size={12} /> SECURE PAYMENT</span></header><div className="payment-wrap"><section className="payment-card return-card"><div className="receiver-avatar"><ShieldCheck size={23} /></div><div className="form-eyebrow">PAYMENT STATUS</div><h1>We’re confirming your payment.</h1><p className="payment-subtext">Cashfree is sending us a secure confirmation. You can close this page safely.</p><div className="payment-secure"><ShieldCheck size={16} /><span>We only confirm payments after checking with Cashfree.</span></div></section><p className="payment-footer"><LockKeyhole size={12} /> Protected by GhostPay</p></div></main>
}

function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const amount = Number(searchParams.get('amount'))
  const alias = searchParams.get('alias')
  return <main className="payment-page"><header className="payment-topbar"><Brand /><span className="secure-pill"><LockKeyhole size={12} /> PAYMENT TEST</span></header><div className="payment-wrap"><section className="payment-card return-card"><div className="receiver-avatar"><Check size={23} /></div><div className="form-eyebrow">SIMULATED CHECKOUT</div><h1>Payment Successful</h1><p className="payment-subtext">{Number.isFinite(amount) && amount > 0 ? `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to ${alias ? formatHandle(alias) : 'your creator'}` : 'Your test payment completed successfully.'}</p><div className="privacy-banner"><ShieldCheck size={16} /><span>This was a simulated payment. No money moved.</span></div><Link className="button button-primary full-button" to="/login">Back to GhostPay<ArrowRight size={17} /></Link></section><p className="payment-footer"><LockKeyhole size={12} /> Test checkout complete</p></div></main>
}

export default App
