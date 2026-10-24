'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  mdiChevronLeft,
  mdiChevronRight,
  mdiClose,
  mdiEyeOutline,
  mdiMagnify,
  mdiRefresh,
  mdiStarOutline,
} from '@mdi/js'
import { MdiIcon } from '@/components/icons'
import { EmptyState, formatDate, InlineError, SegmentedFilter, StatusBadge, TableSkeleton } from '@/components/ui'
import { useDashboardControls, useStaff } from '@/components/dashboard-shell'
import { getSupabase } from '@/lib/supabase'

type Choice = { id: string; name: string }
type ReviewRow = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  sentiment: string | null
  analysis_status: string
  provider_id: string
  provider_name: string
  service_id: string
  service_name: string
  cover_image_url: string | null
  category_id: string | null
  category_name: string
}
type ReviewDirectory = { page: number; page_size: number; total: number; categories: Choice[]; reviews: ReviewRow[] }
type ReviewDetail = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  sentiment: string | null
  sentiment_score: number | null
  analysis_status: string
  topics: unknown
  provider: { id: string; name: string }
  service: { id: string; name: string; cover_image_url: string | null; category_name: string }
}

const sentimentOptions: ReadonlyArray<readonly [string, string]> = [
  ['all', 'All'],
  ['positive', 'Positive'],
  ['negative', 'Negative'],
  ['unprocessed', 'Needs analysis'],
]

export function ReviewsManagementScreen() {
  const { can } = useStaff()
  const { liveDataVersion } = useDashboardControls()
  const [directory, setDirectory] = useState<ReviewDirectory | null>(null)
  const [categoryId, setCategoryId] = useState('all')
  const [sentiment, setSentiment] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ReviewDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [retryingId, setRetryingId] = useState('')
  const [notice, setNotice] = useState('')

  const loadDirectory = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) {
      setError('Supabase is not configured for this deployment.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const { data, error: requestError } = await supabase.rpc('get_admin_reviews_directory', {
      p_category_id: categoryId === 'all' ? null : categoryId,
      p_sentiment: sentiment,
      p_search: search,
      p_page: page,
      p_page_size: 10,
    })
    if (requestError) setError(requestError.message)
    else if (!isReviewDirectory(data)) setError('The review directory returned an unexpected response. Refresh after the Phase 4 dashboard migration is available.')
    else setDirectory(data)
    setLoading(false)
  }, [categoryId, page, search, sentiment])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDirectory() }, 0)
    return () => window.clearTimeout(timer)
  }, [liveDataVersion, loadDirectory])

  const totalPages = Math.max(1, Math.ceil((directory?.total || 0) / (directory?.page_size || 10)))
  const showingStart = directory?.total ? ((directory.page - 1) * directory.page_size) + 1 : 0
  const showingEnd = directory ? Math.min(directory.total, directory.page * directory.page_size) : 0

  function resetPage(change: () => void) {
    change()
    setPage(1)
  }

  async function openReview(reviewId: string) {
    const supabase = getSupabase()
    if (!supabase) return
    setDetailLoading(true)
    setDetailError('')
    setSelected(null)
    const { data, error: requestError } = await supabase.rpc('get_admin_review_detail', { p_review_id: reviewId })
    if (requestError) setDetailError(requestError.message)
    else if (!isReviewDetail(data)) setDetailError('Review details returned an unexpected response.')
    else setSelected(data)
    setDetailLoading(false)
  }

  async function retryAnalysis(review: ReviewRow) {
    const supabase = getSupabase()
    if (!supabase || retryingId) return
    setRetryingId(review.id)
    setError('')
    setNotice('')
    const { error: requestError } = await supabase.functions.invoke('analyze-review', { body: { reviewId: review.id } })
    if (requestError) setError(requestError.message)
    else setNotice('Sentiment analysis has been requested for this review.')
    setRetryingId('')
    await loadDirectory()
  }

  return (
    <div className="screen-stack reviews-management-screen">
      <section className="page-heading page-heading--with-action">
        <div><span className="eyebrow">TRUST & SAFETY</span><h1>Ratings & reviews</h1><p>Review completed-booking service feedback without exposing client identity or changing customer content.</p></div>
        <div className="heading-actions"><button className="secondary-button" type="button" disabled={loading} onClick={() => void loadDirectory()}><MdiIcon path={mdiRefresh} />{loading ? 'Refreshing…' : 'Refresh'}</button></div>
      </section>

      {error && <InlineError message={error} onClose={() => setError('')} />}
      {notice && <div className="inline-success" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}

      <section className="panel data-panel reviews-directory-panel" aria-busy={loading}>
        <div className="reviews-directory-toolbar">
          <label className="search-box"><MdiIcon path={mdiMagnify} /><input value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} placeholder="Search providers, services, categories, or feedback…" /></label>
          <SegmentedFilter ariaLabel="Filter reviews by sentiment" options={sentimentOptions} value={sentiment} onChange={(value) => resetPage(() => setSentiment(value))} />
          <label className="inline-select-wrap"><span>Category</span><select aria-label="Filter reviews by category" value={categoryId} onChange={(event) => resetPage(() => setCategoryId(event.target.value))}><option value="all">All categories</option>{directory?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        </div>

        {loading && !directory ? <TableSkeleton rows={7} /> : !directory?.reviews.length ? <EmptyState title="No reviews found" copy={search || categoryId !== 'all' || sentiment !== 'all' ? 'Try removing a filter or using a different search term.' : 'Completed-booking service reviews will appear here after clients submit feedback.'} /> : <div className="table-scroll"><table className="data-table reviews-directory-table"><thead><tr><th>Service / provider</th><th>Category</th><th>Rating</th><th>Feedback</th><th>Analysis</th><th>Submitted</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{directory.reviews.map((review) => <tr key={review.id}>
          <td data-label="Service / provider"><div className="review-directory-identity"><ReviewImage url={review.cover_image_url} label={review.service_name} /><div><strong>{review.provider_name}</strong><small>{review.service_name}</small></div></div></td>
          <td data-label="Category"><span className="category-tag">{review.category_name}</span></td>
          <td data-label="Rating"><span className="provider-rating"><MdiIcon path={mdiStarOutline} /> {review.rating.toFixed(1)}</span></td>
          <td data-label="Feedback"><span className="review-copy">{review.comment ? truncateCopy(review.comment, 130) : 'No written feedback'}</span></td>
          <td data-label="Analysis"><div className="review-analysis-status"><StatusBadge value={review.sentiment || review.analysis_status} /><small>{review.analysis_status.replaceAll('_', ' ')}</small></div></td>
          <td data-label="Submitted">{formatDate(review.created_at)}</td>
          <td className="row-actions"><button className="review-button" type="button" onClick={() => void openReview(review.id)}><MdiIcon path={mdiEyeOutline} /> Details</button>{can('reviews.analysis.retry') && isRetryable(review.analysis_status) && <button className="sentiment-retry-button" type="button" disabled={retryingId === review.id} onClick={() => void retryAnalysis(review)}>{retryingId === review.id ? 'Retrying…' : 'Retry analysis'}</button>}</td>
        </tr>)}</tbody></table></div>}
        <footer className="table-footer"><span>Showing {showingStart}–{showingEnd} of {directory?.total || 0} reviews</span><div><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page"><MdiIcon path={mdiChevronLeft} /></button><b>{directory?.page || page} / {totalPages}</b><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><MdiIcon path={mdiChevronRight} /></button></div></footer>
      </section>

      {(detailLoading || selected || detailError) && <ReviewDetailModal detail={selected} loading={detailLoading} error={detailError} onClose={() => { setSelected(null); setDetailError('') }} />}
    </div>
  )
}

