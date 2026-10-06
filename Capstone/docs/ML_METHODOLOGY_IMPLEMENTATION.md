# MULTIVENT Machine Learning and NLP Implementation

**Evidence review date:** October 4, 2026  
**Application:** MULTIVENT event-services marketplace  
**ML/NLP project:** `D:\Sentiment Training\multivent-sentiment`

## Purpose and implementation status

MULTIVENT uses natural language processing to analyze the optional written comments that clients submit for completed services. Star ratings remain separate and are not used to force a text label. Each non-empty comment is classified as **positive** or **negative**, assigned an LDA topic, linked to relevant labeled examples, and stored with analysis metadata. Service pages group processed comments into **What clients loved** and **What could improve**, then show a cached, grounded summary for each group.

The implementation is a hybrid pipeline:

1. Conservative text normalization prepares Filipino, Hiligaynon, English, and code-switched feedback.
2. Latent Dirichlet Allocation (LDA) discovers the dominant topic.
3. A frozen multilingual sentence-transformer produces a 384-dimensional embedding.
4. FAISS retrieves similar labeled examples from a training-only index.
5. The configured OpenAI provider returns the final structured binary sentiment verdict. A local weighted-neighbor provider is available as a fallback.
6. Supabase Edge Functions securely connect the mobile application to the Python API and persist the result.

The system **does not train or fine-tune a supervised sentiment classifier**. It fits LDA and builds the retrieval index from the prepared corpus, while the current sentiment decision provider is a pre-trained OpenAI model. This distinction should be stated explicitly in the capstone methodology.

## Completed application integration

The following work is present in the MULTIVENT repository:

- `database/15_sentiment_analysis_integrity.sql` enforces binary sentiment and analysis-state integrity.
- `database/16_service_feedback_sentiment.sql` adds per-service reviews and sentiment fields.
- `database/18_ai_feedback_summary_cache.sql` stores one cached summary per service and sentiment group.
- `supabase/functions/analyze-review/index.ts` authenticates the reviewer, calls the protected Python `/analyze` endpoint, and stores the label, score, topic, reference provenance, provider, confidence, language, and reason.
- `supabase/functions/summarize-reviews/index.ts` requests or reuses grounded positive/negative summaries.
- `src/lib/reviews.ts` loads real reviews, groups analyzed comments, and requests summaries.
- `src/screens/08-ServiceDetails.tsx` displays rating statistics, sentiment groups, summaries, and expandable comments.
- `database/46_sentiment_analysis_retry.sql` and the Edge Function logic support controlled retries for pending, failed, or stale analyses.

The device does not receive the model URL, analysis key, or Supabase service-role key. These remain in protected server-side configuration.

## Runtime data flow

```text
Client submits per-service rating and optional comment
    -> Supabase stores the review
    -> analyze-review validates ownership and claims the job
    -> Python API normalizes the comment
    -> LDA infers a topic
    -> sentence-transformer + FAISS retrieve labeled examples
    -> OpenAI returns positive/negative structured output
    -> Edge Function stores label, signed score, topic, and metadata
    -> service page groups processed comments
    -> summarize-reviews returns a cached or newly grounded summary
```

`sentiment_score` is stored as `positive score - negative score`, producing a value from -1 to 1. Provider confidence is retained as metadata and is not treated as a calibrated probability.

## Dataset assembled

Four documented sources are registered in `config/datasets.yaml`:

| Source | Original records | Role | License |
|---|---:|---|---|
| HiliSenti v1 | 23,337 | Hiligaynon/code-switched language coverage | CC BY-NC-SA 4.0 |
| MAMS ACSA | 3,000 | Restaurant/service domain coverage | Apache 2.0 |
| Crawl Feeds Booking Hotel Reviews | 4,367 | Hospitality domain coverage | CC BY-NC 4.0 |
| UCI Sentiment Labelled Sentences, restaurant subset | 1,000 | Restaurant/service domain coverage | CC BY 4.0 |
| **Total source records examined** | **31,704** | | |

The hotel source can yield a positive and a negative text unit from one review, so source-record counts and candidate-text counts are not interchangeable.

Current generated corpus sizes are:

