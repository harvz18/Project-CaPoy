'use client'

import { useEffect, useState } from 'react'
import {
  mdiAccountGroupOutline,
  mdiArrowRight,
  mdiCalendarCheckOutline,
  mdiCashMultiple,
  mdiChartLine,
  mdiCheckDecagramOutline,
  mdiClockOutline,
  mdiRefresh,
  mdiShieldAccountOutline,
  mdiStorefrontCheckOutline,
  mdiStoreCheckOutline,
} from '@mdi/js'
import Link from 'next/link'
import { MdiIcon } from '@/components/icons'
import { formatMoney, StatusBadge } from '@/components/ui'
import { useStaff } from '@/components/dashboard-shell'
import { getSupabase } from '@/lib/supabase'

type Comparison = { current: number; previous: number; percent_change: number | null }
type MonthlyTrend = { month: string; bookings: number; completed_bookings: number; events: number; completed_events: number; cancelled_events: number; gross: number; commission: number }
type ProviderRanking = { id: string; name: string; rating: number; reviews: number; bookings: number; completed_bookings: number; booked_value: number; completion_rate: number }
type CategoryRanking = { id: string; name: string; active_services: number; providers: number; bookings: number; completed_bookings: number }
type EventTypeMetric = { name: string; events: number; completed: number; cancelled: number }
type RecentBooking = { id: string; status: string; amount: number; created_at: string; event_name: string; provider_name: string }

type ActionCounts = {
  pending_providers: number
  pending_services: number
  pending_payments: number
  negative_reviews: number
  active_support_tickets: number
  urgent_support_tickets: number
  unassigned_events: number
}

