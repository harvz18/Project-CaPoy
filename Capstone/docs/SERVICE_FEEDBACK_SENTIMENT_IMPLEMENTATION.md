# Service Feedback + LDA/RAG Sentiment Implementation

Date completed: September 23, 2026

## What changed

MULTIVENT now collects feedback per completed service instead of requiring one overall event
comment.

- Every completed service requires a 1-to-5 star rating.
- A written comment is optional for each service.
- Ratings are stored as ratings and are never used to force the text sentiment result.
- Every non-empty comment is analyzed independently by the trained sentiment API.
- Service details show the real average rating and 5-to-1 rating distribution.
- Analyzed comments are grouped into **What clients loved** and **What could improve**.
- Each group displays a natural, service-aware OpenAI summary grounded in all analyzed comments in
  that sentiment group.
- Summaries are cached and updated incrementally when later feedback is analyzed, so opening the
  same service repeatedly does not create another OpenAI request.
- Selecting a group expands every analyzed comment in that group.
- Rating-only reviews count toward the average but not toward positive/negative comment groups.

## Runtime flow

```text
Completed event
  -> client rates every completed service
  -> optional comment for each service
  -> one atomic Supabase RPC saves all reviews
  -> each non-empty comment invokes analyze-review
  -> Edge Function verifies the signed-in reviewer
  -> Python /analyze runs LDA + RAG + the configured OpenAI provider
  -> result is saved on that review
  -> service details reads ratings and positive/negative groups immediately
  -> summarize-reviews requests /summarize when its cache is missing or stale
  -> OpenAI writes one grounded sentence using service/category context and client comments
  -> the cached AI sentence replaces the app's friendly local fallback
```

The Expo app does not contain the model URL, Supabase service-role key, or analysis shared secret.
Those values remain in Supabase Edge Function secrets.

## Database work

Created and applied [`database/16_service_feedback_sentiment.sql`](../database/16_service_feedback_sentiment.sql).
It:

- adds analysis status, sentiment, score, LDA topic, metadata, and timestamp columns to `reviews`;
- enforces one review per booking;
- adds review lookup and analysis-queue indexes;
- changes `event_feedback` into the one-per-event submission marker while preserving legacy data;
- adds the authenticated `submit_event_service_feedback` RPC;
- validates ownership, event completion, booking membership, one rating per completed service, and
  rating/comment limits inside one database transaction;
- creates provider notifications; and
- requires event feedback submissions to use the atomic RPC.

Two existing legacy overall-event comments were found. They were not deleted or changed. The app
now decides whether the new form is complete from per-booking review rows, so those old records do
not block service ratings.

Created and applied
[`database/18_ai_feedback_summary_cache.sql`](../database/18_ai_feedback_summary_cache.sql). It adds
one protected cache row per service and sentiment, including the number of source comments and the
latest analysis timestamp used. Clients can read published summaries; only the server-side Edge
Function can create or replace them.

## App work

- `src/screens/15.1-EventFeedback.tsx`: per-service cards, required stars, optional comments, progress,
  validation, and submission state.
- `src/lib/planning.ts`: atomic RPC call and per-comment analysis invocations.
- `src/lib/merchant.ts`: booking rows now carry service/provider IDs and completion is based on the
  presence of all per-booking reviews.
- `src/lib/reviews.ts`: loads real reviews, computes the average/distribution, groups sentiment,
  builds a non-technical fallback, and requests the cached/generated AI summaries.
- `src/screens/08-ServiceDetails.tsx`: real rating distribution, clickable sentiment summary cards,
  and expandable verified comments.
- `src/App.tsx`: loads live review insights whenever a live service detail screen opens.
  Demo catalog cards that are backed by a real service ID use that real service's review feed too.

## Edge Function

Created and deployed `supabase/functions/analyze-review/index.ts`.

The function:

- requires a valid Supabase JWT;
- confirms that the signed-in user owns the review;
- safely claims `pending`, `failed`, or stale `processing` rows;
- sends only the written comment to `/analyze` with `X-Analysis-Key`;
- stores binary sentiment, signed score, LDA topic data, RAG reference IDs, provider, confidence,
  language, and reason; and
