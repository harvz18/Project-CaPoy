'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  mdiAccountGroupOutline,
  mdiAccountTieOutline,
  mdiArrowRight,
  mdiCakeVariantOutline,
  mdiCalendarCheckOutline,
  mdiCameraOutline,
  mdiCashMultiple,
  mdiChartDonutVariant,
  mdiCheckDecagramOutline,
  mdiClipboardTextOutline,
  mdiClipboardTextClockOutline,
  mdiCogOutline,
  mdiEyeOutline,
  mdiFlowerOutline,
  mdiFormatListBulletedType,
  mdiImageMultipleOutline,
  mdiMapMarkerOutline,
  mdiMicrophoneOutline,
  mdiMusicNoteOutline,
  mdiPackageVariantClosed,
  mdiPaletteOutline,
  mdiRefresh,
  mdiShieldAccountOutline,
  mdiShieldCrownOutline,
  mdiSilverwareForkKnife,
  mdiStarOutline,
  mdiStorefrontCheckOutline,
  mdiStoreCheckOutline,
  mdiTshirtCrewOutline,
} from '@mdi/js'
import Link from 'next/link'
import { MdiIcon } from '@/components/icons'
import { formatDate, formatMoney, SegmentedFilter, StatusBadge } from '@/components/ui'
import { useDashboardControls, useStaff } from '@/components/dashboard-shell'
import { getSupabase } from '@/lib/supabase'
import { InsightCards, type DashboardInsights } from './insights-screen'

