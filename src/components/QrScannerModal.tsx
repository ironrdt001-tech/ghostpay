import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

import { BoltIcon, CloseIcon, GalleryIcon } from './Icons'
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
  const videoTrackRef = useRef<MediaStreamTrack | null>(null)
  const animFrameIdRef = useRef<number | null>(null)
  const hasDetectedRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [cameraError, setCameraError] = useState<string | null>(null)
  const [flashOn, setFlashOn] = useState(false)
  const [flashSupported, setFlashSupported] = useState(false)

  const toggleFlash = async () => {
    if (videoTrackRef.current) {
      try {
        const nextState = !flashOn
        await videoTrackRef.current.applyConstraints({
          advanced: [{ torch: nextState } as unknown as MediaTrackConstraintSet],
        })
        setFlashOn(nextState)
      } catch (err) {
        console.warn('Torch error', err)
      }
    }
  }

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
    videoTrackRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setFlashOn(false)
    setFlashSupported(false)
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
    setFlashOn(false)
    setFlashSupported(false)
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

        const track = stream.getVideoTracks()[0]
        if (track) {
          videoTrackRef.current = track
          const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as { torch?: boolean }
          if (capabilities && capabilities.torch) {
            setFlashSupported(true)
          }
        }

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
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        {/* Center: Viewfinder reticle */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div className="reticle-container">
            <div className="reticle-corner top-left"></div>
            <div className="reticle-corner top-right"></div>
            <div className="reticle-corner bottom-left"></div>
            <div className="reticle-corner bottom-right"></div>
          </div>
        </div>

        {/* UPI Interoperability Trust Strip */}
        <div className="scanner-trust-strip">
          <p className="trust-primary">{cameraError || 'Scan any QR code to pay'}</p>
          <p className="trust-secondary">Google Pay • PhonePe • Paytm • UPI</p>
        </div>

        {/* Bottom controls container: Gallery on LEFT, Flash in CENTER, Close on RIGHT */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: 0,
            right: 0,
            width: '100%',
            padding: '0 32px',
            boxSizing: 'border-box',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          {/* Gallery Button on the LEFT */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(50)
              fileInputRef.current?.click()
            }}
            aria-label="Upload QR code from gallery"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <GalleryIcon size={20} strokeWidth={1.8} />
          </button>
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

          {/* Flashlight Button in CENTER (only rendered if flash is supported) */}
          {flashSupported && (
            <button
              type="button"
              onClick={toggleFlash}
              aria-label={flashOn ? 'Turn off flash' : 'Turn on flash'}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: flashOn ? '#FFFFFF' : 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: flashOn ? '1px solid #FFFFFF' : '1px solid rgba(255, 255, 255, 0.25)',
                color: flashOn ? '#0B0F19' : '#FFFFFF',
                boxShadow: flashOn ? '0 0 16px rgba(255, 255, 255, 0.6)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <BoltIcon size={20} strokeWidth={2} fill={flashOn ? '#0B0F19' : 'none'} />
            </button>
          )}

          {/* Close ('X') Button on the RIGHT */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(50)
              stopMediaStream()
              onClose()
            }}
            aria-label="Close scanner"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <CloseIcon size={20} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}
