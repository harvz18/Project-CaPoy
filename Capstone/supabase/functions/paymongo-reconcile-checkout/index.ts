import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  status,
})

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const getString = (value: unknown) => typeof value === 'string' ? value : ''
const getRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown>
  : {}

type Attempt = {
  amount_centavos: number
  client_id: string
  currency: string
  environment: 'test' | 'live'
  id: string
  paymongo_checkout_session_id: string | null
  status: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const paymongoSecret = Deno.env.get('PAYMONGO_SECRET_KEY') ?? ''
  const environment = Deno.env.get('PAYMONGO_ENVIRONMENT') === 'live' ? 'live' : 'test'
  const authorization = request.headers.get('Authorization') ?? ''
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !paymongoSecret) {
    return json({ error: 'PayMongo reconciliation is not configured.' }, 503)
  }
  if ((environment === 'test' && !paymongoSecret.startsWith('sk_test_'))
    || (environment === 'live' && !paymongoSecret.startsWith('sk_live_'))) {
    return json({ error: 'PayMongo environment and secret key do not match.' }, 503)
  }
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Authentication is required.' }, 401)

  let body: { eventId?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'A JSON request body is required.' }, 400)
  }
  if (typeof body.eventId !== 'string' || !uuidPattern.test(body.eventId)) {
    return json({ error: 'A valid eventId is required.' }, 400)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Invalid session.' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: attemptData, error: attemptError } = await admin
    .from('paymongo_payment_attempts')
    .select('id,client_id,environment,status,amount_centavos,currency,paymongo_checkout_session_id')
    .eq('event_id', body.eventId)
    .eq('client_id', authData.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (attemptError || !attemptData) return json({ error: 'No PayMongo checkout was found for this event.' }, 404)
  const attempt = attemptData as Attempt
  if (attempt.environment !== environment || !attempt.paymongo_checkout_session_id) {
    return json({ error: 'The checkout configuration no longer matches this payment attempt.' }, 409)
  }
  if (attempt.status === 'verified') return json({ verified: true, reconciled: false })
  if (attempt.status !== 'checkout_created') return json({ error: 'This checkout is not awaiting payment.' }, 409)

  const checkoutId = encodeURIComponent(attempt.paymongo_checkout_session_id)
  const paymongoHeaders = { Authorization: `Basic ${btoa(`${paymongoSecret}:`)}` }
  let paymongoResponse = await fetch(`https://api.paymongo.com/v2/checkout_sessions/${checkoutId}`, {
    headers: paymongoHeaders,
  })
  // Checkout creation uses V2, while some established merchant accounts
  // expose retrieval through the compatible V1 resource path.
  if (paymongoResponse.status === 404) {
    paymongoResponse = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${checkoutId}`, {
      headers: paymongoHeaders,
    })
  }
  const payload = await paymongoResponse.json().catch(() => null) as Record<string, unknown> | null
  if (!paymongoResponse.ok) {
    return json({ error: `Unable to verify the checkout with PayMongo (HTTP ${paymongoResponse.status}).` }, 502)
  }
  const checkout = getRecord(payload?.data)
  if (getString(checkout.id) !== attempt.paymongo_checkout_session_id) {
    return json({ error: 'PayMongo returned an unexpected checkout.' }, 502)
  }
  const attributes = getRecord(checkout.attributes)
  const payments = Array.isArray(attributes.payments) ? attributes.payments : []
  const paidPayment = payments.map(getRecord).find((payment) => {
    const paymentAttributes = getRecord(payment.attributes)
    return paymentAttributes.status === 'paid'
  })
  if (!paidPayment) return json({ verified: false, reconciled: false, status: 'pending' })
  const paymentAttributes = getRecord(paidPayment.attributes)
  const paymentId = getString(paidPayment.id)
  const amount = paymentAttributes.amount
  const currency = getString(paymentAttributes.currency)
  if (!paymentId || typeof amount !== 'number' || !currency) {
    return json({ error: 'PayMongo returned an incomplete paid payment.' }, 502)
  }

  const { data: reconciled, error: reconciliationError } = await admin.rpc('reconcile_paymongo_checkout_v16', {
    external_payment_id: paymentId,
    paid_amount_centavos: Math.trunc(amount),
    paid_currency: currency,
    reconciliation_payload: payload,
    target_attempt_id: attempt.id,
  })
  if (reconciliationError) return json({ error: 'Unable to record the verified PayMongo payment.' }, 500)
  return json({ verified: true, reconciled: reconciled })
})
