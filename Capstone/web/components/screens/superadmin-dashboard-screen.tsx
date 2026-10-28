'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  mdiAccountGroupOutline,
  mdiAccountKeyOutline,
  mdiArrowRight,
  mdiChartBoxOutline,
  mdiClockOutline,
  mdiRefresh,
  mdiShieldCrownOutline,
  mdiShieldLockOutline,
  mdiStoreCheckOutline,
} from '@mdi/js'
import { MdiIcon } from '@/components/icons'
import { EmptyState, formatDate, InlineError, StatusBadge, TableSkeleton } from '@/components/ui'
import { getSupabase } from '@/lib/supabase'

type RoleMetric = { role: string; accounts: number; active_accounts: number }
type StatusMetric = { status: string; accounts: number }
type GrowthMetric = { key: string; label: string; accounts: number }
type AuditActionMetric = { action: string; occurrences: number }
type RecentAuditMetric = {
  id: string
  action: string
  resource_type: string
  result: string | null
  created_at: string
  actor_name: string | null
  actor_role: string | null
}
type SuperadminAnalytics = {
  generated_at: string
  accounts: {
    total_accounts: number
    active_accounts: number
    disabled_accounts: number
    internal_staff: number
    accounts_this_month: number
  }
  roles: RoleMetric[]
  statuses: StatusMetric[]
  account_growth: GrowthMetric[]
  system: {
    configured_roles: number
    configured_permissions: number
    role_permission_grants: number
    user_permission_overrides: number
    active_services: number
    pending_service_reviews: number
    pending_provider_reviews: number
  }
  audit: {
    recorded_actions: number
    actions_last_24_hours: number
    actions_last_30_days: number
    recorded_failures_30_days: number
  }
  top_audit_actions: AuditActionMetric[]
  recent_audit: RecentAuditMetric[]
}

