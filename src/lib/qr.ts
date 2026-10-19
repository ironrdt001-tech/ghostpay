export interface ScannedPaymentData {
  recipient: string
  amount?: string
}

export function parsePaymentQrCode(rawCode: string): ScannedPaymentData | null {
  const code = (rawCode || '').trim()
  if (!code) return null

  // 1. GhostPay web URL e.g. https://ghostpay-orpin.vercel.app/@username?amount=500
  if (code.includes('ghostpay-orpin.vercel.app') || code.includes('ghostpay') || code.startsWith('http://') || code.startsWith('https://')) {
    try {
      const url = new URL(code.startsWith('http') ? code : `https://${code}`)
      const pathSegments = url.pathname.split('/').filter(Boolean)
      const lastSegment = pathSegments[pathSegments.length - 1] || ''
      const cleanHandle = lastSegment.replace(/^@+/, '')
      const amountParam = url.searchParams.get('am') || url.searchParams.get('amount') || undefined

      if (cleanHandle) {
        return {
          recipient: `@${cleanHandle}`,
          amount: amountParam,
        }
      }
    } catch {
      // Continue to next parsers
    }
  }

  // 2. Relative pathname e.g. /@username?amount=500
  if (code.startsWith('/@') || code.startsWith('@')) {
    try {
      const dummyUrl = new URL(code.startsWith('/') ? `https://ghostpay-orpin.vercel.app${code}` : `https://ghostpay-orpin.vercel.app/${code}`)
      const pathSegments = dummyUrl.pathname.split('/').filter(Boolean)
      const lastSegment = pathSegments[pathSegments.length - 1] || ''
      const cleanHandle = lastSegment.replace(/^@+/, '')
      const amountParam = dummyUrl.searchParams.get('am') || dummyUrl.searchParams.get('amount') || undefined

      if (cleanHandle) {
        return {
          recipient: `@${cleanHandle}`,
          amount: amountParam,
        }
      }
    } catch {
      // Continue to next parsers
    }
  }

  // 3. UPI QR code e.g. upi://pay?pa=recipient@bank&am=500
  if (code.startsWith('upi://')) {
    try {
      const url = new URL(code)
      const pa = url.searchParams.get('pa') || ''
      const am = url.searchParams.get('am') || undefined
      if (pa) {
        return {
          recipient: pa,
          amount: am,
        }
      }
    } catch {
      // Continue to next parsers
    }
  }

  // 4. Raw handle e.g. @username or username
  if (/^@?[a-zA-Z0-9._-]{3,30}$/.test(code)) {
    return {
      recipient: code.startsWith('@') ? code : `@${code}`,
    }
  }

  // 5. Raw UPI ID e.g. username@bank
  if (/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(code)) {
    return {
      recipient: code,
    }
  }

  return {
    recipient: code,
  }
}
