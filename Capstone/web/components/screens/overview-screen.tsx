'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  mdiAccountGroupOutline,
  mdiArrowRight,
  mdiCalendarCheckOutline,
  mdiCashMultiple,
  mdiChartDonutVariant,
  mdiChartLine,
  mdiCheckDecagramOutline,
  mdiClipboardTextClockOutline,
  mdiCogOutline,
  mdiRefresh,
  mdiShieldAccountOutline,
  mdiShieldCrownOutline,
  mdiStorefrontCheckOutline,
  mdiStoreCheckOutline,
} from '@mdi/js'
import Link from 'next/link'
import { MdiIcon } from '@/components/icons'
import { formatMoney, SegmentedFilter, StatusBadge } from '@/components/ui'
import { useStaff } from '@/components/dashboard-shell'
import { getSupabase } from '@/lib/supabase'

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
type TrendPoint = { key: string; label: string; bookings: number }
type RevenuePoint = { key: string; label: string; gross_booking_value: number; recognized_platform_revenue: number }
type BookingStatus = { status: string; count: number }
type CategoryMetric = { id: string; name: string; active_services: number; providers: number; bookings: number }

type DashboardAnalytics = {
  generated_at: string
  range: { key: DateRange; label: string; start: string; end: string }
  kpis: {
    providers: { total: number; verified: number; pending: number }
    clients: { total: number; active: number }
    valid_bookings: PeriodMetric
    confirmed_bookings: { current: number }
    platform_revenue: PeriodMetric
    pending_applications: { current: number; providers: number; services: number }
  }
  financial_summary: {
    gross_booking_value: number
    recognized_platform_revenue: number
    pending_collections: number
    pending_collection_count: number
  }
  booking_trend: TrendPoint[]
  revenue_trend: RevenuePoint[]
  booking_statuses: BookingStatus[]
  popular_categories: CategoryMetric[]
  action_counts: ActionCounts
  recent_bookings: RecentBooking[]
}

