import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  corsHeaders,
  isAllowedOrigin,
  jsonResponse,
  paymentGatewayBaseUrl,
  serviceRoleKey,
} from '../_shared/http.ts'

type CreatePaymentBody = { alias_handle?: unknown; amount_inr?: unknown }

function orderIdFor(transactionId: string) {
  return `gp_${transactionId.replaceAll('-', '')}`
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, headers)
  if (!isAllowedOrigin(origin)) return jsonResponse({ error: 'Origin is not allowed.' }, 403, headers)

  const clientId = Deno.env.get('CASHFREE_PG_CLIENT_ID')
  const clientSecret = Deno.env.get('CASHFREE_PG_CLIENT_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!clientId || !clientSecret || !supabaseUrl) {
    return jsonResponse({ error: 'Payment service is not configured.' }, 503, headers)
  }

  let body: CreatePaymentBody
  try {
    body = await request.json() as CreatePaymentBody
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400, headers)
  }

  const aliasHandle = typeof body.alias_handle === 'string'
    ? body.alias_handle.trim().replace(/^@+/, '').toLowerCase()
    : ''
  const amount = typeof body.amount_inr === 'number' ? body.amount_inr : Number(body.amount_inr)
  const maxAmount = Number(Deno.env.get('MAX_PAYMENT_INR') ?? '100000')
  if (!/^[a-z0-9_][a-z0-9_.]{2,29}$/.test(aliasHandle)) {
    return jsonResponse({ error: 'Enter a valid public alias.' }, 400, headers)
  }
  if (!Number.isFinite(amount) || amount < 1 || amount > maxAmount || Math.round(amount * 100) !== amount * 100) {
    return jsonResponse({ error: `Amount must be between ₹1 and ₹${maxAmount}, with up to two decimals.` }, 400, headers)
  }

  let admin
  try {
    admin = createClient(supabaseUrl, serviceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  } catch (error) {
    console.error('Supabase service configuration error', error)
    return jsonResponse({ error: 'Payment service is not configured.' }, 503, headers)
  }

  const { data: receiver, error: receiverError } = await admin
    .from('users')
    .select('id, kyc_verified')
    .eq('alias_handle', aliasHandle)
    .maybeSingle()
  if (receiverError) {
    console.error('Receiver lookup failed', receiverError.message)
    return jsonResponse({ error: 'Could not load this payment link.' }, 500, headers)
  }
  if (!receiver) return jsonResponse({ error: 'This payment link was not found.' }, 404, headers)
  if (!receiver.kyc_verified) {
    return jsonResponse({ error: 'This creator has not completed account verification yet.' }, 409, headers)
  }

  const { data: transaction, error: transactionError } = await admin
    .from('transactions')
    .insert({ receiver_id: receiver.id, sender_id: null, amount_inr: amount, status: 'pending_collection' })
    .select('id, amount_inr')
    .single()
  if (transactionError || !transaction) {
    console.error('Transaction creation failed', transactionError?.message)
    return jsonResponse({ error: 'Could not start this payment. Please try again.' }, 500, headers)
  }

  const orderId = orderIdFor(transaction.id)
  const appUrl = (Deno.env.get('PUBLIC_APP_URL') ?? '').split(',')[0].trim().replace(/\/$/, '')
  const paymentWebhookUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/payment-success`
  const customerId = `guest_${transaction.id.replaceAll('-', '').slice(0, 24)}`
  const cashfreeResponse = await fetch(`${paymentGatewayBaseUrl()}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-version': Deno.env.get('CASHFREE_PG_API_VERSION') ?? '2026-01-01',
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      order_id: orderId,
      order_amount: Number(transaction.amount_inr),
      order_currency: 'INR',
      customer_details: {
        customer_id: customerId,
        // Cashfree's minimum order fields include a phone. GhostPay does not collect
        // guest phone numbers, so this is a documented-format placeholder only.
        customer_phone: '9999999999',
      },
      order_meta: {
        return_url: `${appUrl}/payment/return?order_id={order_id}`,
        notify_url: paymentWebhookUrl,
        payment_methods: 'upi',
      },
      order_note: 'GhostPay creator payment',
    }),
  })
  const gatewayData = await cashfreeResponse.json().catch(() => null) as Record<string, unknown> | null
  const paymentSessionId = gatewayData?.payment_session_id
  if (!cashfreeResponse.ok || typeof paymentSessionId !== 'string') {
    console.error('Cashfree order creation failed', { status: cashfreeResponse.status, code: gatewayData?.code })
    await admin.from('transactions').update({ status: 'failed' }).eq('id', transaction.id).eq('status', 'pending_collection')
    return jsonResponse({ error: 'Cashfree could not start checkout. Please try again.' }, 502, headers)
  }

  return jsonResponse({
    transaction_id: transaction.id,
    order_id: orderId,
    payment_session_id: paymentSessionId,
    environment: Deno.env.get('CASHFREE_ENV')?.toLowerCase() === 'production' ? 'production' : 'sandbox',
  }, 200, headers)
})
