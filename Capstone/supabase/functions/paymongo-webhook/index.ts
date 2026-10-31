import { createClient } from 'npm:@supabase/supabase-js@2'

const encoder = new TextEncoder()

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  headers: { 'Content-Type': 'application/json' },
  status,
})

const toHex = (value: ArrayBuffer) => Array.from(new Uint8Array(value))
  .map((byte) => byte.toString(16).padStart(2, '0')).join('')

const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return result === 0
}

const signatureParts = (header: string) => Object.fromEntries(header.split(',').map((part) => {
  const separator = part.indexOf('=')
  return separator < 1 ? [part.trim(), ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
}))

const getString = (value: unknown) => typeof value === 'string' ? value : ''
const getRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown>
  : {}

const paymentFromCheckout = (attributes: Record<string, unknown>) => {
  const payments = Array.isArray(attributes.payments) ? attributes.payments : []
  const firstPayment = getRecord(payments[0])
  const paymentAttributes = getRecord(firstPayment.attributes)
  const intent = getRecord(attributes.payment_intent)
  const intentAttributes = getRecord(intent.attributes)
  return {
    amount: typeof paymentAttributes.amount === 'number' ? paymentAttributes.amount
      : typeof intentAttributes.amount === 'number' ? intentAttributes.amount : 0,
    id: getString(firstPayment.id) || getString(intent.id),
    currency: getString(paymentAttributes.currency) || getString(intentAttributes.currency),
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const secret = Deno.env.get('PAYMONGO_WEBHOOK_SECRET') ?? ''
  const environment = Deno.env.get('PAYMONGO_ENVIRONMENT') === 'live' ? 'live' : 'test'
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!secret || !supabaseUrl || !serviceRoleKey) return json({ error: 'Webhook is not configured.' }, 503)

  const rawBody = await request.text()
  const parts = signatureParts(request.headers.get('Paymongo-Signature') ?? '')
  const timestamp = Number(parts.t)
  const signature = environment === 'live' ? parts.li : parts.te
  if (!Number.isSafeInteger(timestamp) || !signature || Math.abs(Date.now() / 1000 - timestamp) > 300) {
    return json({ error: 'Invalid or expired webhook signature.' }, 401)
  }
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expectedSignature = toHex(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(`${timestamp}.${rawBody}`)))
  if (!constantTimeEqual(expectedSignature, signature)) return json({ error: 'Invalid webhook signature.' }, 401)

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return json({ error: 'Webhook payload is not valid JSON.' }, 400)
  }
  const event = getRecord(payload.data)
  // V2 Checkout webhooks place the event type/livemode directly on
  // `data`, with the Checkout Session under `data.data`.  Retain the
  // attributes fallback so an older queued payload cannot be rejected.
  const legacyAttributes = getRecord(event.attributes)
  const checkout = getRecord(event.data)
  const legacyCheckout = getRecord(legacyAttributes.data)
  const checkoutPayload = Object.keys(checkout).length > 0 ? checkout : legacyCheckout
  const checkoutAttributes = getRecord(checkoutPayload.attributes)
  const payment = paymentFromCheckout(checkoutAttributes)
  const checkoutSessionId = getString(checkoutPayload.id)
  // A Checkout Session permits only one successful payment.  Its ID is a
  // safe idempotency key when a webhook delivery does not expose a separate
  // event ID (the current V2 payload shape).
  const externalEventId = getString(event.id) || `checkout_session.payment.paid:${checkoutSessionId}`
  const eventType = getString(event.type) || getString(legacyAttributes.type)
  const livemode = event.livemode === true || legacyAttributes.livemode === true
  if (!externalEventId || !checkoutSessionId) return json({ error: 'Webhook event is missing checkout identifiers.' }, 400)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await admin.rpc('process_paymongo_checkout_webhook_v16', {
    event_type_value: eventType,
    external_checkout_session_id: checkoutSessionId,
    external_event_id_value: externalEventId,
    external_payment_id: payment.id,
    is_livemode: livemode,
    paid_amount_centavos: Math.trunc(payment.amount),
    paid_currency: payment.currency,
    webhook_payload: payload,
  })
  if (error) {
    console.error('PayMongo webhook processing failed:', error.message)
    // PayMongo retries non-2xx responses. The database stores a unique event id
    // so retry delivery cannot produce duplicate receivables or verification.
    return json({ error: 'Webhook processing failed.' }, 500)
  }
  return json({ received: true, result: data })
})
