import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { triggerHaptic } from '../lib/haptics'
import { supabase } from '../lib/supabase'
import {
  GPModal,
  GPAmountField,
  GPChips,
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

  const numAmount = parseFloat(amount)
  const hasValidAmount = Number.isFinite(numAmount) && numAmount > 0

  let currentUrl = isBurner
    ? `https://ghostpay-orpin.vercel.app/pay/${burnerToken || 'gp_brn_temp'}`
    : `https://ghostpay-orpin.vercel.app/@${userHandle}`

  if (!isBurner && hasValidAmount) {
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
    setIsCopied(false)
    if (setRequestAmount) setRequestAmount('')
    onClose()
  }

  const handleCopy = async () => {
    triggerHaptic(50)
    try {
      await navigator.clipboard.writeText(currentUrl)
      setIsCopied(true)
      if (onToast) onToast('success', isBurner ? 'Burner link copied to clipboard.' : 'Payment link copied to clipboard.')
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy', err)
      if (onToast) onToast('error', 'Failed to copy payment link.')
    }
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
      handleCopy()
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

      {/* Actions: Copy link and Share link */}
      <div className="flex gap-3 mt-6">
        <button 
          type="button"
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-transparent border border-gray-700 text-white font-medium hover:bg-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isCopied ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            )}
          </svg>
          {isCopied ? 'Copied!' : 'Copy link'}
        </button>
        <button 
          type="button"
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share link
        </button>
      </div>
    </GPModal>
  )
}

// Export alias for seamless backward compatibility
export { MyQRModal as ShareQrModal }

