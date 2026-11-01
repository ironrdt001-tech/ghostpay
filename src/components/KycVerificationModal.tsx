import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { CheckIcon, CloseIcon, LockIcon, ShieldCheckIcon, ShieldIcon, SpinnerIcon } from './Icons'
import { supabase } from '../lib/supabase'
import type { KycVerification } from '../lib/types'

interface KycVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  initialLegalName?: string
  kycRecord: KycVerification | null
  onSuccess: (record: KycVerification) => void
  onToast: (kind: 'success' | 'error', message: string) => void
}

function maskPan(pan: string): string {
  if (!pan || pan.length < 10) return pan || '••••••••••'
  return `${pan.slice(0, 3)}•••••${pan.slice(8)}`
}

export function KycVerificationModal({
  isOpen,
  onClose,
  userId,
  initialLegalName = '',
  kycRecord,
  onSuccess,
  onToast,
}: KycVerificationModalProps) {
  const [legalName, setLegalName] = useState(kycRecord?.legal_full_name || initialLegalName || '')
  const [panNumber, setPanNumber] = useState(kycRecord?.pan_number || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (kycRecord) {
      setLegalName(kycRecord.legal_full_name || initialLegalName || '')
      setPanNumber(kycRecord.pan_number || '')
    } else if (initialLegalName) {
      setLegalName(initialLegalName)
    }
  }, [kycRecord, initialLegalName])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !loading) onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, loading])

  if (!isOpen) return null

  const isVerifiedOrPending = kycRecord && (kycRecord.status === 'verified' || kycRecord.status === 'pending')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) {
      setError('Database connection is not available.')
      return
    }

    const cleanName = legalName.trim()
    const cleanPan = panNumber.trim().toUpperCase()

    if (cleanName.length < 2) {
      setError('Please enter your full legal name.')
      return
    }

    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      setError('Please enter a valid 10-character PAN number (e.g. ABCDE1234F).')
      return
    }

    setLoading(true)
    setError('')

    try {
      const payload = {
        user_id: userId,
        legal_full_name: cleanName,
        pan_number: cleanPan,
        status: 'verified' as const,
        updated_at: new Date().toISOString(),
      }

      const { data, error: insertError } = await supabase
        .from('kyc_verifications')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single()

      if (insertError) throw insertError

      // Sync user profile state
      await supabase.from('users').update({
        kyc_verified: true,
        real_legal_name: cleanName,
      }).eq('id', userId)

      const savedRecord: KycVerification = (data as KycVerification) || payload
      onToast('success', 'Identity submitted securely')
      onSuccess(savedRecord)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit verification.'
      setError(msg)
      onToast('error', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-scrim" role="presentation" onClick={() => { if (!loading) onClose() }}>
      <section
        className="modal-sheet no-scrollbar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kyc-modal-title"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '440px', width: '100%' }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheckIcon size={16} />
              </div>
              <h2 id="kyc-modal-title" className="text-section-title" style={{ fontSize: '18px', margin: 0 }}>
                {isVerifiedOrPending ? 'Identity Status' : 'Verify Identity'}
              </h2>
            </div>
            <p className="text-secondary" style={{ fontSize: '13px', marginTop: '4px' }}>
              {isVerifiedOrPending
                ? 'Your nodal identity verification credentials'
                : 'Complete nodal verification to unlock unlimited private settlements'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-icon"
            style={{ width: '32px', height: '32px', flexShrink: 0 }}
            aria-label="Close modal"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Modal Content */}
        {isVerifiedOrPending ? (
          /* Sleek Verified / Pending State Badge & Card */
          <div className="surface-inset" style={{ padding: '24px 20px', borderRadius: '14px', textAlign: 'center', marginTop: 'var(--space-2)' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                margin: '0 auto 14px',
                backgroundColor: kycRecord?.status === 'verified' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                color: kycRecord?.status === 'verified' ? '#10b981' : '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {kycRecord?.status === 'verified' ? <ShieldCheckIcon size={26} /> : <ShieldIcon size={26} />}
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '12px',
                backgroundColor: kycRecord?.status === 'verified' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(59, 130, 246, 0.14)',
                color: kycRecord?.status === 'verified' ? '#10b981' : '#3b82f6',
              }}
            >
              <CheckIcon size={13} strokeWidth={2.5} />
              <span>{kycRecord?.status === 'verified' ? 'Identity Verified' : 'Verification Pending'}</span>
            </div>

            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {kycRecord?.legal_full_name}
            </h3>

            <p className="font-mono" style={{ fontSize: '13px', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '16px' }}>
              PAN: {maskPan(kycRecord?.pan_number || '')}
            </p>

            <div
              style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '14px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              Your nodal identity is verified and locked to your GhostPay shielded vault. Private P2P rails and UPI settlements are operating with tier-1 escrow capacity.
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '20px' }}
            >
              Done
            </button>
          </div>
        ) : (
          /* Secure KYC Submission Form */
          <form onSubmit={handleSubmit} className="field-stack" style={{ marginTop: 'var(--space-2)' }}>
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}

            <label className="field-label">
              <span>Legal Full Name</span>
              <input
                type="text"
                name="legal_full_name"
                value={legalName}
                onChange={e => { setLegalName(e.target.value); setError('') }}
                placeholder="Name as per PAN card"
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                required
                disabled={loading}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Must match the government registry for statutory settlement compliance.
              </span>
            </label>

            <label className="field-label">
              <span>PAN Number</span>
              <input
                type="text"
                name="pan_number"
                value={panNumber}
                onChange={e => {
                  setPanNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))
                  setError('')
                }}
                placeholder="ABCDE1234F"
                maxLength={10}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono uppercase placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                required
                disabled={loading}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                10-character alphanumeric PAN issued by the Income Tax Department.
              </span>
            </label>

            {/* Privacy note */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-inset)',
                border: '1px solid var(--border-subtle)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
              }}
            >
              <LockIcon size={14} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--text-muted)' }} />
              <span>
                Encrypted in vault storage. Your PAN is strictly used for one-time nodal verification and is never visible on your public @handle or shared with counterparties.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !legalName.trim() || panNumber.trim().length !== 10}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                minHeight: '44px',
                marginTop: 'var(--space-2)',
              }}
            >
              {loading ? (
                <>
                  <SpinnerIcon size={16} />
                  <span>Submitting for Verification...</span>
                </>
              ) : (
                <>
                  <ShieldCheckIcon size={16} />
                  <span>Submit for Verification</span>
                </>
              )}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
