'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  mdiAccountOutline,
  mdiChevronRight,
  mdiClockOutline,
  mdiClose,
  mdiDatabaseOutline,
  mdiFileDocumentOutline,
  mdiMagnify,
  mdiRefresh,
  mdiShieldCheckOutline,
} from '@mdi/js'
import { MdiIcon } from '@/components/icons'
import { EmptyState, formatDate, InlineError, StatusBadge, TableSkeleton } from '@/components/ui'
import { getSupabase } from '@/lib/supabase'

type AuditEntry = {
  id: string
  actor_id: string | null
  actor_role: string | null
  actor_name: string | null
  actor_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  previous_state: unknown
  new_state: unknown
  result: string | null
  metadata: unknown
  created_at: string
  total_count: number
}

type Summary = Record<string, unknown>

function auditRange(filter: string, custom: { start: string; end: string }) {
  if (filter === 'all') return { start: null, end: null }
  if (filter === 'custom') return {
    start: custom.start ? new Date(`${custom.start}T00:00:00`).toISOString() : null,
    end: custom.end ? new Date(`${custom.end}T23:59:59.999`).toISOString() : null,
  }

  const now = new Date()
  const start = new Date(now)
  if (filter === 'today') start.setHours(0, 0, 0, 0)
  else if (filter === 'week') {
    const day = start.getDay()
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
    start.setHours(0, 0, 0, 0)
  } else {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  }
  return { start: start.toISOString(), end: now.toISOString() }
}