| Artifact | Rows | Use |
|---|---:|---|
| `all_binary.csv` | 23,171 | All valid, deduplicated positive/negative units |
| `domain_filtered.csv` | 5,649 | Units meeting the event/service relevance threshold |
| `lda_train.csv` | 4,462 | Training-only text used to fit LDA |
| `rag.csv` | 3,050 | Balanced training-only references in FAISS |
| `validation.csv` | 2,376 | Held-out validation records |
| `evaluation_hilisenti.csv` | 1,594 | Held-out HiliSenti test records |
| `evaluation_domain.csv` | 790 | Held-out hospitality/restaurant test records |

The two evaluation files contain **2,384** test records in total. The complete binary corpus therefore contains 18,411 training records (79.46%), 2,376 validation records (10.25%), and 2,384 test records (10.29%). LDA and RAG use only domain-relevant subsets of the training partition.

## Preprocessing completed

Dataset preparation performs the following:

- validates source schemas and maps only supported labels to positive or negative;
- excludes 7,154 neutral HiliSenti rows rather than relabeling them;
- excludes empty placeholders, explicit no-complaint hotel fields, conflicting MAMS aspect labels, and malformed records with an audit reason;
- applies Unicode normalization and whitespace cleanup;
- preserves case, punctuation, emojis, particles, and the original language in the clean provider/embedding text;
- expands reviewed informal Filipino/Hiligaynon shortcuts using token-boundary-aware dictionaries;
- reduces excessive repeated letters and normalizes limited laughter/reduplication patterns while retaining an audit trail;
- removes case-insensitive exact duplicates and quarantines contradictory duplicate labels;
- protects held-out fingerprints and whole review groups against training/test leakage;
- calculates domain relevance with frozen embeddings plus reviewed keywords; and
- balances positive and negative RAG references within each source using seed 42.

PII masking for email addresses and Philippine mobile numbers exists but was disabled for the recorded corpus. Names and locations are not automatically anonymized.

For LDA only, `CountVectorizer` lowercases internally, tokenizes word characters, and removes 14 conservative English articles/prepositions/conjunctions. Filipino and Hiligaynon stop-word lists are intentionally empty so negators and sentiment-bearing particles are preserved. No stemming or lemmatization is implemented. Punctuation and emojis are not globally removed.

## Models and features

### Topic discovery

LDA is fitted on 4,462 training-only rows using bag-of-words counts. Its recorded configuration is 10 topics, up to 10,000 features, `min_df=2`, `max_df=0.95`, unigrams, batch learning, 20 maximum iterations, and random state 42. Sentiment labels are not input features for LDA. Topic names are currently left as `Unassigned Topic 0` through `Unassigned Topic 9` pending human review.

### Semantic retrieval

The encoder is the pre-trained `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` model at resolved revision `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`. It is not fine-tuned. Long text is embedded in token windows and mean-pooled; normalized 384-dimensional vectors are searched with a FAISS inner-product index, which acts as cosine similarity for normalized vectors.

The index contains 3,050 balanced training references: 1,525 positive and 1,525 negative. Retrieval selects language and domain examples, then reranks them with similarity, domain relevance, and source weights.

### Sentiment decision

The active configuration uses `AI_PROVIDER=openai` and the configured model name `gpt-5.6-terra`. The provider receives the original feedback, the inferred LDA topic, and retrieved labeled examples, then returns a schema-validated positive/negative label, two scores summing to one, confidence, language, and reason. The prompt states that topics and retrieved references are context rather than ground truth.

The local fallback sums `max(0, similarity) x domain relevance x source weight` by class and selects the larger evidence share. It is documented as provisional, and its evidence share is not a calibrated probability.

## Data quality and missing values

After cleaning, required standardized fields are populated. The standardized files contain these 25 columns:

`id`, `text_original`, `text_clean`, `sentiment`, `source_dataset`, `source_record_id`, `source_domain`, `language`, `split`, `aspect`, `license`, `source_url`, `text_hash`, `original_text_hash`, `source_name`, `language_basis`, `source_split`, `pool`, `label_basis`, `group_id`, `domain_relevance_score`, `domain_semantic_similarity`, `domain_keyword_score`, `domain_irrelevant_penalty`, and `domain_keyword_hits`.