function ReviewDetailModal({ detail, loading, error, onClose }: { detail: ReviewDetail | null; loading: boolean; error: string; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="review-detail-modal" role="dialog" aria-modal="true" aria-labelledby="review-detail-title"><header><button type="button" onClick={onClose} aria-label="Close review details"><MdiIcon path={mdiClose} /></button><div><span className="eyebrow">COMPLETED-BOOKING REVIEW</span><h2 id="review-detail-title">{detail?.provider.name || (loading ? 'Loading review…' : 'Review details')}</h2></div>{detail && <span className="provider-rating"><MdiIcon path={mdiStarOutline} /> {detail.rating.toFixed(1)}</span>}</header>{loading && <TableSkeleton rows={4} />}{error && <InlineError message={error} onClose={onClose} />}{detail && <div className="review-detail-modal__body"><div className="review-detail-service"><ReviewImage url={detail.service.cover_image_url} label={detail.service.name} /><div><strong>{detail.service.name}</strong><small>{detail.service.category_name} · {formatDate(detail.created_at)}</small><Link href={`/dashboard/providers?provider=${encodeURIComponent(detail.provider.id)}`}>View provider profile</Link></div></div><section><span className="detail-label">CLIENT FEEDBACK</span><p>{detail.comment || 'This client submitted a rating without written feedback.'}</p></section><section className="review-detail-analysis"><div><span>Sentiment</span><StatusBadge value={detail.sentiment || detail.analysis_status} /></div><div><span>Analysis status</span><strong>{detail.analysis_status.replaceAll('_', ' ')}</strong></div>{detail.sentiment_score != null && <div><span>Stored confidence</span><strong>{detail.sentiment_score.toFixed(2)}</strong></div>}</section>{topicLabels(detail.topics).length > 0 && <section><span className="detail-label">STORED TOPICS</span><div className="category-tag-list">{topicLabels(detail.topics).map((topic) => <span key={topic}>{topic}</span>)}</div></section>}</div>}<footer><button className="secondary-button" type="button" onClick={onClose}>Close</button></footer></section></div>
}

function ReviewImage({ url, label }: { url: string | null; label: string }) {
  const safeUrl = url?.trim() || ''
  return safeUrl
    ? <span className="review-directory-image" style={{ backgroundImage: `url("${safeUrl.replaceAll('"', '%22')}")` }} role="img" aria-label={`${label} image`} />
    : <span className="review-directory-image review-directory-image--fallback" aria-hidden="true">{label.slice(0, 1).toUpperCase() || 'M'}</span>
}

function isRetryable(status: string) { return ['failed', 'pending'].includes(status) }
function truncateCopy(value: string, limit: number) { const text = value.trim(); return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text }
function topicLabels(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((topic) => typeof topic === 'string' ? topic : topic && typeof topic === 'object' && typeof (topic as Record<string, unknown>).label === 'string' ? String((topic as Record<string, unknown>).label) : '').filter(Boolean).slice(0, 8)
}
function isReviewDirectory(value: unknown): value is ReviewDirectory {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<ReviewDirectory>
  return Boolean(typeof row.page === 'number' && typeof row.page_size === 'number' && typeof row.total === 'number' && Array.isArray(row.categories) && Array.isArray(row.reviews))
}
function isReviewDetail(value: unknown): value is ReviewDetail {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<ReviewDetail>
  return Boolean(typeof row.id === 'string' && row.provider && row.service && typeof row.rating === 'number')
}