type DateRange = 'day' | '3days' | 'week' | 'month'
type PeriodMetric = { current: number; previous: number }
type ActionCounts = {
  pending_providers: number
  pending_services: number
  pending_payments: number
  negative_reviews: number
  active_support_tickets: number
  urgent_support_tickets: number
  unassigned_events: number
}
type RecentBooking = { id: string; status: string; amount: number; created_at: string; event_name: string; provider_name: string }
type ChartPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'
type ChartPoint = { key: string; label: string; platform_revenue: number; gross_transaction_volume: number; bookings: number }
type ChartCategory = { id: string; name: string; bookings: number }
type Choice = { id: string; name: string }
type DashboardReview = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  sentiment: string | null
  analysis_status: string
  provider_name: string
  service_name: string
  cover_image_url: string | null
  category_name: string
}
type DashboardProvider = {
  rank: number
  id: string
  business_name: string
  cover_image_url: string | null
  categories: Choice[]
  average_rating: number
  review_count: number
  platform_revenue: number
  valid_bookings: number
  confirmed_bookings: number
  completed_bookings: number
  performance: string
  verification_status: string
}
type PhaseFourDashboard = {
  generated_at: string
  categories: Choice[]
  ranking_method: string
  top_providers: DashboardProvider[]
  recent_reviews: DashboardReview[]
}
type CategoryPerformanceMetric = {
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
type PhaseFiveDashboard = {
  range: { key: DateRange; label: string; event_type: string | null }
  categories: CategoryPerformanceMetric[]
}
type ChartAnalytics = {
  generated_at: string
  range: { period: ChartPeriod; label: string; selected_year: number; start: string; end: string; event_type: string | null }
  series: ChartPoint[]
  categories: ChartCategory[]
  totals: { bookings: number; platform_revenue: number; gross_transaction_volume: number }
  available_years: number[]
}

type DashboardAnalytics = {
  generated_at: string
  range: { key: DateRange; label: string; start: string; end: string }
  kpis: {
    providers: { total: number; active: number; verified: number; pending: number; current: number; previous: number }
    clients: { total: number; active: number }
    bookings: { total: number; current: number; previous: number }
    valid_bookings: PeriodMetric
    confirmed_bookings: { current: number }
    platform_revenue: PeriodMetric
    monthly_platform_revenue: PeriodMetric
    average_rating: { value: number; review_count: number; current: number; previous: number }
    pending_applications: { current: number; providers: number; coordinators: number; services: number }
  }
  financial_summary: {
    gross_booking_value: number
    recognized_platform_revenue: number
    pending_collections: number
    pending_collection_count: number
  }
  booking_trend: unknown[]
  revenue_trend: unknown[]
  booking_statuses: unknown[]
  popular_categories: unknown[]
  action_counts: ActionCounts
  recent_bookings: RecentBooking[]
}

const dateRangeOptions: ReadonlyArray<readonly [DateRange, string]> = [
  ['day', '1 Day'],
  ['3days', '3 Days'],
  ['week', '1 Week'],
  ['month', '1 Month'],
]

const chartPeriodOptions: ReadonlyArray<readonly [ChartPeriod, string]> = [
  ['daily', 'Daily'],
  ['weekly', 'Weekly'],
  ['monthly', 'Monthly'],
  ['yearly', 'Yearly'],
]

const emptyActions: ActionCounts = {
  pending_providers: 0,
  pending_services: 0,
  pending_payments: 0,
  negative_reviews: 0,
  active_support_tickets: 0,
  urgent_support_tickets: 0,
  unassigned_events: 0,
}

export function OverviewScreen() {
  const { can, canAccessRoute, profile } = useStaff()
  const { eventType, liveDataVersion } = useDashboardControls()
  const hasWorkspaceOverview = canAccessRoute('overview')
  const hasAnalytics = can('dashboard.analytics.view')
  const [dateRange, setDateRange] = useState<DateRange>('week')
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [actions, setActions] = useState<ActionCounts>(emptyActions)
  const [activity, setActivity] = useState<RecentBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('monthly')
  const [chartYear, setChartYear] = useState(() => new Date().getFullYear())
  const [chartAnalytics, setChartAnalytics] = useState<ChartAnalytics | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState('')
  const [providerCategoryId, setProviderCategoryId] = useState('all')
  const [phaseFour, setPhaseFour] = useState<PhaseFourDashboard | null>(null)
  const [phaseFourLoading, setPhaseFourLoading] = useState(false)
  const [phaseFourError, setPhaseFourError] = useState('')
  const [phaseFive, setPhaseFive] = useState<PhaseFiveDashboard | null>(null)
  const [phaseFiveLoading, setPhaseFiveLoading] = useState(false)
  const [phaseFiveError, setPhaseFiveError] = useState('')
  const [phaseSix, setPhaseSix] = useState<DashboardInsights | null>(null)
  const [phaseSixLoading, setPhaseSixLoading] = useState(false)
  const [phaseSixError, setPhaseSixError] = useState('')

  useEffect(() => {
    const supabase = getSupabase()
    let active = true

    if (!hasWorkspaceOverview) {
      return
    }

    async function loadDashboard() {
      await Promise.resolve()
      if (!active) return
      if (!supabase) {
        setError('Supabase is not configured for this deployment.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      if (hasAnalytics) {
        const { data, error: analyticsError } = await supabase.rpc('get_admin_dashboard_analytics', {
          p_range: dateRange,
          p_event_type: eventType === 'all' ? null : eventType,
        })
        if (!active) return
        if (analyticsError) {
          setError(analyticsError.message)
          setLoading(false)
          return
        }
        if (!isDashboardAnalytics(data)) {
          setError('Live dashboard analytics returned an unexpected response. Refresh after the dashboard analytics migration is available.')
          setLoading(false)
          return
        }

        setAnalytics(data)
        setActions(data.action_counts || emptyActions)
        setActivity(Array.isArray(data.recent_bookings) ? data.recent_bookings : [])
        setLoading(false)
        return
      }

      // Staff without analytics permission retain a small, permission-scoped
      // operational home. No analytics RPC or raw reporting data is loaded.
      const [providers, services, payments, reviews, support, coordinators, recent] = await Promise.all([
        can('providers.review')
          ? supabase.from('provider_profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending')
          : Promise.resolve({ count: 0, error: null }),
        can('services.review')
          ? supabase.from('services').select('*', { count: 'exact', head: true }).eq('status', 'pending_review')
          : Promise.resolve({ count: 0, error: null }),
        can('cashflow.view')
          ? supabase.from('payments').select('*', { count: 'exact', head: true }).in('status', ['pending', 'processing'])
          : Promise.resolve({ count: 0, error: null }),
        can('providers.view')
          ? supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('sentiment_label', 'negative')
          : Promise.resolve({ count: 0, error: null }),
        can('support.view')
          ? supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress', 'waiting_for_user'])
          : Promise.resolve({ count: 0, error: null }),
        can('coordinators.view')
          ? supabase.from('events').select('*', { count: 'exact', head: true }).eq('coordinator_assignment_status', 'awaiting_assignment').not('status', 'in', '(completed,cancelled)')
          : Promise.resolve({ count: 0, error: null }),
        can('events.view')
          ? supabase.from('bookings').select('id,status,amount,created_at,events(name),provider_profiles(business_name)').order('created_at', { ascending: false }).limit(5)
          : Promise.resolve({ data: [], error: null }),
      ])
      if (!active) return

      const requestError = [providers, services, payments, reviews, support, coordinators, recent]
        .find((result) => result.error)?.error
      if (requestError) setError(requestError.message)
      setActions({
        pending_providers: providers.count || 0,
        pending_services: services.count || 0,
        pending_payments: payments.count || 0,
        negative_reviews: reviews.count || 0,
        active_support_tickets: support.count || 0,
        urgent_support_tickets: 0,
        unassigned_events: coordinators.count || 0,
      })
      setActivity((recent.data || []).map((booking) => ({
        id: booking.id,
        status: booking.status,
        amount: Number(booking.amount || 0),
        created_at: booking.created_at,
        event_name: relationName(booking.events, 'name', 'Event'),
        provider_name: relationName(booking.provider_profiles, 'business_name', 'Service provider'),
      })))
      setLoading(false)
    }

    void loadDashboard()
    return () => { active = false }
  }, [can, dateRange, eventType, hasAnalytics, hasWorkspaceOverview, liveDataVersion, refreshKey])

  useEffect(() => {
    const supabase = getSupabase()
    let active = true

    if (!hasWorkspaceOverview || !hasAnalytics) {
      return () => { active = false }
    }

    async function loadCharts() {
      if (!supabase) {
        if (active) {
          setChartError('Supabase is not configured for this deployment.')
          setChartLoading(false)
        }
        return
      }

      setChartLoading(true)
      setChartError('')
      const { data, error: chartRequestError } = await supabase.rpc('get_admin_dashboard_chart_analytics', {
        p_period: chartPeriod,
        p_year: chartYear,
        p_event_type: eventType === 'all' ? null : eventType,
      })
      if (!active) return
      if (chartRequestError) {
        setChartError(chartRequestError.message)
        setChartLoading(false)
        return
      }
      if (!isChartAnalytics(data)) {
        setChartError('Live chart analytics returned an unexpected response. Refresh after the Phase 3 dashboard migration is available.')
        setChartLoading(false)
        return
      }

      setChartAnalytics(data)
      setChartLoading(false)
    }

    void loadCharts()
    return () => { active = false }
  }, [chartPeriod, chartYear, eventType, hasAnalytics, hasWorkspaceOverview, liveDataVersion, refreshKey])

  useEffect(() => {
    const supabase = getSupabase()
    let active = true

    if (!hasWorkspaceOverview || !hasAnalytics) return () => { active = false }

    async function loadPhaseFourDashboard() {
      if (!supabase) {
        if (active) {
          setPhaseFourError('Supabase is not configured for this deployment.')
          setPhaseFourLoading(false)
        }
        return
      }

      setPhaseFourLoading(true)
      setPhaseFourError('')
      const { data, error: phaseFourRequestError } = await supabase.rpc('get_admin_dashboard_phase4', {
        p_category_id: providerCategoryId === 'all' ? null : providerCategoryId,
        p_event_type: eventType === 'all' ? null : eventType,
      })
      if (!active) return
      if (phaseFourRequestError) {
        setPhaseFourError(phaseFourRequestError.message)
        setPhaseFourLoading(false)
        return
      }
      if (!isPhaseFourDashboard(data)) {
        setPhaseFourError('Live review and provider analytics returned an unexpected response. Refresh after the Phase 4 dashboard migration is available.')
        setPhaseFourLoading(false)
        return
      }

      setPhaseFour(data)
      setPhaseFourLoading(false)
    }

    void loadPhaseFourDashboard()
    return () => { active = false }
  }, [eventType, hasAnalytics, hasWorkspaceOverview, liveDataVersion, providerCategoryId, refreshKey])

  useEffect(() => {
    const supabase = getSupabase()
    let active = true

    if (!hasWorkspaceOverview || !hasAnalytics) return () => { active = false }

    async function loadPhaseFiveDashboard() {
      if (!supabase) {
        if (active) {
          setPhaseFiveError('Supabase is not configured for this deployment.')
          setPhaseFiveLoading(false)
        }
        return
      }

      setPhaseFiveLoading(true)
      setPhaseFiveError('')
      const { data, error: phaseFiveRequestError } = await supabase.rpc('get_admin_category_performance', {
        p_range: dateRange,
        p_event_type: eventType === 'all' ? null : eventType,
      })
      if (!active) return
      if (phaseFiveRequestError) {
        setPhaseFiveError(phaseFiveRequestError.message)
        setPhaseFiveLoading(false)
        return
      }
      if (!isPhaseFiveDashboard(data)) {
        setPhaseFiveError('Live category performance returned an unexpected response. Refresh after the Phase 5 dashboard migration is available.')
        setPhaseFiveLoading(false)
        return
      }

      setPhaseFive(data)
      setPhaseFiveLoading(false)
    }

    void loadPhaseFiveDashboard()
    return () => { active = false }
  }, [dateRange, eventType, hasAnalytics, hasWorkspaceOverview, liveDataVersion, refreshKey])

  useEffect(() => {
    const supabase = getSupabase()
    let active = true

    if (!hasWorkspaceOverview || !hasAnalytics) return () => { active = false }

    async function loadPhaseSixInsights() {
      if (!supabase) {
        if (active) {
          setPhaseSixError('Supabase is not configured for this deployment.')
          setPhaseSixLoading(false)
        }
        return
      }

      setPhaseSixLoading(true)
      setPhaseSixError('')
      const { data, error: phaseSixRequestError } = await supabase.rpc('get_admin_dashboard_insights', {
        p_event_type: eventType === 'all' ? null : eventType,
      })
      if (!active) return
      if (phaseSixRequestError) {
        setPhaseSixError(phaseSixRequestError.message)
        setPhaseSixLoading(false)
        return
      }
      if (!isDashboardInsights(data)) {
        setPhaseSixError('Live decision support returned an unexpected response. Refresh after the Phase 6 dashboard migration is available.')
        setPhaseSixLoading(false)
        return
      }

      setPhaseSix(data)
      setPhaseSixLoading(false)
    }

    void loadPhaseSixInsights()
    return () => { active = false }
  }, [eventType, hasAnalytics, hasWorkspaceOverview, liveDataVersion, refreshKey])

  const stats = analytics ? [
    { label: 'Total providers', value: analytics.kpis.providers.total.toLocaleString(), detail: providerPeriodComparison(analytics.kpis.providers, analytics.range.label), icon: mdiStorefrontCheckOutline, tone: 'wine' },
    { label: 'Active providers', value: analytics.kpis.providers.active.toLocaleString(), detail: `${analytics.kpis.providers.verified.toLocaleString()} verified marketplace accounts`, icon: mdiAccountGroupOutline, tone: 'gold' },
    { label: 'Total bookings', value: analytics.kpis.bookings.total.toLocaleString(), detail: periodComparison(analytics.kpis.bookings, analytics.range.label), icon: mdiCalendarCheckOutline, tone: 'blue' },
    { label: 'Monthly revenue', value: formatMoney(analytics.kpis.monthly_platform_revenue.current), detail: periodComparison(analytics.kpis.monthly_platform_revenue, 'month', true), icon: mdiCashMultiple, tone: 'green' },
    { label: 'Average rating', value: analytics.kpis.average_rating.review_count ? analytics.kpis.average_rating.value.toFixed(1) : '—', detail: ratingPeriodComparison(analytics.kpis.average_rating, analytics.range.label), icon: mdiStarOutline, tone: 'gold' },
    { label: 'Pending approvals', value: analytics.kpis.pending_applications.current.toLocaleString(), detail: `${analytics.kpis.pending_applications.providers} provider · ${analytics.kpis.pending_applications.coordinators} coordinator · ${analytics.kpis.pending_applications.services} service`, icon: mdiClipboardTextClockOutline, tone: 'wine' },
  ] : []

  const actionCount = (can('providers.review') ? actions.pending_providers : 0)
    + (can('services.review') ? actions.pending_services : 0)
    + (can('cashflow.view') ? actions.pending_payments : 0)
    + (can('providers.view') ? actions.negative_reviews : 0)
    + (can('support.view') ? actions.active_support_tickets : 0)
    + (can('coordinators.view') ? actions.unassigned_events : 0)

  const chartYears = useMemo(() => {
    const years = new Set(chartAnalytics?.available_years?.filter((year) => Number.isInteger(year)) || [])
    years.add(chartYear)
    return [...years].sort((left, right) => right - left)
  }, [chartAnalytics?.available_years, chartYear])
  const selectedProviderCategory = phaseFour?.categories.find((category) => category.id === providerCategoryId)?.name || 'All categories'

  if (!hasWorkspaceOverview) return <GovernanceHomeScreen />

  const isAdminWorkspace = profile.default_role === 'admin'

  return (
    <div className="screen-stack">
      <section className="page-heading page-heading--with-action">
        <div>
          <span className="eyebrow">ADMIN WORKSPACE</span>
          <h1>Dashboard Overview</h1>
          <p>{hasAnalytics ? 'Monitor MULTIVENT’s services, bookings, providers, and business performance.' : 'Review the work and account activity available to your role.'}</p>
        </div>
        <div className="overview-heading-actions">
          {hasAnalytics && <SegmentedFilter ariaLabel="Dashboard date range" options={dateRangeOptions} value={dateRange} onChange={(value) => setDateRange(value as DateRange)} className="dashboard-range-filter" />}
          <button className="secondary-button" type="button" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}>
            <MdiIcon path={mdiRefresh} />{loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </section>

      {error && <div className="dashboard-error" role="alert"><strong>Dashboard data could not be loaded.</strong><span>{error}</span></div>}

      {hasAnalytics && (
        <section className="stat-grid analytics-stat-grid" aria-busy={loading}>
          {stats.map((stat) => (
            <article className="stat-card" key={stat.label}>
              <span className={`stat-card__icon stat-card__icon--${stat.tone}`}><MdiIcon path={stat.icon} /></span>
              <div><p>{stat.label}</p><strong>{stat.value}</strong><small>{stat.detail}</small></div>
            </article>
          ))}
          {loading && !analytics && <div className="activity-empty analytics-loading">Loading verified business metrics…</div>}
        </section>
      )}

      {hasAnalytics && (
        <section className="phase-three-chart-grid" aria-busy={chartLoading}>
          <article className="panel phase-three-revenue-panel">
            <header className="phase-three-chart-header">
              <div>
                <span className="eyebrow">REVENUE OVERVIEW</span>
                <h2>Revenue and booking trends</h2>
                <p>Bars show recognized MULTIVENT platform revenue from paid or verified ledger entries. The line shows valid booking requests on its own scale.</p>
              </div>
              <div className="phase-three-chart-controls">
                <SegmentedFilter ariaLabel="Revenue chart aggregation" options={chartPeriodOptions} value={chartPeriod} onChange={(value) => setChartPeriod(value as ChartPeriod)} className="chart-period-filter" />
                <label className="chart-year-select">Year
                  <select aria-label="Revenue chart year" value={chartYear} onChange={(event) => setChartYear(Number(event.target.value))}>
                    {chartYears.map((year) => <option key={year} value={year}>{chartPeriod === 'yearly' ? `Through ${year}` : year}</option>)}
                  </select>
                </label>
              </div>
            </header>
            {chartError && <div className="chart-inline-error" role="alert">{chartError}</div>}
            {chartLoading && !chartAnalytics ? <div className="chart-empty">Loading live revenue and booking data…</div> : <RevenueBookingChart analytics={chartAnalytics} />}
            {chartAnalytics && <div className="revenue-summary phase-three-revenue-summary" aria-label="Revenue summary">
              <p><span>Recognized platform revenue</span><strong>{formatMoney(chartAnalytics.totals.platform_revenue)}</strong></p>
              <p><span>Gross payment volume</span><strong>{formatMoney(chartAnalytics.totals.gross_transaction_volume)}</strong></p>
              <p><span>Valid booking requests</span><strong>{chartAnalytics.totals.bookings.toLocaleString()}</strong></p>
            </div>}
          </article>

          <article className="panel phase-three-category-panel">
            <header>
              <div><span className="eyebrow">BOOKINGS BY CATEGORY</span><h2>Service category distribution</h2><p>Valid booking requests in the same reporting window. Each booking is counted once using its booked service category.</p></div>
              <MdiIcon path={mdiChartDonutVariant} />
            </header>
            {chartLoading && !chartAnalytics ? <div className="chart-empty">Loading category distribution…</div> : <BookingCategoryDonut analytics={chartAnalytics} />}
          </article>
        </section>
      )}

      {hasAnalytics && (
        <section className="phase-four-dashboard-grid" aria-busy={phaseFourLoading}>
          <article className="panel phase-four-reviews-panel">
            <header>
              <div><span className="eyebrow">RECENT COMMENTS & REVIEWS</span><h2>Latest client feedback</h2><p>Completed-booking service reviews, newest first. Reviewer identity is intentionally not shown.</p></div>
              {can('providers.view') && <Link href="/dashboard/reviews">View all <MdiIcon path={mdiArrowRight} /></Link>}
            </header>
            {phaseFourError && <div className="chart-inline-error" role="alert">{phaseFourError}</div>}
            {phaseFourLoading && !phaseFour ? <div className="chart-empty">Loading recent client feedback…</div> : <RecentReviewsPanel reviews={phaseFour?.recent_reviews || []} />}
          </article>

          <article className="panel phase-four-provider-panel">
            <header className="phase-four-provider-header">
              <div><span className="eyebrow">TOP SERVICE PROVIDERS</span><h2>{selectedProviderCategory}</h2><p>{phaseFour?.ranking_method || 'Loading the established provider ranking rule…'}</p></div>
              <label className="inline-select-wrap"><span>Category</span><select aria-label="Filter top providers by category" value={providerCategoryId} onChange={(event) => setProviderCategoryId(event.target.value)}><option value="all">All categories</option>{phaseFour?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            </header>
            {phaseFourError && <div className="chart-inline-error" role="alert">{phaseFourError}</div>}
            {phaseFourLoading && !phaseFour ? <div className="chart-empty">Loading provider performance…</div> : <ProviderLeaderboard providers={phaseFour?.top_providers || []} canViewProfiles={can('providers.view')} />}
          </article>
        </section>
      )}

      {hasAnalytics && (
        <section className="panel phase-five-category-panel" aria-busy={phaseFiveLoading}>
          <header>
            <div><span className="eyebrow">CATEGORY PERFORMANCE</span><h2>Marketplace activity by category</h2><p>Valid service bookings and recognized MULTIVENT platform revenue for {phaseFive?.range.label || 'the selected reporting period'}.</p></div>
            <Link href={`/dashboard/categories?range=${dateRange}`}>View details <MdiIcon path={mdiArrowRight} /></Link>
          </header>
          {phaseFiveError && <div className="chart-inline-error" role="alert">{phaseFiveError}</div>}
          {phaseFiveLoading && !phaseFive ? <div className="chart-empty">Loading category performance…</div> : <CategoryPerformanceGrid categories={phaseFive?.categories || []} range={dateRange} />}
        </section>
      )}

      {hasAnalytics && (
        <section className="phase-seven-bottom-grid">
          <section className="panel phase-six-insights-panel" aria-busy={phaseSixLoading}>
            <header>
              <div><span className="eyebrow">DECISION SUPPORT</span><h2>Explainable marketplace signals</h2><p>Live, advisory-only indicators from verified provider, booking, review, service, and paid revenue records.</p></div>
              <Link href="/dashboard/insights">View details <MdiIcon path={mdiArrowRight} /></Link>
            </header>
            {phaseSixError && <div className="chart-inline-error" role="alert">{phaseSixError}</div>}
            {phaseSixLoading && !phaseSix ? <div className="chart-empty">Loading explainable decision support...</div> : <InsightCards insights={phaseSix} compact />}
          </section>
          <ProviderServiceManagementPanel
            provider={phaseFour?.top_providers[0] || null}
            canViewProviders={canAccessRoute('providers') && can('providers.view')}
            canReviewListings={canAccessRoute('services') && can('services.view')}
            canViewBookings={canAccessRoute('bookings') && can('events.view')}
            canViewCategories={canAccessRoute('categories') && can('providers.view')}
          />
        </section>
      )}

      <section className={isAdminWorkspace ? 'overview-grid overview-grid--single' : 'overview-grid'}>
        {!isAdminWorkspace && <article className="panel action-panel">
          <header><div><span className="eyebrow">NEEDS ATTENTION</span><h2>Action center</h2></div><span className="count-bubble">{actionCount}</span></header>
          <div className="action-list">
            {can('providers.review') && <Link href="/dashboard/providers"><span className="action-list__icon"><MdiIcon path={mdiStorefrontCheckOutline} /></span><div><strong>Provider applications</strong><p>Review identity, terms, and business documents</p></div><b>{actions.pending_providers}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('services.review') && <Link href="/dashboard/services"><span className="action-list__icon"><MdiIcon path={mdiStoreCheckOutline} /></span><div><strong>Service submissions</strong><p>Review listings before marketplace publication</p></div><b>{actions.pending_services}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('cashflow.view') && <Link href="/dashboard/payments"><span className="action-list__icon action-list__icon--gold"><MdiIcon path={mdiCashMultiple} /></span><div><strong>Payment verifications</strong><p>Transactions awaiting confirmation</p></div><b>{actions.pending_payments}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('providers.view') && <Link href="/dashboard/reviews"><span className="action-list__icon action-list__icon--blue"><MdiIcon path={mdiCheckDecagramOutline} /></span><div><strong>Negative reviews</strong><p>Feedback that may require follow-up</p></div><b>{actions.negative_reviews}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('support.view') && <Link href="/dashboard/support"><span className="action-list__icon action-list__icon--blue"><MdiIcon path={mdiAccountGroupOutline} /></span><div><strong>Support tickets</strong><p>{actions.urgent_support_tickets ? `${actions.urgent_support_tickets} urgent · ` : ''}Open customer service work</p></div><b>{actions.active_support_tickets}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('coordinators.view') && <Link href="/dashboard/coordinators"><span className="action-list__icon"><MdiIcon path={mdiShieldAccountOutline} /></span><div><strong>Coordinator assignments</strong><p>Events waiting for an available employee</p></div><b>{actions.unassigned_events}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {actionCount === 0 && !loading && <div className="activity-empty">No operational items require attention.</div>}
          </div>
        </article>}

        <article className="panel activity-panel compact-activity-panel">
          <header><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Latest bookings</h2></div>{can('events.view') && <Link href="/dashboard/bookings">View all <MdiIcon path={mdiArrowRight} /></Link>}</header>
          {activity.length > 0 ? (
            <div className="activity-table">
              {activity.map((item) => <div key={item.id}><span className="activity-dot" /><div><strong>{item.event_name}</strong><p>{item.provider_name} · {formatMoney(item.amount)}</p></div><StatusBadge value={item.status} /><time>{formatRelativeTime(item.created_at)}</time></div>)}
            </div>
          ) : <div className="activity-empty">Recent booking activity will appear here.</div>}
        </article>
      </section>
    </div>
  )
}

function GovernanceHomeScreen() {
  const items = [
    { href: '/dashboard/users', icon: mdiAccountGroupOutline, title: 'User management', copy: 'Review user accounts, role assignments, and account standing.' },
    { href: '/dashboard/permissions', icon: mdiShieldCrownOutline, title: 'Staff permissions', copy: 'Set staff roles and feature permissions for internal workspaces.' },
    { href: '/dashboard/audit', icon: mdiClipboardTextClockOutline, title: 'Audit logs', copy: 'Trace privileged actions and system changes across the platform.' },
    { href: '/dashboard/settings', icon: mdiCogOutline, title: 'System settings', copy: 'Manage controlled, platform-wide configuration.' },
  ]

  return (
    <div className="screen-stack governance-home">
      <section className="page-heading">
        <div><span className="eyebrow">SUPERADMIN WORKSPACE</span><h1>Governance</h1><p>Manage the people, permissions, and platform controls entrusted to Superadmin.</p></div>
      </section>
      <section className="governance-home-grid">
        {items.map((item) => <Link key={item.href} className="governance-home-card" href={item.href}>
          <span><MdiIcon path={item.icon} /></span><div><h2>{item.title}</h2><p>{item.copy}</p></div><MdiIcon path={mdiArrowRight} />
        </Link>)}
      </section>
    </div>
  )
}

function RecentReviewsPanel({ reviews }: { reviews: DashboardReview[] }) {
  if (!reviews.length) return <div className="chart-empty">No completed-booking service reviews are available for this scope.</div>
  return <div className="phase-four-review-list">{reviews.map((review) => <article key={review.id}>
    <ReviewImage url={review.cover_image_url} label={review.service_name} />
    <div className="phase-four-review-list__main">
      <div><strong>{review.provider_name}</strong><span className="phase-four-rating">★ {Number(review.rating || 0).toFixed(1)}</span></div>
      <p>{review.comment ? truncateCopy(review.comment, 154) : 'No written feedback was supplied for this rating.'}</p>
      <footer><span className="category-tag">{review.category_name}</span><small>{review.service_name} · {formatDate(review.created_at)}</small>{review.sentiment && <StatusBadge value={review.sentiment} />}</footer>
    </div>
  </article>)}</div>
}

function ProviderLeaderboard({ providers, canViewProfiles }: { providers: DashboardProvider[]; canViewProfiles: boolean }) {
  if (!providers.length) return <div className="chart-empty">No eligible provider performance data is available for this category.</div>
  return <div className="phase-four-leaderboard table-scroll">
    <div className="phase-four-leaderboard__header"><span>Rank</span><span>Provider</span><span>Category</span><span>Rating</span><span>Platform revenue</span><span>Bookings</span><span>Standing</span><span>Action</span></div>
    {providers.map((provider) => <div className="phase-four-leaderboard__row" key={provider.id}>
      <b>#{provider.rank}</b>
      <div className="phase-four-provider-identity"><ReviewImage url={provider.cover_image_url} label={provider.business_name} /><span><strong>{provider.business_name}</strong></span></div>
      <span className="phase-four-provider-category">{categoryNames(provider.categories)}</span>
      <span className="provider-rating">{provider.review_count ? <><MdiIcon path={mdiStarOutline} /> {provider.average_rating.toFixed(1)} <small>({provider.review_count})</small></> : <small>No reviews</small>}</span>
      <span><strong>{formatMoney(provider.platform_revenue)}</strong><small>recognized fee</small></span>
      <span><strong>{provider.confirmed_bookings.toLocaleString()}</strong><small>{provider.completed_bookings.toLocaleString()} completed</small></span>
      <span className="provider-standing"><StatusBadge value={provider.verification_status} /><i className={`performance-pill performance-pill--${provider.performance.toLowerCase()}`}>{provider.performance}</i></span>
      <span>{canViewProfiles ? <Link className="review-button" href={`/dashboard/providers?provider=${encodeURIComponent(provider.id)}`}><MdiIcon path={mdiEyeOutline} /> View</Link> : <small className="table-muted">—</small>}</span>
    </div>)}
  </div>
}

function CategoryPerformanceGrid({ categories, range }: { categories: CategoryPerformanceMetric[]; range: DateRange }) {
  if (!categories.length) return <div className="chart-empty">No configured service categories are available for this workspace.</div>
  return <div className="phase-five-category-grid">{categories.map((category) => <Link className="phase-five-category-card" key={category.id} href={`/dashboard/categories?category=${encodeURIComponent(category.id)}&range=${range}`}>
    <span className="phase-five-category-card__icon"><MdiIcon path={categoryIcon(category.icon_name, category.name)} /></span>
    <span className="phase-five-category-card__main"><strong>{category.name}</strong>{!category.is_active && <small>Inactive</small>}<span><b>{category.valid_bookings.toLocaleString()}</b> valid bookings</span><span><b>{formatMoney(category.platform_revenue)}</b> platform revenue</span></span>
    <span className="phase-five-category-card__footer">{category.active_services.toLocaleString()} services <MdiIcon path={mdiArrowRight} /></span>
  </Link>)}</div>
}

function ProviderServiceManagementPanel({ provider, canViewProviders, canReviewListings, canViewBookings, canViewCategories }: {
  provider: DashboardProvider | null
  canViewProviders: boolean
  canReviewListings: boolean
  canViewBookings: boolean
  canViewCategories: boolean
}) {
  const providerHref = provider ? `/dashboard/providers?provider=${encodeURIComponent(provider.id)}` : '/dashboard/providers'
  const coverUrl = provider?.cover_image_url?.trim() || ''

  return <aside className="panel phase-seven-provider-panel">
    <header>
      <div><span className="eyebrow">MARKETPLACE OPERATIONS</span><h2>Provider service management</h2><p>Provider-owned changes stay in the provider workspace. Admin tools remain review- and record-focused.</p></div>
    </header>
    <div className="phase-seven-provider-panel__body">
      <div className="phase-seven-provider-visual">
        {coverUrl
          ? <span className="phase-seven-provider-cover" style={{ backgroundImage: `url("${coverUrl.replaceAll('"', '%22')}")` }} role="img" aria-label={`${provider?.business_name || 'Provider'} service cover`} />
          : <span className="phase-seven-provider-cover phase-seven-provider-cover--fallback" aria-hidden="true"><MdiIcon path={mdiStorefrontCheckOutline} /></span>}
        <div><span className="detail-label">CURRENT PROVIDER RECORD</span><strong>{provider?.business_name || 'Provider portfolio records'}</strong><p>{provider ? `${provider.categories.length} active ${provider.categories.length === 1 ? 'category' : 'categories'} shown in the current dashboard scope.` : 'Open the provider directory to inspect live services, pricing, records, and feedback.'}</p></div>
      </div>

      <div className="phase-seven-management-list">
        <ManagementCapability icon={mdiStorefrontCheckOutline} title="Provider services and pricing" copy="Inspect the existing provider record, services offered, current prices, standing, and feedback." href={canViewProviders ? providerHref : undefined} action="Open provider records" />
        <ManagementCapability icon={mdiPackageVariantClosed} title="Listing and package review" copy={canReviewListings ? 'Review submitted services, packages, inclusions, prices, and listing photos through the existing approval workflow.' : 'Listing approvals remain available only to staff with the existing service-review permission.'} href={canReviewListings ? '/dashboard/services' : undefined} action="Review listings" />
        <ManagementCapability icon={mdiCalendarCheckOutline} title="Booking schedule context" copy={canViewBookings ? 'Inspect current booking records and event dates without changing provider availability.' : 'Booking records are available only to staff with the existing events permission.'} href={canViewBookings ? '/dashboard/bookings' : undefined} action="Open bookings" />
        <ManagementCapability icon={mdiImageMultipleOutline} title="Category and listing context" copy={canViewCategories ? 'Review category performance and open its provider records from the existing marketplace analytics module.' : 'Category records follow the existing marketplace access permission.'} href={canViewCategories ? '/dashboard/categories' : undefined} action="Open categories" />
      </div>

      <p className="phase-seven-provider-note">Availability calendars, client inquiries, media updates, service creation, and package editing are provider-owned workflows and are intentionally not duplicated in the admin workspace.</p>
    </div>
  </aside>
}

function ManagementCapability({ icon, title, copy, href, action }: { icon: string; title: string; copy: string; href?: string; action: string }) {
  return <article className="phase-seven-management-item">
    <span><MdiIcon path={icon} /></span>
    <div><strong>{title}</strong><p>{copy}</p>{href ? <Link href={href}>{action} <MdiIcon path={mdiArrowRight} /></Link> : <small>Access follows existing staff permissions.</small>}</div>
  </article>
}

function ReviewImage({ url, label }: { url: string | null; label: string }) {
  const safeUrl = url?.trim() || ''
  return safeUrl
    ? <span className="phase-four-review-image" style={{ backgroundImage: `url("${safeUrl.replaceAll('"', '%22')}")` }} role="img" aria-label={`${label} image`} />
    : <span className="phase-four-review-image phase-four-review-image--fallback" aria-hidden="true">{label.slice(0, 1).toUpperCase() || 'M'}</span>
}

function truncateCopy(value: string, limit: number) {
  const text = value.trim()
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
}

function RevenueBookingChart({ analytics }: { analytics: ChartAnalytics | null }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  if (!analytics) return <div className="chart-empty">Live chart data is unavailable right now.</div>

  const points = analytics.series
  const hasData = analytics.totals.bookings > 0 || analytics.totals.platform_revenue > 0
  if (!points.length || !hasData) return <div className="chart-empty">No paid platform revenue or valid booking requests were recorded for this reporting window.</div>

  const revenueValues = points.map((point) => Number(point.platform_revenue || 0))
  const bookingValues = points.map((point) => Number(point.bookings || 0))
  const revenueMaximum = roundedChartMaximum(Math.max(...revenueValues, 0))
  const bookingMaximum = roundedChartMaximum(Math.max(...bookingValues, 0))
  const width = Math.max(620, points.length * (analytics.range.period === 'daily' ? 17 : 50))
  const plot = { left: 58, right: width - 52, top: 20, bottom: 200 }
  const plotWidth = plot.right - plot.left
  const plotHeight = plot.bottom - plot.top
  const xAt = (index: number) => points.length <= 1 ? plot.left + plotWidth / 2 : plot.left + index / (points.length - 1) * plotWidth
  const revenueY = (value: number) => plot.bottom - Math.max(0, value) / revenueMaximum * plotHeight
  const bookingY = (value: number) => plot.bottom - Math.max(0, value) / bookingMaximum * plotHeight
  const bookingLine = points.map((point, index) => `${xAt(index)},${bookingY(Number(point.bookings || 0))}`).join(' ')
  const labelStep = Math.max(1, Math.ceil(points.length / 8))
  const tooltip = activeIndex === null ? null : points[activeIndex]
  const barWidth = Math.max(4, Math.min(24, plotWidth / Math.max(points.length, 1) * .56))
  const revenueTicks = [0, .25, .5, .75, 1]

  return (
    <div className="revenue-booking-chart">
      <div className="revenue-booking-chart__legend" aria-label="Chart legend"><span><i className="revenue" />Recognized platform revenue</span><span><i className="bookings" />Valid booking requests</span></div>
      {tooltip && <div className="chart-tooltip" role="status"><strong>{tooltip.label}</strong><span>Platform revenue: {formatMoney(tooltip.platform_revenue)}</span><span>Gross payment volume: {formatMoney(tooltip.gross_transaction_volume)}</span><span>Valid bookings: {tooltip.bookings.toLocaleString()}</span></div>}
      <div className="revenue-booking-chart__scroll">
        <svg viewBox={`0 0 ${width} 238`} style={{ minWidth: `${width}px` }} role="img" aria-label="Recognized platform revenue bars and valid booking request trend line">
          {revenueTicks.map((tick) => {
            const y = plot.bottom - tick * plotHeight
            return <g key={tick}><line x1={plot.left} x2={plot.right} y1={y} y2={y} className="revenue-booking-chart__grid" /><text x={plot.left - 8} y={y + 4} textAnchor="end" className="revenue-booking-chart__axis-label">{formatAxisMoney(revenueMaximum * tick)}</text><text x={plot.right + 8} y={y + 4} className="revenue-booking-chart__axis-label">{Math.round(bookingMaximum * tick)}</text></g>
          })}
          <polyline points={bookingLine} className="revenue-booking-chart__line" />
          {points.map((point, index) => {
            const x = xAt(index)
            const revenue = Number(point.platform_revenue || 0)
            const bookings = Number(point.bookings || 0)
            const isActive = activeIndex === index
            return <g key={point.key} className={isActive ? 'revenue-booking-chart__point is-active' : 'revenue-booking-chart__point'} tabIndex={0} role="button" aria-label={`${point.label}: ${formatMoney(revenue)} recognized platform revenue, ${bookings.toLocaleString()} valid bookings`} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)}>
              <rect x={x - barWidth / 2} y={revenueY(revenue)} width={barWidth} height={Math.max(1, plot.bottom - revenueY(revenue))} rx="3" className="revenue-booking-chart__bar" />
              <circle cx={x} cy={bookingY(bookings)} r="4" className="revenue-booking-chart__line-point" />
              <rect x={x - Math.max(10, barWidth)} y={plot.top} width={Math.max(20, barWidth * 2)} height={plotHeight} className="revenue-booking-chart__hit-area" />
            </g>
          })}
          {points.map((point, index) => (index === 0 || index === points.length - 1 || index % labelStep === 0) && <text key={`${point.key}:label`} x={xAt(index)} y="222" textAnchor="middle" className="revenue-booking-chart__x-label">{point.label}</text>)}
          <text x={plot.left} y="13" className="revenue-booking-chart__axis-title">Platform revenue</text>
          <text x={plot.right} y="13" textAnchor="end" className="revenue-booking-chart__axis-title">Bookings</text>
        </svg>
      </div>
    </div>
  )
}

function BookingCategoryDonut({ analytics }: { analytics: ChartAnalytics | null }) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const categories = useMemo(() => analytics?.categories.filter((item) => item.bookings > 0) || [], [analytics?.categories])
  const total = categories.reduce((sum, item) => sum + Number(item.bookings || 0), 0)
  const background = useMemo(() => {
    if (!total) return 'conic-gradient(#eee8e7 0deg 360deg)'
    let cursor = 0
    return `conic-gradient(${categories.map((item, index) => {
      const next = cursor + item.bookings / total * 360
      const segment = `${categoryColor(item.id, index)} ${cursor.toFixed(2)}deg ${next.toFixed(2)}deg`
      cursor = next
      return segment
    }).join(', ')})`
  }, [categories, total])
  if (!analytics || !total) return <div className="chart-empty">No valid service-category bookings were recorded for this reporting window.</div>

  const activeCategory = categories.find((item) => item.id === activeCategoryId) || null
  return (
    <div className="category-donut-chart">
      <div className="category-donut-chart__visual">
        <div className="category-donut" style={{ background }} role="img" aria-label={`${total} valid bookings across ${categories.length} service categories`}><span><strong>{total.toLocaleString()}</strong><small>Bookings</small></span></div>
        {activeCategory && <div className="category-chart-tooltip" role="status"><strong>{activeCategory.name}</strong><span>{activeCategory.bookings.toLocaleString()} booking{activeCategory.bookings === 1 ? '' : 's'} · {(activeCategory.bookings / total * 100).toFixed(1)}%</span></div>}
      </div>
      <div className="category-donut-chart__legend">
        {categories.map((item, index) => <button type="button" key={item.id} onMouseEnter={() => setActiveCategoryId(item.id)} onMouseLeave={() => setActiveCategoryId(null)} onFocus={() => setActiveCategoryId(item.id)} onBlur={() => setActiveCategoryId(null)} aria-label={`${item.name}: ${item.bookings.toLocaleString()} bookings, ${(item.bookings / total * 100).toFixed(1)} percent`}>
          <i style={{ backgroundColor: categoryColor(item.id, index) }} /><span>{item.name}</span><b>{item.bookings.toLocaleString()}</b><small>{(item.bookings / total * 100).toFixed(1)}%</small>
        </button>)}
      </div>
    </div>
  )
}

/* Legacy category-bar markup, superseded by the Phase 3 booking-category donut.
  const maximum = Math.max(1, ...categories.map((item) => item.bookings))
  if (!categories.length) return <div className="chart-empty">No service-category bookings were recorded in this period.</div>
  return <div className="category-bars">{categories.map((item) => <div key={item.id} title={`${item.name}: ${item.bookings} valid booking${item.bookings === 1 ? '' : 's'}`}><span><strong>{item.name}</strong><small>{item.active_services} active services · {item.providers} providers</small></span><i><b style={{ width: `${item.bookings / maximum * 100}%` }} /></i><em>{item.bookings}</em></div>)}</div>
*/

function periodComparison(metric: PeriodMetric, rangeLabel: string, money = false) {
  if (metric.previous === 0) return `No prior ${rangeLabel.toLowerCase()} baseline`
  const change = (metric.current - metric.previous) / metric.previous * 100
  const direction = change > 0 ? '+' : ''
  const current = money ? formatMoney(metric.current) : metric.current.toLocaleString()
  return `${current} · ${direction}${change.toFixed(1)}% vs prior period`
}

function providerPeriodComparison(metric: { current: number; previous: number }, rangeLabel: string) {
  if (metric.previous === 0) return metric.current ? `${metric.current.toLocaleString()} new provider account${metric.current === 1 ? '' : 's'} in ${rangeLabel.toLowerCase()}` : `No new provider accounts in ${rangeLabel.toLowerCase()}`
  const change = (metric.current - metric.previous) / metric.previous * 100
  return `${metric.current.toLocaleString()} new account${metric.current === 1 ? '' : 's'} · ${change > 0 ? '+' : ''}${change.toFixed(1)}% vs prior period`
}

function ratingPeriodComparison(metric: { review_count: number; current: number; previous: number }, rangeLabel: string) {
  if (!metric.review_count) return 'No eligible completed-booking reviews'
  if (metric.previous === 0) return metric.current ? `${metric.current.toFixed(1)} in ${rangeLabel.toLowerCase()} · no prior baseline` : `${metric.review_count.toLocaleString()} eligible review${metric.review_count === 1 ? '' : 's'}`
  if (!metric.current) return `No new ratings in ${rangeLabel.toLowerCase()}`
  const change = metric.current - metric.previous
  return `${metric.current.toFixed(1)} in ${rangeLabel.toLowerCase()} · ${change > 0 ? '+' : ''}${change.toFixed(1)} vs prior period`
}

function roundedChartMaximum(value: number) {
  if (value <= 1) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / magnitude / 4) * 4 * magnitude
}

