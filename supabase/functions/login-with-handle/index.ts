import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, isAllowedOrigin, jsonResponse, serviceRoleKey } from '../_shared/http.ts'

type LoginBody = { handle?: unknown; password?: unknown }

// A lightweight per-isolate guard limits repeated lookups. Supabase Auth also
// applies its own password-grant rate limits to the credential check.
const attempts = new Map<string, { count: number; resetAt: number }>()
const windowMs = 10 * 60 * 1000
const maxAttempts = 20

Deno.serve(async request => {
  const origin = request.headers.get('origin')
  const headers = { ...corsHeaders(origin), 'Cache-Control': 'no-store' }
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, headers)
  if (!isAllowedOrigin(origin)) return jsonResponse({ error: 'Origin is not allowed.' }, 403, headers)

  let body: LoginBody
  try {
    body = await request.json() as LoginBody
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400, headers)
  }

  const handle = typeof body.handle === 'string' ? body.handle.trim().replace(/^@+/, '').toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!/^[a-z0-9_][a-z0-9_.]{2,29}$/.test(handle) || password.length < 1 || password.length > 256) {
    return jsonResponse({ error: 'Enter a valid handle and password.' }, 400, headers)
  }

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rateKey = `${forwardedFor}:${handle}`
  const now = Date.now()
  const attempt = attempts.get(rateKey)
  if (attempt && attempt.resetAt > now && attempt.count >= maxAttempts) {
    return jsonResponse({ error: 'Too many sign-in attempts. Please try again later.' }, 429, headers)
  }
  attempts.set(rateKey, !attempt || attempt.resetAt <= now
    ? { count: 1, resetAt: now + windowMs }
    : { ...attempt, count: attempt.count + 1 })
  if (attempts.size > 5000) {
    for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  if (!supabaseUrl || !anonKey) return jsonResponse({ error: 'Handle sign-in is not configured.' }, 503, headers)

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .eq('alias_handle', handle)
      .maybeSingle()
    if (profileError) return jsonResponse({ error: 'Handle sign-in is temporarily unavailable.' }, 503, headers)
    if (!profile) return jsonResponse({ error: 'Invalid sign-in credentials.', code: 'ACCOUNT_NOT_FOUND' }, 401, headers)

    const { data: authUser, error: userError } = await admin.auth.admin.getUserById(profile.id)
    const email = authUser.user?.email
    if (userError || !email) return jsonResponse({ error: 'Invalid sign-in credentials.', code: 'ACCOUNT_NOT_FOUND' }, 401, headers)

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: authResult, error: authError } = await authClient.auth.signInWithPassword({ email, password })
    if (authError || !authResult.session) {
      return jsonResponse({ error: 'Invalid sign-in credentials.', code: 'INVALID_CREDENTIALS' }, 401, headers)
    }

    return jsonResponse({
      session: {
        access_token: authResult.session.access_token,
        refresh_token: authResult.session.refresh_token,
      },
    }, 200, headers)
  } catch {
    return jsonResponse({ error: 'Handle sign-in is temporarily unavailable.' }, 503, headers)
  }
})
