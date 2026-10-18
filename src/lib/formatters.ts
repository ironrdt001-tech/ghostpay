import type { Transaction } from './types'

export interface MoneyParts {
  currency: string
  integer: string
  decimal: string
  full: string
}

export function formatMoneyParts(amount: number): MoneyParts {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const parts = formatter.formatToParts(safeAmount)
  let integerPart = ''
  let decimalPart = '00'

  let foundDecimal = false
  for (const part of parts) {
    if (part.type === 'decimal') {
      foundDecimal = true
    } else if (foundDecimal && part.type === 'fraction') {
      decimalPart = part.value
    } else if (!foundDecimal && (part.type === 'integer' || part.type === 'group')) {
      integerPart += part.value
    }
  }

  const full = `₹${integerPart}.${decimalPart}`
  return {
    currency: '₹',
    integer: integerPart || '0',
    decimal: `.${decimalPart}`,
    full,
  }
}

export function formatHandle(value: string): string {
  return `@${value.replace(/^@+/, '')}`
}

export function formatCompactRupee(amount: number): string {
  const safe = Math.abs(amount)
  if (safe >= 10000000) {
    const cr = safe / 10000000
    const str = cr < 100 ? cr.toFixed(1).replace(/\.0$/, '') : Math.round(cr).toString()
    return `₹${str}Cr`
  }
  if (safe >= 100000) {
    const l = safe / 100000
    const str = l < 100 ? l.toFixed(1).replace(/\.0$/, '') : Math.round(l).toString()
    return `₹${str}L`
  }
  if (safe >= 1000) {
    const k = safe / 1000
    const str = k < 100 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k).toString()
    return `₹${str}k`
  }
  return `₹${Math.round(safe)}`
}

export function generateUtrNumber(tx: { id?: string; created_at?: string }): string {
  const raw = String(tx?.id || tx?.created_at || '1029384756')
  let hash = 0
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) % 900000000000
  }
  const normalized = Math.abs(hash) + 100000000000
  return String(normalized).slice(0, 12)
}

export function formatIstTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const timeStr = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    })
    return `${timeStr} IST`
  } catch {
    return '00:00 IST'
  }
}

export function formatIstDateTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const dateStr = date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
    const timeStr = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    })
    return `${dateStr}, ${timeStr} IST`
  } catch {
    return 'Date unavailable'
  }
}

export interface DateGroupedTransactions {
  dateLabel: string
  transactions: Transaction[]
}

export function groupTransactionsByDate(transactions: Transaction[]): DateGroupedTransactions[] {
  const now = new Date()
  const todayKey = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const yesterdayKey = yesterday.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })

  const map = new Map<string, { label: string; list: Transaction[] }>()

  for (const tx of transactions) {
    const txDate = new Date(tx.created_at)
    const key = txDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
    let label: string
    if (key === todayKey) {
      label = 'Today'
    } else if (key === yesterdayKey) {
      label = 'Yesterday'
    } else {
      label = txDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    }

    if (!map.has(key)) {
      map.set(key, { label, list: [] })
    }
    map.get(key)!.list.push(tx)
  }

  return Array.from(map.values()).map(group => ({
    dateLabel: group.label,
    transactions: group.list,
  }))
}