export function AuditLogScreen() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [summary, setSummary] = useState<Summary>({})
  const [selected, setSelected] = useState<AuditEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [resourceFilter, setResourceFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('month')
  const [customDates, setCustomDates] = useState({ start: '', end: '' })

  const loadEntries = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return
    setLoading(true)
    setError('')
    const range = auditRange(dateFilter, customDates)
    const [entriesResult, summaryResult] = await Promise.all([
      supabase.rpc('list_platform_audit_entries', {
        search_text: search.trim() || null,
        resource_filter: resourceFilter,
        action_filter: 'all',
        result_filter: resultFilter,
        range_start: range.start,
        range_end: range.end,
        page_limit: 250,
        page_offset: 0,
      }),
      supabase.rpc('get_audit_security_summary'),
    ])
    const queryError = entriesResult.error || summaryResult.error
    if (queryError) setError(queryError.message)
    else {
      setEntries((entriesResult.data || []) as AuditEntry[])
      setSummary((summaryResult.data || {}) as Summary)
    }
    setLoading(false)
  }, [customDates, dateFilter, resourceFilter, resultFilter, search])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEntries(), 250)
    return () => window.clearTimeout(timer)
  }, [loadEntries])

  const resources = useMemo(() => {
    const values = new Set(entries.map((entry) => entry.resource_type))
    if (resourceFilter !== 'all') values.add(resourceFilter)
    return Array.from(values).sort()
  }, [entries, resourceFilter])
  const totalCount = Number(entries[0]?.total_count || 0)

  return (
    <div className="screen-stack">
      <section className="page-heading page-heading--with-action">
        <div><span className="eyebrow">GOVERNANCE</span><h1>Audit log</h1><p>An append-only, permission-scoped history of meaningful data-changing actions across MULTIVENT.</p></div>
        <button className="secondary-button" onClick={() => void loadEntries()}><MdiIcon path={mdiRefresh} /> Refresh</button>
      </section>

      <section className="stat-grid audit-stat-grid">
        {[
          ['All recorded actions', summary.total_entries, 'Complete retained history'],
          ['Last 24 hours', summary.last_24_hours, 'Recent system activity'],
          ['Permission changes', summary.permission_changes_30_days, 'Past 30 days'],
          ['Financial changes', summary.financial_changes_30_days, 'Past 30 days'],
        ].map(([label, value, detail]) => <article className="stat-card" key={String(label)}><span className="stat-card__icon stat-card__icon--wine"><MdiIcon path={mdiShieldCheckOutline} /></span><div><p>{String(label)}</p><strong>{Number(value || 0).toLocaleString()}</strong><small>{String(detail)}</small></div></article>)}
      </section>

      <div className="audit-explainer"><MdiIcon path={mdiShieldCheckOutline} /><div><strong>Security controls active</strong><p>Application roles cannot edit or delete audit history. Contact details, message bodies, support descriptions, payment references, and private payloads are excluded from automatic row snapshots.</p></div></div>

      <section className="panel data-panel">
        <div className="audit-filter-grid">
          <div className="table-toolbar audit-toolbar">
            <label className="search-box"><MdiIcon path={mdiMagnify} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search action, actor, or record…" /></label>
            <select aria-label="Filter by resource" value={resourceFilter} onChange={(event) => setResourceFilter(event.target.value)}><option value="all">All resources</option>{resources.map((resource) => <option key={resource} value={resource}>{humanize(resource)}</option>)}</select>
            <select aria-label="Filter by result" value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}><option value="all">All results</option><option value="success">Success</option><option value="completed">Completed</option><option value="failed">Failed</option></select>
          </div>
          <div className="business-filter"><span>Date range</span>{[['today','Today'],['week','This week'],['month','This month'],['custom','Custom'],['all','All']].map(([value,label]) => <button type="button" key={value} className={dateFilter === value ? 'selected' : ''} onClick={() => setDateFilter(value)}>{label}</button>)}</div>
          {dateFilter === 'custom' && <div className="audit-custom-dates"><label>From<input aria-label="Audit start date" type="date" value={customDates.start} onChange={(event) => setCustomDates({...customDates,start:event.target.value})}/></label><label>Through<input aria-label="Audit end date" type="date" min={customDates.start || undefined} value={customDates.end} onChange={(event) => setCustomDates({...customDates,end:event.target.value})}/></label></div>}
        </div>
        {error && <InlineError message={`${error} Apply database/38_audit_security_hardening.sql after Phase 8.`} />}
        {loading ? <TableSkeleton /> : entries.length === 0 ? <EmptyState title="No audit entries found" copy="No recorded changes match the selected filters." /> : (
          <div className="audit-list">{entries.map((entry) => <button key={entry.id} className="audit-row" onClick={() => setSelected(entry)}>
            <span className="audit-row__icon"><MdiIcon path={iconForAction(entry.action)} /></span>
            <span className="audit-row__main"><strong>{humanize(entry.action)}</strong><small>{humanize(entry.resource_type)}{entry.resource_id ? ` · ${shortId(entry.resource_id)}` : ''}</small></span>
            <span className="audit-row__actor"><strong>{entry.actor_name || entry.actor_email || 'System'}</strong><small>{humanize(entry.actor_role || 'system')}</small></span>
            <StatusBadge value={entry.result || 'completed'} />
            <time>{formatAuditTime(entry.created_at)}</time>
            <MdiIcon path={mdiChevronRight} />
          </button>)}</div>
        )}
        <footer className="table-footer"><span>Showing {entries.length} of {totalCount.toLocaleString()} matching actions</span><small>Newest actions first · maximum 250 rows</small></footer>
      </section>

      {selected && <AuditDetailModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function AuditDetailModal({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="audit-detail-modal" role="dialog" aria-modal="true" aria-labelledby="audit-title">
      <header><div><span className="eyebrow">AUDIT ENTRY</span><h2 id="audit-title">{humanize(entry.action)}</h2></div><button onClick={onClose} aria-label="Close audit details"><MdiIcon path={mdiClose} /></button></header>
      <div className="audit-detail-modal__body">
        <div className="audit-summary-grid">
          <SummaryItem icon={mdiAccountOutline} label="Actor" value={entry.actor_name || entry.actor_email || 'System process'} detail={humanize(entry.actor_role || 'system')} />
          <SummaryItem icon={mdiDatabaseOutline} label="Resource" value={humanize(entry.resource_type)} detail={entry.resource_id || 'No resource ID'} />
          <SummaryItem icon={mdiClockOutline} label="Timestamp" value={new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(entry.created_at))} detail="Asia/Manila display time" />
          <SummaryItem icon={mdiShieldCheckOutline} label="Result" value={humanize(entry.result || 'completed')} detail={`Audit ID ${shortId(entry.id)}`} />
        </div>
        <section className="audit-change-section"><div><span className="detail-label">PREVIOUS STATE</span><JsonState value={entry.previous_state} empty="This action created a new record." /></div><div><span className="detail-label">NEW STATE</span><JsonState value={entry.new_state} empty="This action removed the record." /></div></section>
        <section className="audit-metadata"><span className="detail-label">METADATA</span><JsonState value={entry.metadata} empty="No additional metadata." /></section>
      </div>
      <footer><button className="secondary-button" onClick={onClose}>Close details</button></footer>
    </section>
  </div>
}

function SummaryItem({ icon, label, value, detail }: { icon: string; label: string; value: string; detail: string }) {
  return <div className="audit-summary-item"><span><MdiIcon path={icon} /></span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></div>
}

function JsonState({ value, empty }: { value: unknown; empty: string }) {
  if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) return <p className="json-empty">{empty}</p>
  return <pre>{JSON.stringify(value, null, 2)}</pre>
}

function humanize(value: string) {
  return value.replaceAll('.', ' ').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value
}

function formatAuditTime(value: string) {
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(date)
  return formatDate(value)
}

function iconForAction(action: string) {
  if (action.includes('profile') || action.includes('role') || action.includes('permission')) return mdiAccountOutline
  if (action.includes('service')) return mdiFileDocumentOutline
  return mdiDatabaseOutline
}