- marks failures for safe retry without losing the rating/comment.

`analyze-review` is active on Supabase project `vkjmyyrxxzznbrgxzfyn` with JWT verification enabled.
An anonymous request was checked and correctly returned HTTP 401.

Created and deployed `supabase/functions/summarize-reviews/index.ts`. It:

- requires a valid Supabase session and keeps the model URL/key off the device;
- loads only processed comments for the selected service and sentiment;
- returns an existing cache entry when its source count and timestamp are current;
- asks the protected Python `/summarize` endpoint for a 15-to-40-word customer-facing sentence when
  the cache is missing or stale;
- passes the earlier aggregate plus only newly analyzed comments for incremental updates;
- safely falls back to the last cached sentence when a refresh temporarily fails; and
- never sends star ratings to the language model or invents feedback for rating-only reviews.

## Current model configuration

The local model environment is using:

```dotenv
AI_PROVIDER=openai
OPENAI_MODEL=gpt-5.6-terra
EMBEDDING_LOCAL_FILES_ONLY=true
ENABLE_ANALYSIS_LOGGING=false
```

The health endpoint was verified with LDA loaded, RAG loaded, OpenAI configured, and no reported
errors. `AI_PROVIDER=openai` does not bypass LDA or retrieval: topic inference and RAG evidence are
still part of the analysis response; OpenAI is the configured AI decision provider.

The new `/summarize` endpoint also uses the configured OpenAI Responses client with a structured
output contract. It receives the service name, category, one sentiment group, its verified comments,
and—when applicable—the prior aggregate. Its prompt forbids invented claims and technical wording
such as LDA, RAG, topics, scores, or keywords. One comment begins with **A client says**; multiple
comments begin with **Most clients say**.

## How to test using the app

1. Keep the Python sentiment server and Cloudflare tunnel running.
2. Keep the Expo app running on port `8082` and refresh/reload it so it receives the new bundle.
3. Sign in as a client that owns a completed event.
4. Open **Bookings**, select the completed event, and choose **Submit feedback**.
5. Select 1-5 stars for every listed service.
6. Add a positive comment to one service and a critical comment to another. Comments are optional,
   but written examples make the sentiment sections testable.
7. Select **Submit all feedback**. A success screen confirms the ratings were saved.
8. Open **Explore**, open the exact live service, then scroll to **Guest Reviews**.
9. Check the average/distribution. Select **What clients loved** or **What could improve** to reveal
   all comments in that group.
10. The card first has a readable local fallback. Once the protected summary request finishes, it
    displays the AI sentence. Reopening an unchanged service uses the database cache.

If a comment is still processing, the service page reports how many comments are pending. Reopen the
service page to reload its analysis.

## Important temporary-tunnel note

The configured model URL currently uses a Cloudflare quick tunnel:

```text
https://scanner-appointment-thirty-volunteer.trycloudflare.com
```

That URL is temporary. It works only while the local Python server and `cloudflared` process are
running, and it can change after restart. For production, deploy the model to a stable HTTPS host,
then update `SENTIMENT_API_URL` in Supabase secrets and redeploy/restart only as required by that
host. Do not put the analysis API key into the Expo `.env`.

## Verification completed

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build:web` passed.
- Supabase confirmed the RPC and review analysis columns exist.
- Supabase confirmed `analyze-review` is active.
- Supabase confirmed `summarize-reviews` is active and migration 18 was applied.
- The model `/health` check reported LDA, RAG, and OpenAI ready.
- All 57 model tests passed, and a real `/summarize` request returned a grounded OpenAI summary.

## Schedule availability correction

`database/17_release_completed_booking_dates.sql` was added and applied after testing the
provider-completion flow. The schedule checker now treats only `requested`, `approved`,
`payment_required`, `paid`, and `confirmed` bookings as date conflicts. Completed bookings remain
available for history, reviews, and reporting, but immediately release the provider's date.
