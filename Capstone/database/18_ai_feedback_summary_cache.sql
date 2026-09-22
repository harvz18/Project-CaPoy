-- Cached, customer-facing AI summaries for positive and negative service feedback.
-- Run after 16_service_feedback_sentiment.sql.

begin;

create table if not exists public.service_review_summaries (
  service_id uuid not null references public.services(id) on delete cascade,
  sentiment_label text not null,
  summary text not null,
  source_review_count integer not null,
  source_latest_analyzed_at timestamptz not null,
  provider text not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (service_id, sentiment_label),
  constraint service_review_summaries_sentiment_check
    check (sentiment_label in ('negative', 'positive')),
  constraint service_review_summaries_text_check
    check (char_length(trim(summary)) between 10 and 600),
  constraint service_review_summaries_count_check
    check (source_review_count >= 1)
);

alter table public.service_review_summaries enable row level security;

revoke all on table public.service_review_summaries from anon, authenticated;
grant select on table public.service_review_summaries to anon, authenticated;

drop policy if exists "Published feedback summaries are readable"
  on public.service_review_summaries;
create policy "Published feedback summaries are readable"
  on public.service_review_summaries
  for select
  to anon, authenticated
  using (true);

commit;
