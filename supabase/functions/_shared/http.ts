const allowedOrigins = (Deno.env.get('PUBLIC_APP_URL') ?? '')
  .split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean)

export function corsHeaders(origin: string | null): HeadersInit {
  const acceptedOrigin = origin && allowedOrigins.includes(origin.replace(/\/$/, ''))
    ? origin
    : allowedOrigins[0] ?? 'null'
  return {
    'Access-Control-Allow-Origin': acceptedOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export function isAllowedOrigin(origin: string | null): boolean {
  return Boolean(origin && allowedOrigins.includes(origin.replace(/\/$/, '')))
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

export function serviceRoleKey(): string {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacyKey) return legacyKey

  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>
      if (parsed.default) return parsed.default
    } catch {
      // Fall through to the actionable configuration error below.
    }
  }
  throw new Error('Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEYS for Edge Functions.')
}

export function cashfreeEnvironment(): 'sandbox' | 'production' {
  return Deno.env.get('CASHFREE_ENV')?.toLowerCase() === 'production' ? 'production' : 'sandbox'
}

export function paymentGatewayBaseUrl(): string {
  return cashfreeEnvironment() === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg'
}

export function payoutBaseUrl(): string {
  return cashfreeEnvironment() === 'production'
    ? 'https://api.cashfree.com/payout'
    : 'https://sandbox.cashfree.com/payout'
}
