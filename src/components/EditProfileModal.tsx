import { useState, useRef, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { processAvatarFileToDataUrl } from '../lib/avatar'
import { CloseIcon, CameraIcon, GalleryIcon, TrashIcon, SpinnerIcon, CheckIcon } from './Icons'
import type { Profile } from '../lib/types'

interface EditProfileModalProps {
  profile: Profile
  userEmail: string
  onClose: () => void
  onSuccess: (updatedProfile: Profile) => void
  onToast: (kind: 'success' | 'error', message: string) => void
}

export function EditProfileModal({
  profile,
  userEmail,
  onClose,
  onSuccess,
  onToast,
}: EditProfileModalProps) {
  const [handle, setHandle] = useState(profile.alias_handle || '')
  const [fullName, setFullName] = useState(profile.real_legal_name || profile.full_name || '')
  const [upiId, setUpiId] = useState(profile.real_upi_id || profile.upi_id || '')
  const [email, setEmail] = useState(userEmail || '')
  const [password, setPassword] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '')

  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const deviceFileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraFileInputRef = useRef<HTMLInputElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, busy])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setAvatarMenuOpen(false)
      }
    }
    if (avatarMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [avatarMenuOpen])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setError('Database connection is not available.')
      return
    }

    const cleanHandle = handle.trim().replace(/^@+/, '').toLowerCase()
    if (!cleanHandle) {
      setError('Handle cannot be empty.')
      return
    }
    if (!/^[a-z0-9_][a-z0-9_.]{2,29}$/.test(cleanHandle)) {
      setError('Handle must be 3 to 30 characters using letters, numbers, dots, or underscores.')
      return
    }

    if (password.trim().length > 0 && password.trim().length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }

    setBusy(true)
    setError('')
    const aliasChanged = cleanHandle !== profile.alias_handle
    let databaseProfileUpdated = false
    let publicProfileUpdated = false
    let updatedProfile: Profile | null = null

    try {
      // 1. Update public profiles table
      const { error: handleErr } = await supabase.from('profiles').upsert({
        id: profile.id,
        alias_handle: cleanHandle,
        avatar_url: avatarUrl || null,
      }, { onConflict: 'id' })
      if (handleErr) throw handleErr
      publicProfileUpdated = true

      // 2. Update private users table
      const { data: savedProfile, error: profileErr } = await supabase.from('users').update({
        alias_handle: cleanHandle,
        real_legal_name: fullName.trim(),
        real_upi_id: upiId.trim(),
        avatar_url: avatarUrl || null,
      }).eq('id', profile.id).select('id, alias_handle, real_legal_name, real_upi_id, avatar_url, wallet_balance').single()
      if (profileErr) throw profileErr
      updatedProfile = savedProfile as Profile
      databaseProfileUpdated = true

      // 3. Update auth user if email or password changed
      const authUpdates: { email?: string; password?: string; data: { avatar_url: string | null } } = {
        data: { avatar_url: avatarUrl || null },
      }
      if (email.trim() && email.trim() !== userEmail) {
        authUpdates.email = email.trim()
      }
      if (password.trim().length > 0) {
        authUpdates.password = password.trim()
      }
      const { error: authErr } = await supabase.auth.updateUser(authUpdates)
      if (authErr) throw authErr

      if (updatedProfile) {
        onSuccess(updatedProfile)
      }
      onToast('success', authUpdates.email
        ? 'Profile updated. Please verify your new email in your inbox.'
        : 'Profile and account settings saved.')
      onClose()
    } catch (saveError) {
      // Rollback on failure
      if (publicProfileUpdated || aliasChanged) {
        await supabase.from('profiles').upsert({
          id: profile.id,
          alias_handle: profile.alias_handle,
          avatar_url: profile.avatar_url ?? null,
        }, { onConflict: 'id' })
      }
      if (databaseProfileUpdated) {
        await supabase.from('users').update({
          alias_handle: profile.alias_handle,
          real_legal_name: profile.real_legal_name || profile.full_name,
          real_upi_id: profile.real_upi_id || profile.upi_id,
          avatar_url: profile.avatar_url,
        }).eq('id', profile.id)
      }
      const message = saveError instanceof Error ? saveError.message : 'Profile update failed. Please try again.'
      setError(message)
      onToast('error', message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-scrim" role="presentation" onClick={() => { if (!busy) onClose() }}>
      <section
        className="modal-sheet no-scrollbar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 id="edit-profile-title" className="text-section-title">Edit profile</h2>
            <p className="text-secondary" style={{ marginTop: '2px' }}>
              Update your public handle and private settlement details
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-icon"
            style={{ width: '32px', height: '32px' }}
            aria-label="Close modal"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Clickable Avatar Circle with Popover */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'var(--space-4) 0 var(--space-5)', position: 'relative' }}>
          <button
            type="button"
            onClick={() => setAvatarMenuOpen(open => !open)}
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-inset)',
              border: '2px solid var(--border-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              position: 'relative',
            }}
            title="Change profile photo"
            aria-label="Change profile photo"
            aria-expanded={avatarMenuOpen}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '28px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {(handle || 'G').replace(/^@+/, '').charAt(0).toUpperCase()}
              </span>
            )}
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Tap photo to change
          </span>

          {avatarMenuOpen && (
            <div
              ref={popoverRef}
              className="surface-elevated"
              style={{
                position: 'absolute',
                top: '92px',
                zIndex: 60,
                width: '210px',
                padding: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setAvatarMenuOpen(false)
                  deviceFileInputRef.current?.click()
                }}
                className="btn-ghost"
                style={{ width: '100%', justifyContent: 'flex-start', minHeight: '36px', fontSize: '13px' }}
              >
                <GalleryIcon size={15} />
                <span>Choose from device</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAvatarMenuOpen(false)
                  cameraFileInputRef.current?.click()
                }}
                className="btn-ghost"
                style={{ width: '100%', justifyContent: 'flex-start', minHeight: '36px', fontSize: '13px' }}
              >
                <CameraIcon size={15} />
                <span>Take photo</span>
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarUrl('')
                    setAvatarMenuOpen(false)
                  }}
                  className="btn-ghost"
                  style={{ width: '100%', justifyContent: 'flex-start', minHeight: '36px', fontSize: '13px', color: 'var(--semantic-debit-text)' }}
                >
                  <TrashIcon size={15} />
                  <span>Remove photo</span>
                </button>
              )}
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={deviceFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={async event => {
              const file = event.target.files?.[0]
              if (!file) return
              try {
                const dataUrl = await processAvatarFileToDataUrl(file)
                setAvatarUrl(dataUrl)
                onToast('success', 'Photo loaded. Click Save changes to apply.')
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Could not process image.'
                onToast('error', msg)
              } finally {
                event.target.value = ''
              }
            }}
          />

          <input
            ref={cameraFileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            style={{ display: 'none' }}
            onChange={async event => {
              const file = event.target.files?.[0]
              if (!file) return
              try {
                const dataUrl = await processAvatarFileToDataUrl(file)
                setAvatarUrl(dataUrl)
                onToast('success', 'Photo loaded. Click Save changes to apply.')
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Could not capture photo.'
                onToast('error', msg)
              } finally {
                event.target.value = ''
              }
            }}
          />
        </div>

        <form onSubmit={handleSubmit} className="field-stack">
          <label className="field-label">
            <span>Public handle</span>
            <div className="input-with-prefix">
              <span className="input-prefix">@</span>
              <input
                type="text"
                autoCapitalize="none"
                value={handle.replace(/^@+/, '')}
                onChange={e => setHandle(e.target.value)}
                disabled={busy}
                required
              />
            </div>
          </label>

          <label className="field-label">
            <span>Legal name (bank account name)</span>
            <input
              type="text"
              autoComplete="name"
              className="field-input"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              disabled={busy}
              required
            />
          </label>

          <label className="field-label">
            <span>UPI ID (private settlement)</span>
            <input
              type="text"
              autoCapitalize="none"
              className="field-input"
              value={upiId}
              onChange={e => setUpiId(e.target.value)}
              disabled={busy}
              required
            />
          </label>

          <label className="field-label">
            <span>Email address</span>
            <input
              type="email"
              autoComplete="email"
              className="field-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={busy}
              required
            />
          </label>

          <label className="field-label">
            <span>New password (optional)</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Leave blank to keep current"
              className="field-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>

          {error && (
            <div style={{ color: 'var(--semantic-debit-text)', fontSize: '13px' }} role="alert">
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary"
            >
              {busy ? (
                <>
                  <SpinnerIcon size={15} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckIcon size={15} />
                  <span>Save changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
