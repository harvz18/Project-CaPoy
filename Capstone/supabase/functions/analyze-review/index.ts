import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

type JsonObject = Record<string, unknown>

type AnalysisResponse = {
  confidence: number
  language: string
  provider: string
  reason: string
  scores: { negative: number; positive: number }
  sentiment: 'negative' | 'positive'
  topic: {
    id: number | null
    in_vocabulary: boolean
    keywords: string[]
    name: string
    probability: number
  }
  rag: {
    retrieved_examples: Array<{ id: string; source_dataset: string }>
  }
}

const jsonResponse = (body: JsonObject, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

const isFiniteShare = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1

const parseAnalysis = (value: unknown): AnalysisResponse => {
  if (!value || typeof value !== 'object') throw new Error('The sentiment API returned invalid JSON.')

  const result = value as Record<string, unknown>
  const scores = result.scores as Record<string, unknown> | undefined
  const topic = result.topic as Record<string, unknown> | undefined
  const rag = result.rag as Record<string, unknown> | undefined
  const references = rag?.retrieved_examples

  if (
    (result.sentiment !== 'negative' && result.sentiment !== 'positive') ||
    !isFiniteShare(result.confidence) ||
    typeof result.language !== 'string' ||
    typeof result.provider !== 'string' ||
    typeof result.reason !== 'string' ||
    !scores ||
    !isFiniteShare(scores.negative) ||
    !isFiniteShare(scores.positive) ||
    Math.abs(scores.negative + scores.positive - 1) > 0.000001 ||
    !topic ||
    !(topic.id === null || (typeof topic.id === 'number' && Number.isInteger(topic.id))) ||
    typeof topic.in_vocabulary !== 'boolean' ||
    !Array.isArray(topic.keywords) ||
    !topic.keywords.every((keyword) => typeof keyword === 'string') ||
    typeof topic.name !== 'string' ||
    !isFiniteShare(topic.probability) ||
    !Array.isArray(references)
  ) {
    throw new Error('The sentiment API response does not match the expected binary schema.')
  }

  return value as AnalysisResponse
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown analysis failure.'

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
    return jsonResponse({ error: 'The analysis function is not configured.' }, 503)
  }
  if (!authorization.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentication is required.' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return jsonResponse({ error: 'Invalid session.' }, 401)

  let requestBody: { reviewId?: unknown }
  try {
    requestBody = await request.json()
  } catch {
    return jsonResponse({ error: 'A JSON request body is required.' }, 400)
  }

  const reviewId = requestBody.reviewId
  if (
    typeof reviewId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reviewId)
  ) {
    return jsonResponse({ error: 'A valid reviewId is required.' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: review, error: reviewError } = await admin
    .from('reviews')
    .select('id, reviewer_id, comment, analysis_status, updated_at')
    .eq('id', reviewId)
    .eq('reviewer_id', authData.user.id)
    .maybeSingle()

  if (reviewError) return jsonResponse({ error: 'Unable to load review.' }, 500)
  if (!review) return jsonResponse({ error: 'Review was not found.' }, 404)
  if (!review.comment?.trim()) {
    if (review.analysis_status !== 'not_requested') {
      await admin
        .from('reviews')
        .update({ analysis_status: 'not_requested', updated_at: new Date().toISOString() })
        .eq('id', reviewId)
    }
    return jsonResponse({ reviewId, status: 'not_requested' })
  }
  if (review.analysis_status === 'processed') {
    return jsonResponse({ reviewId, status: 'processed' })
  }

  const processingStartedAt = Date.parse(review.updated_at)
  const staleProcessing =
    review.analysis_status === 'processing' &&
    Number.isFinite(processingStartedAt) &&
    processingStartedAt < Date.now() - 10 * 60 * 1000

  if (review.analysis_status === 'processing' && !staleProcessing) {
    return jsonResponse({ reviewId, status: 'processing' }, 202)
  }
  if (!['pending', 'failed', 'processing'].includes(review.analysis_status)) {
    return jsonResponse({ error: 'Review is not eligible for analysis.' }, 409)
  }

  const startedAt = new Date().toISOString()
  const { data: claimed, error: claimError } = await admin
    .from('reviews')
    .update({
      analysis_metadata: { schema_version: 1, started_at: startedAt },
      analysis_status: 'processing',
      updated_at: startedAt,
    })
    .eq('id', reviewId)
    .eq('analysis_status', review.analysis_status)
    .select('id')
    .maybeSingle()

  if (claimError) return jsonResponse({ error: 'Unable to claim review for analysis.' }, 500)
  if (!claimed) return jsonResponse({ reviewId, status: 'processing' }, 202)

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
    if (sentimentApiKey) headers['X-Analysis-Key'] = sentimentApiKey

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45_000)
    let modelResponse: Response
    try {
      modelResponse = await fetch(`${sentimentApiUrl}/analyze`, {
        body: JSON.stringify({ feedback: review.comment.trim() }),
        headers,
        method: 'POST',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!modelResponse.ok) {
      throw new Error(`Sentiment API request failed with status ${modelResponse.status}.`)
    }

    const analysis = parseAnalysis(await modelResponse.json())
    const analyzedAt = new Date().toISOString()
    const sentimentScore = analysis.scores.positive - analysis.scores.negative
    const referenceIds = analysis.rag.retrieved_examples.map((example) => ({
      id: example.id,
      source_dataset: example.source_dataset,
    }))

    const { error: updateError } = await admin
      .from('reviews')
      .update({
        analysis_metadata: {
          binary_scores: analysis.scores,
          confidence: analysis.confidence,
          language: analysis.language,
          provider: analysis.provider,
          reason: analysis.reason,
          reference_ids: referenceIds,
          schema_version: 1,
        },
        analysis_status: 'processed',
        analyzed_at: analyzedAt,
        sentiment_label: analysis.sentiment,
        sentiment_score: sentimentScore,
        topic_assignments: [analysis.topic],
        updated_at: analyzedAt,
      })
      .eq('id', reviewId)

    if (updateError) throw new Error('Unable to store the sentiment result.')
    return jsonResponse({ reviewId, status: 'processed' })
  } catch (error) {
    const message = getErrorMessage(error)
    await admin
      .from('reviews')
      .update({
        analysis_metadata: {
          error: message,
          failed_at: new Date().toISOString(),
          schema_version: 1,
        },
        analysis_status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)

    return jsonResponse({ error: message, reviewId, status: 'failed' }, 502)
  }
})
