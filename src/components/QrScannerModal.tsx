import { useState, useEffect } from 'react'
import { CloseIcon, CameraIcon, GalleryIcon } from './Icons'
import { triggerHaptic } from '../lib/haptics'

interface QrScannerModalProps {
  isOpen: boolean
  onClose: () => void
}

export function QrScannerModal({ isOpen, onClose }: QrScannerModalProps) {
  const [scanMode, setScanMode] = useState<'camera' | 'gallery'>('camera')

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan QR to pay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: '#FFFFFF',
        fontFamily: "'Onest', system-ui, -apple-system, sans-serif",
        paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        paddingLeft: '20px',
        paddingRight: '20px',
        overflow: 'hidden',
      }}
    >
      {/* Top Row: Close button on top-left, centered title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          minHeight: '44px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            triggerHaptic()
            onClose()
          }}
          aria-label="Close scanner"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <CloseIcon size={18} strokeWidth={2} />
        </button>

        <h1
          style={{
            fontSize: '17px',
            fontWeight: 600,
            color: '#FFFFFF',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Scan QR to pay
        </h1>

        <div style={{ width: '40px' }} aria-hidden="true" />
      </div>

      {/* Middle: Rounded transparent viewfinder square with illuminated corner brackets & pulsing mock */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          padding: '20px 0',
        }}
      >
        <div
          style={{
            width: '250px',
            height: '250px',
            position: 'relative',
            borderRadius: '20px',
            border: '2px solid rgba(255, 255, 255, 0.5)',
            overflow: 'hidden',
            backgroundColor: '#16181D',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
          }}
        >
          {/* Mock camera feed pulsing animation */}
          <div
            className="qr-viewfinder-pulse"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle, rgba(37, 99, 235, 0.14) 0%, rgba(22, 24, 29, 0.85) 100%)',
            }}
          />

          {/* Animated laser scan line */}
          <div className="qr-scan-laser" />

          {/* Corner Bracket: Top-Left */}
          <div
            style={{
              position: 'absolute',
              top: '-2px',
              left: '-2px',
              width: '24px',
              height: '24px',
              borderTop: '4px solid #FFFFFF',
              borderLeft: '4px solid #FFFFFF',
              borderTopLeftRadius: '18px',
              pointerEvents: 'none',
            }}
          />
          {/* Corner Bracket: Top-Right */}
          <div
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '24px',
              height: '24px',
              borderTop: '4px solid #FFFFFF',
              borderRight: '4px solid #FFFFFF',
              borderTopRightRadius: '18px',
              pointerEvents: 'none',
            }}
          />
          {/* Corner Bracket: Bottom-Left */}
          <div
            style={{
              position: 'absolute',
              bottom: '-2px',
              left: '-2px',
              width: '24px',
              height: '24px',
              borderBottom: '4px solid #FFFFFF',
              borderLeft: '4px solid #FFFFFF',
              borderBottomLeftRadius: '18px',
              pointerEvents: 'none',
            }}
          />
          {/* Corner Bracket: Bottom-Right */}
          <div
            style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              width: '24px',
              height: '24px',
              borderBottom: '4px solid #FFFFFF',
              borderRight: '4px solid #FFFFFF',
              borderBottomRightRadius: '18px',
              pointerEvents: 'none',
            }}
          />
        </div>

        <p
          style={{
            marginTop: '24px',
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
            maxWidth: '260px',
            lineHeight: 1.45,
            letterSpacing: '-0.01em',
          }}
        >
          Align QR code inside the frame to pay instantly
        </p>
      </div>

      {/* Bottom Row: Two Pill Buttons ("Use Camera" active by default & "Upload from Gallery") */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          maxWidth: '360px',
          margin: '0 auto',
        }}
      >
        <button
          type="button"
          onClick={() => {
            triggerHaptic()
            setScanMode('camera')
          }}
          style={{
            flex: 1,
            minHeight: '46px',
            padding: '0 16px',
            borderRadius: '999px',
            backgroundColor: scanMode === 'camera' ? 'var(--accent-primary, #2563EB)' : 'rgba(255, 255, 255, 0.1)',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            border: scanMode === 'camera' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
            cursor: 'pointer',
            transition: 'background-color 180ms ease, transform 120ms ease',
          }}
        >
          <CameraIcon size={16} strokeWidth={2} />
          <span>Use Camera</span>
        </button>

        <label
          style={{
            flex: 1,
            minHeight: '46px',
            padding: '0 16px',
            borderRadius: '999px',
            backgroundColor: scanMode === 'gallery' ? 'var(--accent-primary, #2563EB)' : 'rgba(255, 255, 255, 0.1)',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            border: scanMode === 'gallery' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
            cursor: 'pointer',
            transition: 'background-color 180ms ease, transform 120ms ease',
          }}
          onClick={() => {
            triggerHaptic()
            setScanMode('gallery')
          }}
        >
          <GalleryIcon size={16} strokeWidth={2} />
          <span>Upload from Gallery</span>
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) {
                triggerHaptic()
              }
            }}
          />
        </label>
      </div>
    </div>
  )
}
