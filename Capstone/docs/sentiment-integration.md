# Sentiment analysis integration

MULTIVENT analyzes optional comments attached to individual service reviews. Star ratings are
stored separately and are not passed to the text classifier.

## Runtime flow

```text
Expo app -> submit_event_service_feedback RPC
         -> one reviews row per completed booking
         -> invoke analyze-review for each non-empty comment
Edge Function -> verify the user owns the review
              -> claim pending/failed row as processing
              -> POST the comment to the Python /analyze endpoint
              -> store sentiment, signed score, LDA topic, RAG references, and metadata
Service details -> group processed comments by positive/negative sentiment
                -> show a friendly local fallback immediately
                -> invoke summarize-reviews when comments exist
Edge Function -> reuse a current service/sentiment summary cache
              -> otherwise POST comments and service context to Python /summarize
              -> cache the grounded OpenAI sentence
Service details -> replace the fallback with the AI summary
                -> expand all comments when a summary is selected
```

The Expo application never receives the service-role key, model URL, or model shared secret. Only
RAG reference IDs and provenance are persisted; retrieved training sentences are not copied into
Supabase.

`sentiment_score` is the signed binary evidence margin (`positive score - negative score`) from
`-1` to `1`. Provider confidence is retained in `analysis_metadata.confidence` and must not be
presented as a calibrated probability.

## Deploy

1. Apply `database/15_sentiment_analysis_integrity.sql`,
   `database/16_service_feedback_sentiment.sql`, and
   `database/18_ai_feedback_summary_cache.sql` in that order.
2. Deploy the Python project from `D:\Sentiment Training\multivent-sentiment` to a stable HTTPS
   service. Keep `models/`, `vector_store/`, and prepared `data/` artifacts in the deployment and
   require a successful `/health` response before enabling traffic.
3. Configure the model environment. The current integration intentionally uses OpenAI:

   ```dotenv
   AI_PROVIDER=openai
   OPENAI_MODEL=gpt-5.6-terra
   ANALYSIS_API_KEY=replace-with-a-long-random-secret
   EMBEDDING_LOCAL_FILES_ONLY=true
   ENABLE_ANALYSIS_LOGGING=false
   ```

4. Configure the same secret and the stable model base URL in Supabase:

   ```powershell
   npx supabase secrets set SENTIMENT_API_URL=https://sentiment.example.com
   npx supabase secrets set SENTIMENT_API_KEY=replace-with-the-same-secret
   ```

5. Deploy both feedback functions:

   ```powershell
   npx supabase functions deploy analyze-review
   npx supabase functions deploy summarize-reviews
   ```

See [`SERVICE_FEEDBACK_SENTIMENT_IMPLEMENTATION.md`](SERVICE_FEEDBACK_SENTIMENT_IMPLEMENTATION.md)
for the completed file-by-file changes and app-only test procedure.

## Retry and operations

The analysis function is idempotent for processed rows and accepts `pending`, `failed`, and stale
`processing` rows. Retry it as the feedback owner with `{ "reviewId": "..." }`. A processing row
older than ten minutes can be reclaimed. Monitor `/health` plus review counts grouped by
`analysis_status`.

The summary function is also idempotent from the app's perspective: unchanged feedback returns the
cache. New analyzed comments update the aggregate incrementally. If the model is unavailable, the
app retains its non-technical fallback or the last successful cached sentence.

The current local evaluation report does not establish accuracy on real MULTIVENT feedback. Use a
manually labeled production validation set before using sentiment for ranking, penalties, or other
automated business decisions.
