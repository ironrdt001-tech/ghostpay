import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'

import { Brand } from '../components/Brand'
import { ArrowRightIcon, LockIcon, ShieldCheckIcon, SpinnerIcon } from '../components/Icons'
import { supabase } from '../lib/supabase'

interface AuthPageProps {
  initialMode?: 'sign-in' | 'create-account'
}

export function AuthPage({ initialMode = 'sign-in' }: AuthPageProps) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'sign-in' | 'create-account'>(initialMode)
  const [handle, setHandle] = useState('')
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [debouncedHandle, setDebouncedHandle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const toastTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
  }, [])

  // 500ms debounce on handle input value
  useEffect(() => {
    if (mode !== 'create-account') {
      setHandleStatus('idle')
      setDebouncedHandle('')
      return
    }

    const clean = handle.trim().toLowerCase()
    if (clean.length < 3) {
      setHandleStatus('idle')
      setDebouncedHandle('')
      return
    }

    if (clean !== debouncedHandle) {
      setHandleStatus('checking')
    }

    const timer = setTimeout(() => {
      setDebouncedHandle(clean)
    }, 500)

    return () => clearTimeout(timer)
  }, [handle, mode, debouncedHandle])

  // Query Supabase profiles table when debounced value changes
  useEffect(() => {
    if (mode !== 'create-account' || !debouncedHandle) {
      return
    }

    let isMounted = true

    async function checkHandleAvailability() {
      if (!supabase) return
      setHandleStatus('checking')
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('alias_handle', debouncedHandle)
          .maybeSingle()

        if (!isMounted) return

        if (error) {
          console.error('Error checking handle availability:', error)
          setHandleStatus('idle')
          return
        }

        setHandleStatus(data ? 'taken' : 'available')
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to check handle availability:', err)
        setHandleStatus('idle')
      }
    }

    checkHandleAvailability()

    return () => {
      isMounted = false
    }
  }, [debouncedHandle, mode])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!supabase) {
      setError('Connect your Supabase project to continue.')
      return
    }

    const cleanHandle = handle.trim().replace(/^@+/, '').toLowerCase()
    if (mode === 'create-account' && !/^[a-z0-9_][a-z0-9_.]{2,29}$/.test(cleanHandle)) {
      setError('Choose a handle with 3 to 30 letters, numbers, dots, or underscores.')
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
          if (rpcError) {
            setError(rpcError.message)
            return
          }
          if (typeof userEmail !== 'string' || !userEmail.trim()) {
            setError('Handle not found. Check your spelling or sign in with your email.')
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

        if (authError) {
          setError(authError.message)
          return
        }
        if (!data?.user) {
          setError('Sign-in did not return an active session. Please try again.')
          return
        }

        const { data: profile, error: profileError } = await supabase.from('users').select('id').eq('id', data.user.id).maybeSingle()
        if (profileError) {
          setError(profileError.message)
          return
        }
        navigate(profile ? '/dashboard' : '/onboarding', { replace: true })
        return
      }

      // Mode: create-account
      const { data: existingHandle, error: handleError } = await supabase.from('profiles').select('id').eq('alias_handle', cleanHandle).maybeSingle()
      if (handleError) {
        setError(handleError.message)
        return
      }
      if (existingHandle) {
        setError('That handle is already taken. Please choose another one.')
        return
      }

      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { alias_handle: cleanHandle } },
      })

      if (signupError) {
        setError(signupError.code === '23505' ? 'That handle is already taken. Please choose another one.' : signupError.message)
        return
      }

      if (data.session) {
        navigate('/onboarding', { replace: true })
      } else {
        setMessage('Account created. Check your email to confirm your account, then sign in to continue.')
      }
    } catch (authErr) {
      setError(authErr instanceof Error ? authErr.message : 'Authentication failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const isCreating = mode === 'create-account'

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        backgroundColor: 'var(--bg-canvas)',
      }}
    >
      {/* Left editorial brand panel */}
      <section
        style={{
          padding: 'var(--space-8) var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-8)' }}>
            <Brand />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <LockIcon size={13} />
              <span>Private payments</span>
            </div>
          </div>

          <div style={{ maxWidth: '440px', marginTop: 'var(--space-10)' }}>
            <h1 className="text-page-title" style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>
              Get paid without exposing your bank account.
            </h1>
            <p className="text-secondary" style={{ fontSize: '15px', lineHeight: 1.5, marginBottom: 'var(--space-6)' }}>
              GhostPay shields your legal name, bank details, and personal phone number through encrypted nodal escrow.
            </p>

            <div
              className="surface-inset"
              style={{
                padding: 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                borderRadius: 'var(--radius-card)',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ShieldCheckIcon size={18} strokeWidth={2} />
              </div>
              <div style={{ fontSize: '13px' }}>
                <strong style={{ fontWeight: 500, color: 'var(--text-primary)', display: 'block' }}>
                  Shielded identity
                </strong>
                <span style={{ color: 'var(--text-muted)' }}>
                  Only your public @handle is shared with clients.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 'var(--space-8)' }}>
          GhostPay © {new Date().getFullYear()} · Payments with complete privacy
        </div>
      </section>

      {/* Right authentication form */}
      <section
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-8) var(--space-6)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h2 className="text-page-title" style={{ marginBottom: '4px' }}>
              {isCreating ? 'Create your account' : 'Sign in to GhostPay'}
            </h2>
            <p className="text-secondary">
              {isCreating
                ? 'Claim your shielded handle and payment link.'
                : 'Enter your credentials to access your dashboard.'}
            </p>
          </div>

          {/* Mode switch */}
          <div className="segmented-pill" style={{ width: '100%', marginBottom: 'var(--space-5)' }}>
            <button
              type="button"
              className={`segmented-tab ${!isCreating ? 'active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => { setMode('sign-in'); setError(''); setMessage(''); setHandleStatus('idle') }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`segmented-tab ${isCreating ? 'active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => { setMode('create-account'); setError(''); setMessage(''); setHandleStatus('idle') }}
            >
              Create account
            </button>
          </div>

          <form onSubmit={submit} className="field-stack">
            {isCreating && (
              <label className="field-label">
                <span>Claim your @handle</span>
                <div
                  className="field-input flex items-center"
                  style={{ gap: '2px' }}
                >
                  <span
                    className="select-none"
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '15px',
                      lineHeight: 1,
                    }}
                  >
                    @
                  </span>
                  <input
                    type="text"
                    name="handle"
                    autoComplete="off"
                    minLength={3}
                    maxLength={20}
                    pattern="[a-z0-9_]{3,20}"
                    placeholder="yourhandle"
                    value={handle}
                    onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                    className="bg-transparent border-none outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 w-full"
                    style={{
                      outline: 'none',
                      boxShadow: 'none',
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      width: '100%',
                      minHeight: '100%',
                      height: '100%',
                      fontSize: '15px',
                      fontFamily: 'inherit',
                      color: 'var(--text-primary)',
                    }}
                    required
                  />
                </div>
                {handleStatus !== 'idle' && (
                  <div
                    className={`flex items-center gap-1.5 mt-2 text-sm font-medium ${
                      handleStatus === 'checking'
                        ? 'text-gray-400'
                        : handleStatus === 'available'
                        ? 'text-emerald-500'
                        : 'text-red-500'
                    }`}
                  >
                    {handleStatus === 'checking' && <span>Checking...</span>}
                    {handleStatus === 'available' && (
                      <>
                        <CheckCircle2 className="w-4 h-4 shrink-0" size={16} stroke="currentColor" />
                        <span>Handle available</span>
                      </>
                    )}
                    {handleStatus === 'taken' && (
                      <>
                        <XCircle className="w-4 h-4 shrink-0" size={16} stroke="currentColor" />
                        <span>Handle taken</span>
                      </>
                    )}
                  </div>
                )}
              </label>
            )}

            <label className="field-label">
              <span>{isCreating ? 'Email address' : 'Email or @handle'}</span>
              <input
                type={isCreating ? 'email' : 'text'}
                name="email"
                autoComplete={isCreating ? 'email' : 'username'}
                placeholder={isCreating ? 'you@domain.com' : 'you@domain.com or @handle'}
                className="field-input"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                required
              />
            </label>

            <label className="field-label">
              <span>Password</span>
              <input
                type="password"
                name="password"
                autoComplete={isCreating ? 'new-password' : 'current-password'}
                minLength={isCreating ? 8 : undefined}
                placeholder={isCreating ? 'At least 8 characters' : 'Enter your password'}
                className="field-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </label>

            {error && (
              <div style={{ color: 'var(--semantic-debit-text)', fontSize: '13px' }} role="alert">
                {error}
              </div>
            )}

            {message && (
              <div style={{ color: 'var(--semantic-credit-text)', fontSize: '13px' }} role="status">
                {message}
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
                  <span>{isCreating ? 'Creating account...' : 'Signing in...'}</span>
                </>
              ) : (
                <>
                  <span>{isCreating ? 'Create account' : 'Sign in'}</span>
                  <ArrowRightIcon size={16} strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: 'var(--space-5)' }}>
            Your banking details remain encrypted and private.
          </p>
        </div>
      </section>
    </main>
  )
}
