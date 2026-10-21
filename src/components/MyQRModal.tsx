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
  const width = 720
  const height = 860

  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.scale(scale, scale)

  // 1. Solid obsidian outer canvas (zero white corner bleed on WhatsApp)
  ctx.fillStyle = '#05070b'
  ctx.fillRect(0, 0, width, height)

  // Main pass dimensions
  const cardX = 24
  const cardY = 24
  const cardW = 672
  const cardH = 812
  const cardRadius = 40

  // Clip to main pass body
  ctx.save()
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius)
  ctx.clip()

  // Deep vertical titanium gradient
  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH)
  cardGrad.addColorStop(0, '#111827')
  cardGrad.addColorStop(0.45, '#0b0f19')
  cardGrad.addColorStop(1, '#070a12')
  ctx.fillStyle = cardGrad
  ctx.fillRect(cardX, cardY, cardW, cardH)

  // Top ambient radial glow
  const glowColor = isBurner ? 'rgba(249, 115, 22, 0.14)' : 'rgba(59, 130, 246, 0.14)'
  const glow = ctx.createRadialGradient(360, 24, 10, 360, 24, 340)
  glow.addColorStop(0, glowColor)
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(cardX, cardY, cardW, cardH)

  // 2. Bottom settlement strip (y: 736 to 836, height 100px)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)'
  ctx.fillRect(cardX, 736, cardW, 100)

  // Full-width subtle horizontal divider line
  ctx.beginPath()
  ctx.moveTo(cardX, 736)
  ctx.lineTo(cardX + cardW, 736)
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
  ctx.stroke()

  ctx.restore()

  // Top-lit specular outer border
  const strokeGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH)
  strokeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)')
  strokeGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.10)')
  strokeGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)')

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = strokeGrad
  ctx.stroke()

  // 3. Header Row (centered at y: 76)
  const logoSize = 44
  const logoX = 68
  const logoY = 76 - logoSize / 2
  drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 12)
  ctx.fillStyle = isBurner ? 'rgba(234, 88, 12, 0.16)' : 'rgba(37, 99, 235, 0.16)'
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = isBurner ? 'rgba(251, 146, 60, 0.35)' : 'rgba(96, 165, 250, 0.35)'
  ctx.stroke()

  ctx.fillStyle = isBurner ? '#fb923c' : '#60a5fa'
  ctx.font = '600 22px Inter, system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('G', logoX + logoSize / 2, 76 + 1)

  ctx.fillStyle = '#f8fafc'
  ctx.font = '600 28px Inter, system-ui, -apple-system, sans-serif'
  if ('letterSpacing' in ctx) {
    // @ts-ignore
    ctx.letterSpacing = '-0.02em'
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('ghostpay', 126, 76)
  if ('letterSpacing' in ctx) {
    // @ts-ignore
    ctx.letterSpacing = 'normal'
  }

  // Right status pill (right-aligned to x: 652)
  const badgeText = isBurner ? '1-Time Use' : 'Shielded Escrow'
  ctx.font = '500 15px Inter, system-ui, -apple-system, sans-serif'
  const textWidth = ctx.measureText(badgeText).width
  const dotRadius = 3
  const dotGap = 9
  const badgePadLeft = 14
  const badgePadRight = 14
  const badgeW = badgePadLeft + dotRadius * 2 + dotGap + textWidth + badgePadRight
  const badgeH = 36
  const badgeX = 652 - badgeW
  const badgeY = 76 - badgeH / 2

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 18)
  ctx.fillStyle = isBurner ? 'rgba(124, 45, 18, 0.22)' : 'rgba(30, 58, 138, 0.20)'
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = isBurner ? 'rgba(251, 146, 60, 0.25)' : 'rgba(96, 165, 250, 0.22)'
  ctx.stroke()

  // Glowing status dot
  const dotCenterX = badgeX + badgePadLeft + dotRadius
  ctx.save()
  ctx.shadowColor = isBurner ? '#f97316' : '#3b82f6'
  ctx.shadowBlur = 8
  ctx.beginPath()
  ctx.arc(dotCenterX, 76, dotRadius, 0, Math.PI * 2)
  ctx.fillStyle = isBurner ? '#f97316' : '#3b82f6'
  ctx.fill()
  ctx.restore()

  const badgeTextX = dotCenterX + dotRadius + dotGap
  ctx.fillStyle = isBurner ? '#fb923c' : '#60a5fa'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(badgeText, badgeTextX, 76)

  // 4. Pure Uncluttered QR Tile + Precision Pedestal (No Center Sticker)
  // Outer pedestal frame
  drawRoundedRect(ctx, 152, 152, 416, 416, 36)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)'
  ctx.stroke()

  // Inner pure white QR card with drop shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 10
  drawRoundedRect(ctx, 164, 164, 392, 392, 28)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()

  // Draw pure, unobstructed QR code
  if (qrImg) {
    ctx.drawImage(qrImg, 192, 192, 336, 336)
  }

  // 5. Clean Center Identity Typography Below QR
  const cleanHandle = handle.replace(/^@+/, '')
  const numericAmount = amount ? Number(amount) : null
  const hasAmount = numericAmount !== null && !isNaN(numericAmount) && numericAmount > 0
  const amountStr = hasAmount ? ` · ₹${numericAmount.toLocaleString('en-IN')}` : ''
  const primaryText = isBurner ? 'Burner QR' : `@${cleanHandle}`
  const titleY = isBurner ? 632 : 645

  ctx.textBaseline = 'middle'

  if (!hasAmount) {
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = isBurner
      ? '700 32px Inter, system-ui, -apple-system, sans-serif'
      : '700 34px Inter, system-ui, -apple-system, sans-serif'
    ctx.fillText(primaryText, 360, titleY)
  } else {
    ctx.font = isBurner
      ? '700 32px Inter, system-ui, -apple-system, sans-serif'
      : '700 34px Inter, system-ui, -apple-system, sans-serif'
    const primaryW = ctx.measureText(primaryText).width

    ctx.font = '600 30px Inter, system-ui, -apple-system, sans-serif'
    const amountW = ctx.measureText(amountStr).width

    const totalW = primaryW + amountW
    const startX = 360 - totalW / 2

    ctx.textAlign = 'left'
    ctx.fillStyle = '#ffffff'
    ctx.font = isBurner
      ? '700 32px Inter, system-ui, -apple-system, sans-serif'
      : '700 34px Inter, system-ui, -apple-system, sans-serif'
    ctx.fillText(primaryText, startX, titleY)

    ctx.fillStyle = isBurner ? '#fdba74' : '#93c5fd'
    ctx.font = '600 30px Inter, system-ui, -apple-system, sans-serif'
    ctx.fillText(amountStr, startX + primaryW, titleY)
  }

  if (isBurner) {
    ctx.textAlign = 'center'
    ctx.fillStyle = '#94a3b8'
    ctx.font = '500 16px Inter, system-ui, sans-serif'
    ctx.fillText('Self-destructs after single payment', 360, 670)
  }

  // 6. Grounded Bottom Settlement Strip (Centered at y: 786)
  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 16px Inter, system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Scan to pay privately  ·  Zero bank details exposed', 360, 786)

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
    const fileName = isBurner
      ? 'GhostPay-Burner-Pass.png'
      : `GhostPay-${(userHandle || 'Pass').replace(/^@/, '')}.png`
    const shareTitle = isBurner ? 'GhostPay Burner Pass' : 'GhostPay Private Portal'

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
          title: shareTitle,
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
          <QRCodeSVG value={currentUrl} size={210} level="H" />
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


