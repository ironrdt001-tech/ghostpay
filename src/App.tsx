import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { Brand } from './components/Brand'
import { SpinnerIcon } from './components/Icons'
import { AuthPage } from './pages/AuthPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'
import { PaymentPage } from './pages/PaymentPage'
import { PaymentSuccessPage } from './pages/PaymentSuccessPage'
import { PaymentReturnPage } from './pages/PaymentReturnPage'

function AuthenticatedRedirect({ session }: { session: Session }) {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    async function resolveDestination() {
      if (!supabase) {
        navigate('/', { replace: true })
        return
      }
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

  return checking ? (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <Brand />
      <SpinnerIcon size={22} style={{ color: 'var(--text-muted)' }} />
    </div>
  ) : null
}

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = window.localStorage.getItem('ghostpay.theme')
      return stored === 'dark' || stored === 'light' ? stored : 'dark'
    } catch {
      return 'dark'
    }
  })
  const logoutReset = useRef(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.scrollBehavior = 'smooth'
    if (session && !logoutReset.current) {
      try {
        window.localStorage.setItem('ghostpay.theme', theme)
      } catch {
        // Storage access may be restricted
      }
    }
  }, [session, theme])

  function toggleTheme() {
    setTheme(current => (current === 'dark' ? 'light' : 'dark'))
  }

  function resetThemeForLogout() {
    logoutReset.current = true
    setTheme('dark')
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.classList.add('dark')
    try {
      window.localStorage.removeItem('ghostpay.theme')
    } catch {
      // Storage access may be restricted
    }
  }

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setSession(null)
        resetThemeForLogout()
      } else {
        setSession(data.session)
        if (data.session) {
          logoutReset.current = false
          try {
            const stored = window.localStorage.getItem('ghostpay.theme')
            setTheme(stored === 'light' ? 'light' : 'dark')
          } catch {
            setTheme('dark')
          }
        } else {
          resetThemeForLogout()
        }
      }
      setAuthReady(true)
    }).catch(() => {
      setSession(null)
      resetThemeForLogout()
      setAuthReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) {
        logoutReset.current = false
        try {
          const stored = window.localStorage.getItem('ghostpay.theme')
          setTheme(stored === 'light' ? 'light' : 'dark')
        } catch {
          setTheme('dark')
        }
      } else {
        resetThemeForLogout()
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', backgroundColor: 'var(--bg-canvas)' }}>
        <Brand />
        <SpinnerIcon size={22} style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  const path = window.location.pathname
  const isPublicRoute = path.startsWith('/pay/') || path.startsWith('/@') || path.startsWith('/payment/')

  // If no user AND it's not a public route, show login
  if (!session && !isPublicRoute && path !== '/' && path !== '/login' && path !== '/signup') {
    return <AuthPage />
  }

  return (
    <Routes>
      <Route path="/" element={session ? <AuthenticatedRedirect session={session} /> : <AuthPage />} />
      <Route path="/login" element={session ? <AuthenticatedRedirect session={session} /> : <AuthPage initialMode="sign-in" />} />
      <Route path="/signup" element={session ? <AuthenticatedRedirect session={session} /> : <AuthPage initialMode="create-account" />} />
      <Route path="/onboarding" element={session ? <OnboardingPage session={session} /> : <Navigate to="/" replace />} />
      <Route
        path="/dashboard"
        element={
          session ? (
            <DashboardPage
              session={session}
              theme={theme}
              onToggleTheme={toggleTheme}
              onResetTheme={resetThemeForLogout}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="/payment/return" element={<PaymentReturnPage />} />
      <Route path="/payment/success" element={<PaymentSuccessPage />} />
      <Route path="/pay/:handle" element={<PaymentPage />} />
      <Route path="/pay/:id" element={<PaymentPage />} />
      <Route path="/@:handle" element={<PaymentPage />} />
      {/* Public profile route: /:handle supports /@alias */}
      <Route path="/:handle" element={<PaymentPage />} />
      <Route path="*" element={<Navigate to={session ? '/dashboard' : '/'} replace />} />
    </Routes>
  )
}

export default App
