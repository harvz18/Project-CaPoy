'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  mdiAccountTieOutline,
  mdiCakeVariantOutline,
  mdiCameraOutline,
  mdiClipboardTextOutline,
  mdiFlowerOutline,
  mdiFormatListBulletedType,
  mdiMapMarkerOutline,
  mdiMicrophoneOutline,
  mdiMusicNoteOutline,
  mdiPaletteOutline,
  mdiRefresh,
  mdiSilverwareForkKnife,
  mdiStarOutline,
  mdiTshirtCrewOutline,
} from '@mdi/js'
import { MdiIcon } from '@/components/icons'
import { useDashboardControls } from '@/components/dashboard-shell'
import { EmptyState, formatMoney, InlineError, SegmentedFilter, StatusBadge, TableSkeleton } from '@/components/ui'
import { getSupabase } from '@/lib/supabase'

type DateRange = 'day' | '3days' | 'week' | 'month'
type CategoryMetric = {
  id: string
  name: string
  description: string | null
  icon_name: string | null
  is_active: boolean
  active_services: number
  providers: number
  valid_bookings: number
  completed_bookings: number
  platform_revenue: number
  average_rating: number
  review_count: number
}
type CategoryPerformance = {
  range: { key: DateRange; label: string; event_type: string | null }
  categories: CategoryMetric[]
}
type CategoryProvider = {
  id: string
  business_name: string
  verification_status: string
  services: number
  active_services: number
  valid_bookings: number
  completed_bookings: number
  platform_revenue: number
  average_rating: number
  review_count: number
}
type CategoryService = {
  id: string
  name: string
  status: string
  base_price: number | null
  provider_id: string
  provider_name: string
  valid_bookings: number
  completed_bookings: number
  platform_revenue: number
  average_rating: number
  review_count: number
}
type CategoryDetail = {
  range: { key: DateRange; label: string; event_type: string | null }
  category: CategoryMetric & { services: number }
  booking_activity: Array<{ status: string; count: number }>
  providers: CategoryProvider[]
  services: CategoryService[]
}

const dateRangeOptions: ReadonlyArray<readonly [DateRange, string]> = [
  ['day', '1 Day'],
  ['3days', '3 Days'],
  ['week', '1 Week'],
  ['month', '1 Month'],
]

