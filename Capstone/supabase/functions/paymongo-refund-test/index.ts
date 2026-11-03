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
const getString = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const getRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown>
  : {}

type RefundPreparation = {
  amountCentavos: number
  attemptId: string
  currency: 'PHP'
  paymentId: string
  status: 'created' | 'processing' | 'succeeded' | 'failed'
  refundId?: string
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

  // This endpoint is deliberately unavailable in production. A future live
  // refund flow must be separately designed, reviewed, and enabled.
  if (environment !== 'test') {
    return json({ error: 'PayMongo test refunds are disabled outside test mode.' }, 403)
  }
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !paymongoSecret) {
    return json({ error: 'PayMongo test refunds are not configured.' }, 503)
  }
  if (!paymongoSecret.startsWith('sk_test_')) {
    return json({ error: 'PayMongo test refunds require a sk_test_ secret key.' }, 503)
  }
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Authentication is required.' }, 401)

  let body: { refundId?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'A JSON request body is required.' }, 400)
  }
  if (typeof body.refundId !== 'string' || !uuidPattern.test(body.refundId)) {
    return json({ error: 'A valid refundId is required.' }, 400)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Invalid session.' }, 401)

  const { data: preparedData, error: preparedError } = await userClient.rpc('prepare_v16_paymongo_test_refund', {
    target_refund_id: body.refundId,
  })
  if (preparedError) return json({ error: preparedError.message }, 409)
  const prepared = preparedData as RefundPreparation | null
  if (!prepared?.attemptId || !prepared.paymentId || !Number.isInteger(prepared.amountCentavos) || prepared.amountCentavos <= 0) {
    return json({ error: 'The server returned an invalid test refund attempt.' }, 500)
  }
  if (prepared.status === 'succeeded') {
    return json({ refundId: prepared.refundId, status: 'succeeded', reused: true })
  }
  if (prepared.status === 'processing') {
    return json({ refundId: prepared.refundId, status: 'processing', reused: true })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  try {
    const response = await fetch('https://api.paymongo.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${paymongoSecret}:`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: prepared.amountCentavos,
            notes: `MULTIVENT demo refund ${prepared.attemptId}`,
            payment_id: prepared.paymentId,
            reason: 'requested_by_customer',
          },
        },
      }),
    })
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    const refund = getRecord(payload?.data)
    const attributes = getRecord(refund.attributes)
    const refundId = getString(refund.id)
    const processorStatus = getString(attributes.status).toLowerCase()
    const normalizedStatus = processorStatus === 'succeeded'
      ? 'succeeded'
      : processorStatus === 'failed'
        ? 'failed'
        : 'processing'

    if (!response.ok || !refundId) {
      const firstError = Array.isArray(payload?.errors) ? getRecord(payload?.errors?.[0]) : {}
      const message = getString(firstError.detail) || getString(firstError.code) || `PayMongo rejected the test refund (HTTP ${response.status}).`
      await admin.rpc('record_v16_paymongo_test_refund_result', {
        processor_failure_reason: message,
        processor_refund_id: null,
        processor_status: 'failed',
        target_attempt_id: prepared.attemptId,
      })
      return json({ error: message }, 502)
    }

    const { error: recordError } = await admin.rpc('record_v16_paymongo_test_refund_result', {
      processor_failure_reason: null,
      processor_refund_id: refundId,
      processor_status: normalizedStatus,
      target_attempt_id: prepared.attemptId,
    })
    if (recordError) return json({ error: 'PayMongo accepted the test refund, but MULTIVENT could not record it safely.' }, 500)
    return json({ refundId, status: normalizedStatus })
  } catch {
    await admin.rpc('record_v16_paymongo_test_refund_result', {
      processor_failure_reason: 'Unable to contact PayMongo for the test refund.',
      processor_refund_id: null,
      processor_status: 'failed',
      target_attempt_id: prepared.attemptId,
    })
    return json({ error: 'Unable to contact PayMongo for the test refund.' }, 502)
  }
})
