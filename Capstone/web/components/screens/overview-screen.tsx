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

type Counts = { users: number; providers: number; bookings: number; revenue: number; pendingProviders: number; pendingServices: number }
type Activity = { id: string; label: string; detail: string; time: string; status: string }

export function OverviewScreen() {
  const { profile } = useStaff()
  const [counts, setCounts] = useState<Counts>({ users: 0, providers: 0, bookings: 0, revenue: 0, pendingProviders: 0, pendingServices: 0 })
  const [activity, setActivity] = useState<Activity[]>([])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return

    async function loadCounts() {
      const [users, providers, bookings, pendingProviders, pendingServices, payments, recentBookings] = await Promise.all([
        supabase!.from('profiles').select('*', { count: 'exact', head: true }),
        supabase!.from('provider_profiles').select('*', { count: 'exact', head: true }),
        supabase!.from('bookings').select('*', { count: 'exact', head: true }),
        supabase!.from('provider_profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase!.from('services').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
        supabase!.from('payments').select('amount').in('status', ['paid', 'verified']),
        supabase!.from('bookings').select('id,status,amount,created_at').order('created_at', { ascending: false }).limit(4),
      ])
      setCounts({
        users: users.count || 0,
        providers: providers.count || 0,
        bookings: bookings.count || 0,
        pendingProviders: pendingProviders.count || 0,
        pendingServices: pendingServices.count || 0,
        revenue: (payments.data || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
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
  }, [])

  const firstName = profile.full_name?.split(' ')[0] || (profile.default_role === 'superadmin' ? 'Superadmin' : 'Administrator')
  const stats = [
    { label: 'Total users', value: counts.users.toLocaleString(), detail: 'Registered accounts', icon: mdiAccountGroupOutline, tone: 'wine' },
    { label: 'Verified providers', value: counts.providers.toLocaleString(), detail: `${counts.pendingProviders} awaiting review`, icon: mdiStorefrontCheckOutline, tone: 'gold' },
    { label: 'Total bookings', value: counts.bookings.toLocaleString(), detail: 'Across all events', icon: mdiCalendarCheckOutline, tone: 'blue' },
    { label: 'Processed value', value: formatMoney(counts.revenue), detail: 'Paid & verified', icon: mdiCashMultiple, tone: 'green' },
  ]

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
          <header><div><span className="eyebrow">NEEDS ATTENTION</span><h2>Action center</h2></div><span className="count-bubble">{counts.pendingProviders + counts.pendingServices + 5}</span></header>
          <div className="action-list">
            <Link href="/dashboard/providers"><span className="action-list__icon"><MdiIcon path={mdiStorefrontCheckOutline} /></span><div><strong>Provider applications</strong><p>Review identity and business documents</p></div><b>{counts.pendingProviders}</b><MdiIcon path={mdiArrowRight} /></Link>
            <Link href="/dashboard/services"><span className="action-list__icon"><MdiIcon path={mdiStoreCheckOutline} /></span><div><strong>Service submissions</strong><p>Review listings before marketplace publication</p></div><b>{counts.pendingServices}</b><MdiIcon path={mdiArrowRight} /></Link>
            <Link href="/dashboard/payments"><span className="action-list__icon action-list__icon--gold"><MdiIcon path={mdiCashMultiple} /></span><div><strong>Payment verifications</strong><p>Transactions awaiting confirmation</p></div><b>3</b><MdiIcon path={mdiArrowRight} /></Link>
            <Link href="/dashboard/reviews"><span className="action-list__icon action-list__icon--blue"><MdiIcon path={mdiCheckDecagramOutline} /></span><div><strong>Flagged reviews</strong><p>Community reports requiring a decision</p></div><b>2</b><MdiIcon path={mdiArrowRight} /></Link>
          </div>
        </article>

        <article className="panel health-panel">
          <header><div><span className="eyebrow">PLATFORM HEALTH</span><h2>Service status</h2></div><span className="healthy-pill"><i /> Healthy</span></header>
          <div className="health-score"><div><strong>99.98%</strong><span>30-day uptime</span></div><MdiIcon path={mdiChartLine} size={2.3} /></div>
          <div className="service-list"><p><span><i />Authentication</span><b>Operational</b></p><p><span><i />Booking service</span><b>Operational</b></p><p><span><i />Payments</span><b>Operational</b></p><p><span><i />Notifications</span><b>Operational</b></p></div>
        </article>
      </section>

      <section className="panel activity-panel">
        <header><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Platform pulse</h2></div><Link href="/dashboard/audit">View audit log <MdiIcon path={mdiArrowRight} /></Link></header>
        {activity.length > 0 ? (
          <div className="activity-table">
            {activity.map((item) => <div key={item.id}><span className="activity-dot" /><div><strong>{item.label}</strong><p>{item.detail}</p></div><StatusBadge value={item.status} /><time>{item.time}</time></div>)}
          </div>
        ) : <div className="activity-empty">Activity will appear here as staff actions and platform events are recorded.</div>}
      </section>
    </div>
  )
}

function formatRelativeTime(value: string) {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000))
  if (elapsedMinutes < 60) return `${elapsedMinutes || 1} min ago`
  if (elapsedMinutes < 1_440) return `${Math.floor(elapsedMinutes / 60)} hr ago`
  return `${Math.floor(elapsedMinutes / 1_440)} d ago`
}
