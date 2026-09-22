import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

type Sentiment = 'negative' | 'positive'
type JsonObject = Record<string, unknown>

type ReviewRow = {
  analyzed_at: string
  comment: string
  sentiment_label: Sentiment
}

type CachedSummary = {
  provider: string
  sentiment_label: Sentiment
  source_latest_analyzed_at: string
  source_review_count: number
  summary: string
}

const jsonResponse = (body: JsonObject, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown summary failure.'

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const parseModelSummary = (value: unknown) => {
  if (!value || typeof value !== 'object') throw new Error('The summary API returned invalid JSON.')
  const result = value as Record<string, unknown>
  if (
    typeof result.summary !== 'string' ||
    result.summary.trim().length < 10 ||
    result.summary.trim().length > 600 ||
    typeof result.provider !== 'string'
  ) {
    throw new Error('The summary API response does not match the expected schema.')
  }
  return { provider: result.provider, summary: result.summary.trim() }
}

const commentBatches = (comments: string[]) => {
  const batches: string[][] = []
  let batch: string[] = []
  let characters = 0

  comments.forEach((comment) => {
    if (batch.length && (batch.length >= 200 || characters + comment.length > 60_000)) {
      batches.push(batch)
      batch = []
      characters = 0
    }
    batch.push(comment)
    characters += comment.length
  })
  if (batch.length) batches.push(batch)
  return batches
}

const requestSummary = async (
  apiUrl: string,
  apiKey: string,
  body: JsonObject
) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
  if (apiKey) headers['X-Analysis-Key'] = apiKey

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)
  try {
    const response = await fetch(`${apiUrl}/summarize`, {
      body: JSON.stringify(body),
      headers,
      method: 'POST',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Summary API request failed with status ${response.status}.`)
    return parseModelSummary(await response.json())
  } finally {
    clearTimeout(timeout)
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const sentimentApiUrl = (Deno.env.get('SENTIMENT_API_URL') ?? '').replace(/\/$/, '')
  const sentimentApiKey = Deno.env.get('SENTIMENT_API_KEY') ?? ''
  const authorization = request.headers.get('Authorization') ?? ''

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !sentimentApiUrl) {
    return jsonResponse({ error: 'The feedback summary function is not configured.' }, 503)
  }
  if (!authorization.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentication is required.' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return jsonResponse({ error: 'Invalid session.' }, 401)

  let body: { serviceId?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'A JSON request body is required.' }, 400)
  }
  if (!isUuid(body.serviceId)) return jsonResponse({ error: 'A valid serviceId is required.' }, 400)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: service, error: serviceError } = await admin
    .from('services')
    .select('id, name, category_id')
    .eq('id', body.serviceId)
    .maybeSingle()
  if (serviceError) return jsonResponse({ error: 'Unable to load the service.' }, 500)
  if (!service) return jsonResponse({ error: 'Service was not found.' }, 404)

  let serviceCategory = 'Event service'
  if (service.category_id) {
    const { data: category } = await admin
      .from('service_categories')
      .select('name')
      .eq('id', service.category_id)
      .maybeSingle()
    if (category?.name) serviceCategory = category.name
  }

  const [{ data: reviewData, error: reviewError }, { data: cacheData, error: cacheError }] =
    await Promise.all([
      admin
        .from('reviews')
        .select('comment, sentiment_label, analyzed_at')
        .eq('service_id', body.serviceId)
        .eq('analysis_status', 'processed')
        .not('comment', 'is', null)
        .order('analyzed_at', { ascending: true }),
      admin
        .from('service_review_summaries')
        .select('sentiment_label, summary, source_review_count, source_latest_analyzed_at, provider')
        .eq('service_id', body.serviceId),
    ])

  if (reviewError) return jsonResponse({ error: 'Unable to load service feedback.' }, 500)
  if (cacheError) return jsonResponse({ error: 'Unable to load cached feedback summaries.' }, 500)

  const reviews = (reviewData ?? []).filter((row): row is ReviewRow =>
    typeof row.comment === 'string' &&
    row.comment.trim().length > 0 &&
    (row.sentiment_label === 'positive' || row.sentiment_label === 'negative') &&
    typeof row.analyzed_at === 'string'
  )
  const cache = new Map(
    (cacheData ?? []).map((row) => [row.sentiment_label, row as CachedSummary])
  )
  const summaries: Record<Sentiment, string | null> = { negative: null, positive: null }
  const stale: Sentiment[] = []

  for (const sentiment of ['positive', 'negative'] as const) {
    const group = reviews.filter((review) => review.sentiment_label === sentiment)
    if (!group.length) continue

    const latestAnalyzedAt = group[group.length - 1].analyzed_at
    const cached = cache.get(sentiment)
    if (
      cached &&
      cached.source_review_count === group.length &&
      cached.source_latest_analyzed_at === latestAnalyzedAt
    ) {
      summaries[sentiment] = cached.summary
      continue
    }

    const canIncrement = Boolean(
      cached &&
      group.length > cached.source_review_count &&
      Date.parse(latestAnalyzedAt) > Date.parse(cached.source_latest_analyzed_at)
    )
    const comments = canIncrement
      ? group
          .filter((review) => Date.parse(review.analyzed_at) > Date.parse(cached!.source_latest_analyzed_at))
          .map((review) => review.comment.trim())
      : group.map((review) => review.comment.trim())

    let previousSummary = canIncrement ? cached?.summary : undefined
    let previousCount = canIncrement ? cached?.source_review_count ?? 0 : 0
    let provider = cached?.provider ?? 'openai'

    try {
      for (const batch of commentBatches(comments)) {
        const generated = await requestSummary(sentimentApiUrl, sentimentApiKey, {
          comments: batch,
          previous_feedback_count: previousCount,
          ...(previousSummary ? { previous_summary: previousSummary } : {}),
          sentiment,
          service_category: serviceCategory,
          service_name: service.name,
        })
        previousSummary = generated.summary
        previousCount += batch.length
        provider = generated.provider
      }

      if (!previousSummary) throw new Error('No summary was generated.')
      const now = new Date().toISOString()
      const { error: upsertError } = await admin.from('service_review_summaries').upsert(
        {
          generated_at: now,
          provider,
          sentiment_label: sentiment,
          service_id: body.serviceId,
          source_latest_analyzed_at: latestAnalyzedAt,
          source_review_count: group.length,
          summary: previousSummary,
          updated_at: now,
        },
        { onConflict: 'service_id,sentiment_label' }
      )
      if (upsertError) throw new Error('Unable to cache the generated feedback summary.')
      summaries[sentiment] = previousSummary
    } catch (error) {
      console.error(`Unable to refresh ${sentiment} summary:`, getErrorMessage(error))
      if (cached) {
        summaries[sentiment] = cached.summary
        stale.push(sentiment)
      }
    }
  }

  return jsonResponse({ stale, summaries })
})
