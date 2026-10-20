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

  // 1. Solid obsidian outer frame to eliminate WhatsApp/OS white bleeding corners
  ctx.fillStyle = '#05070b'
  ctx.fillRect(0, 0, width, height)

  // Inset main card with vertical titanium gradient
  const cardInset = 20
  const cardX = cardInset
  const cardY = cardInset
  const cardW = width - cardInset * 2
  const cardH = height - cardInset * 2
  const cardRadius = 36

  ctx.save()
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius)
  ctx.clip()

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH)
  cardGrad.addColorStop(0, '#111726')
  cardGrad.addColorStop(0.45, '#090d16')
  cardGrad.addColorStop(1, '#06080d')
  ctx.fillStyle = cardGrad
  ctx.fillRect(cardX, cardY, cardW, cardH)

  // Top-center ambient light bloom
  const bloomColor = isBurner ? 'rgba(249, 115, 22, 0.10)' : 'rgba(59, 130, 246, 0.10)'
  const bloom = ctx.createRadialGradient(width / 2, cardY, 10, width / 2, cardY, 320)
  bloom.addColorStop(0, bloomColor)
  bloom.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = bloom
  ctx.fillRect(cardX, cardY, cardW, cardH)
  ctx.restore()

  // Top-lit specular border (Linear/Apple top-edge highlight)
  const strokeGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH)
  strokeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)')
  strokeGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.10)')
  strokeGrad.addColorStop(1, 'rgba(255, 255, 255, 0.04)')

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = strokeGrad
  ctx.stroke()

  // 2. Color-Synced Top-Left Brand Mark
  const logoX = cardX + 36
  const logoY = cardY + 36
  const logoSize = 44
  drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 12)
  ctx.fillStyle = isBurner ? 'rgba(234, 88, 12, 0.18)' : 'rgba(37, 99, 235, 0.18)'
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = isBurner ? 'rgba(251, 146, 60, 0.35)' : 'rgba(96, 165, 250, 0.35)'
  ctx.stroke()

  ctx.fillStyle = isBurner ? '#fb923c' : '#60a5fa'
  ctx.font = '600 22px Inter, system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('G', logoX + logoSize / 2, logoY + logoSize / 2 + 1)

  ctx.fillStyle = '#f8fafc'
  ctx.font = '600 27px Inter, system-ui, -apple-system, sans-serif'
  if ('letterSpacing' in ctx) {
    // @ts-ignore
    ctx.letterSpacing = '-0.02em'
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('ghostpay', logoX + logoSize + 14, logoY + logoSize / 2)
  if ('letterSpacing' in ctx) {
    // @ts-ignore
    ctx.letterSpacing = 'normal'
  }

  // 3. Top-Right Pill Badge with Live Indicator Dot
  const badgeText = isBurner ? 'Burner Escrow' : 'Shielded Escrow'
  ctx.font = '500 15.5px Inter, system-ui, -apple-system, sans-serif'
  const textWidth = ctx.measureText(badgeText).width
  const dotRadius = 3
  const dotGap = 9
  const badgePadLeft = 14
  const badgePadRight = 14
  const badgeW = badgePadLeft + dotRadius * 2 + dotGap + textWidth + badgePadRight
  const badgeH = 36
  const badgeX = cardX + cardW - 36 - badgeW
  const badgeY = logoY + (logoSize - badgeH) / 2

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 18)
  ctx.fillStyle = isBurner ? 'rgba(124, 45, 18, 0.22)' : 'rgba(30, 58, 138, 0.20)'
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = isBurner ? 'rgba(251, 146, 60, 0.25)' : 'rgba(96, 165, 250, 0.22)'
  ctx.stroke()

  // Glowing status dot
  const dotCenterX = badgeX + badgePadLeft + dotRadius
  const dotCenterY = badgeY + badgeH / 2
  ctx.save()
  ctx.shadowColor = isBurner ? '#f97316' : '#3b82f6'
  ctx.shadowBlur = 8
  ctx.beginPath()
  ctx.arc(dotCenterX, dotCenterY, dotRadius, 0, Math.PI * 2)
  ctx.fillStyle = isBurner ? '#f97316' : '#3b82f6'
  ctx.fill()
  ctx.restore()

  // Badge text
  const textStartX = dotCenterX + dotRadius + dotGap
  ctx.fillStyle = isBurner ? '#fb923c' : '#60a5fa'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(badgeText, textStartX, badgeY + badgeH / 2)

  // 4. Double-Bezel QR Housing + Center GhostPay Monogram
  const qrBoxSize = 380
  const bezelPadding = 8
  const bezelSize = qrBoxSize + bezelPadding * 2
  const bezelX = (width - bezelSize) / 2
  const bezelY = 132

  // Outer machined bezel
  drawRoundedRect(ctx, bezelX, bezelY, bezelSize, bezelSize, 34)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.stroke()

  // Inner white QR tile
  const qrBoxX = bezelX + bezelPadding
  const qrBoxY = bezelY + bezelPadding
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 26)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  if (qrImg) {
    const quietZone = 28
    const qrSize = qrBoxSize - quietZone * 2
    const qrX = qrBoxX + quietZone
    const qrY = qrBoxY + quietZone
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

    // Center GhostPay Monogram Badge (46x46 with 4px white quiet border)
    const centerX = qrX + qrSize / 2
    const centerY = qrY + qrSize / 2
    const monoSize = 46
    const quietBorder = 4
    const totalCenterSize = monoSize + quietBorder * 2

    // White quiet border
    drawRoundedRect(
      ctx,
      centerX - totalCenterSize / 2,
      centerY - totalCenterSize / 2,
      totalCenterSize,
      totalCenterSize,
      14
    )
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // Dark monogram badge
    drawRoundedRect(
      ctx,
      centerX - monoSize / 2,
      centerY - monoSize / 2,
      monoSize,
      monoSize,
      11
    )
    ctx.fillStyle = '#090d16'
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = isBurner ? 'rgba(251, 146, 60, 0.45)' : 'rgba(96, 165, 250, 0.45)'
    ctx.stroke()

    // Crisp "G" monogram
    ctx.fillStyle = isBurner ? '#fb923c' : '#60a5fa'
    ctx.font = 'bold 24px Inter, system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('G', centerX, centerY + 1)
  }

  // 5. Anchored Handle Pill & Machined Footer
  const cleanHandle = handle.replace(/^@+/, '')
  const numericAmount = amount ? Number(amount) : null
  const hasAmount = numericAmount !== null && !isNaN(numericAmount) && numericAmount > 0

  const handleLabel = isBurner ? 'One-time Burner QR' : `@${cleanHandle}`
  const amountLabel = hasAmount ? ` · ₹${numericAmount.toLocaleString('en-IN')}` : ''

  ctx.font = isBurner
    ? '600 21px Inter, system-ui, -apple-system, sans-serif'
    : '600 21px "JetBrains Mono", "SF Mono", ui-monospace, monospace'
  const handleWidth = ctx.measureText(handleLabel).width

  let amountWidth = 0
  if (hasAmount) {
    ctx.font = '600 21px Inter, system-ui, -apple-system, sans-serif'
    amountWidth = ctx.measureText(amountLabel).width
  }

  const pillPaddingX = 24
  const pillW = handleWidth + amountWidth + pillPaddingX * 2
  const pillH = 44
  const pillX = (width - pillW) / 2
  const pillY = 560

  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 999)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)'
  ctx.stroke()

  const textStartX = pillX + pillPaddingX
  const textCenterY = pillY + pillH / 2

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#f8fafc'
  ctx.font = isBurner
    ? '600 21px Inter, system-ui, -apple-system, sans-serif'
    : '600 21px "JetBrains Mono", "SF Mono", ui-monospace, monospace'
  ctx.fillText(handleLabel, textStartX, textCenterY)

  if (hasAmount) {
    ctx.fillStyle = isBurner ? '#fb923c' : '#60a5fa'
    ctx.font = '600 21px Inter, system-ui, -apple-system, sans-serif'
    ctx.fillText(amountLabel, textStartX + handleWidth, textCenterY)
  }

  // Hairline horizontal laser divider (60% of card width)
  const dividerW = cardW * 0.6
  const dividerX = (width - dividerW) / 2
  const dividerY = 662
  const lineGrad = ctx.createLinearGradient(dividerX, dividerY, dividerX + dividerW, dividerY)
  lineGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
  lineGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.09)')
  lineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')

  ctx.beginPath()
  ctx.moveTo(dividerX, dividerY)
  ctx.lineTo(dividerX + dividerW, dividerY)
  ctx.lineWidth = 1
  ctx.strokeStyle = lineGrad
  ctx.stroke()

  // Signature footer text
  const footerY = 708
  ctx.fillStyle = '#64748b'
  ctx.font = '600 12.5px Inter, system-ui, -apple-system, sans-serif'
  if ('letterSpacing' in ctx) {
    // @ts-ignore
    ctx.letterSpacing = '1.2px'
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('SCAN TO PAY PRIVATELY · ZERO BANK DETAILS EXPOSED', width / 2, footerY)
  if ('letterSpacing' in ctx) {
    // @ts-ignore
    ctx.letterSpacing = 'normal'
  }

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


