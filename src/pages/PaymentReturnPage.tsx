import { Link } from 'react-router-dom'

import { Brand } from '../components/Brand'
import { ArrowRightIcon, ShieldCheckIcon } from '../components/Icons'

export function PaymentReturnPage() {
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
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Secure confirmation
        </span>
      </header>

      <div style={{ maxWidth: '440px', margin: 'var(--space-10) auto', padding: '0 var(--space-4)' }}>
        <div className="surface-card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--accent-text)',
              margin: '0 auto var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheckIcon size={24} strokeWidth={2} />
          </div>

          <h1 className="text-section-title" style={{ fontSize: '20px', marginBottom: 'var(--space-2)' }}>
            Confirming your payment
          </h1>
          <p className="text-secondary" style={{ fontSize: '14px', lineHeight: 1.5, marginBottom: 'var(--space-6)' }}>
            We are confirming your payment settlement. You can return to your dashboard or close this page safely.
          </p>

          <Link to="/dashboard" className="btn-primary btn-full">
            <span>Return to dashboard</span>
            <ArrowRightIcon size={15} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </main>
  )
}