export function SuperadminDashboardScreen() {
  const [analytics, setAnalytics] = useState<SuperadminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    async function loadDashboard() {
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
      const { data, error: requestError } = await supabase.rpc('get_superadmin_dashboard_analytics')
      if (!active) return
      if (requestError) setError(requestError.message)
      else if (!isSuperadminAnalytics(data)) setError('Governance analytics returned an unexpected response.')
      else setAnalytics(data)
      setLoading(false)
    }

    void loadDashboard()
    return () => { active = false }
  }, [refreshKey])

  const roleMaximum = useMemo(() => Math.max(1, ...(analytics?.roles.map((role) => numberValue(role.accounts)) || [0])), [analytics?.roles])
  const growthMaximum = useMemo(() => Math.max(1, ...(analytics?.account_growth.map((month) => numberValue(month.accounts)) || [0])), [analytics?.account_growth])
  const actionMaximum = useMemo(() => Math.max(1, ...(analytics?.top_audit_actions.map((action) => numberValue(action.occurrences)) || [0])), [analytics?.top_audit_actions])

  return (
    <div className="screen-stack superadmin-dashboard">
      <section className="page-heading page-heading--with-action">
        <div><span className="eyebrow">SUPERADMIN GOVERNANCE</span><h1>System dashboard</h1><p>Descriptive account, access-control, moderation, and audit activity from live MULTIVENT records.</p></div>
        <button className="secondary-button" type="button" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}><MdiIcon path={mdiRefresh} />{loading ? 'Refreshing…' : 'Refresh'}</button>
      </section>

      {error && <InlineError message={error} onClose={() => setError('')} />}

      <section className="stat-grid superadmin-stat-grid" aria-busy={loading}>
        <MetricCard icon={mdiAccountGroupOutline} tone="wine" label="Total accounts" value={analytics?.accounts.total_accounts} detail={`${numberValue(analytics?.accounts.accounts_this_month)} created this month`} />
        <MetricCard icon={mdiAccountKeyOutline} tone="blue" label="Active accounts" value={analytics?.accounts.active_accounts} detail={`${numberValue(analytics?.accounts.disabled_accounts)} disabled`} />
        <MetricCard icon={mdiShieldCrownOutline} tone="gold" label="Internal staff" value={analytics?.accounts.internal_staff} detail="Admin, Superadmin, Assistant, and Customer Service" />
        <MetricCard icon={mdiClockOutline} tone="green" label="Audited actions" value={analytics?.audit.actions_last_24_hours} detail={`${numberValue(analytics?.audit.actions_last_30_days)} recorded in 30 days`} />
        <MetricCard icon={mdiStoreCheckOutline} tone="wine" label="Moderation queue" value={numberValue(analytics?.system.pending_service_reviews) + numberValue(analytics?.system.pending_provider_reviews)} detail={`${numberValue(analytics?.system.pending_service_reviews)} services · ${numberValue(analytics?.system.pending_provider_reviews)} providers`} />
        <MetricCard icon={mdiShieldLockOutline} tone="blue" label="Configured permissions" value={analytics?.system.configured_permissions} detail={`${numberValue(analytics?.system.user_permission_overrides)} user-specific overrides`} />
      </section>

      {loading && !analytics ? <section className="panel superadmin-loading"><TableSkeleton rows={9} /></section> : analytics && <>
        <section className="superadmin-analytics-grid">
          <article className="panel superadmin-account-panel">
            <header><div><span className="eyebrow">ACCOUNT DISTRIBUTION</span><h2>Accounts by role</h2><p>Active accounts include active and verified lifecycle states.</p></div><MdiIcon path={mdiAccountGroupOutline} /></header>
            {analytics.roles.length ? <div className="superadmin-role-bars">{analytics.roles.map((role) => <div key={role.role}><div><strong>{humanize(role.role)}</strong><span>{numberValue(role.accounts).toLocaleString()} accounts · {numberValue(role.active_accounts).toLocaleString()} active</span></div><i><b style={{ width: `${numberValue(role.accounts) / roleMaximum * 100}%` }} /></i></div>)}</div> : <EmptyState title="No account roles found" copy="Configured account roles will appear here." />}
            <div className="superadmin-status-list">{analytics.statuses.map((status) => <span key={status.status}><StatusBadge value={status.status} /><b>{numberValue(status.accounts).toLocaleString()}</b></span>)}</div>
          </article>

          <article className="panel superadmin-growth-panel">
            <header><div><span className="eyebrow">ONBOARDING TREND</span><h2>New accounts</h2><p>Account profiles created in the last six calendar months.</p></div><MdiIcon path={mdiChartBoxOutline} /></header>
            <div className="superadmin-growth-chart" aria-label="New account trend over the last six months">{analytics.account_growth.map((month) => <div key={month.key}><strong>{numberValue(month.accounts).toLocaleString()}</strong><i><b style={{ height: `${numberValue(month.accounts) / growthMaximum * 100}%` }} /></i><span>{month.label}</span></div>)}</div>
          </article>
        </section>

        <section className="superadmin-operations-grid">
          <article className="panel superadmin-access-panel">
            <header><div><span className="eyebrow">ACCESS CONTROL</span><h2>Governance configuration</h2><p>Live configuration counts. These are descriptive; no settings are changed here.</p></div><MdiIcon path={mdiShieldLockOutline} /></header>
            <div className="superadmin-access-metrics">
              <Metric label="Roles" value={analytics.system.configured_roles} detail="Configured system roles" />
              <Metric label="Permission grants" value={analytics.system.role_permission_grants} detail="Role-to-permission mappings" />
              <Metric label="Overrides" value={analytics.system.user_permission_overrides} detail="User-specific permission decisions" />
              <Metric label="Active services" value={analytics.system.active_services} detail="Current marketplace listings" />
            </div>
            <div className="superadmin-links"><Link href="/dashboard/users">Open users <MdiIcon path={mdiArrowRight} /></Link><Link href="/dashboard/permissions">Manage access <MdiIcon path={mdiArrowRight} /></Link><Link href="/dashboard/settings">System settings <MdiIcon path={mdiArrowRight} /></Link></div>
          </article>

          <article className="panel superadmin-audit-panel">
            <header><div><span className="eyebrow">AUDIT PATTERNS</span><h2>Most recorded actions</h2><p>Append-only audit activity from the past 30 days.</p></div><Link href="/dashboard/audit">Open audit log <MdiIcon path={mdiArrowRight} /></Link></header>
            {analytics.top_audit_actions.length ? <div className="superadmin-action-bars">{analytics.top_audit_actions.map((action) => <div key={action.action}><span>{humanize(action.action)}</span><i><b style={{ width: `${numberValue(action.occurrences) / actionMaximum * 100}%` }} /></i><strong>{numberValue(action.occurrences).toLocaleString()}</strong></div>)}</div> : <EmptyState title="No recorded actions yet" copy="Meaningful data-changing activity will appear after it is audited." />}
          </article>
        </section>

        <section className="panel superadmin-recent-audit-panel">
          <header><div><span className="eyebrow">RECENT GOVERNANCE ACTIVITY</span><h2>Latest audited changes</h2><p>Only action metadata is summarized here. Open the audit log for the authorized detail view.</p></div><Link href="/dashboard/audit">View all <MdiIcon path={mdiArrowRight} /></Link></header>
          {analytics.recent_audit.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Action</th><th>Resource</th><th>Actor</th><th>Result</th><th>Recorded</th></tr></thead><tbody>{analytics.recent_audit.map((entry) => <tr key={entry.id}><td data-label="Action"><strong>{humanize(entry.action)}</strong></td><td data-label="Resource">{humanize(entry.resource_type)}</td><td data-label="Actor">{entry.actor_name || 'System'}<small className="table-subcopy">{humanize(entry.actor_role || 'system')}</small></td><td data-label="Result"><StatusBadge value={entry.result || 'completed'} /></td><td data-label="Recorded">{formatDate(entry.created_at)}</td></tr>)}</tbody></table></div> : <EmptyState title="No governance activity yet" copy="Audited data changes will appear here." />}
        </section>
      </>}
    </div>
  )
}

function MetricCard({ icon, tone, label, value, detail }: { icon: string; tone: 'wine' | 'gold' | 'blue' | 'green'; label: string; value: unknown; detail: string }) {
  return <article className="stat-card"><span className={`stat-card__icon stat-card__icon--${tone}`}><MdiIcon path={icon} /></span><div><p>{label}</p><strong>{numberValue(value).toLocaleString()}</strong><small>{detail}</small></div></article>
}

function Metric({ label, value, detail }: { label: string; value: unknown; detail: string }) {
  return <div><span>{label}</span><strong>{numberValue(value).toLocaleString()}</strong><small>{detail}</small></div>
}

function humanize(value: string) {
  return value.replaceAll('.', ' ').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function numberValue(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function isSuperadminAnalytics(value: unknown): value is SuperadminAnalytics {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<SuperadminAnalytics>
  return Boolean(data.accounts && data.system && data.audit && Array.isArray(data.roles) && Array.isArray(data.statuses) && Array.isArray(data.account_growth) && Array.isArray(data.top_audit_actions) && Array.isArray(data.recent_audit))
}
