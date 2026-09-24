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
  action: string
  resource_type: string
  resource_id: string | null
  previous_state: unknown
  new_state: unknown
  result: string | null
  metadata: unknown
  created_at: string
  profiles: unknown
}

const selection = 'id,actor_id,actor_role,action,resource_type,resource_id,previous_state,new_state,result,metadata,created_at,profiles(full_name,email)'

export function AuditLogScreen() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [selected, setSelected] = useState<AuditEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [resourceFilter, setResourceFilter] = useState('all')

  const loadEntries = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('audit_logs')
      .select(selection)
      .order('created_at', { ascending: false })
      .limit(250)
    if (queryError) setError(queryError.message)
    else setEntries((data || []) as unknown as AuditEntry[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    let active = true
    void supabase.from('audit_logs').select(selection).order('created_at', { ascending: false }).limit(250).then(({ data, error: queryError }) => {
      if (!active) return
      if (queryError) setError(queryError.message)
      else setEntries((data || []) as unknown as AuditEntry[])
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const resources = useMemo(() => Array.from(new Set(entries.map((entry) => entry.resource_type))).sort(), [entries])
  const visibleEntries = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return entries.filter((entry) => {
      const actor = nestedRecord(entry.profiles)
      const matchesResource = resourceFilter === 'all' || entry.resource_type === resourceFilter
      const matchesSearch = !needle || [entry.action, entry.resource_type, entry.resource_id, entry.actor_role, actor?.full_name, actor?.email]
        .some((value) => String(value || '').toLowerCase().includes(needle))
      return matchesResource && matchesSearch
    })
  }, [entries, resourceFilter, search])

  return (
    <div className="screen-stack">
      <section className="page-heading page-heading--with-action">
        <div><span className="eyebrow">GOVERNANCE</span><h1>Audit log</h1><p>A tamper-resistant history of meaningful data-changing actions across MULTIVENT.</p></div>
        <button className="secondary-button" onClick={() => void loadEntries()}><MdiIcon path={mdiRefresh} /> Refresh</button>
      </section>

      <div className="audit-explainer"><MdiIcon path={mdiShieldCheckOutline} /><div><strong>What is recorded?</strong><p>Creates, edits, status decisions, approvals, deletions, bookings, payments, reviews, role assignments, and other important writes. Routine page views and searches are intentionally excluded.</p></div></div>

      <section className="panel data-panel">
        <div className="table-toolbar audit-toolbar">
          <label className="search-box"><MdiIcon path={mdiMagnify} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search action, actor, or record…" /></label>
          <select aria-label="Filter by resource" value={resourceFilter} onChange={(event) => setResourceFilter(event.target.value)}><option value="all">All resources</option>{resources.map((resource) => <option key={resource} value={resource}>{humanize(resource)}</option>)}</select>
        </div>
        {error && <InlineError message={`${error} Apply database/22_platform_audit_and_provider_service_crud.sql to enable the expanded audit trail.`} />}
        {loading ? <TableSkeleton /> : visibleEntries.length === 0 ? <EmptyState title="No audit entries found" copy="Meaningful platform changes will appear here." /> : (
          <div className="audit-list">{visibleEntries.map((entry) => {
            const actor = nestedRecord(entry.profiles)
            return <button key={entry.id} className="audit-row" onClick={() => setSelected(entry)}>
              <span className="audit-row__icon"><MdiIcon path={iconForAction(entry.action)} /></span>
              <span className="audit-row__main"><strong>{humanize(entry.action)}</strong><small>{humanize(entry.resource_type)}{entry.resource_id ? ` · ${shortId(entry.resource_id)}` : ''}</small></span>
              <span className="audit-row__actor"><strong>{String(actor?.full_name || actor?.email || 'System')}</strong><small>{humanize(entry.actor_role || 'system')}</small></span>
              <StatusBadge value={entry.result || 'completed'} />
              <time>{formatAuditTime(entry.created_at)}</time>
              <MdiIcon path={mdiChevronRight} />
            </button>
          })}</div>
        )}
        <footer className="table-footer"><span>Showing {visibleEntries.length} of {entries.length} most recent actions</span></footer>
      </section>

      {selected && <AuditDetailModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function AuditDetailModal({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const actor = nestedRecord(entry.profiles)
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="audit-detail-modal" role="dialog" aria-modal="true" aria-labelledby="audit-title">
      <header><div><span className="eyebrow">AUDIT ENTRY</span><h2 id="audit-title">{humanize(entry.action)}</h2></div><button onClick={onClose} aria-label="Close audit details"><MdiIcon path={mdiClose} /></button></header>
      <div className="audit-detail-modal__body">
        <div className="audit-summary-grid">
          <SummaryItem icon={mdiAccountOutline} label="Actor" value={String(actor?.full_name || actor?.email || 'System process')} detail={humanize(entry.actor_role || 'system')} />
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

function nestedRecord(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined
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
  if (action.includes('profile') || action.includes('role')) return mdiAccountOutline
  if (action.includes('service')) return mdiFileDocumentOutline
  return mdiDatabaseOutline
}
