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
  mdiStorefrontCheckOutline,
  mdiStoreCheckOutline,
} from '@mdi/js'
import Link from 'next/link'
import { MdiIcon } from '@/components/icons'
import { formatMoney, StatusBadge } from '@/components/ui'
import { useStaff } from '@/components/dashboard-shell'
import { getSupabase } from '@/lib/supabase'

type Counts = { users: number; clients: number; providers: number; bookings: number; revenue: number; completedEvents: number; upcomingEvents: number; cancelledEvents: number; pendingProviders: number; pendingServices: number; pendingPayments: number; negativeReviews: number; openSupport: number }
type Activity = { id: string; label: string; detail: string; time: string; status: string }

export function OverviewScreen() {
  const { can, profile } = useStaff()
  const [counts, setCounts] = useState<Counts>({ users: 0, clients: 0, providers: 0, bookings: 0, revenue: 0, completedEvents: 0, upcomingEvents: 0, cancelledEvents: 0, pendingProviders: 0, pendingServices: 0, pendingPayments: 0, negativeReviews: 0, openSupport: 0 })
  const [activity, setActivity] = useState<Activity[]>([])
  const [rankings, setRankings] = useState<{ providers: Record<string, unknown>[]; categories: Record<string, unknown>[] }>({ providers: [], categories: [] })

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return

    async function loadCounts() {
      const [users, providers, verifiedProviders, bookings, pendingProviders, pendingServices, pendingPayments, negativeReviews, openSupport, payments, recentBookings, analytics] = await Promise.all([
        supabase!.from('profiles').select('*', { count: 'exact', head: true }),
        supabase!.from('provider_profiles').select('*', { count: 'exact', head: true }),
        supabase!.from('provider_profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'verified'),
        supabase!.from('bookings').select('*', { count: 'exact', head: true }),
        supabase!.from('provider_profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase!.from('services').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
        supabase!.from('payments').select('*', { count: 'exact', head: true }).in('status', ['pending', 'processing']),
        supabase!.from('reviews').select('*', { count: 'exact', head: true }).eq('sentiment_label', 'negative'),
        supabase!.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress', 'waiting_for_user']),
        supabase!.from('payments').select('amount').in('status', ['paid', 'verified']),
        supabase!.from('bookings').select('id,status,amount,created_at').order('created_at', { ascending: false }).limit(4),
        can('dashboard.analytics.view') ? supabase!.rpc('get_business_dashboard') : Promise.resolve({ data: null }),
      ])
      const business = analytics.data && typeof analytics.data === 'object' ? analytics.data as Record<string, unknown> : {}
      setCounts({
        users: Number(business.total_users ?? users.count ?? 0),
        clients: Number(business.total_clients ?? 0),
        providers: Number(verifiedProviders.count ?? business.total_providers ?? providers.count ?? 0),
        bookings: Number(business.total_bookings ?? bookings.count ?? 0),
        completedEvents: Number(business.completed_events ?? 0),
        upcomingEvents: Number(business.upcoming_events ?? 0),
        cancelledEvents: Number(business.cancelled_events ?? 0),
        pendingProviders: pendingProviders.count || 0,
        pendingServices: pendingServices.count || 0,
        pendingPayments: pendingPayments.count || 0,
        negativeReviews: negativeReviews.count || 0,
        openSupport: openSupport.count || 0,
        revenue: Number(business.commission_revenue ?? (payments.data || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
      })
      setRankings({
        providers: Array.isArray(business.top_providers) ? business.top_providers as Record<string, unknown>[] : [],
        categories: Array.isArray(business.popular_categories) ? business.popular_categories as Record<string, unknown>[] : [],
      })
      setActivity((recentBookings.data || []).map((booking) => ({
        id: booking.id,
        label: `Booking MV-${booking.id.slice(0, 6).toUpperCase()}`,
        detail: `${String(booking.status).replaceAll('_', ' ')} · ${formatMoney(booking.amount)}`,
        time: formatRelativeTime(booking.created_at),
        status: booking.status,
      })))
    }
    void loadCounts()
  }, [can])

  const firstName = profile.full_name?.split(' ')[0] || (profile.default_role === 'superadmin' ? 'Superadmin' : 'Administrator')
  const stats = [
    { label: 'Total users', value: counts.users.toLocaleString(), detail: 'Registered accounts', icon: mdiAccountGroupOutline, tone: 'wine' },
    { label: 'Verified providers', value: counts.providers.toLocaleString(), detail: `${counts.pendingProviders} awaiting review`, icon: mdiStorefrontCheckOutline, tone: 'gold' },
    { label: 'Total bookings', value: counts.bookings.toLocaleString(), detail: 'Across all events', icon: mdiCalendarCheckOutline, tone: 'blue' },
    { label: can('dashboard.analytics.view') ? 'Commission revenue' : 'Processed value', value: formatMoney(counts.revenue), detail: can('dashboard.analytics.view') ? 'MULTIVENT income' : 'Paid & verified', icon: mdiCashMultiple, tone: 'green' },
    ...(can('dashboard.analytics.view') ? [
      { label: 'Upcoming events', value: counts.upcomingEvents.toLocaleString(), detail: `${counts.completedEvents} completed`, icon: mdiCalendarCheckOutline, tone: 'blue' },
      { label: 'Cancelled events', value: counts.cancelledEvents.toLocaleString(), detail: `${counts.clients} registered clients`, icon: mdiClockOutline, tone: 'gold' },
    ] : []),
  ]
  const actionCount = (can('providers.review') ? counts.pendingProviders : 0)
    + (can('services.review') ? counts.pendingServices : 0)
    + (can('cashflow.view') ? counts.pendingPayments : 0)
    + (can('providers.view') ? counts.negativeReviews : 0)
    + (can('support.view') ? counts.openSupport : 0)

  return (
    <div className="screen-stack">
      <section className="page-heading page-heading--with-action">
        <div><span className="eyebrow">OPERATIONS OVERVIEW</span><h1>Good morning, {firstName}</h1><p>Here’s what’s happening across MULTIVENT today.</p></div>
        <div className="date-chip"><MdiIcon path={mdiClockOutline} /><span>{new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span></div>
      </section>

      <section className="stat-grid">
        {stats.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <span className={`stat-card__icon stat-card__icon--${stat.tone}`}><MdiIcon path={stat.icon} /></span>
            <div><p>{stat.label}</p><strong>{stat.value}</strong><small>{stat.detail}</small></div>
          </article>
        ))}
      </section>

      <section className="overview-grid">
        <article className="panel action-panel">
          <header><div><span className="eyebrow">NEEDS ATTENTION</span><h2>Action center</h2></div><span className="count-bubble">{actionCount}</span></header>
          <div className="action-list">
            {can('providers.review') && <Link href="/dashboard/providers"><span className="action-list__icon"><MdiIcon path={mdiStorefrontCheckOutline} /></span><div><strong>Provider applications</strong><p>Review identity and business documents</p></div><b>{counts.pendingProviders}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('services.review') && <Link href="/dashboard/services"><span className="action-list__icon"><MdiIcon path={mdiStoreCheckOutline} /></span><div><strong>Service submissions</strong><p>Review listings before marketplace publication</p></div><b>{counts.pendingServices}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('cashflow.view') && <Link href="/dashboard/payments"><span className="action-list__icon action-list__icon--gold"><MdiIcon path={mdiCashMultiple} /></span><div><strong>Payment verifications</strong><p>Transactions awaiting confirmation</p></div><b>{counts.pendingPayments}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('providers.view') && <Link href="/dashboard/reviews"><span className="action-list__icon action-list__icon--blue"><MdiIcon path={mdiCheckDecagramOutline} /></span><div><strong>Negative reviews</strong><p>Feedback that may require follow-up</p></div><b>{counts.negativeReviews}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {can('support.view') && <Link href="/dashboard/support"><span className="action-list__icon action-list__icon--blue"><MdiIcon path={mdiAccountGroupOutline} /></span><div><strong>Support tickets</strong><p>Platform concerns awaiting Customer Service</p></div><b>{counts.openSupport}</b><MdiIcon path={mdiArrowRight} /></Link>}
            {actionCount === 0 && <div className="activity-empty">No operational items require attention.</div>}
          </div>
        </article>

        <article className="panel health-panel">
          <header><div><span className="eyebrow">PLATFORM HEALTH</span><h2>Service status</h2></div><span className="healthy-pill"><i /> Healthy</span></header>
          <div className="health-score"><div><strong>99.98%</strong><span>30-day uptime</span></div><MdiIcon path={mdiChartLine} size={2.3} /></div>
          <div className="service-list"><p><span><i />Authentication</span><b>Operational</b></p><p><span><i />Booking service</span><b>Operational</b></p><p><span><i />Payments</span><b>Operational</b></p><p><span><i />Notifications</span><b>Operational</b></p></div>
        </article>
      </section>

      <section className="panel activity-panel">
        <header><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Platform pulse</h2></div>{can('system.audit_logs') && <Link href="/dashboard/audit">View audit log <MdiIcon path={mdiArrowRight} /></Link>}</header>
        {activity.length > 0 ? (
          <div className="activity-table">
            {activity.map((item) => <div key={item.id}><span className="activity-dot" /><div><strong>{item.label}</strong><p>{item.detail}</p></div><StatusBadge value={item.status} /><time>{item.time}</time></div>)}
          </div>
        ) : <div className="activity-empty">Activity will appear here as staff actions and platform events are recorded.</div>}
      </section>
      {can('dashboard.analytics.view') && <section className="overview-grid ranking-grid"><article className="panel ranking-panel"><header><div><span className="eyebrow">PROVIDER PERFORMANCE</span><h2>Top-rated providers</h2></div></header>{rankings.providers.length ? rankings.providers.map((item, index) => <div className="ranking-row" key={`${item.name}-${index}`}><b>{index + 1}</b><span><strong>{String(item.name)}</strong><small>{Number(item.bookings || 0)} bookings</small></span><em>★ {Number(item.rating || 0).toFixed(1)}</em></div>) : <div className="activity-empty">Provider rankings will appear after reviews are submitted.</div>}</article><article className="panel ranking-panel"><header><div><span className="eyebrow">SERVICE DEMAND</span><h2>Most-booked categories</h2></div></header>{rankings.categories.length ? rankings.categories.map((item, index) => <div className="ranking-row" key={`${item.name}-${index}`}><b>{index + 1}</b><span><strong>{String(item.name)}</strong><small>Marketplace category</small></span><em>{Number(item.bookings || 0)} bookings</em></div>) : <div className="activity-empty">Category demand will appear after bookings are created.</div>}</article></section>}
    </div>
  )
}

function formatRelativeTime(value: string) {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000))
  if (elapsedMinutes < 60) return `${elapsedMinutes || 1} min ago`
  if (elapsedMinutes < 1_440) return `${Math.floor(elapsedMinutes / 60)} hr ago`
  return `${Math.floor(elapsedMinutes / 1_440)} d ago`
}
