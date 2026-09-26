'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  mdiAlertOutline,
  mdiCheck,
  mdiChevronLeft,
  mdiChevronRight,
  mdiClose,
  mdiDownloadOutline,
  mdiDotsHorizontal,
  mdiEyeOutline,
  mdiFilterVariant,
  mdiMagnify,
  mdiRefresh,
  mdiShieldLockOutline,
  mdiTuneVariant,
} from '@mdi/js'
import { MdiIcon } from '@/components/icons'
import { useStaff } from '@/components/dashboard-shell'
import { EmptyState, formatDate, formatMoney, InlineError, StatusBadge, TableSkeleton } from '@/components/ui'
import { getSupabase } from '@/lib/supabase'
import type { SectionKey } from '@/lib/types'
import { ServicesScreen } from './services-screen'
import { AuditLogScreen } from './audit-log-screen'
import { BusinessOperationsScreen } from './business-operations-screen'

type OperationSection = Exclude<SectionKey, 'overview'>
type BusinessSection = 'revenue' | 'cashflow' | 'remittances' | 'coordinators' | 'support' | 'permissions'
type LegacyTableSection = Exclude<OperationSection, 'settings' | 'services' | 'audit' | BusinessSection>
type Row = Record<string, unknown>
type ConfirmationAction = { id: string; action: string; currentStatus: string; name: string; kind: 'user' | 'provider'; reason: string }

const pageCopy: Record<OperationSection, { eyebrow: string; title: string; description: string }> = {
  users: { eyebrow: 'COMMUNITY', title: 'User management', description: 'View accounts, access roles, and account standing.' },
  providers: { eyebrow: 'MARKETPLACE', title: 'Provider approvals', description: 'Review and manage service provider applications.' },
  services: { eyebrow: 'MARKETPLACE', title: 'Service approvals', description: 'Review provider listings before they become visible to clients.' },
  bookings: { eyebrow: 'OPERATIONS', title: 'Bookings', description: 'Monitor booking activity and lifecycle status.' },
  payments: { eyebrow: 'FINANCE', title: 'Payments', description: 'Track platform transactions and payment verification.' },
  reviews: { eyebrow: 'TRUST & SAFETY', title: 'Reviews', description: 'Monitor feedback and keep the marketplace trustworthy.' },
  revenue: { eyebrow: 'FINANCE', title: 'Revenue', description: 'Track MULTIVENT commission earnings and provider net amounts.' },
  cashflow: { eyebrow: 'FINANCE', title: 'Cash flow', description: 'Follow money entering and leaving MULTIVENT operations.' },
  remittances: { eyebrow: 'OFFICE OPERATIONS', title: 'Cash remittances', description: 'Record and verify coordinator cash handoffs.' },
  coordinators: { eyebrow: 'WORKFORCE', title: 'Coordinator queue', description: 'Resolve pending assignments and view workforce availability.' },
  support: { eyebrow: 'CUSTOMER SERVICE', title: 'Support tickets', description: 'Handle platform, account, booking, and payment concerns.' },
  permissions: { eyebrow: 'GOVERNANCE', title: 'Roles & permissions', description: 'Configure feature access and create internal accounts.' },
  audit: { eyebrow: 'GOVERNANCE', title: 'Audit log', description: 'Trace privileged actions and system changes.' },
  settings: { eyebrow: 'GOVERNANCE', title: 'System settings', description: 'Manage controlled, platform-wide configuration.' },
}

