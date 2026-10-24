'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  mdiAlertOutline,
  mdiArrowRight,
  mdiCalendarCheckOutline,
  mdiCashMultiple,
  mdiCheckDecagramOutline,
  mdiRefresh,
  mdiStarOutline,
} from '@mdi/js'
import Link from 'next/link'
import { useDashboardControls } from '@/components/dashboard-shell'
import { MdiIcon } from '@/components/icons'
import { formatMoney, InlineError } from '@/components/ui'
import { getSupabase } from '@/lib/supabase'

type InsightRange = {
  current_start: string
  current_end: string
  previous_start: string
  event_type: string | null
}

type InsightCriteria = {
  highest_rated_provider: string
  top_revenue_category: string
  most_booked_provider: string
  declining_rating: string
  recommended_to_feature: string
}

type RatedProviderInsight = {
  id: string
  business_name: string
  average_rating: number
  review_count: number
  completed_bookings: number
}

type BookedProviderInsight = {
  id: string
  business_name: string
  valid_bookings: number
  completed_bookings: number
}

type DecliningProviderInsight = {
  id: string
  business_name: string
  previous_rating: number
  current_rating: number
  difference: number
  previous_review_count: number
  current_review_count: number
}

type FeatureCandidateInsight = {
  id: string
  business_name: string
  average_rating: number
  review_count: number
  current_valid_bookings: number
  previous_valid_bookings: number
  positive_written_reviews: number
  negative_written_reviews: number
}

type RevenueCategoryInsight = {
  id: string
  name: string
  platform_revenue: number
}

export type DashboardInsights = {
  generated_at: string
  range: InsightRange
  criteria: InsightCriteria
  highest_rated_provider: RatedProviderInsight | null
  top_revenue_category: RevenueCategoryInsight | null
  most_booked_provider: BookedProviderInsight | null
  declining_rating: DecliningProviderInsight | null
  recommended_to_feature: FeatureCandidateInsight | null
}

export function InsightsScreen() {
  const { eventType, liveDataVersion } = useDashboardControls()
  const [insights, setInsights] = useState<DashboardInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true

    async function loadInsights() {
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
      const { data, error: requestError } = await supabase.rpc('get_admin_dashboard_insights', {
        p_event_type: eventType === 'all' ? null : eventType,
      })
      if (!active) return

      if (requestError) setError(requestError.message)
      else if (!isDashboardInsights(data)) setError('Live decision support returned an unexpected response. Refresh after the Phase 6 dashboard migration is available.')
      else setInsights(data)
      setLoading(false)
    }

    void loadInsights()
    return () => { active = false }
  }, [eventType, liveDataVersion, refreshKey])

  const scope = useMemo(() => {
    if (!insights?.range.event_type) return 'all event types'
    return insights.range.event_type
  }, [insights?.range.event_type])

  return (
    <div className="screen-stack insights-screen">
      <section className="page-heading page-heading--with-action">
        <div>
          <span className="eyebrow">ANALYTICS</span>
          <h1>Decision support</h1>
          <p>Explainable marketplace signals based on live booking, review, service, and paid revenue records.</p>
        </div>
        <button className="secondary-button" type="button" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}>
          <MdiIcon path={mdiRefresh} />{loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </section>

      {error && <InlineError message={error} onClose={() => setError('')} />}

      <section className="panel insights-panel" aria-busy={loading}>
        <header className="insights-panel__header">
          <div>
            <span className="eyebrow">LIVE MARKETPLACE SIGNALS</span>
            <h2>Current 30-day comparison</h2>
            <p>Scoped to {scope}. Recommendations are advisory only; this page cannot feature a provider, alter ratings, or change moderation.</p>
          </div>
          <span className="insights-panel__period">Two comparable 30-day periods</span>
        </header>
        {loading && !insights ? <div className="chart-empty">Loading explainable decision support...</div> : <InsightCards insights={insights} />}
      </section>
    </div>
  )
}