The optional `domain_keyword_hits` audit field is blank when no configured keyword matched; for example, it is blank in 16,213 of 23,171 `all_binary.csv` rows. This is an expected empty list representation, not a missing label or missing review text. Ineligible raw rows are written to exclusion/audit files rather than silently imputed.

## Splitting, leakage control, and validation

HiliSenti retains its publisher-provided train, validation, and test splits. The other domain sources use deterministic whole-review hashing with seed 42 for 80% training, 10% validation, and 10% testing. Hotel positive and negative fields from the same review stay in the same partition. Deduplication prioritizes test, then validation, then training, and the pipeline fails if evaluation text enters LDA or RAG.

No k-fold cross-validation is implemented. The project uses fixed held-out partitions because the pipeline includes source-specific splits, review grouping, retrieval-index construction, and strict leakage controls.

## Recorded evaluation

The current binary report evaluated the configured OpenAI provider on reproducible seed-42 samples of 100 held-out records per set, with six retrieved references per request:

| Held-out set | N | Accuracy | Precision | Recall | F1 | Macro F1 |
|---|---:|---:|---:|---:|---:|---:|
| HiliSenti | 100 | 0.9500 | 0.9130 | 0.9767 | 0.9438 | 0.9494 |
| Hospitality/restaurant domain | 100 | 0.9400 | 0.9583 | 0.9200 | 0.9388 | 0.9400 |

Precision, recall, and F1 treat positive as the positive class. The report also records macro precision/recall, per-source metrics, class distribution, predictions, and confusion matrices. Leakage checks passed.

These results are promising but do **not** establish performance on real MULTIVENT event feedback. Only 100 examples from each available held-out set were evaluated; the domain set is a hospitality/restaurant proxy, some hotel labels are weak field-position labels, and the configured provider was not fine-tuned on this corpus. A manually labeled, representative MULTIVENT validation set and full held-out evaluation are required before using sentiment for ranking, penalties, or automated business decisions.

## Tools and libraries

- Python, FastAPI, Uvicorn, Pydantic, pandas, NumPy, scikit-learn, joblib
- Sentence Transformers and PyTorch-backed multilingual embeddings
- FAISS CPU vector search
- OpenAI Responses API with structured Pydantic output
- Hugging Face Hub/Datasets and UCI source downloads
- pytest and httpx for automated tests
- Supabase PostgreSQL, RPCs, Edge Functions, and secure secrets
- TypeScript, React Native/Expo, and the MULTIVENT web/mobile interface

## Verification and remaining work

The application integration documentation records successful type checking, linting, web build, database/function checks, model health checks, 57 model tests, and a real summary request. The current generated artifacts also record passed leakage checks.

Remaining research work is to:

1. collect and manually label representative MULTIVENT feedback with clear annotation rules;
2. evaluate all held-out rows or report a justified sample and confidence intervals;
3. report per-language, per-source, and per-service-category errors;
4. have a qualified speaker review Hiligaynon/Filipino normalization and LDA topic names;
5. define acceptance criteria before the final evaluation; and
6. keep the model service on a stable HTTPS deployment rather than a temporary tunnel.

## Evidence files

This summary was derived from the current code and generated artifacts, especially:

- `D:\Sentiment Training\multivent-sentiment\config\datasets.yaml`
- `D:\Sentiment Training\multivent-sentiment\data\processed\multivent_corpus\manifest.json`
- `D:\Sentiment Training\multivent-sentiment\reports\multivent_dataset_report.md`
- `D:\Sentiment Training\multivent-sentiment\reports\binary_evaluation.md`
- `D:\Sentiment Training\multivent-sentiment\reports\evaluation.json`
- `D:\Sentiment Training\multivent-sentiment\reports\lda_topics.md`
- `D:\Sentiment Training\multivent-sentiment\app\corpus\prepare.py`
- `D:\Sentiment Training\multivent-sentiment\app\topics\lda_service.py`
- `D:\Sentiment Training\multivent-sentiment\app\sentiment\openai_provider.py`
- `docs/sentiment-integration.md`
- `docs/SERVICE_FEEDBACK_SENTIMENT_IMPLEMENTATION.md`