const columns: Record<LegacyTableSection, { key: string; label: string; render?: (row: Row) => React.ReactNode }[]> = {
  users: [
    { key: 'full_name', label: 'User', render: (row) => <Identity title={String(row.full_name || 'Unnamed user')} subtitle={String(row.email || 'No email')} /> },
    { key: 'default_role', label: 'Role', render: (row) => <span className="role-label">{String(row.default_role || 'client').replaceAll('_', ' ')}</span> },
    { key: 'account_status', label: 'Status', render: (row) => <StatusBadge value={String(row.account_status)} /> },
    { key: 'created_at', label: 'Joined', render: (row) => formatDate(String(row.created_at || '')) },
  ],
  providers: [
    { key: 'business_name', label: 'Business', render: (row) => <Identity title={String(row.business_name || 'Unnamed business')} subtitle={String(row.contact_email || row.location || 'No contact supplied')} /> },
    { key: 'description', label: 'Category', render: (row) => String(row.description || 'Unspecified') },
    { key: 'location', label: 'Location' },
    { key: 'terms_accepted', label: 'Agreement', render: (row) => <StatusBadge value={row.terms_accepted ? 'accepted' : 'missing'} /> },
    { key: 'verification_status', label: 'Verification', render: (row) => <StatusBadge value={String(row.verification_status)} /> },
    { key: 'created_at', label: 'Applied', render: (row) => formatDate(String(row.created_at || '')) },
  ],
  bookings: [
    { key: 'id', label: 'Booking', render: (row) => <strong className="record-id">MV-{String(row.id).slice(0, 6).toUpperCase()}</strong> },
    { key: 'requested_date', label: 'Event date', render: (row) => formatDate(String(row.requested_date || '')) },
    { key: 'amount', label: 'Amount', render: (row) => <strong>{formatMoney(row.amount as number)}</strong> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge value={String(row.status)} /> },
    { key: 'created_at', label: 'Requested', render: (row) => formatDate(String(row.created_at || '')) },
  ],
  payments: [
    { key: 'provider_reference', label: 'Reference', render: (row) => <strong className="record-id">{String(row.provider_reference || String(row.id).slice(0, 8)).toUpperCase()}</strong> },
    { key: 'provider', label: 'Method' },
    { key: 'amount', label: 'Amount', render: (row) => <strong>{formatMoney(row.amount as number)}</strong> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge value={String(row.status)} /> },
    { key: 'created_at', label: 'Created', render: (row) => formatDate(String(row.created_at || '')) },
  ],
  reviews: [
    { key: 'rating', label: 'Rating', render: (row) => <span className="rating">★ {String(row.rating || 0)}.0</span> },
    { key: 'comment', label: 'Review', render: (row) => <span className="review-copy">{String(row.comment || 'No written feedback')}</span> },
    { key: 'sentiment_label', label: 'Sentiment', render: (row) => <StatusBadge value={String(row.sentiment_label || 'published')} /> },
    { key: 'created_at', label: 'Submitted', render: (row) => formatDate(String(row.created_at || '')) },
  ],
}

const queries: Record<LegacyTableSection, { table: string; select: string; order: string }> = {
  users: { table: 'profiles', select: 'id,full_name,email,default_role,account_status,created_at', order: 'created_at' },
  providers: { table: 'provider_profiles', select: 'id,user_id,business_name,description,contact_email,contact_phone,location,verification_status,terms_accepted,terms_version,terms_accepted_at,rejection_reason,reviewed_at,reviewed_by,created_at,updated_at,profiles!provider_profiles_user_id_fkey(full_name,email,phone,account_status)', order: 'created_at' },
  bookings: { table: 'bookings', select: 'id,requested_date,amount,status,created_at', order: 'created_at' },
  payments: { table: 'payments', select: 'id,provider_reference,provider,amount,status,created_at', order: 'created_at' },
  reviews: { table: 'reviews', select: 'id,rating,comment,sentiment_label,created_at', order: 'created_at' },
}

export function OperationsScreen({ section }: { section: OperationSection }) {
  const { can } = useStaff()
  const copy = pageCopy[section]
  const permissionBySection: Record<OperationSection, string> = {
    users: 'users.view', providers: 'providers.view', services: 'services.view',
    bookings: 'events.view', payments: 'cashflow.view', reviews: 'providers.view',
    revenue: 'revenue.view', cashflow: 'cashflow.view', remittances: 'remittance.view',
    coordinators: 'coordinators.view', support: 'support.view',
    permissions: 'users.permissions.manage', audit: 'system.audit_logs', settings: 'system.settings',
  }

  if (section === 'permissions') {
    if (!can('users.permissions.manage') && !can('users.create') && !can('coordinators.create')) return <RestrictedScreen />
  } else if (!can(permissionBySection[section])) return <RestrictedScreen />

  if (section === 'settings') return <SettingsScreen />
  if (section === 'services') return <ServicesScreen />
  if (section === 'audit') return <AuditLogScreen />
  if (['revenue', 'cashflow', 'remittances', 'coordinators', 'support', 'permissions'].includes(section)) {
    return <BusinessOperationsScreen section={section as BusinessSection} />
  }
  return <TableScreen section={section as LegacyTableSection} copy={copy} />
}

