import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { toBlob } from 'html-to-image'
import { ExportCardStage } from './ExportCardStage'
import { SpinnerIcon } from './Icons'
import { triggerHaptic } from '../lib/haptics'
import { supabase } from '../lib/supabase'
import {
  GPModal,
  GPAmountField,
  GPChips,
  GPButton,
  ShareIcon,
  DownloadIcon,
} from './GhostPayModalKit'

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
    const syncBurnerToDatabase = async () => {
      if (isBurner && burnerToken && supabase) {
        const numericAmount = amount ? Number(amount) : null
        const { error } = await supabase
          .from('burner_links')
          .upsert(
            {
              token: burnerToken,
              handle: userHandle,
              amount: numericAmount,
              consumed: false,
            },
            { onConflict: 'token' }
          )

        if (error) console.error('Failed to lock burner amount in DB:', error)
      }
    }

    // Add a small 500ms debounce so we don't spam Supabase on every keystroke
    const timeoutId = setTimeout(syncBurnerToDatabase, 500)
    return () => clearTimeout(timeoutId)
  }, [isBurner, burnerToken, amount, userHandle])

  const handleClose = () => {
    setAmount('')
    setIsBurner(false)
    setBurnerToken('')
    if (setRequestAmount) setRequestAmount('')
    onClose()
  }

  const handleShare = async () => {
    triggerHaptic(50)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Pay me on GhostPay', url: currentUrl })
      } catch (err) {
        console.warn('Share cancelled', err)
      }
    } else {
      try {
        await navigator.clipboard.writeText(currentUrl)
        onToast('success', 'Payment link copied to clipboard.')
      } catch {
        onToast('error', 'Failed to copy payment link.')
      }
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

  const handleAmountChange = (val: string) => {
    setAmount(val)
    if (setRequestAmount) setRequestAmount(val)
  }

  const handleChipPick = (val: number) => {
    triggerHaptic(50)
    const next = String(Number(amount || 0) + val)
    setAmount(next)
    if (setRequestAmount) setRequestAmount(next)
  }

  return (
    <>
      <GPModal
        title={isBurner ? 'Burner QR' : 'My payment QR'}
        subtitle={
          isBurner
            ? 'Self-destructs after a single payment'
            : 'Scan to open your private payment portal'
        }
        onClose={handleClose}
      >
        {/* Burner Mode Toggle Pill (Above QR Code) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
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
                : '1px solid var(--gp-border, var(--border-subtle))',
              backgroundColor: isBurner
                ? 'rgba(244, 63, 94, 0.15)'
                : 'var(--gp-field, var(--bg-inset))',
              color: isBurner
                ? '#F43F5E'
                : 'var(--gp-label, var(--text-secondary))',
              boxShadow: isBurner
                ? '0 2px 12px rgba(244, 63, 94, 0.25)'
                : 'none',
            }}
          >
            <span>🔥 Burner mode (1-time use)</span>
          </button>
        </div>

        {/* White rounded QR tile with soft green and purple glow */}
        <div className="gp-qr-wrap">
          <div className={`gp-qr-tile ${isBurner ? 'is-burner' : ''}`}>
            <QRCodeSVG value={currentUrl} size={210} level="M" />
          </div>
        </div>

        {/* Amount Field bound to existing state */}
        <GPAmountField
          value={amount}
          onChange={handleAmountChange}
          optional
          placeholder="Enter amount"
          hint="Leave empty to let the payer enter any amount."
        />

        {/* Quick Add Chips wired to existing chip handler */}
        <GPChips
          amount={amount}
          options={[500, 1000, 2000, 5000]}
          onPick={handleChipPick}
        />

        {/* Footer Actions: Share (secondary) and Download (primary) */}
        <div className="gp-footer">
          <GPButton
            variant="secondary"
            icon={<ShareIcon />}
            onClick={handleShare}
          >
            Share
          </GPButton>
          <GPButton
            variant="primary"
            icon={downloading ? <SpinnerIcon size={16} /> : <DownloadIcon />}
            disabled={downloading}
            onClick={handleDownloadQR}
          >
            {downloading ? 'Downloading...' : 'Download'}
          </GPButton>
        </div>
      </GPModal>

      {/* Mobile GPU safe off-screen stage */}
      <ExportCardStage
        handle={isBurner ? (burnerToken || userHandle) : userHandle}
        activeQrShareUrl={currentUrl}
        requestedAmount={hasValidAmount ? numAmount : null}
      />
    </>
  )
}

// Export alias for seamless backward compatibility
export { MyQRModal as ShareQrModal }
