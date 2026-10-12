import { createClient } from 'npm:@supabase/supabase-js@2'
import { jsonResponse, payoutBaseUrl, serviceRoleKey } from '../_shared/http.ts'

type CashfreePaymentWebhook = {
  type?: string
  data?: {
    order?: { order_id?: string; order_amount?: number; order_currency?: string }
    payment?: { payment_status?: string; payment_amount?: number; payment_currency?: string; cf_payment_id?: string }
  }
}

function transactionIdFor(orderId: string): string | null {
  const match = /^gp_([a-f0-9]{32})$/.exec(orderId)
  if (!match) return null
  const compact = match[1]
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`
}

async function verifyCashfreeSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!timestamp || !signature || !/^\d{10,16}$/.test(timestamp)) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  let signatureBytes: Uint8Array
  try {
    signatureBytes = Uint8Array.from(atob(signature), (character) => character.charCodeAt(0))
  } catch {
    return false
  }
  const signedPayload = new TextEncoder().encode(timestamp + rawBody)
  return await crypto.subtle.verify('HMAC', key, signatureBytes, signedPayload)
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)
  const signatureSecret = Deno.env.get('CASHFREE_PG_CLIENT_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const payoutClientId = Deno.env.get('CASHFREE_PAYOUT_CLIENT_ID')
  const payoutClientSecret = Deno.env.get('CASHFREE_PAYOUT_CLIENT_SECRET')
  if (!signatureSecret || !supabaseUrl || !payoutClientId || !payoutClientSecret) {
    console.error('Payment webhook secrets are incomplete.')
    return jsonResponse({ error: 'Webhook is not configured.' }, 503)
  }

  const rawBody = await request.text()
  const signatureValid = await verifyCashfreeSignature(
    rawBody,
    request.headers.get('x-webhook-timestamp'),
    request.headers.get('x-webhook-signature'),
    signatureSecret,
  )
  if (!signatureValid) return jsonResponse({ error: 'Invalid webhook signature.' }, 401)

  let event: CashfreePaymentWebhook
  try {
    event = JSON.parse(rawBody) as CashfreePaymentWebhook
  } catch {
    return jsonResponse({ error: 'Invalid webhook JSON.' }, 400)
  }

  const paymentStatus = event.data?.payment?.payment_status
  const orderId = event.data?.order?.order_id
  if (!orderId) return jsonResponse({ error: 'Webhook is missing an order ID.' }, 400)
  if (event.type !== 'PAYMENT_SUCCESS_WEBHOOK' || paymentStatus !== 'SUCCESS') {
    // Treat non-success notices as acknowledgements. A late failure notice must not
    // overwrite an order whose payment or payout has already progressed.
    return jsonResponse({ received: true, ignored: true })
  }

  const transactionId = transactionIdFor(orderId)
  if (!transactionId) return jsonResponse({ error: 'Order ID is not a GhostPay transaction.' }, 400)
  let admin
  try {
    admin = createClient(supabaseUrl, serviceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  } catch (error) {
    console.error('Supabase service configuration error', error)
    return jsonResponse({ error: 'Webhook is not configured.' }, 503)
  }

  const { data: transaction, error: transactionError } = await admin
    .from('transactions')
    .select('id, receiver_id, amount_inr, status')
    .eq('id', transactionId)
    .maybeSingle()
  if (transactionError) {
    console.error('Transaction lookup failed', transactionError.message)
    return jsonResponse({ error: 'Could not load transaction.' }, 500)
  }
  if (!transaction) return jsonResponse({ error: 'Transaction not found.' }, 404)
  if (transaction.status === 'payout_successful') return jsonResponse({ received: true, duplicate: true })
  if (transaction.status === 'failed') return jsonResponse({ received: true, ignored: true })

  const paidAmount = Number(event.data?.payment?.payment_amount)
  const currency = event.data?.payment?.payment_currency ?? event.data?.order?.order_currency
  const orderAmount = Number(event.data?.order?.order_amount)
  if (currency !== 'INR' || paidAmount !== Number(transaction.amount_inr) || orderAmount !== Number(transaction.amount_inr)) {
    console.error('Amount or currency mismatch; refusing payout.', { transactionId })
    await admin.from('transactions').update({ status: 'failed' }).eq('id', transaction.id).eq('status', 'pending_collection')
    return jsonResponse({ error: 'Payment amount or currency did not match the order.' }, 409)
  }

  const payoutTransferId = `gp_${transaction.id.replaceAll('-', '')}`
  const wasAlreadyEscrowed = transaction.status === 'escrowed'
  if (wasAlreadyEscrowed) {
    // A retried payment webhook first checks the deterministic Cashfree transfer ID.
    // This prevents submitting a second payout after an ambiguous network timeout.
    const statusUrl = new URL(`${payoutBaseUrl()}/transfers`)
    statusUrl.searchParams.set('transfer_id', payoutTransferId)
    const statusResponse = await fetch(statusUrl, {
      headers: {
        'x-api-version': Deno.env.get('CASHFREE_PAYOUT_API_VERSION') ?? '2024-01-01',
        'x-client-id': payoutClientId,
        'x-client-secret': payoutClientSecret,
      },
    })
    if (statusResponse.ok) {
      const statusData = await statusResponse.json().catch(() => null) as Record<string, unknown> | null
      const status = String(statusData?.status ?? statusData?.transfer_status ?? '').toUpperCase()
      if (status === 'SUCCESS' || status === 'FAILED') {
        const finalStatus = status === 'SUCCESS' ? 'payout_successful' : 'failed'
        const { error: updateError } = await admin.from('transactions').update({ status: finalStatus }).eq('id', transaction.id).eq('status', 'escrowed')
        if (updateError) return jsonResponse({ error: 'Could not record payout status.' }, 500)
        return jsonResponse({ received: true, payout_status: status, payout_transfer_id: payoutTransferId })
      }
      if (status) return jsonResponse({ error: 'Payout is still processing; Cashfree should retry this webhook.' }, 503)
      return jsonResponse({ error: 'Payout status is being reconciled.' }, 503)
    } else if (statusResponse.status !== 404) {
      console.error('Cashfree payout status lookup failed', statusResponse.status)
      return jsonResponse({ error: 'Payout status is being reconciled.' }, 503)
    }
  }

  if (transaction.status === 'pending_collection') {
    const { data: escrowed, error: escrowError } = await admin
      .from('transactions')
      .update({ status: 'escrowed' })
      .eq('id', transaction.id)
      .eq('status', 'pending_collection')
      .select('id')
      .maybeSingle()
    if (escrowError) {
      console.error('Could not record collected payment', escrowError.message)
      return jsonResponse({ error: 'Could not record collected payment.' }, 500)
    }
    if (!escrowed) {
      // Another delivery may have advanced it. Re-read before deciding whether the
      // deterministic payout ID is safe to retry.
      const { data: latest, error: latestError } = await admin.from('transactions').select('status').eq('id', transaction.id).single()
      if (latestError || latest?.status !== 'escrowed') return jsonResponse({ received: true, duplicate: true })
    }
  }

  const { data: receiver, error: receiverError } = await admin
    .from('users')
    .select('real_upi_id, real_legal_name, kyc_verified')
    .eq('id', transaction.receiver_id)
    .maybeSingle()
  if (receiverError || !receiver) {
    console.error('Payout destination lookup failed', receiverError?.message)
    return jsonResponse({ error: 'Could not load payout destination.' }, 500)
  }
  if (!receiver.kyc_verified || !receiver.real_upi_id || !receiver.real_legal_name) {
    console.error('Receiver is not eligible for payout.', { transactionId })
    return jsonResponse({ error: 'Receiver is not verified for payout.' }, 409)
  }

  const payoutResponse = await fetch(`${payoutBaseUrl()}/transfers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-version': Deno.env.get('CASHFREE_PAYOUT_API_VERSION') ?? '2024-01-01',
      'x-client-id': payoutClientId,
      'x-client-secret': payoutClientSecret,
    },
    body: JSON.stringify({
      transfer_id: payoutTransferId,
      transfer_amount: Number(transaction.amount_inr),
      transfer_currency: 'INR',
      transfer_mode: 'upi',
      transfer_remarks: 'GhostPay creator payout',
      beneficiary_details: {
        beneficiary_name: receiver.real_legal_name,
        beneficiary_instrument_details: { vpa: receiver.real_upi_id },
      },
    }),
  })
  const payoutData = await payoutResponse.json().catch(() => null) as Record<string, unknown> | null
  if (!payoutResponse.ok) {
    console.error('Cashfree payout initiation failed', { status: payoutResponse.status, code: payoutData?.code })
    // Leave the transaction escrowed so an identical webhook can retry using the
    // same transfer_id. Do not tell the receiver the payout failed on a timeout.
    return jsonResponse({ error: 'Payment was collected; payout is awaiting retry.' }, 503)
  }

  const payoutStatus = String(payoutData?.status ?? payoutData?.transfer_status ?? '').toUpperCase()
  if (payoutStatus === 'SUCCESS') {
    const { error: updateError } = await admin
      .from('transactions')
      .update({ status: 'payout_successful' })
      .eq('id', transaction.id)
      .eq('status', 'escrowed')
    if (updateError) {
      console.error('Could not record successful payout', updateError.message)
      return jsonResponse({ error: 'Payout succeeded but status update needs reconciliation.' }, 500)
    }
  } else if (payoutStatus === 'FAILED') {
    const { error: updateError } = await admin
      .from('transactions')
      .update({ status: 'failed' })
      .eq('id', transaction.id)
      .eq('status', 'escrowed')
    if (updateError) {
      console.error('Could not record failed payout', updateError.message)
      return jsonResponse({ error: 'Could not record payout result.' }, 500)
    }
  }

  // Cashfree may acknowledge the transfer before its final settlement status. Keep
  // it escrowed until Cashfree confirms SUCCESS via its transfer status/webhook.
  return jsonResponse({ error: 'Payout is still processing; Cashfree should retry this webhook.' }, 503)
})