function TableScreen({ section, copy }: { section: LegacyTableSection; copy: typeof pageCopy[OperationSection] }) {
  const { can, profile } = useStaff()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationAction | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<Row | null>(null)

  const loadRows = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return
    setLoading(true)
    setError('')
    const query = queries[section]
    const { data, error: queryError } = await supabase.from(query.table).select(query.select).order(query.order, { ascending: false }).limit(100)
    if (queryError) setError(queryError.message)
    else setRows((data || []) as unknown as Row[])
    setLoading(false)
  }, [section])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    let active = true
    const query = queries[section]
    void supabase.from(query.table).select(query.select).order(query.order, { ascending: false }).limit(100).then(({ data, error: queryError }) => {
      if (!active) return
      if (queryError) setError(queryError.message)
      else setRows((data || []) as unknown as Row[])
      setLoading(false)
    })
    return () => { active = false }
  }, [section])

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch = !needle || Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(needle))
      const role = String(row.default_role || '')
      const matchesFilter = filter === 'all'
        || (section === 'users' && filter === 'internal' && ['admin', 'superadmin', 'assistant', 'customer_service', 'event_coordinator'].includes(role))
        || (section === 'users' && role === filter)
        || (section === 'providers' && (String(row.verification_status) === filter || String(row.description || '').toLowerCase() === filter))
      return matchesSearch && matchesFilter
    })
  }, [filter, rows, search, section])

  const filterOptions = section === 'users'
    ? [['all', 'All users'], ['client', 'Clients'], ['service_provider', 'Service providers'], ['event_coordinator', 'Event coordinators'], ['internal', 'Internal staff']]
    : section === 'providers'
      ? [['all', 'All providers'], ['pending', 'Pending'], ['verified', 'Approved'], ['disabled', 'Rejected'], ...Array.from(new Set(rows.map((row) => String(row.description || '').trim()).filter(Boolean))).map((value) => [value.toLowerCase(), value])]
      : []

  async function moderate(id: string, action: string) {
    const supabase = getSupabase()
    if (!supabase) return
    setBusyId(id)
    const rpc = section === 'users' ? 'admin_set_account_status' : 'admin_set_provider_verification'
    const args = section === 'users'
      ? { target_user_id: id, new_status: action, reason: confirmation?.reason.trim() || null }
      : { target_provider_id: id, new_status: action, reason: confirmation?.reason.trim() || null }
    const { error: actionError } = await supabase.rpc(rpc, args)
    setBusyId('')
    if (actionError) setError(actionError.message)
    else {
      setConfirmation(null)
      setSelectedProvider(null)
      void loadRows()
    }
  }

  function canManageUser(row: Row) {
    const targetRole = String(row.default_role)
    if (String(row.id) === profile.id || targetRole === 'superadmin') return false
    if (targetRole === 'admin') return profile.default_role === 'superadmin'
    return true
  }

  return (
    <div className="screen-stack">
      <section className="page-heading page-heading--with-action">
        <div><span className="eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.description}</p></div>
        <button className="secondary-button" onClick={() => void loadRows()}><MdiIcon path={mdiRefresh} /> Refresh</button>
      </section>

      <section className="panel data-panel">
        <div className="table-toolbar">
          <label className="search-box"><MdiIcon path={mdiMagnify} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${copy.title.toLowerCase()}…`} /><kbd>⌘ K</kbd></label>
          <div>{filterOptions.length > 0 && <select className="inline-select" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter records">{filterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}<button className="tool-button"><MdiIcon path={mdiFilterVariant} /> Filter</button><button className="tool-button"><MdiIcon path={mdiDownloadOutline} /> Export</button></div>
        </div>
        {error && <InlineError message={`${error} Apply database/20_admin_web_access.sql if staff access policies are not installed yet.`} onClose={() => setError('')} />}
        {loading ? <TableSkeleton /> : visibleRows.length === 0 ? <EmptyState title={`No ${copy.title.toLowerCase()} found`} copy={search ? 'Try a different search term.' : 'Records will appear here when they become available.'} /> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr>{columns[section].map((column) => <th key={column.key}>{column.label}</th>)}{((section === 'users' && can('users.update')) || (section === 'providers' && can('providers.review'))) && <th><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody>{visibleRows.map((row) => (
                <tr key={String(row.id)}>
                  {columns[section].map((column) => <td key={column.key} data-label={column.label}>{column.render ? column.render(row) : String(row[column.key] ?? '—')}</td>)}
                  {section === 'users' && can('users.update') && <td className="row-actions">{canManageUser(row) && <button disabled={busyId === row.id} title="Manage account status" onClick={() => setConfirmation({ id: String(row.id), action: String(row.account_status), currentStatus: String(row.account_status), name: String(row.full_name || row.email || 'this user'), kind: 'user', reason: '' })}><MdiIcon path={mdiDotsHorizontal} /></button>}</td>}
                  {section === 'providers' && can('providers.review') && <td className="row-actions"><button className="review-button" disabled={busyId === row.id} title="Inspect provider application" onClick={() => setSelectedProvider(row)}><MdiIcon path={mdiEyeOutline} /> Review</button></td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <footer className="table-footer"><span>Showing {visibleRows.length} of {rows.length} records</span><div><button disabled><MdiIcon path={mdiChevronLeft} /></button><b>1</b><button disabled><MdiIcon path={mdiChevronRight} /></button></div></footer>
      </section>
      {confirmation && (
        <ModerationDialog
          value={confirmation}
          busy={busyId === confirmation.id}
          onChange={setConfirmation}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void moderate(confirmation.id, confirmation.action)}
        />
      )}
      {section === 'providers' && selectedProvider && (
        <ProviderApplicationModal
          provider={selectedProvider}
          canApprove={can('providers.approve')}
          canReject={can('providers.reject')}
          onClose={() => setSelectedProvider(null)}
          onDecision={(action) => setConfirmation({
            id: String(selectedProvider.id),
            action,
            currentStatus: String(selectedProvider.verification_status),
            name: String(selectedProvider.business_name || 'this provider'),
            kind: 'provider',
            reason: '',
          })}
        />
      )}
    </div>
  )
}

function ProviderApplicationModal({ provider, canApprove, canReject, onClose, onDecision }: {
  provider: Row
  canApprove: boolean
  canReject: boolean
  onClose: () => void
  onDecision: (action: 'verified' | 'disabled') => void
}) {
  const profileValue = Array.isArray(provider.profiles) ? provider.profiles[0] : provider.profiles
  const profile = profileValue && typeof profileValue === 'object' ? profileValue as Row : {}
  const reviewable = ['pending', 'disabled'].includes(String(provider.verification_status))
  const termsCurrent = provider.terms_accepted && provider.terms_version === '2026-09-25-commission-v1'

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="service-detail-modal provider-application-modal" role="dialog" aria-modal="true" aria-labelledby="provider-application-title">
        <header><button onClick={onClose} aria-label="Close provider application"><MdiIcon path={mdiChevronLeft} /></button><div><span className="eyebrow">PROVIDER APPLICATION</span><h2 id="provider-application-title">{String(provider.business_name || 'Unnamed business')}</h2></div><StatusBadge value={String(provider.verification_status)} /></header>
        <div className="service-detail-modal__body provider-application-body">
          <section className="provider-application-summary">
            <div><span>Applicant</span><strong>{String(profile.full_name || 'Not supplied')}</strong><small>{String(profile.email || provider.contact_email || 'No email')}</small></div>
            <div><span>Submitted</span><strong>{formatDate(String(provider.created_at || ''))}</strong><small>{provider.reviewed_at ? `Last reviewed ${formatDate(String(provider.reviewed_at))}` : 'Not reviewed yet'}</small></div>
            <div><span>Commission agreement</span><StatusBadge value={termsCurrent ? 'accepted' : 'missing'} /><small>{provider.terms_version ? String(provider.terms_version) : 'Current terms not accepted'}</small></div>
          </section>
          <div className="provider-application-grid">
            <section><span className="detail-label">BUSINESS DESCRIPTION</span><p>{String(provider.description || 'No business description was supplied.')}</p></section>
            <dl>
              <div><dt>Contact email</dt><dd>{String(provider.contact_email || profile.email || 'Not supplied')}</dd></div>
              <div><dt>Contact phone</dt><dd>{String(provider.contact_phone || profile.phone || 'Not supplied')}</dd></div>
              <div><dt>Location</dt><dd>{String(provider.location || 'Not supplied')}</dd></div>
              <div><dt>Account standing</dt><dd><StatusBadge value={String(profile.account_status || provider.verification_status)} /></dd></div>
            </dl>
          </div>
          {Boolean(provider.rejection_reason) && <section className="previous-note"><strong>Previous rejection reason</strong><p>{String(provider.rejection_reason)}</p></section>}
          {!termsCurrent && <div className="inline-warning"><MdiIcon path={mdiAlertOutline} /><span>This application cannot be approved until the provider accepts the current commission agreement.</span></div>}
        </div>
        <footer><button className="secondary-button" onClick={onClose}>Close</button>{reviewable && (canApprove || canReject) && <div>{canReject && <button className="decline-button" onClick={() => onDecision('disabled')}><MdiIcon path={mdiClose} /> Reject</button>}{canApprove && <button className="approve-button" disabled={!termsCurrent} onClick={() => onDecision('verified')}><MdiIcon path={mdiCheck} /> Approve provider</button>}</div>}</footer>
      </section>
    </div>
  )
}

function SettingsScreen() {
  const [settings, setSettings] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    void supabase.from('system_settings').select('id,key,value,description,updated_at').order('key').then(({ data, error: queryError }) => {
      if (queryError) setError(queryError.message)
      else setSettings((data || []).map((item) => ({ ...item, value: unwrapValue(item.value) })))
      setLoading(false)
    })
  }, [])

  async function saveSetting(setting: Row, value: unknown) {
    if (!window.confirm(`Update “${String(setting.key).replaceAll('_', ' ')}”? This change affects the whole platform.`)) return
    const supabase = getSupabase()
    if (!supabase) return
    const { error: updateError } = await supabase.rpc('superadmin_upsert_system_setting', {
      setting_key: setting.key,
      setting_value: { value },
      setting_description: setting.description,
    })
    if (updateError) setError(updateError.message)
    else setSettings((current) => current.map((item) => item.id === setting.id ? { ...item, value } : item))
  }

  return (
    <div className="screen-stack">
      <section className="page-heading"><span className="eyebrow">GOVERNANCE</span><h1>System settings</h1><p>Manage controlled, platform-wide configuration.</p></section>
      {error && <InlineError message={`${error} Apply database/20_admin_web_access.sql if the governance policies are not installed yet.`} />}
      <section className="settings-layout">
        <div className="panel settings-panel">
          <header><span><MdiIcon path={mdiTuneVariant} /></span><div><h2>Platform configuration</h2><p>Changes are applied immediately and written to the audit log.</p></div></header>
          {loading ? <TableSkeleton rows={3} /> : settings.length === 0 ? <EmptyState title="No settings configured" copy="Add rows to system_settings to manage them here." /> : (
            <div className="settings-list">{settings.map((setting) => (
              <div key={String(setting.id)} className="setting-row">
                <div><strong>{String(setting.key).replaceAll('_', ' ')}</strong><p>{String(setting.description || 'No description')}</p></div>
                {typeof setting.value === 'boolean' ? (
                  <button className={`switch ${setting.value ? 'switch--on' : ''}`} role="switch" aria-checked={Boolean(setting.value)} onClick={() => saveSetting(setting, !setting.value)}><i /></button>
                ) : (
                  <input aria-label={String(setting.key)} value={String(setting.value ?? '')} onChange={(event) => setSettings((current) => current.map((item) => item.id === setting.id ? { ...item, value: event.target.value } : item))} onBlur={(event) => saveSetting(setting, Number(event.target.value) || event.target.value)} />
                )}
              </div>
            ))}</div>
          )}
        </div>
        <aside className="governance-note"><MdiIcon path={mdiAlertOutline} /><h3>Handle with care</h3><p>System settings can affect every user. Confirm values in a staging environment before changing production.</p></aside>
      </section>
    </div>
  )
}

function RestrictedScreen() {
  return <div className="restricted-screen"><span><MdiIcon path={mdiShieldLockOutline} /></span><p className="eyebrow">RESTRICTED</p><h1>This area has elevated access.</h1><p>Your current role permissions do not allow access to this feature.</p></div>
}

function Identity({ title, subtitle }: { title: string; subtitle: string }) {
  const initials = title.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <div className="identity"><span>{initials}</span><div><strong>{title}</strong><small>{subtitle}</small></div></div>
}

function unwrapValue(value: unknown) {
  if (value && typeof value === 'object' && 'value' in value) return (value as { value: unknown }).value
  return value
}

function ModerationDialog({ value, busy, onChange, onCancel, onConfirm }: { value: ConfirmationAction; busy: boolean; onChange: (value: ConfirmationAction) => void; onCancel: () => void; onConfirm: () => void }) {
  const isUser = value.kind === 'user'
  const actionLabel = value.action === 'active' ? 'Activate' : value.action === 'verified' ? 'Approve' : value.action === 'suspended' ? 'Suspend' : isUser ? 'Disable' : 'Reject'
  const copy = isUser
    ? `${actionLabel} ${value.name}'s account? Their access will change immediately and this action will be recorded in the audit log.`
    : value.action === 'verified'
      ? `Approve ${value.name} as a verified provider?`
      : `Decline ${value.name}'s provider application? Their provider access will be disabled.`

  return (
    <div className="modal-backdrop modal-backdrop--front">
      <section className="confirmation-dialog account-dialog" role="alertdialog" aria-modal="true" aria-labelledby="moderation-title">
        <span className={`confirmation-dialog__icon ${value.action === 'active' || value.action === 'verified' ? 'confirmation-dialog__icon--approved' : 'confirmation-dialog__icon--declined'}`}><MdiIcon path={value.action === 'active' || value.action === 'verified' ? mdiCheck : mdiAlertOutline} /></span>
        <h2 id="moderation-title">{isUser ? 'Confirm account change' : 'Confirm provider decision'}</h2>
        {isUser && <div className="status-choice" role="radiogroup" aria-label="New account status">{[
          ['active', 'Active', 'Normal account access'],
          ['suspended', 'Suspended', 'Temporary access restriction'],
          ['disabled', 'Disabled', 'Indefinite access restriction'],
        ].map(([status, title, detail]) => <button key={status} role="radio" aria-checked={value.action === status} className={value.action === status ? 'selected' : ''} onClick={() => onChange({ ...value, action: status })}><i /> <span><strong>{title}</strong><small>{detail}</small></span></button>)}</div>}
        <p>{copy}</p>
        {(value.action === 'disabled' || (isUser && value.action === 'suspended')) && <label className="decision-note account-reason"><span>{isUser ? 'Reason for this restriction' : 'Provider rejection reason'}</span><textarea value={value.reason} onChange={(event) => onChange({ ...value, reason: event.target.value })} placeholder="Briefly explain the decision…" /></label>}
        <div className="confirmation-dialog__actions"><button className="secondary-button" disabled={busy} onClick={onCancel}>Cancel</button><button className={value.action === 'active' || value.action === 'verified' ? 'confirm-button confirm-button--approve' : 'confirm-button confirm-button--decline'} disabled={busy || (isUser && value.action === value.currentStatus) || ((value.action === 'suspended' || value.action === 'disabled') && !value.reason.trim())} onClick={onConfirm}>{busy ? 'Applying…' : `${actionLabel} ${isUser ? 'account' : 'application'}`}</button></div>
      </section>
    </div>
  )
}
