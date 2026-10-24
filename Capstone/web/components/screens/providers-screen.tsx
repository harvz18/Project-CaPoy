'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  mdiArrowRight,
  mdiCheck,
  mdiChevronLeft,
  mdiChevronRight,
  mdiClose,
  mdiEyeOutline,
  mdiMagnify,
  mdiRefresh,
  mdiStarOutline,
  mdiStorefrontOutline,
} from '@mdi/js'
import { MdiIcon } from '@/components/icons'
import { EmptyState, formatDate, formatMoney, InlineError, SegmentedFilter, StatusBadge, TableSkeleton } from '@/components/ui'
import { useDashboardControls, useStaff } from '@/components/dashboard-shell'
import { getSupabase } from '@/lib/supabase'

type Category = { id: string; name: string }
type ProviderRow = {
  id: string
  business_name: string
  full_name: string | null
  email: string | null
  location: string | null
  verification_status: string
  account_status: string
  categories: Category[]
  active_services: number
  services: number
  valid_bookings: number
  confirmed_bookings: number
  completed_bookings: number
  average_rating: number
  review_count: number
  performance: string
  registered_at: string
  terms_accepted: boolean
  terms_version: string | null
}
type RankedProvider = {
  rank: number
  id: string
  business_name: string
  categories: Category[]
  valid_bookings: number
  confirmed_bookings: number
  completed_bookings: number
  average_rating: number
  review_count: number
  written_review_count: number
  positive_written_reviews: number
  negative_written_reviews: number
  performance: string
}
type ProviderDirectory = {
  page: number
  page_size: number
  total: number
  categories: Category[]
  ranking_method: string
  top_providers: RankedProvider[]
  providers: ProviderRow[]
}
type ProviderDetail = {
  provider: {
    id: string
    business_name: string
    description: string | null
    full_name: string | null
    email: string | null
    phone: string | null
    location: string | null
    verification_status: string
    account_status: string
    terms_accepted: boolean
    terms_version: string | null
    rejection_reason: string | null
    registered_at: string
    reviewed_at: string | null
  }
  summary: {
    active_services: number
    services: number
    valid_bookings: number
    confirmed_bookings: number
    completed_bookings: number
    average_rating: number
    review_count: number
    written_review_count: number
    positive_written_reviews: number
    negative_written_reviews: number
  }
  categories: Category[]
  services: Array<{
    id: string
    name: string
    status: string
    is_available: boolean
    base_price: number | null
    location: string | null
    category_id: string | null
    category_name: string | null
    valid_bookings: number
    confirmed_bookings: number
    completed_bookings: number
    average_rating: number
    review_count: number
    created_at: string
  }>
  recent_reviews: Array<{
    id: string
    rating: number
    comment: string | null
    sentiment: string | null
    created_at: string
    service_name: string
  }>
}

const statusOptions: ReadonlyArray<readonly [string, string]> = [
  ['all', 'All'],
  ['pending', 'For review'],
  ['verified', 'Verified'],
  ['disabled', 'Declined'],
]

