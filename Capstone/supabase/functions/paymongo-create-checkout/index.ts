import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

type CheckoutPreparation = {
  amount: number
  amountCentavos: number
  attemptId: string
  checkoutReference: string
  checkoutUrl?: string
  currency: 'PHP'
  eventName?: string
  status: 'created' | 'creating_checkout' | 'checkout_created'
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  status,
})

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const messageFrom = (value: unknown, fallback: string) =>
  value && typeof value === 'object' && typeof (value as { message?: unknown }).message === 'string'
    ? (value as { message: string }).message
    : fallback

const parseMethods = () => {
  const configured = Deno.env.get('PAYMONGO_PAYMENT_METHOD_TYPES')
  if (!configured) return ['qrph']
  try {
    const parsed = JSON.parse(configured)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((item) => typeof item === 'string')) {
      return parsed
    }
  } catch {
    // The safe QR Ph default is supported by PayMongo's hosted-checkout quick start.
  }
  return ['qrph']
}

const configuredReturnUrl = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  // The public mobile domain is a harmless UX return fallback. A redirect is
  // never treated as payment proof; the signed webhook remains authoritative.
  return value && /^https:\/\//i.test(value) ? value : 'https://mobile.multivent.org'
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
    return json({ error: 'PayMongo checkout is not configured.' }, 503)
  }
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Authentication is required.' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Invalid session.' }, 401)

  let body: { eventId?: unknown; paymentType?: unknown; termsAccepted?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'A JSON request body is required.' }, 400)
  }
  if (typeof body.eventId !== 'string' || !uuidPattern.test(body.eventId)) {
    return json({ error: 'A valid eventId is required.' }, 400)
  }
  if (body.paymentType !== 'deposit' && body.paymentType !== 'full') {
    return json({ error: 'A valid payment type is required.' }, 400)
  }
  if (body.termsAccepted !== true) return json({ error: 'Accept the booking and cancellation terms first.' }, 400)

  const { data: preparedData, error: preparedError } = await userClient.rpc('prepare_my_paymongo_checkout_v16', {
    selected_payment_type: body.paymentType,
    target_environment: environment,
    target_event_id: body.eventId,
    terms_accepted: true,
  })
  if (preparedError) return json({ error: preparedError.message }, 409)
  const prepared = preparedData as CheckoutPreparation | null
  if (!prepared?.attemptId || !prepared.checkoutReference) {
    return json({ error: 'The server returned an invalid payment attempt.' }, 500)
  }
  if (prepared.status === 'checkout_created' && prepared.checkoutUrl) {
    return json({ attemptId: prepared.attemptId, checkoutUrl: prepared.checkoutUrl, reused: true })
  }
  if (prepared.status === 'creating_checkout') {
    return json({ error: 'Your checkout is being prepared. Please try again shortly.' }, 409)
  }
  if (!Number.isInteger(prepared.amountCentavos) || prepared.amountCentavos <= 0) {
    return json({ error: 'The server returned an invalid payment attempt.' }, 500)
  }

  const { data: claimed, error: claimError } = await userClient.rpc('claim_my_paymongo_checkout_v16', {
    target_attempt_id: prepared.attemptId,
  })
  if (claimError) return json({ error: claimError.message }, 409)
  if (claimed !== true) return json({ error: 'Your checkout is already being prepared. Please try again shortly.' }, 409)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  try {
    const paymongoResponse = await fetch('https://api.paymongo.com/v2/checkout_sessions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${paymongoSecret}:`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            cancel_url: configuredReturnUrl('PAYMONGO_CANCEL_URL'),
            description: `MULTIVENT reservation for ${prepared.eventName ?? 'your event'}`,
            line_items: [{
              amount: prepared.amountCentavos,
              currency: prepared.currency,
              name: `MULTIVENT ${body.paymentType === 'full' ? 'full payment' : 'downpayment'}`,
              quantity: 1,
            }],
            metadata: {
              multivent_attempt_id: prepared.attemptId,
              multivent_checkout_reference: prepared.checkoutReference,
              multivent_event_id: body.eventId,
            },
            payment_method_types: parseMethods(),
            reference_number: prepared.checkoutReference,
            success_url: configuredReturnUrl('PAYMONGO_SUCCESS_URL'),
          },
        },
      }),
    })
    const payload = await paymongoResponse.json().catch(() => null) as Record<string, unknown> | null
    const resource = payload?.data as { id?: unknown; attributes?: { checkout_url?: unknown } } | undefined
    const checkoutSessionId = typeof resource?.id === 'string' ? resource.id : ''
    const checkoutUrl = typeof resource?.attributes?.checkout_url === 'string' ? resource.attributes.checkout_url : ''
    if (!paymongoResponse.ok || !checkoutSessionId || !/^https:\/\/checkout\.paymongo\.com\//i.test(checkoutUrl)) {
      const errors = Array.isArray(payload?.errors) ? payload.errors : []
      const message = messageFrom(errors[0], 'PayMongo could not create a checkout session.')
      await admin.rpc('fail_paymongo_checkout_attempt_v16', {
        failure_message: message,
        target_attempt_id: prepared.attemptId,
      })
      return json({ error: message }, 502)
    }

    const { data: recorded, error: recordError } = await admin.rpc('record_paymongo_checkout_session_v16', {
      external_checkout_session_id: checkoutSessionId,
      external_checkout_url: checkoutUrl,
      target_attempt_id: prepared.attemptId,
    })
    if (recordError || !recorded || typeof (recorded as { checkoutUrl?: unknown }).checkoutUrl !== 'string') {
      return json({ error: recordError?.message ?? 'Checkout session was created but could not be recorded safely.' }, 500)
    }
    return json({ attemptId: prepared.attemptId, checkoutUrl: (recorded as { checkoutUrl: string }).checkoutUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create a PayMongo checkout session.'
    await admin.rpc('fail_paymongo_checkout_attempt_v16', {
      failure_message: message,
      target_attempt_id: prepared.attemptId,
    })
    return json({ error: 'Unable to create a PayMongo checkout session.' }, 502)
  }
})