export function CategoryPerformanceScreen() {
  const searchParams = useSearchParams()
  const { eventType, liveDataVersion } = useDashboardControls()
  const [range, setRange] = useState<DateRange>(() => dateRangeFromQuery(searchParams.get('range')))
  const [performance, setPerformance] = useState<CategoryPerformance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [detail, setDetail] = useState<CategoryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const categoryId = searchParams.get('category') || ''

  useEffect(() => {
    let active = true
    async function loadPerformance() {
      const supabase = getSupabase()
      if (!supabase) {
        if (active) {
          setError('Supabase is not configured for this deployment.')
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setError('')
      const { data, error: requestError } = await supabase.rpc('get_admin_category_performance', {
        p_range: range,
        p_event_type: eventType === 'all' ? null : eventType,
      })
      if (!active) return
      if (requestError) setError(requestError.message)
      else if (!isCategoryPerformance(data)) setError('Category performance returned an unexpected response. Refresh after the Phase 5 migration is available.')
      else setPerformance(data)
      setLoading(false)
    }

    void loadPerformance()
    return () => { active = false }
  }, [eventType, liveDataVersion, range, refreshKey])

  useEffect(() => {
    let active = true
    if (!categoryId) {
      const timer = window.setTimeout(() => {
        if (!active) return
        setDetail(null)
        setDetailError('')
        setDetailLoading(false)
      }, 0)
      return () => { active = false; window.clearTimeout(timer) }
    }

    async function loadDetail() {
      const supabase = getSupabase()
      if (!supabase) {
        if (active) {
          setDetailError('Supabase is not configured for this deployment.')
          setDetailLoading(false)
        }
        return
      }

      setDetailLoading(true)
      setDetailError('')
      setDetail(null)
      const { data, error: requestError } = await supabase.rpc('get_admin_category_performance_detail', {
        p_category_id: categoryId,
        p_range: range,
        p_event_type: eventType === 'all' ? null : eventType,
      })
      if (!active) return
      if (requestError) setDetailError(requestError.message)
      else if (!isCategoryDetail(data)) setDetailError('Category details returned an unexpected response.')
      else setDetail(data)
      setDetailLoading(false)
    }

    void loadDetail()
    return () => { active = false }
  }, [categoryId, eventType, liveDataVersion, range])

  const scopeCopy = useMemo(() => {
    const eventCopy = eventType === 'all' ? 'all event types' : eventType
    return `${performance?.range.label || dateRangeOptions.find(([value]) => value === range)?.[1] || 'Selected period'} · ${eventCopy}`
  }, [eventType, performance?.range.label, range])

  return (
    <div className="screen-stack category-performance-screen">
      <section className="page-heading page-heading--with-action">
        <div><span className="eyebrow">MARKETPLACE ANALYTICS</span><h1>Category performance</h1><p>Valid service bookings and recognized MULTIVENT platform revenue, attributed to each booked service category.</p></div>
        <div className="overview-heading-actions">
          <SegmentedFilter ariaLabel="Category reporting date range" options={dateRangeOptions} value={range} onChange={(value) => setRange(value as DateRange)} className="dashboard-range-filter" />
          <button className="secondary-button" type="button" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}><MdiIcon path={mdiRefresh} />{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </section>

      {error && <InlineError message={error} onClose={() => setError('')} />}

      <section className="category-performance-panel" aria-busy={loading}>
        <header className="category-performance-panel__header"><div><span className="eyebrow">CONFIGURED SERVICE CATEGORIES</span><h2>Marketplace activity by category</h2><p>{scopeCopy}. Revenue is paid or verified booking-payment commission only.</p></div><span className="category-performance-panel__count">{performance?.categories.length || 0} categories</span></header>
        {loading && !performance ? <div className="category-performance-loading"><TableSkeleton rows={6} /></div> : !performance?.categories.length ? <EmptyState title="No service categories found" copy="Configured MULTIVENT service categories will appear here when they are available." /> : <div className="category-performance-grid">{performance.categories.map((category) => <Link key={category.id} className="category-performance-card" href={`/dashboard/categories?category=${encodeURIComponent(category.id)}&range=${range}`}>
          <span className="category-performance-card__icon"><MdiIcon path={categoryIcon(category.icon_name, category.name)} /></span>
          <span className="category-performance-card__heading"><strong>{category.name}</strong>{!category.is_active && <small>Inactive</small>}</span>
          <span className="category-performance-card__metrics"><span><small>Valid bookings</small><b>{category.valid_bookings.toLocaleString()}</b></span><span><small>Platform revenue</small><b>{formatMoney(category.platform_revenue)}</b></span></span>
          <span className="category-performance-card__footer"><span>{category.active_services.toLocaleString()} active services · {category.providers.toLocaleString()} providers</span><span>View details</span></span>
        </Link>)}</div>}
      </section>

      {categoryId && <CategoryDetailPanel detail={detail} loading={detailLoading} error={detailError} range={range} />}
    </div>
  )
}

function CategoryDetailPanel({ detail, loading, error, range }: { detail: CategoryDetail | null; loading: boolean; error: string; range: DateRange }) {
  if (loading) return <section className="panel category-detail-panel" aria-busy="true"><TableSkeleton rows={8} /></section>
  if (error) return <section className="panel category-detail-panel"><InlineError message={error} /></section>
  if (!detail) return null

  const category = detail.category
  return <section className="panel category-detail-panel">
    <header className="category-detail-panel__header"><div className="category-detail-title"><span className="category-performance-card__icon"><MdiIcon path={categoryIcon(category.icon_name, category.name)} /></span><div><span className="eyebrow">CATEGORY DETAILS</span><h2>{category.name}</h2><p>{category.description || 'No category description has been configured.'}</p></div></div><Link className="secondary-button" href={`/dashboard/categories?range=${range}`}>Close details</Link></header>

    <div className="category-detail-metrics">
      <MetricCard label="Valid bookings" value={category.valid_bookings.toLocaleString()} copy={`${category.completed_bookings.toLocaleString()} completed`} />
      <MetricCard label="Platform revenue" value={formatMoney(category.platform_revenue)} copy="Paid or verified commission" />
      <MetricCard label="Active services" value={category.active_services.toLocaleString()} copy={`${category.services.toLocaleString()} total listings`} />
      <MetricCard label="Providers" value={category.providers.toLocaleString()} copy="With active category services" />
      <MetricCard label="Average rating" value={category.review_count ? category.average_rating.toFixed(1) : '—'} copy={category.review_count ? `${category.review_count.toLocaleString()} completed-booking reviews` : 'No eligible reviews'} />
    </div>

    <div className="category-booking-activity"><div><span className="eyebrow">BOOKING ACTIVITY</span><p>All recorded statuses for this category in the selected scope.</p></div><div>{detail.booking_activity.length ? detail.booking_activity.map((item) => <span key={item.status}><StatusBadge value={item.status} /><b>{item.count.toLocaleString()}</b></span>) : <small>No booking activity in this scope.</small>}</div></div>

    <div className="category-detail-grid">
      <section><header><div><span className="eyebrow">PROVIDERS</span><h3>Category providers</h3></div><small>Top {detail.providers.length} by valid bookings</small></header>{detail.providers.length ? <div className="table-scroll"><table className="data-table category-detail-table"><thead><tr><th>Provider</th><th>Services</th><th>Bookings</th><th>Platform revenue</th><th>Rating</th></tr></thead><tbody>{detail.providers.map((provider) => <tr key={provider.id}><td data-label="Provider"><Link className="table-link" href={`/dashboard/providers?provider=${encodeURIComponent(provider.id)}`}><strong>{provider.business_name}</strong><small>{provider.verification_status}</small></Link></td><td data-label="Services">{provider.active_services.toLocaleString()} active <small className="table-subcopy">{provider.services.toLocaleString()} total</small></td><td data-label="Bookings">{provider.valid_bookings.toLocaleString()} valid <small className="table-subcopy">{provider.completed_bookings.toLocaleString()} completed</small></td><td data-label="Platform revenue">{formatMoney(provider.platform_revenue)}</td><td data-label="Rating">{provider.review_count ? <span className="provider-rating"><MdiIcon path={mdiStarOutline} /> {provider.average_rating.toFixed(1)} <small>({provider.review_count})</small></span> : <small className="table-muted">No reviews</small>}</td></tr>)}</tbody></table></div> : <EmptyState title="No providers in this scope" copy="Providers with services in this category will appear here." />}</section>

      <section><header><div><span className="eyebrow">SERVICES</span><h3>Category services</h3></div><small>Top {detail.services.length} by valid bookings</small></header>{detail.services.length ? <div className="table-scroll"><table className="data-table category-detail-table"><thead><tr><th>Service</th><th>Provider</th><th>Status</th><th>Bookings</th><th>Platform revenue</th></tr></thead><tbody>{detail.services.map((service) => <tr key={service.id}><td data-label="Service"><strong>{service.name}</strong>{service.base_price != null && <small className="table-subcopy">From {formatMoney(service.base_price)}</small>}</td><td data-label="Provider"><Link className="table-link" href={`/dashboard/providers?provider=${encodeURIComponent(service.provider_id)}`}>{service.provider_name}</Link></td><td data-label="Status"><StatusBadge value={service.status} /></td><td data-label="Bookings">{service.valid_bookings.toLocaleString()} valid <small className="table-subcopy">{service.completed_bookings.toLocaleString()} completed</small></td><td data-label="Platform revenue">{formatMoney(service.platform_revenue)}</td></tr>)}</tbody></table></div> : <EmptyState title="No services in this category" copy="Service listings for this configured category will appear here." />}</section>
    </div>
  </section>
}

function MetricCard({ label, value, copy }: { label: string; value: string; copy: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{copy}</small></article>
}

function categoryIcon(iconName: string | null, categoryName: string) {
  const source = `${iconName || ''} ${categoryName}`.toLowerCase()
  if (source.includes('venue') || source.includes('estate') || source.includes('map')) return mdiMapMarkerOutline
  if (source.includes('cater') || source.includes('utensil') || source.includes('food')) return mdiSilverwareForkKnife
  if (source.includes('photo') || source.includes('video') || source.includes('camera')) return mdiCameraOutline
  if (source.includes('flor') || source.includes('flower')) return mdiFlowerOutline
  if (source.includes('attire') || source.includes('gown') || source.includes('shirt')) return mdiTshirtCrewOutline
  if (source.includes('organizer') || source.includes('coordinator') || source.includes('clipboard')) return mdiClipboardTextOutline
  if (source.includes('sound') || source.includes('light') || source.includes('music')) return mdiMusicNoteOutline
  if (source.includes('host') || source.includes('emcee') || source.includes('mic')) return mdiMicrophoneOutline
  if (source.includes('cake')) return mdiCakeVariantOutline
  if (source.includes('makeup') || source.includes('beauty') || source.includes('palette')) return mdiPaletteOutline
  if (source.includes('event')) return mdiAccountTieOutline
  return mdiFormatListBulletedType
}

function dateRangeFromQuery(value: string | null): DateRange {
  return value === 'day' || value === '3days' || value === 'week' || value === 'month' ? value : 'month'
}
function isCategoryPerformance(value: unknown): value is CategoryPerformance {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<CategoryPerformance>
  return Boolean(row.range && Array.isArray(row.categories))
}
function isCategoryDetail(value: unknown): value is CategoryDetail {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<CategoryDetail>
  return Boolean(row.range && row.category && Array.isArray(row.booking_activity) && Array.isArray(row.providers) && Array.isArray(row.services))
}
