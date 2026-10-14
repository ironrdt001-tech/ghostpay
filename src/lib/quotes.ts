let lastSharedQuote = ''

export async function fetchDynamicTrustQuoteFromWeb(): Promise<string> {
  const cacheBuster = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  try {
    const res = await fetch(
      `https://api.quotable.io/quotes/random?tags=trust|wisdom|honesty|character|business&maxLength=120&_cb=${cacheBuster}`,
      { cache: 'no-store' },
    )
    if (res.ok) {
      const data = await res.json()
      const item = Array.isArray(data) ? data[0] : data
      if (item?.content && item.content !== lastSharedQuote) {
        lastSharedQuote = item.content
        return item.content
      }
    }
  } catch {
    // Continue to fallback web source
  }

  try {
    const randomSkip = Math.floor(Math.random() * 1200)
    const res = await fetch(
      `https://dummyjson.com/quotes?limit=30&skip=${randomSkip}&_cb=${cacheBuster}`,
      { cache: 'no-store' },
    )
    if (res.ok) {
      const data = await res.json()
      const quotes: Array<{ quote: string }> = data?.quotes || []
      if (quotes.length > 0) {
        const candidates = quotes.filter(q => q.quote !== lastSharedQuote)
        const trustMatch = candidates.find(q => /trust|honest|truth|character|promise|value|respect|integrity|money|wealth/i.test(q.quote))
        const chosen = trustMatch?.quote || candidates[Math.floor(Math.random() * candidates.length)]?.quote
        if (chosen) {
          lastSharedQuote = chosen
          return chosen
        }
      }
    }
  } catch {
    // Continue to retry loop
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(`https://dummyjson.com/quotes/random?_cb=${cacheBuster}-${attempt}`, { cache: 'no-store' })
      const data = await res.json()
      if (typeof data?.quote === 'string' && data.quote !== lastSharedQuote) {
        lastSharedQuote = data.quote
        return data.quote
      }
    } catch {
      // Continue to local fallback
    }
  }

  const fallbackQuotes = [
    'Privacy is the foundation of trust.',
    'Integrity is choosing your thoughts and actions based on values rather than personal gain.',
    'The way to gain a good reputation is to endeavor to be what you desire to appear.',
  ]
  const fallback = fallbackQuotes.find(quote => quote !== lastSharedQuote) || fallbackQuotes[0]
  lastSharedQuote = fallback
  return fallback
}
