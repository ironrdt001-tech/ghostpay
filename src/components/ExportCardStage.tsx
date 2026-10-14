import { QRCodeSVG } from 'qrcode.react'

interface ExportCardStageProps {
  handle: string
  activeQrShareUrl: string
  requestedAmount?: number | null
}

export function ExportCardStage({ handle, activeQrShareUrl, requestedAmount }: ExportCardStageProps) {
  const cleanHandle = handle.replace(/^@+/, '')

  return (
    <div className="ghostpay-export-stage">
      <div
        id="ghostpay-export-card"
        style={{
          width: '380px',
          backgroundColor: '#0B0C0E',
          borderRadius: '24px',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          color: '#F3F4F6',
          fontFamily: "'Onest', system-ui, -apple-system, sans-serif",
          border: '1px solid #22262E',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: 'rgba(29, 78, 216, 0.15)',
                color: '#93C5FD',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '14px',
                border: '1px solid #22262E',
              }}
            >
              G
            </div>
            <span style={{ fontWeight: 500, fontSize: '18px', letterSpacing: '-0.02em', color: '#F3F4F6' }}>
              ghostpay
            </span>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 500,
              padding: '4px 10px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(29, 78, 216, 0.12)',
              color: '#93C5FD',
              border: '1px solid #22262E',
            }}
          >
            Shielded Escrow
          </span>
        </div>

        <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#FFFFFF', marginBottom: '20px' }}>
          <QRCodeSVG value={activeQrShareUrl} size={200} level="M" />
        </div>

        <div
          className="font-mono"
          style={{
            fontSize: '18px',
            fontWeight: 500,
            color: '#F3F4F6',
            letterSpacing: '-0.01em',
            marginBottom: '4px',
          }}
        >
          @{cleanHandle}
        </div>

        {requestedAmount && requestedAmount > 0 && (
          <div
            style={{
              margin: '4px 0 8px',
              padding: '4px 12px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid #0D9488',
              color: '#10B981',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            Requested: ₹{requestedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        )}

        <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '6px' }}>
          Scan to pay privately · Zero bank details exposed
        </div>
      </div>
    </div>
  )
}
