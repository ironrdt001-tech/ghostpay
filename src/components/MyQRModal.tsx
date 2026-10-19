import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { toBlob } from 'html-to-image'
import { ExportCardStage } from './ExportCardStage'
import { CloseIcon, CopyIcon, CheckIcon, DownloadIcon, SpinnerIcon } from './Icons'
import { triggerHaptic } from '../lib/haptics'

export interface MyQRModalProps {
  handle: string
  requestAmount?: string
  setRequestAmount?: (amount: string) => void
  onClose: () => void
  onToast: (kind: 'success' | 'error', message: string) => void
}

export function MyQRModal({
  handle,
  requestAmount,
  setRequestAmount,
  onClose,
  onToast,
}: MyQRModalProps) {
  const [isBurner, setIsBurner] = useState(false)
  const [burnerToken, setBurnerToken] = useState('')
  const [amount, setAmount] = useState(requestAmount || '')
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const userHandle = handle.replace(/^@+/, '')

  function handleToggleBurner() {
    triggerHaptic(50)
    if (!isBurner) {
      if (!burnerToken) {
        const token = 'gp_brn_' + Math.random().toString(36).substring(2, 10)
        setBurnerToken(token)
      }
      setIsBurner(true)
    } else {
      setIsBurner(false)
    }
  }

  const numAmount = parseFloat(amount)
  const hasValidAmount = Number.isFinite(numAmount) && numAmount > 0

  let currentUrl = isBurner
    ? `https://ghostpay-orpin.vercel.app/pay/${burnerToken || 'gp_brn_temp'}`
    : `https://ghostpay-orpin.vercel.app/@${userHandle}`

  if (hasValidAmount) {
    currentUrl += `?am=${amount.trim()}`
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(currentUrl)
      triggerHaptic(50)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onToast('success', 'Payment link copied to clipboard.')
    } catch {
      onToast('error', 'Failed to copy payment link.')
    }
  }

  async function generateBrandedCardBlob(): Promise<Blob> {
    const cardElement = document.getElementById('ghostpay-export-card')
    if (!cardElement) {
      throw new Error('Card element not found in DOM')
    }

    const blob = await toBlob(cardElement, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#0B0C0E',
    })

    if (!blob) {
      throw new Error('Could not render image blob')
    }

    return blob
  }

  function triggerBlobDownload(blob: Blob) {
    const dataUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `GhostPay-${isBurner ? 'Burner' : userHandle}.png`
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(dataUrl)
  }

  async function handleDownloadQR() {
    setDownloading(true)
    try {
      const blob = await generateBrandedCardBlob()
      triggerBlobDownload(blob)
      onToast('success', 'Branded QR card downloaded.')
    } catch {
      onToast('error', 'Could not render QR card image.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="modal-scrim" role="presentation" onClick={onClose}>
      <section
        className="modal-sheet no-scrollbar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-dialog-title"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '420px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 id="qr-dialog-title" className="text-section-title">
              {isBurner ? 'Burner QR' : 'My payment QR'}
            </h2>
            <p className="text-secondary" style={{ marginTop: '2px', fontSize: '13px' }}>
              {isBurner
                ? 'Self-destructs after a single payment'
                : 'Scan to open your private payment portal'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            style={{ width: '32px', height: '32px' }}
            aria-label="Close modal"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Burner Mode Toggle Pill (Above QR Code) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
          <button
            type="button"
            onClick={handleToggleBurner}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              border: isBurner
                ? '1px solid rgba(244, 63, 94, 0.5)'
                : '1px solid var(--border-subtle)',
              backgroundColor: isBurner
                ? 'rgba(244, 63, 94, 0.15)'
                : 'var(--bg-inset)',
              color: isBurner
                ? '#F43F5E'
                : 'var(--text-secondary)',
              boxShadow: isBurner
                ? '0 2px 12px rgba(244, 63, 94, 0.25)'
                : 'none',
            }}
          >
            <span>🔥 Burner mode (1-time use)</span>
          </button>
        </div>

        {/* QR Code Container with Animated Aura Glow */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: 'var(--space-4) 0 var(--space-5)',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              isolation: 'isolate',
            }}
          >
            {/* Animated Aura Glow: .burner-aura-glow when isBurner, else .qr-aura-glow */}
            <div className={isBurner ? 'burner-aura-glow' : 'qr-aura-glow'} />

            {/* QR code solid white surface */}
            <div
              style={{
                position: 'relative',
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              }}
            >
              <QRCodeSVG value={currentUrl} size={210} level="M" />
            </div>
          </div>
        </div>

        {/* Persistent Amount Input */}
        <div className="qr-amount-wrapper" style={{ marginBottom: 'var(--space-6)' }}>
          <input 
            type="number" 
            placeholder="₹ Enter amount (Optional)" 
            value={amount} 
            onChange={(e) => {
              setAmount(e.target.value)
              if (setRequestAmount) setRequestAmount(e.target.value)
            }}
            className="qr-persistent-input"
          />
        </div>

        {/* Action Buttons: Copy link & Download */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <button type="button" onClick={handleCopyLink} className="btn-secondary">
            {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
            <span>{copied ? 'Copied' : 'Copy link'}</span>
          </button>
          <button type="button" onClick={handleDownloadQR} disabled={downloading} className="btn-primary">
            {downloading ? <SpinnerIcon size={15} /> : <DownloadIcon size={15} />}
            <span>Download</span>
          </button>
        </div>
      </section>

      {/* Mobile GPU safe off-screen stage */}
      <ExportCardStage
        handle={isBurner ? (burnerToken || userHandle) : userHandle}
        activeQrShareUrl={currentUrl}
        requestedAmount={hasValidAmount ? numAmount : null}
      />
    </div>
  )
}

// Export alias for seamless backward compatibility
export { MyQRModal as ShareQrModal }
