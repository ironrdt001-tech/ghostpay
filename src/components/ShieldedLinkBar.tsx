import { useState } from 'react'
import { ShieldIcon, CopyIcon, CheckIcon, QrScanIcon } from './Icons'

interface ShieldedLinkBarProps {
  handle: string
  onOpenQr: () => void
}

export function ShieldedLinkBar({ handle, onOpenQr }: ShieldedLinkBarProps) {
  const [copied, setCopied] = useState(false)
  const cleanHandle = handle.replace(/^@+/, '')
  const publicUrl = `${window.location.host}/@${cleanHandle}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/@${cleanHandle}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore copy error
    }
  }

  return (
    <div
      className="surface-card"
      style={{
        padding: 'var(--space-4) var(--space-5)',
        marginBottom: 'var(--space-6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
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
          <ShieldIcon size={16} strokeWidth={2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Shielded payment link
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {publicUrl}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <button
          type="button"
          onClick={handleCopy}
          className="btn-secondary"
          style={{ minHeight: '36px', padding: '0 14px', fontSize: '13px' }}
          aria-label="Copy public payment link"
        >
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          <span>{copied ? 'Copied' : 'Copy link'}</span>
        </button>
        <button
          type="button"
          onClick={onOpenQr}
          className="btn-primary"
          style={{ minHeight: '36px', padding: '0 14px', fontSize: '13px' }}
        >
          <QrScanIcon size={14} strokeWidth={2} />
          <span>My QR</span>
        </button>
      </div>
    </div>
  )
}
