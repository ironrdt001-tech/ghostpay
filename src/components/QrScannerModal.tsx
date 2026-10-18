import { useState, useEffect, useRef } from 'react'
import jsQR from 'jsqr'
import { CloseIcon, CameraIcon, GalleryIcon } from './Icons'
import { triggerHaptic } from '../lib/haptics'

interface QrScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (scannedCode: string) => void
  onToast?: (kind: 'success' | 'error', message: string) => void
}

export function QrScannerModal({ isOpen, onClose, onSuccess, onToast }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameIdRef = useRef<number | null>(null)
  const hasDetectedRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [scanMode, setScanMode] = useState<'camera' | 'gallery'>('camera')
  const [cameraError, setCameraError] = useState<string | null>(null)

  function stopMediaStream() {
    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current)
      animFrameIdRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop()
        } catch {
          // ignore error on stop
        }
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  function handleQrDetected(codeData: string) {
    if (hasDetectedRef.current) return
    hasDetectedRef.current = true

    triggerHaptic(50)
    stopMediaStream()
    onSuccess(codeData)
    onClose()
  }

  // Camera initialization and live scanning loop
  useEffect(() => {
    if (!isOpen) {
      stopMediaStream()
      return
    }

    hasDetectedRef.current = false
    setCameraError(null)
    setScanMode('camera')
    let isCancelled = false

    async function initCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera not supported in this browser.')
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        if (isCancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute('playsinline', 'true')
          try {
            await videoRef.current.play()
          } catch {
            // autoplay permitted or user gesture handled
          }
        }

        // Start requestAnimationFrame scan loop
        function scanFrame() {
          if (hasDetectedRef.current || isCancelled) return

          const video = videoRef.current
          const canvas = canvasRef.current

          if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            const width = video.videoWidth
            const height = video.videoHeight

            if (width > 0 && height > 0) {
              canvas.width = width
              canvas.height = height
              const ctx = canvas.getContext('2d', { willReadFrequently: true })

              if (ctx) {
                ctx.drawImage(video, 0, 0, width, height)
                const imageData = ctx.getImageData(0, 0, width, height)
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: 'dontInvert',
                })

                if (code && code.data && !hasDetectedRef.current) {
                  handleQrDetected(code.data)
                  return
                }
              }
            }
          }

          animFrameIdRef.current = requestAnimationFrame(scanFrame)
        }

        animFrameIdRef.current = requestAnimationFrame(scanFrame)
      } catch (err) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Camera access was denied or is unavailable.'
          setCameraError(msg)
          if (onToast) onToast('error', 'Camera unavailable. Please upload a QR code image from your gallery.')
        }
      }
    }

    initCamera()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      isCancelled = true
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      stopMediaStream()
    }
  }, [isOpen])

  // Gallery image processing hook
  function handleImageFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(img, 0, 0, img.width, img.height)
          const imageData = ctx.getImageData(0, 0, img.width, img.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)
          if (code && code.data) {
            handleQrDetected(code.data)
          } else {
            if (onToast) onToast('error', 'No valid GhostPay or UPI QR code found in this image.')
          }
        }
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan to pay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Onest', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Live Video Feed Background */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          objectFit: 'cover',
          width: '100%',
          height: '100%',
          position: 'absolute',
          zIndex: 0,
          background: '#0B0C0E',
        }}
      />

      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Full-screen Dark UI Overlay */}
      <div
        style={{
          zIndex: 10,
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          paddingLeft: '20px',
          paddingRight: '20px',
          pointerEvents: 'none',
        }}
      >
        {/* Top Row: Close button on top-left, title "Scan to pay" centered in white text */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            minHeight: '44px',
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => {
              triggerHaptic(50)
              stopMediaStream()
              onClose()
            }}
            aria-label="Close scanner"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.15)',
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
              textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            }}
          >
            Scan to pay
          </h1>

          <div style={{ width: '40px' }} aria-hidden="true" />
        </div>

        {/* Middle: Viewfinder cutout square with illuminated bright white corner brackets */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '250px',
              height: '250px',
              position: 'relative',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.52)',
            }}
          >
            {/* Animated Laser Sweep Line */}
            <div
              style={{
                position: 'absolute',
                height: '2px',
                width: '100%',
                background: '#10B981',
                boxShadow: '0 0 12px #10B981',
                animation: 'scanLaser 2s linear infinite',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />

            {/* Corner Bracket: Top-Left */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '32px',
                height: '32px',
                borderTop: '3px solid #10B981',
                borderLeft: '3px solid #10B981',
                borderTopLeftRadius: '16px',
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)',
                pointerEvents: 'none',
                zIndex: 3,
              }}
            />
            {/* Corner Bracket: Top-Right */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '32px',
                height: '32px',
                borderTop: '3px solid #10B981',
                borderRight: '3px solid #10B981',
                borderTopRightRadius: '16px',
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)',
                pointerEvents: 'none',
                zIndex: 3,
              }}
            />
            {/* Corner Bracket: Bottom-Left */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '32px',
                height: '32px',
                borderBottom: '3px solid #10B981',
                borderLeft: '3px solid #10B981',
                borderBottomLeftRadius: '16px',
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)',
                pointerEvents: 'none',
                zIndex: 3,
              }}
            />
            {/* Corner Bracket: Bottom-Right */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '32px',
                height: '32px',
                borderBottom: '3px solid #10B981',
                borderRight: '3px solid #10B981',
                borderBottomRightRadius: '16px',
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)',
                pointerEvents: 'none',
                zIndex: 3,
              }}
            />
          </div>

          <p
            style={{
              marginTop: '24px',
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.85)',
              textAlign: 'center',
              maxWidth: '260px',
              lineHeight: 1.45,
              letterSpacing: '-0.01em',
              textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            }}
          >
            {cameraError || 'Align QR code inside the frame to pay instantly'}
          </p>
        </div>

        {/* Bottom Row: Two Pill Buttons (Use Camera & Upload from Gallery) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            maxWidth: '360px',
            margin: '0 auto',
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => {
              triggerHaptic(50)
              setScanMode('camera')
            }}
            style={{
              flex: 1,
              minHeight: '46px',
              padding: '0 16px',
              borderRadius: '999px',
              backgroundColor: scanMode === 'camera' ? 'var(--accent-primary, #2563EB)' : 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              border: scanMode === 'camera' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.15)',
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
              backgroundColor: scanMode === 'gallery' ? 'var(--accent-primary, #2563EB)' : 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              border: scanMode === 'gallery' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.15)',
              cursor: 'pointer',
              transition: 'background-color 180ms ease, transform 120ms ease',
            }}
            onClick={() => {
              triggerHaptic(50)
              setScanMode('gallery')
            }}
          >
            <GalleryIcon size={16} strokeWidth={2} />
            <span>Upload from Gallery</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  triggerHaptic(50)
                  handleImageFile(file)
                }
              }}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