export function ProvidersScreen({ readOnly = false }: { readOnly?: boolean }) {
  const { can } = useStaff()
  const { liveDataVersion } = useDashboardControls()
  const searchParams = useSearchParams()
  const [directory, setDirectory] = useState<ProviderDirectory | null>(null)
  const [categoryId, setCategoryId] = useState(() => searchParams.get('category') || 'all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('performance')
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ProviderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [notice, setNotice] = useState('')
  const [openedProviderId, setOpenedProviderId] = useState('')

  const loadDirectory = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) {
      setError('Supabase is not configured for this deployment.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const { data, error: requestError } = await supabase.rpc('get_admin_provider_directory', {
      p_category_id: categoryId === 'all' ? null : categoryId,
      p_status: status,
      p_search: search,
      p_sort: sort,
      p_page: page,
      p_page_size: 10,
    })
    if (requestError) {
      setError(requestError.message)
    } else if (!isDirectory(data)) {
      setError('The provider directory returned an unexpected response. Refresh after the provider-management migration is available.')
    } else {
      setDirectory(data)
    }
    setLoading(false)
  }, [categoryId, page, search, sort, status])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDirectory() }, 0)
    return () => window.clearTimeout(timer)
  }, [liveDataVersion, loadDirectory])

  const totalPages = Math.max(1, Math.ceil((directory?.total || 0) / (directory?.page_size || 10)))
  const selectedCategory = directory?.categories.find((category) => category.id === categoryId)?.name || 'All categories'
  const showingStart = directory?.total ? ((directory.page - 1) * directory.page_size) + 1 : 0
  const showingEnd = directory ? Math.min(directory.total, directory.page * directory.page_size) : 0

  function changeFilters(change: () => void) {
    change()
    setPage(1)
  }

  const openProvider = useCallback(async (providerId: string) => {
    const supabase = getSupabase()
    if (!supabase) return
    setDetailLoading(true)
    setDetailError('')
    setSelected(null)
    const { data, error: requestError } = await supabase.rpc('get_admin_provider_profile', { p_provider_id: providerId })
    if (requestError) setDetailError(requestError.message)
    else if (!isProviderDetail(data)) setDetailError('Provider detail returned an unexpected response.')
    else setSelected(data)
    setDetailLoading(false)
  }, [])

  useEffect(() => {
    const providerId = searchParams.get('provider')
    if (!providerId || providerId === openedProviderId) return
    const timer = window.setTimeout(() => {
      setOpenedProviderId(providerId)
      void openProvider(providerId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [openProvider, openedProviderId, searchParams])

  async function updateProviderStatus(nextStatus: 'verified' | 'disabled', reason = '') {
    if (!selected) return
    const supabase = getSupabase()
    if (!supabase) return
    setDetailError('')
    const { error: requestError } = await supabase.rpc('admin_set_provider_verification', {
      target_provider_id: selected.provider.id,
      new_status: nextStatus,
      reason: reason || null,
    })
    if (requestError) {
      setDetailError(requestError.message)
      return
    }
    setNotice(nextStatus === 'verified' ? 'Provider has been approved.' : 'Provider application has been declined.')
    setSelected(null)
    await loadDirectory()
  }

  return (
    <div className="screen-stack provider-management-screen">
      <section className="page-heading page-heading--with-action">
        <div><span className="eyebrow">MARKETPLACE</span><h1>Service Providers</h1><p>{readOnly ? 'Review provider performance, services, and customer feedback.' : 'Review and manage provider standing, category performance, services, and customer feedback.'}</p></div>
        <div className="heading-actions"><button className="secondary-button" type="button" disabled={loading} onClick={() => void loadDirectory()}><MdiIcon path={mdiRefresh} />{loading ? 'Refreshing…' : 'Refresh'}</button></div>
      </section>

      {error && <InlineError message={error} onClose={() => setError('')} />}
      {notice && <div className="inline-success" role="status"><MdiIcon path={mdiCheck} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}

      <section className="provider-performance-section" aria-busy={loading}>
        <div className="provider-performance-heading">
          <div><span className="eyebrow">TOP PERFORMING SERVICE PROVIDERS</span><h2>{selectedCategory}</h2><p>{directory?.ranking_method || 'Loading ranking method…'}</p></div>
          <label className="inline-select-wrap"><span>Category</span><select value={categoryId} onChange={(event) => changeFilters(() => setCategoryId(event.target.value))} aria-label="Filter provider rankings by category"><option value="all">All categories</option>{directory?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        </div>
        {loading && !directory ? <TableSkeleton rows={4} /> : !directory?.top_providers.length ? <EmptyState title="No provider performance data yet" copy="Rankings will appear after providers have active category services or booking activity." /> : (
          <div className="provider-ranking-table">
            <div className="provider-ranking-table__header"><span>Rank</span><span>Provider</span><span>Bookings</span><span>Rating</span><span>Performance</span><span /></div>
            {directory.top_providers.map((provider) => <div className="provider-ranking-row" key={provider.id}>
              <b>{provider.rank}</b>
              <div><strong>{provider.business_name}</strong><small>{categoryId === 'all' ? categoryNames(provider.categories) : selectedCategory}</small></div>
              <span><strong>{provider.confirmed_bookings}</strong><small>{provider.valid_bookings} valid</small></span>
              <span className="provider-rating">{ratingCopy(provider.average_rating, provider.review_count)}</span>
              <span className={`performance-pill performance-pill--${provider.performance.toLowerCase()}`}>{provider.performance}</span>
              <button className="review-button" type="button" onClick={() => void openProvider(provider.id)}><MdiIcon path={mdiEyeOutline} /> View</button>
            </div>)}
          </div>
        )}
      </section>

      <section className="panel data-panel provider-directory-panel" aria-busy={loading}>
        <div className="provider-directory-toolbar">
          <label className="search-box"><MdiIcon path={mdiMagnify} /><input value={search} onChange={(event) => changeFilters(() => setSearch(event.target.value))} placeholder="Search providers, owners, or email…" /><kbd>⌘ K</kbd></label>
          <SegmentedFilter ariaLabel="Filter providers by verification status" options={statusOptions} value={status} onChange={(value) => changeFilters(() => setStatus(value))} />
          <label className="inline-select-wrap"><span>Sort</span><select value={sort} onChange={(event) => changeFilters(() => setSort(event.target.value))}><option value="performance">Performance</option><option value="bookings">Most bookings</option><option value="rating">Established rating</option><option value="newest">Newest first</option></select></label>
        </div>
        {loading && !directory ? <TableSkeleton rows={6} /> : !directory?.providers.length ? <EmptyState title="No service providers found" copy={search ? 'Try a different search term or remove a filter.' : 'Provider accounts will appear here when they register.'} /> : (
          <div className="table-scroll">
            <table className="data-table provider-directory-table">
              <thead><tr><th>Provider</th><th>Categories</th><th>Active services</th><th>Bookings</th><th>Rating</th><th>Standing</th><th>Registered</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{directory.providers.map((provider) => <tr key={provider.id}>
                <td data-label="Provider"><div className="provider-identity"><span><MdiIcon path={mdiStorefrontOutline} /></span><div><strong>{provider.business_name}</strong><small>{provider.full_name || 'Provider account'} · {provider.email || 'No email'}</small></div></div></td>
                <td data-label="Categories"><div className="category-tag-list">{provider.categories.length ? provider.categories.slice(0, 2).map((category) => <span key={category.id}>{category.name}</span>) : <small>None active</small>}{provider.categories.length > 2 && <b>+{provider.categories.length - 2}</b>}</div></td>
                <td data-label="Active services"><strong>{provider.active_services}</strong><small className="table-subcopy">{provider.services} total</small></td>
                <td data-label="Bookings"><strong>{provider.confirmed_bookings}</strong><small className="table-subcopy">{provider.valid_bookings} valid</small></td>
                <td data-label="Rating"><span className="provider-rating">{ratingCopy(provider.average_rating, provider.review_count)}</span></td>
                <td data-label="Standing"><div className="provider-standing"><StatusBadge value={provider.verification_status} /><span className={`performance-pill performance-pill--${provider.performance.toLowerCase()}`}>{provider.performance}</span></div></td>
                <td data-label="Registered">{formatDate(provider.registered_at)}</td>
                <td className="row-actions"><button className="review-button" type="button" onClick={() => void openProvider(provider.id)}><MdiIcon path={mdiArrowRight} /> Details</button></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
        <footer className="table-footer"><span>Showing {showingStart}–{showingEnd} of {directory?.total || 0} providers</span><div><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page"><MdiIcon path={mdiChevronLeft} /></button><b>{directory?.page || page} / {totalPages}</b><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><MdiIcon path={mdiChevronRight} /></button></div></footer>
      </section>

      {(detailLoading || selected || detailError) && <ProviderDetailModal
        detail={selected}
        loading={detailLoading}
        error={detailError}
        canApprove={!readOnly && can('providers.approve')}
        canReject={!readOnly && can('providers.reject')}
        canReview={!readOnly && can('providers.review')}
        onClose={() => { setSelected(null); setDetailError('') }}
        onApprove={() => void updateProviderStatus('verified')}
        onDecline={(reason) => void updateProviderStatus('disabled', reason)}
      />}
    </div>
  )
}

function ProviderDetailModal({ detail, loading, error, canApprove, canReject, canReview, onClose, onApprove, onDecline }: {
  detail: ProviderDetail | null
  loading: boolean
  error: string
  canApprove: boolean
  canReject: boolean
  canReview: boolean
  onClose: () => void
  onApprove: () => void
  onDecline: (reason: string) => void
}) {
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const provider = detail?.provider
  const reviewable = provider && ['pending', 'disabled'].includes(provider.verification_status)
  const termsCurrent = Boolean(provider?.terms_accepted && provider?.terms_version === '2026-09-25-commission-v1')

  return (
    <div className="modal-backdrop provider-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="provider-detail-modal" role="dialog" aria-modal="true" aria-labelledby="provider-detail-title">
        <header><button onClick={onClose} aria-label="Close provider details"><MdiIcon path={mdiClose} /></button><div><span className="eyebrow">SERVICE PROVIDER</span><h2 id="provider-detail-title">{provider?.business_name || (loading ? 'Loading provider…' : 'Provider details')}</h2></div>{provider && <StatusBadge value={provider.verification_status} />}</header>
        {loading && <TableSkeleton rows={5} />}
        {error && <InlineError message={error} onClose={onClose} />}
        {detail && provider && (
          <div className="provider-detail-modal__body">
            <section className="provider-detail-hero">
              <div className="provider-detail-identity"><span><MdiIcon path={mdiStorefrontOutline} /></span><div><strong>{provider.business_name}</strong><p>{provider.full_name || 'Provider account'} · {provider.location || 'Location not supplied'}</p></div></div>
              <div className="provider-detail-contact"><span>{provider.email || 'No email supplied'}</span><span>{provider.phone || 'No phone supplied'}</span><span>Registered {formatDate(provider.registered_at)}</span></div>
            </section>

            <section className="provider-summary-grid">
              <Metric label="Active services" value={detail.summary.active_services} /><Metric label="Valid bookings" value={detail.summary.valid_bookings} /><Metric label="Confirmed" value={detail.summary.confirmed_bookings} /><Metric label="Average rating" value={detail.summary.review_count ? detail.summary.average_rating.toFixed(1) : '—'} detail={detail.summary.review_count ? `${detail.summary.review_count} reviews` : 'No reviews yet'} />
            </section>

            <section className="provider-detail-section"><div className="provider-detail-section__heading"><div><span className="detail-label">BUSINESS PROFILE</span><h3>About this provider</h3></div><div className="category-tag-list">{detail.categories.map((category) => <span key={category.id}>{category.name}</span>)}</div></div><p>{provider.description || 'No business description was supplied.'}</p></section>

            <section className="provider-detail-section"><div className="provider-detail-section__heading"><div><span className="detail-label">SERVICES OFFERED</span><h3>Live service portfolio</h3></div><span className="table-muted">{detail.services.length} services</span></div>{detail.services.length ? <div className="provider-service-list">{detail.services.map((service) => <article key={service.id}><div><strong>{service.name}</strong><small>{service.category_name || 'Uncategorized'} · {service.location || 'Location not supplied'}</small></div><span>{service.base_price ? formatMoney(service.base_price) : 'Custom quote'}</span><span><StatusBadge value={service.status} />{!service.is_available && <small>Unavailable</small>}</span><span>{service.confirmed_bookings} confirmed</span></article>)}</div> : <EmptyState title="No services listed" copy="This provider has not created any services yet." />}</section>

            <section className="provider-detail-section"><div className="provider-detail-section__heading"><div><span className="detail-label">RATINGS & FEEDBACK</span><h3>Recent client reviews</h3></div><span className="provider-rating">{ratingCopy(detail.summary.average_rating, detail.summary.review_count)}</span></div>{detail.recent_reviews.length ? <div className="provider-review-list">{detail.recent_reviews.map((review) => <article key={review.id}><div><span className="rating">★ {review.rating.toFixed(1)}</span><strong>{review.service_name}</strong><small>{formatDate(review.created_at)}</small></div><p>{review.comment || 'No written feedback.'}</p>{review.sentiment && <StatusBadge value={review.sentiment} />}</article>)}</div> : <EmptyState title="No customer reviews yet" copy="Service feedback will appear here after completed bookings are reviewed." />}</section>

            {provider.rejection_reason && <section className="previous-note"><strong>Previous decision note</strong><p>{provider.rejection_reason}</p></section>}
            {reviewable && !termsCurrent && <div className="inline-warning"><MdiIcon path={mdiStarOutline} /><span>This provider cannot be approved until the current commission agreement is accepted.</span></div>}
            {declining && <section className="provider-decision-form"><label><span>Reason for declining this provider</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Briefly explain the decision…" /></label><div><button className="secondary-button" type="button" onClick={() => { setDeclining(false); setReason('') }}>Cancel</button><button className="decline-button" type="button" disabled={!reason.trim()} onClick={() => onDecline(reason.trim())}>Confirm decline</button></div></section>}
          </div>
        )}
        {detail && provider && <footer><button className="secondary-button" type="button" onClick={onClose}>Close</button>{reviewable && canReview && !declining && <div>{canReject && <button className="decline-button" type="button" onClick={() => setDeclining(true)}><MdiIcon path={mdiClose} /> Decline</button>}{canApprove && <button className="approve-button" type="button" disabled={!termsCurrent} onClick={() => { if (window.confirm(`Approve ${provider.business_name} as a verified provider?`)) onApprove() }}><MdiIcon path={mdiCheck} /> Approve provider</button>}</div>}</footer>}
      </section>
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <article><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>
}

function ratingCopy(rating: number, reviews: number) {
  if (!reviews) return <span className="table-muted">No reviews</span>
  return <><MdiIcon path={mdiStarOutline} /> {Number(rating || 0).toFixed(1)} <small>({reviews}{reviews < 3 ? ', emerging' : ''})</small></>
}

function categoryNames(categories: Category[]) {
  if (!categories.length) return 'No active category'
  return categories.map((category) => category.name).join(', ')
}

function isDirectory(value: unknown): value is ProviderDirectory {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<ProviderDirectory>
  return Array.isArray(row.categories) && Array.isArray(row.top_providers) && Array.isArray(row.providers) && typeof row.total === 'number'
}

function isProviderDetail(value: unknown): value is ProviderDetail {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<ProviderDetail>
  return Boolean(row.provider && row.summary && Array.isArray(row.categories) && Array.isArray(row.services) && Array.isArray(row.recent_reviews))
}