function formatAxisMoney(value: number) {
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M`
  if (value >= 1_000) return `₱${(value / 1_000).toFixed(value % 1_000 ? 1 : 0)}k`
  return `₱${Math.round(value)}`
}

function categoryColor(id: string, fallbackIndex: number) {
  const palette = ['#651c2d', '#853143', '#a64e62', '#bf7180', '#d4939d', '#8d5a63', '#b76755', '#9e7a57']
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0
  return palette[Math.abs(hash || fallbackIndex) % palette.length]
}
function categoryNames(categories: Choice[]) {
  if (!categories.length) return 'No active category'
  const names = categories.map((category) => category.name)
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
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
function formatRelativeTime(value: string) {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000))
  if (elapsedMinutes < 60) return `${elapsedMinutes || 1} min ago`
  if (elapsedMinutes < 1_440) return `${Math.floor(elapsedMinutes / 60)} hr ago`
  return `${Math.floor(elapsedMinutes / 1_440)} d ago`
}
function relationName(value: unknown, key: string, fallback: string) {
  const relation = Array.isArray(value) ? value[0] : value
  if (!relation || typeof relation !== 'object') return fallback
  const result = (relation as Record<string, unknown>)[key]
  return typeof result === 'string' && result.trim() ? result : fallback
}
function isDashboardAnalytics(value: unknown): value is DashboardAnalytics {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<DashboardAnalytics>
  return Boolean(row.range && row.kpis && row.kpis.providers && row.kpis.bookings && row.kpis.monthly_platform_revenue && row.kpis.average_rating && row.financial_summary && Array.isArray(row.booking_trend) && Array.isArray(row.revenue_trend) && Array.isArray(row.booking_statuses) && Array.isArray(row.popular_categories) && row.action_counts && Array.isArray(row.recent_bookings))
}

function isChartAnalytics(value: unknown): value is ChartAnalytics {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<ChartAnalytics>
  return Boolean(row.range && row.totals && Array.isArray(row.series) && Array.isArray(row.categories) && Array.isArray(row.available_years))
}

function isPhaseFourDashboard(value: unknown): value is PhaseFourDashboard {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<PhaseFourDashboard>
  return Boolean(Array.isArray(row.categories) && Array.isArray(row.top_providers) && Array.isArray(row.recent_reviews) && typeof row.ranking_method === 'string')
}

function isPhaseFiveDashboard(value: unknown): value is PhaseFiveDashboard {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<PhaseFiveDashboard>
  return Boolean(row.range && Array.isArray(row.categories))
}

function isDashboardInsights(value: unknown): value is DashboardInsights {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<DashboardInsights>
  return Boolean(row.range && row.criteria && 'highest_rated_provider' in row && 'top_revenue_category' in row && 'most_booked_provider' in row && 'declining_rating' in row && 'recommended_to_feature' in row)
}
