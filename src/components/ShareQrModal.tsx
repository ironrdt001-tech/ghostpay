import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { toBlob } from 'html-to-image'
import { fetchDynamicTrustQuoteFromWeb } from '../lib/quotes'
import { ExportCardStage } from './ExportCardStage'
import { CloseIcon, ShareIcon, DownloadIcon, SpinnerIcon } from './Icons'

interface ShareQrModalProps {
  handle: string
  requestAmount: string
  setRequestAmount: (amount: string) => void
  onClose: () => void
  onToast: (kind: 'success' | 'error', message: string) => void
}

export function ShareQrModal({
  handle,
  requestAmount,
  setRequestAmount,
  onClose,
  onToast,
}: ShareQrModalProps) {
  const [downloading, setDownloading] = useState(false)
  const cleanHandle = handle.replace(/^@+/, '')
  const numericAmount = parseFloat(requestAmount) || 0
  const hasRequestedAmount = Number.isFinite(numericAmount) && numericAmount > 0

  const activeQrShareUrl = hasRequestedAmount
    ? `https://ghostpay-orpin.vercel.app/@${cleanHandle}?amount=${numericAmount}`
    : `https://ghostpay-orpin.vercel.app/@${cleanHandle}`

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
    link.download = `GhostPay-${cleanHandle}.png`
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

  async function handleShare() {
    try {
      const dynamicQuote = await fetchDynamicTrustQuoteFromWeb()
      const requestLabel = hasRequestedAmount
        ? `Pay me ₹${numericAmount.toLocaleString('en-IN')} securely here: `
        : 'Pay me securely here: '
      const shareText = `${requestLabel}${activeQrShareUrl}\n\n"${dynamicQuote}"`

      const blob = await generateBrandedCardBlob()
      const file = new File([blob], `ghostpay-${cleanHandle}.png`, { type: 'image/png' })
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

      if (isMobile && navigator.share) {
        try {
          await navigator.share({
            files: [file],
            title: 'GhostPay',
            text: shareText,
          })
          return
        } catch (shareErr) {
          if (shareErr instanceof DOMException && shareErr.name === 'AbortError') return
        }
      }

      triggerBlobDownload(blob)
      await navigator.clipboard.writeText(shareText)
      onToast('success', 'Card downloaded and link copied to clipboard.')
    } catch {
      onToast('error', 'Share failed. Please try downloading instead.')
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
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 id="qr-dialog-title" className="text-section-title">My payment QR</h2>
            <p className="text-secondary" style={{ marginTop: '2px' }}>
              Scan to open your private payment portal
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

        {/* QR Code Container with Legendary Animated Glow */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: 'var(--space-6) 0 var(--space-6)',
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
            {/* Animated Rotating Gradient Glow */}
            <div
              style={{
                position: 'absolute',
                inset: '-6px',
                background: 'linear-gradient(45deg, #3B82F6, #10B981, #8B5CF6, #3B82F6)',
                backgroundSize: '400% 400%',
                filter: 'blur(14px)',
                zIndex: -1,
                borderRadius: '20px',
                animation: 'gradientShift 6s ease infinite',
              }}
            />

            {/* QR code solid white surface */}
            <div
              style={{
                position: 'relative',
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QRCodeSVG value={activeQrShareUrl} size={220} level="M" />
            </div>
          </div>
        </div>

        {/* Requested Amount Section */}
        <div className="surface-inset" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Request specific amount (optional)
            </span>
            {requestAmount && (
              <button
                type="button"
                onClick={() => setRequestAmount('')}
                style={{ fontSize: '12px', color: 'var(--semantic-debit-text)', cursor: 'pointer' }}
              >
                Clear
              </button>
            )}
          </div>

          <div className="input-with-prefix">
            <span className="input-prefix">₹</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={requestAmount}
              onChange={e => setRequestAmount(e.target.value)}
              className="tabular-nums"
            />
          </div>

          <div className="chip-group" style={{ marginTop: '8px' }}>
            {[100, 500, 1000].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setRequestAmount(String(val))}
                className={`chip-btn ${numericAmount === val ? 'active' : ''}`}
              >
                ₹{val.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <button type="button" onClick={handleShare} className="btn-secondary">
            <ShareIcon size={15} />
            <span>Share QR</span>
          </button>
          <button type="button" onClick={handleDownloadQR} disabled={downloading} className="btn-primary">
            {downloading ? <SpinnerIcon size={15} /> : <DownloadIcon size={15} />}
            <span>Download</span>
          </button>
        </div>
      </section>

      {/* Mobile GPU safe off-screen stage */}
      <ExportCardStage
        handle={cleanHandle}
        activeQrShareUrl={activeQrShareUrl}
        requestedAmount={hasRequestedAmount ? numericAmount : null}
      />
    </div>
  )
}