type DashboardAnalytics = {
  generated_at: string
  users: { total: number; active: number; suspended: number; disabled: number; clients: number }
  providers: { total: number; verified: number; pending: number; disabled: number; activation_rate: number }
  services: { total: number; active: number; pending_review: number; rejected: number }
  bookings: { total: number; completed: number; active: number; cancelled_or_expired: number; average_value: number; completion_rate: number }
  events: { total: number; completed: number; upcoming: number; in_progress: number; cancelled: number; completion_rate: number }
  finance: { gross_transaction_value: number; commission_revenue: number; provider_net_value: number }
  action_counts: ActionCounts
  comparisons: { bookings: Comparison; providers: Comparison; commission: Comparison }
  monthly_trend: MonthlyTrend[]
  top_providers: ProviderRanking[]
  popular_categories: CategoryRanking[]
  event_types: EventTypeMetric[]
  recent_bookings: RecentBooking[]
}

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
  const { can, profile } = useStaff()
  const hasAnalytics = can('dashboard.analytics.view')
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [actions, setActions] = useState<ActionCounts>(emptyActions)
  const [activity, setActivity] = useState<RecentBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const supabase = getSupabase()
    let active = true

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
        const { data, error: analyticsError } = await supabase!.rpc('get_business_dashboard')
        if (!active) return
        if (analyticsError) {
          setError(analyticsError.message)
          setLoading(false)
          return
        }

        if (!isDashboardAnalytics(data)) {
          setError('The Phase 7 analytics migration has not been applied yet. Apply database migration 36, then refresh this page.')
          setLoading(false)
          return
        }

        const nextAnalytics = data
        setAnalytics(nextAnalytics)
        setActions(nextAnalytics.action_counts || emptyActions)
        setActivity(Array.isArray(nextAnalytics.recent_bookings) ? nextAnalytics.recent_bookings : [])
        setLoading(false)
        return
      }

      // Non-analytics staff keep a permission-scoped operational home. These
      // reads are skipped entirely when the account lacks the related feature.
      const [providers, services, payments, reviews, support, coordinators, recent] = await Promise.all([
        can('providers.review')
          ? supabase!.from('provider_profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending')
          : Promise.resolve({ count: 0, error: null }),
        can('services.review')
          ? supabase!.from('services').select('*', { count: 'exact', head: true }).eq('status', 'pending_review')
          : Promise.resolve({ count: 0, error: null }),
        can('cashflow.view')
          ? supabase!.from('payments').select('*', { count: 'exact', head: true }).in('status', ['pending', 'processing'])
          : Promise.resolve({ count: 0, error: null }),
        can('providers.view')
          ? supabase!.from('reviews').select('*', { count: 'exact', head: true }).eq('sentiment_label', 'negative')
          : Promise.resolve({ count: 0, error: null }),
        can('support.view')
          ? supabase!.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress', 'waiting_for_user'])
          : Promise.resolve({ count: 0, error: null }),
        can('coordinators.view')
          ? supabase!.from('events').select('*', { count: 'exact', head: true }).eq('coordinator_assignment_status', 'awaiting_assignment').not('status', 'in', '(completed,cancelled)')
          : Promise.resolve({ count: 0, error: null }),
        can('events.view')
          ? supabase!.from('bookings').select('id,status,amount,created_at,events(name),provider_profiles(business_name)').order('created_at', { ascending: false }).limit(8)
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
  }, [can, hasAnalytics, refreshKey])

  const firstName = profile.full_name?.split(' ')[0] || (profile.default_role === 'superadmin' ? 'Superadmin' : 'Administrator')
  const stats = analytics ? [
    { label: 'Total users', value: analytics.users.total.toLocaleString(), detail: `${analytics.users.active.toLocaleString()} active accounts`, icon: mdiAccountGroupOutline, tone: 'wine' },
    { label: 'Verified providers', value: analytics.providers.verified.toLocaleString(), detail: `${analytics.providers.pending.toLocaleString()} awaiting review`, icon: mdiStorefrontCheckOutline, tone: 'gold' },
    { label: 'Total bookings', value: analytics.bookings.total.toLocaleString(), detail: comparisonCopy(analytics.comparisons.bookings, 'this month'), icon: mdiCalendarCheckOutline, tone: 'blue' },
    { label: 'Commission revenue', value: formatMoney(analytics.finance.commission_revenue), detail: comparisonCopy(analytics.comparisons.commission, 'this month', true), icon: mdiCashMultiple, tone: 'green' },
    { label: 'Upcoming events', value: analytics.events.upcoming.toLocaleString(), detail: `${analytics.events.in_progress.toLocaleString()} currently in progress`, icon: mdiCalendarCheckOutline, tone: 'blue' },
    { label: 'Average booking', value: formatMoney(analytics.bookings.average_value), detail: `${formatPercent(analytics.bookings.completion_rate)} booking completion`, icon: mdiChartLine, tone: 'green' },
  ] : []
  const actionCount = (can('providers.review') ? actions.pending_providers : 0)
    + (can('services.review') ? actions.pending_services : 0)
    + (can('cashflow.view') ? actions.pending_payments : 0)
    + (can('providers.view') ? actions.negative_reviews : 0)
    + (can('support.view') ? actions.active_support_tickets : 0)
    + (can('coordinators.view') ? actions.unassigned_events : 0)
  const maxMonthlyBookings = Math.max(1, ...(analytics?.monthly_trend || []).map((item) => item.bookings))

  return (
    <div className="screen-stack">
      <section className="page-heading page-heading--with-action">
        <div><span className="eyebrow">OPERATIONS OVERVIEW</span><h1>Good morning, {firstName}</h1><p>{hasAnalytics ? 'A live, read-only view of MULTIVENT business performance.' : 'Your permission-scoped operational queue.'}</p></div>
        <div className="overview-heading-actions">
          <div className="date-chip"><MdiIcon path={mdiClockOutline} /><span>{new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span></div>
          <button className="secondary-button" type="button" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}><MdiIcon path={mdiRefresh} />{loading ? 'Refreshing…' : 'Refresh'}</button>
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
        <section className="overview-grid analytics-overview-grid">
          <article className="panel analytics-trend-panel">
            <header><div><span className="eyebrow">12-MONTH TREND</span><h2>Bookings and commission</h2><p>Monthly booking volume with recognized MULTIVENT commission.</p></div><span className="analytics-generated">Updated {formatRelativeTime(analytics.generated_at)}</span></header>
            <div className="analytics-chart" aria-label="Monthly booking trend">
              {analytics.monthly_trend.map((item) => (
                <div className="analytics-chart__column" key={item.month} title={`${formatMonth(item.month)}: ${item.bookings} bookings, ${formatMoney(item.commission)} commission`}>
                  <span>{item.bookings}</span>
                  <div><i style={{ height: `${Math.max(item.bookings ? 10 : 2, item.bookings / maxMonthlyBookings * 100)}%` }} /></div>
                  <b>{formatShortMonth(item.month)}</b>
                  <small>{formatCompactMoney(item.commission)}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel business-health-panel">
            <header><div><span className="eyebrow">BUSINESS HEALTH</span><h2>Outcome ratios</h2></div></header>
            <div className="health-metrics">
              <HealthMetric label="Finalized events completed" value={analytics.events.completion_rate} detail={`${analytics.events.completed} completed · ${analytics.events.cancelled} cancelled`} />
              <HealthMetric label="Bookings completed" value={analytics.bookings.completion_rate} detail={`${analytics.bookings.active} still active`} />
              <HealthMetric label="Providers verified" value={analytics.providers.activation_rate} detail={`${analytics.providers.verified} of ${analytics.providers.total}`} />
            </div>
            <div className="business-health-summary">
              <p><span>Gross transaction value</span><strong>{formatMoney(analytics.finance.gross_transaction_value)}</strong></p>
              <p><span>Provider net value</span><strong>{formatMoney(analytics.finance.provider_net_value)}</strong></p>
              <p><span>Active services</span><strong>{analytics.services.active.toLocaleString()}</strong></p>
            </div>
          </article>
        </section>
      )}

      <section className="overview-grid">
        <article className="panel action-panel">
          <header><div><span className="eyebrow">NEEDS ATTENTION</span><h2>Action center</h2></div><span className="count-bubble">{actionCount}</span></header>
          <div className="action-list">
            {can('providers.review') && <Link href="/dashboard/providers"><span className="action-list__icon"><MdiIcon path={mdiStorefrontCheckOutline} /></span><div><strong>Provider applications</strong><p>Review identity, terms, and business documents</p></div><b>{actions.pending_providers}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('services.review') && <Link href="/dashboard/services"><span className="action-list__icon"><MdiIcon path={mdiStoreCheckOutline} /></span><div><strong>Service submissions</strong><p>Review listings before marketplace publication</p></div><b>{actions.pending_services}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('cashflow.view') && <Link href="/dashboard/payments"><span className="action-list__icon action-list__icon--gold"><MdiIcon path={mdiCashMultiple} /></span><div><strong>Payment verifications</strong><p>Transactions awaiting confirmation</p></div><b>{actions.pending_payments}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('providers.view') && <Link href="/dashboard/reviews"><span className="action-list__icon action-list__icon--blue"><MdiIcon path={mdiCheckDecagramOutline} /></span><div><strong>Negative reviews</strong><p>Feedback that may require follow-up</p></div><b>{actions.negative_reviews}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('support.view') && <Link href="/dashboard/support"><span className="action-list__icon action-list__icon--blue"><MdiIcon path={mdiAccountGroupOutline} /></span><div><strong>Support tickets</strong><p>{actions.urgent_support_tickets ? `${actions.urgent_support_tickets} urgent · ` : ''}Open Customer Service work</p></div><b>{actions.active_support_tickets}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('coordinators.view') && <Link href="/dashboard/coordinators"><span className="action-list__icon"><MdiIcon path={mdiShieldAccountOutline} /></span><div><strong>Coordinator assignments</strong><p>Events waiting for an available employee</p></div><b>{actions.unassigned_events}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {actionCount === 0 && !loading && <div className="activity-empty">No operational items require attention.</div>}
          </div>
        </article>

        <article className="panel activity-panel compact-activity-panel">
          <header><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Latest bookings</h2></div>{can('events.view') && <Link href="/dashboard/bookings">View all <MdiIcon path={mdiArrowRight} /></Link>}</header>
          {activity.length > 0 ? (
            <div className="activity-table">
              {activity.slice(0, 5).map((item) => <div key={item.id}><span className="activity-dot" /><div><strong>{item.event_name}</strong><p>{item.provider_name} · {formatMoney(item.amount)}</p></div><StatusBadge value={item.status} /><time>{formatRelativeTime(item.created_at)}</time></div>)}
            </div>
          ) : <div className="activity-empty">Recent booking activity will appear here.</div>}
        </article>
      </section>

      {analytics && (
        <section className="analytics-ranking-grid">
          <article className="panel ranking-panel">
            <header><div><span className="eyebrow">PROVIDER PERFORMANCE</span><h2>Verified provider leaders</h2></div></header>
            {analytics.top_providers.length ? analytics.top_providers.map((item, index) => <div className="ranking-row ranking-row--detailed" key={item.id}><b>{index + 1}</b><span><strong>{item.name}</strong><small>{item.bookings} bookings · {item.completion_rate.toFixed(1)}% completed</small></span><em>★ {item.rating.toFixed(1)} <small>{item.reviews} reviews</small></em></div>) : <div className="activity-empty">Provider rankings will appear after verified providers receive bookings.</div>}
          </article>
          <article className="panel ranking-panel">
            <header><div><span className="eyebrow">SERVICE DEMAND</span><h2>Popular categories</h2></div></header>
            {analytics.popular_categories.length ? analytics.popular_categories.map((item, index) => <div className="ranking-row ranking-row--detailed" key={item.id}><b>{index + 1}</b><span><strong>{item.name}</strong><small>{item.active_services} active services · {item.providers} providers</small></span><em>{item.bookings} bookings</em></div>) : <div className="activity-empty">Category demand will appear after bookings are created.</div>}
          </article>
          <article className="panel ranking-panel">
            <header><div><span className="eyebrow">EVENT MIX</span><h2>Events by type</h2></div></header>
            {analytics.event_types.length ? analytics.event_types.map((item, index) => <div className="ranking-row ranking-row--detailed" key={item.name}><b>{index + 1}</b><span><strong>{item.name}</strong><small>{item.completed} completed · {item.cancelled} cancelled</small></span><em>{item.events} events</em></div>) : <div className="activity-empty">Event-type metrics will appear as events are created.</div>}
          </article>
        </section>
      )}
    </div>
  )
}

function HealthMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)))
  return <div className="health-metric"><div><span>{label}</span><strong>{formatPercent(safeValue)}</strong></div><i><b style={{ width: `${safeValue}%` }} /></i><small>{detail}</small></div>
}

function comparisonCopy(comparison: Comparison, suffix: string, money = false) {
  const current = money ? formatMoney(comparison.current) : comparison.current.toLocaleString()
  if (comparison.percent_change === null) return `${current} ${suffix} · no prior baseline`
  const direction = comparison.percent_change > 0 ? '+' : ''
  return `${current} ${suffix} · ${direction}${comparison.percent_change.toFixed(1)}% vs prior month`
}

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`))
}

function formatShortMonth(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`))
}

function formatCompactMoney(value: number) {
  return new Intl.NumberFormat('en-PH', { notation: 'compact', style: 'currency', currency: 'PHP', maximumFractionDigits: 1 }).format(Number(value || 0))
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
  return Boolean(
    row.users
    && row.providers
    && row.services
    && row.bookings
    && row.events
    && row.finance
    && row.action_counts
    && row.comparisons
    && Array.isArray(row.monthly_trend)
    && Array.isArray(row.top_providers)
    && Array.isArray(row.popular_categories)
    && Array.isArray(row.event_types)
    && Array.isArray(row.recent_bookings),
  )
}
