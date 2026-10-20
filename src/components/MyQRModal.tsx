import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { triggerHaptic } from '../lib/haptics'
import { supabase } from '../lib/supabase'
import {
  GPModal,
  GPAmountField,
  GPChips,
  GPButton,
  CopyIcon,
  ShareIcon,
} from './GhostPayModalKit'

export interface MyQRModalProps {
  handle: string
  requestAmount?: string
  setRequestAmount?: (amount: string) => void
  onClose: () => void
  onToast: (kind: 'success' | 'error', message: string) => void
}

const TRUST_QUOTES = [
  'He who trusts the world, the world betrays him.',
  "Privacy is not an option, and it shouldn't be the price we accept for just getting on the Internet.",
  'In a transparent world, the only real luxury left is anonymity.',
  'Trust the math, verify the ledger, shield the identity.',
  'Zero footprints. Zero exposure. Pure settlement.',
]

function getRandomQuote(): string {
  const index = Math.floor(Math.random() * TRUST_QUOTES.length)
  return TRUST_QUOTES[index]
}

function buildShareCaption(url: string, quote = getRandomQuote()): string {
  return `Pay me securely here:\n${url}\n\n"${quote}"`
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

async function getQrImageElement(): Promise<HTMLImageElement | null> {
  const svg = document.querySelector('.gp-qr-wrap .gp-qr-tile svg') as SVGSVGElement | null
  if (!svg) return null

  const cloned = svg.cloneNode(true) as SVGSVGElement
  if (!cloned.getAttribute('xmlns')) {
    cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }

  const svgData = new XMLSerializer().serializeToString(cloned)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function generateBrandedQrBlob({
  handle,
  isBurner,
  amount,
}: {
  handle: string
  isBurner: boolean
  amount?: string
}): Promise<Blob | null> {
  const qrImg = await getQrImageElement()

  const canvas = document.createElement('canvas')
  const scale = 2
  const width = 680
  const height = 800

  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.scale(scale, scale)

  // 1. Solid outer frame to eliminate WhatsApp/OS white bleeding corners
  ctx.fillStyle = '#07090e'
  ctx.fillRect(0, 0, width, height)

  // Inset main card (20px margin, 36px radius, matte #0b0e14 fill, 1.5px subtle border)
  const cardInset = 20
  const cardX = cardInset
  const cardY = cardInset
  const cardW = width - cardInset * 2
  const cardH = height - cardInset * 2
  const cardRadius = 36

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius)
  ctx.fillStyle = '#0b0e14'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.stroke()

  // 2. Top-Left Stealth Frosted Brand Mark
  const logoX = cardX + 36
  const logoY = cardY + 36
  const logoSize = 44
  drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 12)
  ctx.fillStyle = 'rgba(30, 58, 138, 0.22)'
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.28)'
  ctx.stroke()

  ctx.fillStyle = '#60a5fa'
  ctx.font = '600 22px Inter, system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('G', logoX + logoSize / 2, logoY + logoSize / 2 + 1)

  ctx.fillStyle = '#f8fafc'
  ctx.font = '500 28px Inter, system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('ghostpay', logoX + logoSize + 14, logoY + logoSize / 2)

  // 3. Top-Right Pill Badge (STRICTLY NO EMOJIS)
  const badgeText = isBurner ? 'Burner Escrow' : 'Shielded Escrow'
  ctx.font = '500 16px Inter, system-ui, -apple-system, sans-serif'
  const badgeTextWidth = ctx.measureText(badgeText).width
  const badgePadX = 16
  const badgeW = badgeTextWidth + badgePadX * 2
  const badgeH = 36
  const badgeX = cardX + cardW - 36 - badgeW
  const badgeY = logoY + (logoSize - badgeH) / 2

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 18)
  ctx.fillStyle = isBurner ? 'rgba(124, 45, 18, 0.22)' : 'rgba(30, 58, 138, 0.20)'
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = isBurner ? 'rgba(251, 146, 60, 0.25)' : 'rgba(96, 165, 250, 0.22)'
  ctx.stroke()

  ctx.fillStyle = isBurner ? '#fb923c' : '#60a5fa'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2)

  // 4. Center White QR Container (380x380px, 28px radius, quiet-zone 28px)
  const qrBoxSize = 380
  const qrBoxX = (width - qrBoxSize) / 2
  const qrBoxY = 136
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  if (qrImg) {
    const quietZone = 28
    const qrSize = qrBoxSize - quietZone * 2
    const qrX = qrBoxX + quietZone
    const qrY = qrBoxY + quietZone
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
  }

  // 5. Bottom Typography (Clean & Minimal — No AI Filler)
  const cleanHandle = handle.replace(/^@+/, '')
  const numericAmount = amount ? Number(amount) : null
  const hasAmount = numericAmount !== null && !isNaN(numericAmount) && numericAmount > 0

  const handleY = 570
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (isBurner) {
    ctx.fillStyle = '#f8fafc'
    ctx.font = '600 24px Inter, system-ui, -apple-system, sans-serif'
    ctx.fillText('One-time Burner QR', width / 2, handleY)
  } else {
    ctx.fillStyle = '#f8fafc'
    ctx.font = '500 26px "JetBrains Mono", "SF Mono", ui-monospace, monospace'
    ctx.fillText(`@${cleanHandle}`, width / 2, handleY)
  }

  if (hasAmount) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '500 20px Inter, system-ui, -apple-system, sans-serif'
    ctx.fillText(`₹${numericAmount.toLocaleString('en-IN')}`, width / 2, handleY + 34)
  }

  // Signature footer line (48px above bottom card edge)
  const footerY = cardY + cardH - 48
  ctx.fillStyle = '#64748b'
  ctx.font = '400 17px Inter, system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Scan to pay privately · Zero bank details exposed', width / 2, footerY)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
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
  const [isCopied, setIsCopied] = useState(false)

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

  // Dynamic base URL using window.location.origin
  const baseUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://ghostpay-orpin.vercel.app'

  // If burner mode is ON, strictly return the raw token route.
  // If OFF, return the @handle route, appending ?am= ONLY if an amount exists.
  const currentUrl = isBurner
    ? `${baseUrl}/pay/${burnerToken}`
    : `${baseUrl}/@${userHandle}${amount ? `?am=${amount}` : ''}`

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
    setIsCopied(false)
    if (setRequestAmount) setRequestAmount('')
    onClose()
  }

  const handleCopy = async () => {
    triggerHaptic(50)
    const quote = getRandomQuote()
    const shareCaption = buildShareCaption(currentUrl, quote)
    try {
      await navigator.clipboard.writeText(shareCaption)
      setIsCopied(true)
      if (onToast) {
        onToast(
          'success',
          isBurner
            ? 'Burner link copied to clipboard.'
            : 'Payment link copied to clipboard.'
        )
      }
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy', err)
      if (onToast) onToast('error', 'Failed to copy payment link.')
    }
  }

  const handleShare = async () => {
    triggerHaptic(50)
    const quote = getRandomQuote()
    const shareCaption = buildShareCaption(currentUrl, quote)
    const fileName = `ghostpay-${userHandle || 'qr'}.png`

    try {
      const blob = await generateBrandedQrBlob({
        handle: userHandle,
        isBurner,
        amount,
      })

      if (!blob) {
        await navigator.clipboard.writeText(shareCaption)
        if (onToast) onToast('success', 'Payment link copied to clipboard.')
        return
      }

      const file = new File([blob], fileName, { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'GhostPay Payment',
          text: shareCaption,
          files: [file],
        })
      } else {
        downloadBlob(blob, fileName)
        try {
          await navigator.clipboard.writeText(shareCaption)
          if (onToast) onToast('success', 'Card downloaded & link copied!')
        } catch {
          if (onToast) onToast('success', 'Card downloaded successfully.')
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      console.warn('Share failed, copying link instead', err)
      try {
        await navigator.clipboard.writeText(shareCaption)
        if (onToast) onToast('success', 'Payment link copied to clipboard.')
      } catch {
        if (onToast) onToast('error', 'Failed to share payment QR.')
      }
    }
  }

  useEffect(() => {
    if (setRequestAmount) setRequestAmount(amount)
  }, [amount, setRequestAmount])

  const handleChipPick = (val: number) => {
    triggerHaptic(50)
    const next = String(Number(amount || 0) + val)
    setAmount(next)
  }

  return (
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
      <div className="gp-pill-row">
        <button
          type="button"
          onClick={handleToggleBurner}
          className={`gp-burner-pill ${!isBurner ? 'is-inactive' : ''}`}
        >
          <span>🔥 Burner mode (1-time use)</span>
        </button>
      </div>

      {/* White rounded QR tile with soft green/purple glow, or warm amber glow in burner mode */}
      <div className="gp-qr-wrap">
        <div className={`gp-qr-tile ${isBurner ? 'gp-qr-tile--burner' : ''}`}>
          <QRCodeSVG value={currentUrl} size={210} level="M" />
        </div>
      </div>

      {/* Amount Field bound to existing state */}
      <GPAmountField
        value={amount}
        onChange={setAmount}
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

      {/* Actions: Copy link and Share QR */}
      <div className="gp-footer">
        <GPButton
          variant="secondary"
          icon={<CopyIcon />}
          onClick={handleCopy}
        >
          {isCopied ? 'Copied!' : 'Copy link'}
        </GPButton>
        <GPButton
          variant="primary"
          icon={<ShareIcon />}
          onClick={handleShare}
        >
          Share QR
        </GPButton>
      </div>
    </GPModal>
  )
}

// Export alias for seamless backward compatibility
export { MyQRModal as ShareQrModal }