export function InsightCards({ insights, compact = false }: { insights: DashboardInsights | null; compact?: boolean }) {
  const criteria = insights?.criteria
  const highest = insights?.highest_rated_provider || null
  const revenue = insights?.top_revenue_category || null
  const booked = insights?.most_booked_provider || null
  const declining = insights?.declining_rating || null
  const recommended = insights?.recommended_to_feature || null

  const items: Array<{
    key: string
    eyebrow: string
    title: string
    icon: string
    value: string
    detail: string
    criterion: string
    href?: string
    action?: string
    tone: 'wine' | 'gold' | 'blue' | 'alert' | 'green'
  }> = [
    {
      key: 'highest-rated',
      eyebrow: 'QUALITY',
      title: 'Highest rated provider',
      icon: mdiStarOutline,
      value: highest ? `${numberValue(highest.average_rating).toFixed(1)} / 5` : 'No qualified provider',
      detail: highest ? `${highest.business_name} - ${numberValue(highest.review_count).toLocaleString()} completed-booking reviews` : 'At least three completed-booking reviews are required.',
      criterion: criteria?.highest_rated_provider || 'Verified, active providers need at least three completed-booking reviews.',
      href: highest ? `/dashboard/providers?provider=${encodeURIComponent(highest.id)}` : undefined,
      action: highest ? 'Open provider' : undefined,
      tone: 'gold',
    },
    {
      key: 'top-revenue',
      eyebrow: 'REVENUE',
      title: 'Top revenue category',
      icon: mdiCashMultiple,
      value: revenue ? formatMoney(numberValue(revenue.platform_revenue)) : 'No paid revenue',
      detail: revenue ? `${revenue.name} - paid or verified booking-payment commission` : 'No paid or verified booking-payment commission in this scope.',
      criterion: criteria?.top_revenue_category || 'Only paid or verified booking-payment commission is compared.',
      tone: 'wine',
    },
    {
      key: 'most-booked',
      eyebrow: 'DEMAND',
      title: 'Most booked provider',
      icon: mdiCalendarCheckOutline,
      value: booked ? numberValue(booked.valid_bookings).toLocaleString() : 'No valid bookings',
      detail: booked ? `${booked.business_name} - ${numberValue(booked.completed_bookings).toLocaleString()} completed` : 'No valid service booking requests in this scope.',
      criterion: criteria?.most_booked_provider || 'Cancelled, rejected, and expired booking requests are excluded.',
      href: booked ? `/dashboard/providers?provider=${encodeURIComponent(booked.id)}` : undefined,
      action: booked ? 'Open provider' : undefined,
      tone: 'blue',
    },
    {
      key: 'declining-rating',
      eyebrow: 'WATCHLIST',
      title: 'Declining rating',
      icon: mdiAlertOutline,
      value: declining ? `${numberValue(declining.difference).toFixed(1)} pts` : 'No material decline',
      detail: declining ? `${declining.business_name} - ${numberValue(declining.previous_rating).toFixed(1)} to ${numberValue(declining.current_rating).toFixed(1)}` : 'No provider meets the comparable-period decline threshold.',
      criterion: criteria?.declining_rating || 'Both 30-day periods require at least three completed-booking reviews.',
      href: declining ? `/dashboard/providers?provider=${encodeURIComponent(declining.id)}` : undefined,
      action: declining ? 'Review provider' : undefined,
      tone: 'alert',
    },
    {
      key: 'feature-candidate',
      eyebrow: 'ADVISORY ONLY',
      title: 'Recommended to feature',
      icon: mdiCheckDecagramOutline,
      value: recommended ? recommended.business_name : 'No provider recommended',
      detail: recommended ? `${numberValue(recommended.average_rating).toFixed(1)} rating - ${numberValue(recommended.current_valid_bookings).toLocaleString()} current valid bookings` : 'No provider meets every transparent recommendation criterion.',
      criterion: criteria?.recommended_to_feature || 'This is an advisory recommendation and does not change provider visibility.',
      href: recommended ? `/dashboard/providers?provider=${encodeURIComponent(recommended.id)}` : undefined,
      action: recommended ? 'Open provider' : undefined,
      tone: 'green',
    },
  ]

  return (
    <div className={compact ? 'insight-card-grid insight-card-grid--compact' : 'insight-card-grid'}>
      {items.map((item) => <article className={`insight-card insight-card--${item.tone}`} key={item.key}>
        <span className="insight-card__icon"><MdiIcon path={item.icon} /></span>
        <div className="insight-card__main">
          <span className="eyebrow">{item.eyebrow}</span>
          <h3>{item.title}</h3>
          <strong>{item.value}</strong>
          <p>{item.detail}</p>
          {item.href && item.action && <Link href={item.href}>{item.action} <MdiIcon path={mdiArrowRight} /></Link>}
        </div>
        <p className="insight-card__criterion"><b>Method:</b> {item.criterion}</p>
      </article>)}
    </div>
  )
}

function numberValue(value: unknown) {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function isDashboardInsights(value: unknown): value is DashboardInsights {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<DashboardInsights>
  return Boolean(row.range && row.criteria && 'highest_rated_provider' in row && 'top_revenue_category' in row && 'most_booked_provider' in row && 'declining_rating' in row && 'recommended_to_feature' in row)
}