const dateRangeOptions: ReadonlyArray<readonly [DateRange, string]> = [
  ['day', '1 Day'],
  ['3days', '3 Days'],
  ['week', '1 Week'],
  ['month', '1 Month'],
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
  const hasWorkspaceOverview = canAccessRoute('overview')
  const hasAnalytics = can('dashboard.analytics.view')
  const [dateRange, setDateRange] = useState<DateRange>('week')
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [actions, setActions] = useState<ActionCounts>(emptyActions)
  const [activity, setActivity] = useState<RecentBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const supabase = getSupabase()
    let active = true

    if (!hasWorkspaceOverview) {
      setLoading(false)
      return () => { active = false }
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
        const { data, error: analyticsError } = await supabase.rpc('get_admin_dashboard_analytics', { p_range: dateRange })
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
  }, [can, dateRange, hasAnalytics, hasWorkspaceOverview, refreshKey])

  const stats = analytics ? [
    { label: 'Total service providers', value: analytics.kpis.providers.total.toLocaleString(), detail: `All-time · ${analytics.kpis.providers.verified.toLocaleString()} verified`, icon: mdiStorefrontCheckOutline, tone: 'wine' },
    { label: 'Total clients', value: analytics.kpis.clients.total.toLocaleString(), detail: `All-time · ${analytics.kpis.clients.active.toLocaleString()} active`, icon: mdiAccountGroupOutline, tone: 'gold' },
    { label: 'Valid bookings', value: analytics.kpis.valid_bookings.current.toLocaleString(), detail: periodComparison(analytics.kpis.valid_bookings, analytics.range.label), icon: mdiCalendarCheckOutline, tone: 'blue' },
    { label: 'Confirmed bookings', value: analytics.kpis.confirmed_bookings.current.toLocaleString(), detail: `Accepted bookings in ${analytics.range.label.toLowerCase()}`, icon: mdiCheckDecagramOutline, tone: 'blue' },
    { label: 'MULTIVENT revenue', value: formatMoney(analytics.kpis.platform_revenue.current), detail: periodComparison(analytics.kpis.platform_revenue, analytics.range.label, true), icon: mdiCashMultiple, tone: 'green' },
    { label: 'Pending applications', value: analytics.kpis.pending_applications.current.toLocaleString(), detail: `${analytics.kpis.pending_applications.providers} provider · ${analytics.kpis.pending_applications.services} service`, icon: mdiChartLine, tone: 'wine' },
  ] : []

  const actionCount = (can('providers.review') ? actions.pending_providers : 0)
    + (can('services.review') ? actions.pending_services : 0)
    + (can('cashflow.view') ? actions.pending_payments : 0)
    + (can('providers.view') ? actions.negative_reviews : 0)
    + (can('support.view') ? actions.active_support_tickets : 0)
    + (can('coordinators.view') ? actions.unassigned_events : 0)

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

      {analytics && (
        <>
          <section className="phase-two-analytics-grid" aria-busy={loading}>
            <article className="panel phase-two-chart-panel">
              <header>
                <div><span className="eyebrow">BOOKING ACTIVITY</span><h2>Valid bookings over time</h2><p>Created booking requests, excluding rejected, cancelled, and expired records.</p></div>
                <span className="analytics-generated">Updated {formatRelativeTime(analytics.generated_at)}</span>
              </header>
              <BookingBarChart points={analytics.booking_trend} />
            </article>

            <article className="panel phase-two-chart-panel revenue-chart-panel">
              <header><div><span className="eyebrow">REVENUE OVERVIEW</span><h2>Booked value and platform revenue</h2><p>Booked value and recognized MULTIVENT earnings are shown separately.</p></div></header>
              <RevenueTrendChart points={analytics.revenue_trend} />
              <div className="revenue-summary" aria-label="Revenue summary">
                <p><span>Gross booking value</span><strong>{formatMoney(analytics.financial_summary.gross_booking_value)}</strong></p>
                <p><span>Recognized platform revenue</span><strong>{formatMoney(analytics.financial_summary.recognized_platform_revenue)}</strong></p>
                <p><span>Pending collection requests</span><strong>{formatMoney(analytics.financial_summary.pending_collections)} <small>({analytics.financial_summary.pending_collection_count})</small></strong></p>
              </div>
            </article>
          </section>

          <section className="phase-two-insights-grid" aria-busy={loading}>
            <article className="panel status-distribution-panel">
              <header><div><span className="eyebrow">BOOKING STATUS</span><h2>Status distribution</h2><p>Actual status values for bookings created in {analytics.range.label.toLowerCase()}.</p></div><MdiIcon path={mdiChartDonutVariant} /></header>
              <BookingStatusDonut statuses={analytics.booking_statuses} />
            </article>
            <article className="panel category-demand-panel">
              <header><div><span className="eyebrow">SERVICE DEMAND</span><h2>Popular service categories</h2><p>Ranked by valid booking requests in {analytics.range.label.toLowerCase()}.</p></div></header>
              <CategoryBars categories={analytics.popular_categories} />
            </article>
          </section>
        </>
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

function BookingBarChart({ points }: { points: TrendPoint[] }) {
  const maximum = Math.max(1, ...points.map((point) => point.bookings))
  if (!points.length) return <div className="chart-empty">No booking activity was recorded in this period.</div>
  return (
    <div className="booking-bar-chart" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(28px, 1fr))` }} aria-label="Booking activity bar chart">
      {points.map((point) => {
        const height = point.bookings ? Math.max(8, point.bookings / maximum * 100) : 2
        return <div className="booking-bar-chart__column" key={point.key} title={`${point.label}: ${point.bookings} valid booking${point.bookings === 1 ? '' : 's'}`}>
          <span>{point.bookings || ''}</span><div><i style={{ height: `${height}%` }} /></div><b>{point.label}</b>
        </div>
      })}
    </div>
  )
}

function RevenueTrendChart({ points }: { points: RevenuePoint[] }) {
  const bookedValues = points.map((point) => Number(point.gross_booking_value || 0))
  const revenueValues = points.map((point) => Number(point.recognized_platform_revenue || 0))
  const maximum = Math.max(1, ...bookedValues, ...revenueValues)
  const labels = points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.max(1, Math.ceil(points.length / 6)) === 0)
  if (!points.length) return <div className="chart-empty">No financial activity was recorded in this period.</div>
  return (
    <div className="revenue-line-chart" aria-label="Revenue trend chart">
      <div className="revenue-line-chart__legend"><span><i className="booked" />Gross booking value</span><span><i className="revenue" />Recognized revenue</span></div>
      <svg viewBox="0 0 520 178" preserveAspectRatio="none" role="img" aria-label="Gross booking value and recognized platform revenue">
        <line x1="18" x2="502" y1="148" y2="148" className="revenue-line-chart__baseline" />
        <polyline points={linePoints(bookedValues, maximum)} className="revenue-line-chart__line revenue-line-chart__line--booked" />
        <polyline points={linePoints(revenueValues, maximum)} className="revenue-line-chart__line revenue-line-chart__line--revenue" />
        {points.map((point, index) => <g key={point.key}>
          <circle cx={pointX(index, points.length)} cy={pointY(bookedValues[index], maximum)} r="3.5" className="revenue-line-chart__point revenue-line-chart__point--booked"><title>{`${point.label}: ${formatMoney(point.gross_booking_value)} gross booking value`}</title></circle>
          <circle cx={pointX(index, points.length)} cy={pointY(revenueValues[index], maximum)} r="3.5" className="revenue-line-chart__point revenue-line-chart__point--revenue"><title>{`${point.label}: ${formatMoney(point.recognized_platform_revenue)} recognized platform revenue`}</title></circle>
        </g>)}
      </svg>
      <div className="revenue-line-chart__labels">{labels.map((point) => <span key={point.key}>{point.label}</span>)}</div>
    </div>
  )
}

function BookingStatusDonut({ statuses }: { statuses: BookingStatus[] }) {
  const total = statuses.reduce((sum, item) => sum + Number(item.count || 0), 0)
  const background = useMemo(() => {
    if (!total) return 'conic-gradient(#eee8e7 0deg 360deg)'
    let cursor = 0
    return `conic-gradient(${statuses.map((item) => {
      const next = cursor + item.count / total * 360
      const segment = `${statusColor(item.status)} ${cursor.toFixed(2)}deg ${next.toFixed(2)}deg`
      cursor = next
      return segment
    }).join(', ')})`
  }, [statuses, total])
  if (!total) return <div className="chart-empty">No booking statuses are available for this period.</div>
  return (
    <div className="status-chart">
      <div className="status-donut" style={{ background }} role="img" aria-label={`${total} bookings across ${statuses.length} statuses`}><span><strong>{total}</strong><small>Bookings</small></span></div>
      <div className="status-legend">
        {statuses.map((item) => <div key={item.status} title={`${friendlyStatus(item.status)}: ${item.count}`}><i style={{ backgroundColor: statusColor(item.status) }} /><span>{friendlyStatus(item.status)}</span><b>{item.count}</b><small>{`${(item.count / total * 100).toFixed(1)}%`}</small></div>)}
      </div>
    </div>
  )
}

function CategoryBars({ categories }: { categories: CategoryMetric[] }) {
  const maximum = Math.max(1, ...categories.map((item) => item.bookings))
  if (!categories.length) return <div className="chart-empty">No service-category bookings were recorded in this period.</div>
  return <div className="category-bars">{categories.map((item) => <div key={item.id} title={`${item.name}: ${item.bookings} valid booking${item.bookings === 1 ? '' : 's'}`}><span><strong>{item.name}</strong><small>{item.active_services} active services · {item.providers} providers</small></span><i><b style={{ width: `${item.bookings / maximum * 100}%` }} /></i><em>{item.bookings}</em></div>)}</div>
}

function periodComparison(metric: PeriodMetric, rangeLabel: string, money = false) {
  if (metric.previous === 0) return `No prior ${rangeLabel.toLowerCase()} baseline`
  const change = (metric.current - metric.previous) / metric.previous * 100
  const direction = change > 0 ? '+' : ''
  const current = money ? formatMoney(metric.current) : metric.current.toLocaleString()
  return `${current} · ${direction}${change.toFixed(1)}% vs prior period`
}

function linePoints(values: number[], maximum: number) {
  return values.map((value, index) => `${pointX(index, values.length)},${pointY(value, maximum)}`).join(' ')
}

function pointX(index: number, count: number) { return 18 + (count <= 1 ? 242 : index / (count - 1) * 484) }
function pointY(value: number, maximum: number) { return 148 - Math.max(0, value) / Math.max(1, maximum) * 122 }
function friendlyStatus(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function statusColor(status: string) {
  const colors: Record<string, string> = { confirmed: '#722f37', completed: '#3f7d5c', approved: '#a66c36', paid: '#b78446', payment_required: '#c58533', requested: '#9d7e84', rejected: '#ad5058', cancelled: '#81777a', expired: '#a79da0' }
  return colors[status] || '#8f8588'
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
  return Boolean(row.range && row.kpis && row.financial_summary && Array.isArray(row.booking_trend) && Array.isArray(row.revenue_trend) && Array.isArray(row.booking_statuses) && Array.isArray(row.popular_categories) && row.action_counts && Array.isArray(row.recent_bookings))
}
