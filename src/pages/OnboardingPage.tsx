import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Brand } from '../components/Brand'
import { ArrowRightIcon, LockIcon, ShieldCheckIcon, SpinnerIcon } from '../components/Icons'

interface OnboardingPageProps {
  session: Session
}

export function OnboardingPage({ session }: OnboardingPageProps) {
  const navigate = useNavigate()
  const [alias, setAlias] = useState(() => {
    return typeof session.user.user_metadata?.alias_handle === 'string'
      ? session.user.user_metadata.alias_handle
      : ''
  })
  const [legalName, setLegalName] = useState('')
  const [upi, setUpi] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!supabase) {
      setError('Connect your Supabase project to continue.')
      return
    }

    const cleanAlias = alias.trim().replace(/^@+/, '').toLowerCase()
    if (!/^[a-z0-9_][a-z0-9_.]{2,29}$/.test(cleanAlias)) {
      setError('Use 3 to 30 letters, numbers, dots, or underscores for your alias.')
      return
    }

    const cleanUpi = upi.replace(/[\u2013\u2014\u2212]/g, '-').trim()
    if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9]{2,64}$/.test(cleanUpi)) {
      setError('Enter a valid UPI ID (e.g. name@okaxis or 8815041849-a46c@ibl).')
      return
    }

    setBusy(true)
    try {
      const { error: claimError } = await supabase.from('profiles').upsert(
        { id: session.user.id, alias_handle: cleanAlias },
        { onConflict: 'id' },
      )
      if (claimError) {
        setError(claimError.code === '23505' ? 'That alias is already taken. Please try another one.' : claimError.message)
        setBusy(false)
        return
      }

      const { error: insertError } = await supabase.from('users').insert({
        id: session.user.id,
        alias_handle: cleanAlias,
        real_legal_name: legalName.trim(),
        real_upi_id: cleanUpi,
      })
      if (insertError) {
        setError(insertError.code === '23505' ? 'That alias is already taken. Please try another one.' : insertError.message)
        setBusy(false)
        return
      }

      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed. Please try again.')
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--bg-canvas)' }}>
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
        <Link to="/dashboard" style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span>Already set up? Go to dashboard</span>
          <ArrowRightIcon size={14} />
        </Link>
      </header>

      <div style={{ maxWidth: '480px', margin: 'var(--space-10) auto', padding: '0 var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--accent-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheckIcon size={20} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-page-title" style={{ fontSize: '24px' }}>
              Set up your shield
            </h1>
            <p className="text-secondary" style={{ fontSize: '13px', marginTop: '2px' }}>
              Configure your public @handle and private settlement accounts
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="surface-card field-stack" style={{ padding: 'var(--space-6)' }}>
          <label className="field-label">
            <span>Choose your public @handle</span>
            <div className="input-with-prefix">
              <span className="input-prefix">@</span>
              <input
                type="text"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="yourname"
                value={alias}
                onChange={e => setAlias(e.target.value)}
                required
              />
            </div>
            <small style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Clients only see this handle on your payment portal.
            </small>
          </label>

          <div
            className="surface-inset"
            style={{
              padding: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              margin: 'var(--space-2) 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              <LockIcon size={14} />
              <span>Private settlement details (never shared publicly)</span>
            </div>

            <label className="field-label">
              <span>Legal bank account name</span>
              <input
                type="text"
                autoComplete="name"
                className="field-input"
                placeholder="Name on your bank account"
                value={legalName}
                onChange={e => setLegalName(e.target.value)}
                required
              />
            </label>

            <label className="field-label">
              <span>Real UPI ID</span>
              <input
                type="text"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="field-input"
                placeholder="name@okaxis"
                pattern="^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9]{2,64}$"
                value={upi}
                onChange={e => setUpi(e.target.value.replace(/[\u2013\u2014\u2212]/g, '-'))}
                required
              />
            </label>
          </div>

          {error && (
            <div style={{ color: 'var(--semantic-debit-text)', fontSize: '13px' }} role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary btn-full"
            style={{ marginTop: 'var(--space-2)' }}
          >
            {busy ? (
              <>
                <SpinnerIcon size={16} />
                <span>Securing your account...</span>
              </>
            ) : (
              <>
                <span>Secure my account</span>
                <ArrowRightIcon size={16} strokeWidth={2} />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
