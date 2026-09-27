'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  mdiAccountPlusOutline,
  mdiCashCheck,
  mdiChartLine,
  mdiCheck,
  mdiChevronDown,
  mdiRefresh,
  mdiShieldKeyOutline,
} from '@mdi/js'
import { MdiIcon } from '@/components/icons'
import { EmptyState, formatDate, formatMoney, InlineError, SegmentedFilter, StatusBadge, TableSkeleton } from '@/components/ui'
import { useStaff } from '@/components/dashboard-shell'
import { getSupabase } from '@/lib/supabase'

export type BusinessSection = 'revenue' | 'cashflow' | 'remittances' | 'coordinators' | 'support' | 'permissions'
type Row = Record<string, unknown>
type PermissionChoice = 'inherit' | 'grant' | 'deny'
type PermissionGroupState = 'off' | 'partial' | 'on'
type PermissionGroup = {
  key: string
  label: string
  description: string
  permissions: Row[]
}

function sumRemittanceRemaining(expectations: Row[]) {
  return Math.round(
    expectations.reduce((total, item) => total + Number(item.amount_remaining || 0), 0) * 100,
  ) / 100
}

type RemittanceEventGroup = {
  amountExpected: number
  amountReceived: number
  coordinatorName: string
  eventDate: string
  eventId: string
  eventName: string
  latestRecordedAt: string
  recordedBy: string
  rows: Row[]
  status: string
}

function groupRemittancesByEvent(rows: Row[]): RemittanceEventGroup[] {
  const groups = new Map<string, RemittanceEventGroup>()
  for (const row of rows) {
    const eventId = String(row.event_id || '')
    if (!eventId) continue
    const existing = groups.get(eventId)
    const event = row.events as Row | null
    const recordedAt = String(row.received_at || row.created_at || '')
    if (!existing) {
      groups.set(eventId, {
        amountExpected: String(row.status) === 'disputed' ? 0 : Number(row.amount_expected || 0),
        amountReceived: String(row.status) === 'disputed' ? 0 : Number(row.amount_received || 0),
        coordinatorName: String((row.coordinator as Row | null)?.full_name || 'Coordinator'),
        eventDate: String(event?.event_date || ''),
        eventId,
        eventName: String(event?.name || eventId.slice(0, 8)),
        latestRecordedAt: recordedAt,
        recordedBy: String((row.receiver as Row | null)?.full_name || 'MULTIVENT staff'),
        rows: [row],
        status: String(row.status || 'pending'),
      })
      continue
    }
    if (String(row.status) !== 'disputed') {
      existing.amountExpected += Number(row.amount_expected || 0)
      existing.amountReceived += Number(row.amount_received || 0)
    }
    existing.rows.push(row)
    if (new Date(recordedAt).getTime() > new Date(existing.latestRecordedAt).getTime()) {
      existing.latestRecordedAt = recordedAt
      existing.recordedBy = String((row.receiver as Row | null)?.full_name || 'MULTIVENT staff')
    }
    const statuses = existing.rows.map((item) => String(item.status))
    const activeStatuses = statuses.filter((status) => status !== 'disputed')
    existing.status = activeStatuses.length === 0
      ? 'disputed'
      : activeStatuses.every((status) => status === 'verified')
      ? 'verified'
        : activeStatuses.every((status) => ['remitted', 'verified'].includes(status))
          ? 'remitted'
          : activeStatuses.some((status) => status === 'partially_remitted')
            ? 'partially_remitted'
            : 'pending'
  }

  return [...groups.values()].sort(
    (left, right) => new Date(right.latestRecordedAt).getTime() - new Date(left.latestRecordedAt).getTime(),
  )
}

const permissionGroupDefinitions = [
  { key: 'analytics', label: 'Business dashboard', description: 'View business totals, trends, provider performance, and operational summaries.', codes: ['dashboard.analytics.view'] },
  { key: 'users-view', label: 'User directory', description: 'View registered user profiles and account standing.', codes: ['users.view'] },
  { key: 'users-create', label: 'Create staff accounts', description: 'Create Assistant and Customer Service accounts. Admin creation remains Superadmin-only.', codes: ['users.create'] },
  { key: 'users-update', label: 'Manage account status', description: 'Suspend, reactivate, or disable eligible user accounts.', codes: ['users.update'] },
  { key: 'permissions', label: 'Roles and feature access', description: 'Change role defaults and individual staff access.', codes: ['users.permissions.manage'] },
  { key: 'providers', label: 'Provider approvals', description: 'View and review provider applications, then approve or reject them.', codes: ['providers.view', 'providers.review', 'providers.approve', 'providers.reject'] },
  { key: 'services', label: 'Service approvals', description: 'View and review service submissions, then approve or decline them.', codes: ['services.view', 'services.review', 'services.approve', 'services.reject'] },
  { key: 'coordinators-create', label: 'Create coordinators', description: 'Create employed Event Coordinator accounts.', codes: ['coordinators.create'] },
  { key: 'coordinators', label: 'Coordinator assignments', description: 'View the coordinator workforce and assign or replace event coordinators.', codes: ['coordinators.view', 'coordinators.assign', 'coordinators.reassign'] },
  { key: 'events', label: 'Event operations', description: 'View bookings and events and manage their operational workflow.', codes: ['events.view', 'events.manage'] },
  { key: 'finance', label: 'Revenue and cash flow', description: 'View commission revenue, transaction records, and platform cash movement.', codes: ['revenue.view', 'cashflow.view'] },
  { key: 'payments', label: 'Payment verification', description: 'Verify payment records when the payment workflow requires staff review.', codes: ['payment.verify'] },
  { key: 'remittance', label: 'Cash remittances', description: 'View and record coordinator cash handoffs, including verification and disputes.', codes: ['remittance.view', 'remittance.create', 'remittance.verify'] },
  { key: 'support', label: 'Customer support', description: 'View, assign, respond to, resolve, and close support tickets.', codes: ['support.view', 'support.assign', 'support.respond', 'support.resolve'] },
  { key: 'settings', label: 'System settings', description: 'Change protected platform configuration, including commission settings.', codes: ['system.settings'] },
  { key: 'audit', label: 'Audit history', description: 'View privileged records of administrative and security-sensitive changes.', codes: ['system.audit_logs'] },
] as const

const permissionActionLabels: Record<string, string> = {
  'dashboard.analytics.view': 'View business dashboard',
  'users.view': 'View user directory',
  'users.create': 'Create staff accounts',
  'users.update': 'Manage account status',
  'users.permissions.manage': 'Manage roles and access',
  'providers.view': 'View provider applications',
  'providers.review': 'Review provider details',
  'providers.approve': 'Approve provider applications',
  'providers.reject': 'Reject provider applications',
  'services.view': 'View service submissions',
  'services.review': 'Review service details',
  'services.approve': 'Approve service submissions',
  'services.reject': 'Decline service submissions',
  'coordinators.create': 'Create coordinator accounts',
  'coordinators.view': 'View coordinator workforce',
  'coordinators.assign': 'Assign coordinators',
  'coordinators.reassign': 'Replace coordinators',
  'events.view': 'View events and bookings',
  'events.manage': 'Manage event operations',
  'revenue.view': 'View commission revenue',
  'cashflow.view': 'View platform cash flow',
  'payment.verify': 'Verify payment records',
  'remittance.view': 'View cash remittances',
  'remittance.create': 'Record cash remittances',
  'remittance.verify': 'Verify or dispute remittances',
  'support.view': 'View support tickets',
  'support.assign': 'Assign support tickets',
  'support.respond': 'Respond to support tickets',
  'support.resolve': 'Resolve and close tickets',
  'system.settings': 'Manage system settings',
  'system.audit_logs': 'View audit history',
}

function permissionActionLabel(permission: Row) {
  const code = String(permission.code)
  return permissionActionLabels[code] || code
    .split('.')
    .map((part) => part.replaceAll('_', ' '))
    .join(' · ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function buildPermissionGroups(permissions: Row[]): PermissionGroup[] {
  const byCode = new Map(permissions.map((permission) => [String(permission.code), permission]))
  return permissionGroupDefinitions.map((definition) => ({
    key: definition.key,
    label: definition.label,
    description: definition.description,
    permissions: definition.codes.map((code) => byCode.get(code)).filter((permission): permission is Row => Boolean(permission)),
  })).filter((group) => group.permissions.length > 0)
}

function booleanGroupState(group: PermissionGroup, enabledIds: Set<string>): PermissionGroupState {
  const enabledCount = group.permissions.filter((permission) => enabledIds.has(String(permission.id))).length
  if (enabledCount === 0) return 'off'
  if (enabledCount === group.permissions.length) return 'on'
  return 'partial'
}

function overrideGroupChoice(group: PermissionGroup, overrides: Map<string, boolean>): PermissionChoice | 'mixed' {
  const choices = group.permissions.map((permission) => {
    const permissionId = String(permission.id)
    return overrides.has(permissionId) ? (overrides.get(permissionId) ? 'grant' : 'deny') : 'inherit'
  })
  return choices.every((choice) => choice === choices[0]) ? choices[0] : 'mixed'
}

function creationGroupChoice(group: PermissionGroup, overrides: Record<string, PermissionChoice>): PermissionChoice | 'mixed' {
  const choices = group.permissions.map((permission) => overrides[String(permission.code)] || 'inherit')
  return choices.every((choice) => choice === choices[0]) ? choices[0] : 'mixed'
}

const formatDateTime = (value: unknown) => {
  const date = new Date(String(value || ''))
  return Number.isNaN(date.getTime())
    ? 'Schedule incomplete'
    : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

const formatReportMonth = (value: string) => {
  const parsed = new Date(`${value}-01T00:00:00Z`)
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-PH', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed)
}

const cashFlowRange = (filter: string, custom: { start: string; end: string }) => {
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

const formatSupportPayment = (bookingValue: unknown) => {
  const booking = Array.isArray(bookingValue) ? bookingValue[0] as Row | undefined : bookingValue as Row | null
  if (!booking) return 'No booking or payment details'
  const payments = Array.isArray(booking.payments) ? booking.payments as Row[] : []
  const latest = payments[0]
  if (!latest) return `${String(booking.status || 'unknown').replaceAll('_', ' ')} · ${formatMoney(Number(booking.amount || 0))}`
  return `${String(latest.status || 'unknown').replaceAll('_', ' ')} · ${String(latest.provider || 'payment')} · ${formatMoney(Number(latest.amount || 0))}`
}

const copy: Record<BusinessSection, { eyebrow: string; title: string; description: string }> = {
  revenue: { eyebrow: 'FINANCE', title: 'Revenue', description: 'Commission earned by MULTIVENT from completed payment activity.' },
  cashflow: { eyebrow: 'FINANCE', title: 'Cash flow', description: 'Gross receipts, provider payables, releases, refunds, and adjustments.' },
  remittances: { eyebrow: 'OFFICE OPERATIONS', title: 'Cash remittances', description: 'Coordinator cash handoffs recorded at the MULTIVENT office.' },
  coordinators: { eyebrow: 'WORKFORCE', title: 'Coordinator queue', description: 'Events stay valid while MULTIVENT finds a conflict-free coordinator.' },
  support: { eyebrow: 'CUSTOMER SERVICE', title: 'Support tickets', description: 'Platform-related account, booking, payment, and technical concerns.' },
  permissions: { eyebrow: 'GOVERNANCE', title: 'Roles & permissions', description: 'Dynamic feature access and internal account provisioning.' },
}

export function BusinessOperationsScreen({ section }: { section: BusinessSection }) {
  if (section === 'revenue') return <RevenueScreen />
  if (section === 'cashflow') return <CashFlowScreen />
  if (section === 'permissions') return <PermissionsScreen />
  return <OperationalQueue section={section} />
}

function Heading({ section, onRefresh }: { section: BusinessSection; onRefresh?: () => void }) {
  const value = copy[section]
  return (
    <section className="page-heading page-heading--with-action">
      <div><span className="eyebrow">{value.eyebrow}</span><h1>{value.title}</h1><p>{value.description}</p></div>
      {onRefresh && <button className="secondary-button" onClick={onRefresh}><MdiIcon path={mdiRefresh} /> Refresh</button>}
    </section>
  )
}

function RevenueScreen() {
  const [data, setData] = useState<Row>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return
    setLoading(true)
    setError('')
    const { data: result, error: queryError } = await supabase.rpc('get_revenue_dashboard')
    if (queryError) setError(queryError.message)
    else setData((result || {}) as Row)
    setLoading(false)
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const monthly = Array.isArray(data.monthly) ? data.monthly as Row[] : []
  const paymentMethods = Array.isArray(data.payment_methods) ? data.payment_methods as Row[] : []
  const topProviders = Array.isArray(data.top_providers) ? data.top_providers as Row[] : []
  const currentMonth = data.current_month && typeof data.current_month === 'object' ? data.current_month as Row : {}
  const maximum = Math.max(1, ...monthly.map((item) => Number(item.gross || 0)))
  const commissionChange = currentMonth.percent_change == null
    ? 'No prior-month baseline'
    : `${Number(currentMonth.percent_change) > 0 ? '+' : ''}${Number(currentMonth.percent_change).toFixed(1)}% from last month`
  return (
    <div className="screen-stack">
      <Heading section="revenue" onRefresh={() => void load()} />
      {error && <InlineError message={error} />}
      {loading ? <TableSkeleton rows={4} /> : <>
        <section className="stat-grid">
          {[
            ['Client payment value', data.gross_amount, 'Includes MULTIVENT commission'],
            ['Commission revenue', data.commission_amount, `${Number(data.commission_rate ?? 0.10) * 100}% added to provider prices`],
            ['Provider service value', data.provider_net_amount, 'Provider-listed amount payable'],
            ['This month', currentMonth.commission, commissionChange],
          ].map(([label, value, detail], index) => (
            <article className="stat-card" key={String(label)}>
              <span className={`stat-card__icon stat-card__icon--${index === 1 ? 'green' : 'wine'}`}><MdiIcon path={index === 3 ? mdiCashCheck : mdiChartLine} /></span>
              <div><p>{String(label)}</p><strong>{formatMoney(Number(value || 0))}</strong><small>{String(detail)}</small></div>
            </article>
          ))}
        </section>
        <section className="panel business-panel">
          <header><div><span className="eyebrow">LAST 12 MONTHS</span><h2>Client payments and commission</h2></div></header>
          {monthly.length === 0 ? <EmptyState title="No recognized revenue yet" copy="Paid and verified provider transactions will appear here." /> : (
            <div className="revenue-bars">{monthly.map((item) => {
              const gross = Number(item.gross || 0)
              return <div key={String(item.month)}><span>{formatReportMonth(String(item.month))}</span><i style={{ width: `${gross === 0 ? 0 : Math.max(2, gross / maximum * 100)}%` }} /><strong>{formatMoney(Number(item.commission || 0))}</strong></div>
            })}</div>
          )}
        </section>
        <section className="finance-breakdown-grid">
          <article className="panel ranking-panel"><header><div><span className="eyebrow">PAYMENT CHANNELS</span><h2>Revenue by method</h2></div></header>{paymentMethods.length ? paymentMethods.map((item, index) => <div className="ranking-row ranking-row--detailed" key={String(item.method)}><b>{index + 1}</b><span><strong>{String(item.method)}</strong><small>{Number(item.transactions || 0)} transactions · {formatMoney(Number(item.gross || 0))} gross</small></span><em>{formatMoney(Number(item.commission || 0))}</em></div>) : <EmptyState title="No payment data" copy="Payment channels appear after revenue is recognized." />}</article>
          <article className="panel ranking-panel"><header><div><span className="eyebrow">COMMISSION SOURCES</span><h2>Provider contribution</h2></div></header>{topProviders.length ? topProviders.map((item, index) => <div className="ranking-row ranking-row--detailed" key={String(item.id)}><b>{index + 1}</b><span><strong>{String(item.name)}</strong><small>{Number(item.transactions || 0)} transactions · {formatMoney(Number(item.gross || 0))} gross</small></span><em>{formatMoney(Number(item.commission || 0))}</em></div>) : <EmptyState title="No provider revenue" copy="Provider contribution appears after recognized payments." />}</article>
        </section>
      </>}
    </div>
  )
}

function CashFlowScreen() {
  const [data, setData] = useState<Row>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [transactionType, setTransactionType] = useState('all')
  const [status, setStatus] = useState('all')
  const [customDates, setCustomDates] = useState({ start: '', end: '' })

  const load = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return
    setLoading(true)
    setError('')
    const range = cashFlowRange(dateFilter, customDates)
    const { data: result, error: queryError } = await supabase.rpc('get_cash_flow_report', {
      range_start: range.start,
      range_end: range.end,
      target_type: transactionType,
      target_status: status,
      page_limit: 500,
      page_offset: 0,
    })
    if (queryError) setError(queryError.message)
    else setData((result || {}) as Row)
    setLoading(false)
  }, [customDates, dateFilter, status, transactionType])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const summary = data.summary && typeof data.summary === 'object' ? data.summary as Row : {}
  const rows = Array.isArray(data.rows) ? data.rows as Row[] : []
  return <div className="screen-stack">
    <Heading section="cashflow" onRefresh={() => void load()} />
    {error && <InlineError message={error} />}
    <section className="stat-grid finance-stat-grid">
      {[
        ['Amount received', summary.amount_received, 'Recorded inflows'],
        ['Amount released', summary.amount_released, 'Recorded outflows'],
        ['Net cash movement', summary.net_cash_movement, 'Received less released'],
        ['Commission revenue', summary.commission_revenue, 'Recognized MULTIVENT income'],
        ['Provider payable', summary.provider_payable, 'Recognized provider net'],
        ['Refunds', summary.refunds, 'Released through refunds'],
      ].map(([label, value, detail], index) => <article className="stat-card" key={String(label)}><span className={`stat-card__icon stat-card__icon--${index === 2 || index === 3 ? 'green' : 'wine'}`}><MdiIcon path={index === 1 || index === 5 ? mdiCashCheck : mdiChartLine} /></span><div><p>{String(label)}</p><strong>{formatMoney(Number(value || 0))}</strong><small>{String(detail)}</small></div></article>)}
    </section>
    <section className="panel data-panel">
      <div className="cashflow-filter-grid">
        <div className="filter-strip"><span>Date range</span><SegmentedFilter ariaLabel="Filter cash flow by date" value={dateFilter} onChange={setDateFilter} options={[["all", "All"], ["today", "Today"], ["week", "This week"], ["month", "This month"], ["custom", "Custom"]]} /></div>
        <div className="cashflow-selects"><label>Type<select value={transactionType} onChange={(event) => setTransactionType(event.target.value)}><option value="all">All classifications</option><option value="booking_payment">Cash inflow</option><option value="provider_remittance">Office cash remittance</option><option value="refund">Refund</option><option value="provider_payable">Provider payable</option><option value="commission_revenue">Commission revenue</option><option value="adjustment">Adjustment</option></select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{['pending','processing','paid','verified','partially_remitted','remitted','disputed','refunded','failed','cancelled'].map((value) => <option value={value} key={value}>{value.replaceAll('_',' ')}</option>)}</select></label></div>
        {dateFilter === 'custom' && <div className="cashflow-custom-dates"><label>From<input aria-label="Cash-flow start date" type="date" value={customDates.start} onChange={(event) => setCustomDates({...customDates,start:event.target.value})}/></label><label>Through<input aria-label="Cash-flow end date" type="date" value={customDates.end} min={customDates.start || undefined} onChange={(event) => setCustomDates({...customDates,end:event.target.value})}/></label></div>}
      </div>
      {loading ? <TableSkeleton /> : rows.length === 0 ? <EmptyState title="No cash-flow records" copy="No financial movement matches the selected filters." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Reference</th><th>Event / service</th><th>Provider</th><th>Classification</th><th>Method</th><th>Gross</th><th>Commission</th><th>Provider net</th><th>Received</th><th>Released</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={String(row.id)}><td data-label="Date">{formatDate(String(row.transaction_at))}</td><td data-label="Reference"><strong className="record-id">{String(row.transaction_reference)}</strong></td><td data-label="Event / service"><strong>{String(row.event_name)}</strong><small className="table-subtitle">{String(row.service_name)}</small></td><td data-label="Provider">{String(row.provider_name)}</td><td data-label="Classification"><strong>{String(row.classification)}</strong><small className="table-subtitle">{String(row.cash_direction).replaceAll('_',' ')}</small></td><td data-label="Method">{String(row.payment_method || '—')}</td><td data-label="Gross">{formatMoney(Number(row.gross_amount))}</td><td data-label="Commission">{formatMoney(Number(row.commission_amount))}</td><td data-label="Provider net">{formatMoney(Number(row.provider_net_amount))}</td><td data-label="Received">{formatMoney(Number(row.amount_received))}</td><td data-label="Released">{formatMoney(Number(row.amount_released))}</td><td data-label="Status"><StatusBadge value={String(row.status)} /></td></tr>)}</tbody></table></div>}
      <footer className="table-footer"><span>Showing {rows.length} of {Number(data.total_count || 0).toLocaleString()} matching records</span><small>Read-only financial reporting</small></footer>
    </section>
  </div>
}

function OperationalQueue({ section }: { section: Exclude<BusinessSection, 'revenue' | 'permissions'> }) {
  const { can } = useStaff()
  const [rows, setRows] = useState<Row[]>([])
  const [coordinators, setCoordinators] = useState<Row[]>([])
  const [supportAgents, setSupportAgents] = useState<Row[]>([])
  const [remittanceEvents, setRemittanceEvents] = useState<Row[]>([])
  const [remittanceExpectations, setRemittanceExpectations] = useState<Row[]>([])
  const [availabilityRows, setAvailabilityRows] = useState<Row[]>([])
  const [availability, setAvailability] = useState({ coordinatorId: '', startsAt: '', endsAt: '', status: 'unavailable', reason: '' })
  const [remittance, setRemittance] = useState({ eventId: '', bookingId: '', expected: '', received: '', reference: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<Row | null>(null)
  const [messages, setMessages] = useState<Row[]>([])
  const [reply, setReply] = useState('')
  const [internalReply, setInternalReply] = useState(false)
  const [supportSearch, setSupportSearch] = useState('')
  const [supportStatus, setSupportStatus] = useState('all')
  const [supportPriority, setSupportPriority] = useState('all')
  const [supportAssignment, setSupportAssignment] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [remittanceStatus, setRemittanceStatus] = useState('all')
  const [expandedRemittanceEventId, setExpandedRemittanceEventId] = useState('')
  const [customDates, setCustomDates] = useState({ start: '', end: '' })

  const load = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return
    setLoading(true); setError('')
    let result: { data: unknown; error: { message: string } | null }
    if (section === 'coordinators') {
      const [queue, people, availabilityResult] = await Promise.all([
        supabase.rpc('list_unassigned_events'),
        supabase.rpc('list_available_event_coordinators'),
        supabase.from('coordinator_availability').select('id,coordinator_id,starts_at,ends_at,status,reason,created_at').gte('ends_at', new Date().toISOString()).order('starts_at').limit(100),
      ])
      result = queue
      setCoordinators(Array.isArray(people.data) ? people.data as Row[] : [])
      setAvailabilityRows(availabilityResult.data || [])
      const schedulingError = people.error || availabilityResult.error
      if (schedulingError) setError(schedulingError.message)
    } else if (section === 'support') {
      const [ticketResult, agentResult] = await Promise.all([
        supabase.from('support_tickets').select('id,ticket_number,user_id,event_id,booking_id,category,subject,description,status,priority,assigned_to,resolved_at,first_responded_at,last_message_at,closed_at,created_at,updated_at,profiles!support_tickets_user_id_fkey(full_name,email,phone,default_role,account_status),assignee:profiles!support_tickets_assigned_to_fkey(full_name,email),events(name,event_date,status),bookings(status,amount,services(name),payments(id,provider,provider_reference,amount,status,paid_at,verified_at))').order('updated_at', { ascending: false }).limit(250),
        supabase.rpc('list_support_agents'),
      ])
      result = ticketResult
      setSupportAgents(Array.isArray(agentResult.data) ? agentResult.data as Row[] : [])
      if (agentResult.error) setError(agentResult.error.message)
    } else if (section === 'remittances') {
      const [remittanceResult, eventResult] = await Promise.all([
        supabase.from('cash_remittances').select('id,event_id,booking_id,coordinator_id,amount_expected,amount_received,received_at,received_by,status,reference_number,notes,verified_at,verified_by,dispute_reason,created_at,events!cash_remittances_event_id_fkey(name,event_date),bookings!cash_remittances_booking_id_fkey(services(name),provider_profiles(business_name)),coordinator:profiles!cash_remittances_coordinator_id_fkey(full_name),receiver:profiles!cash_remittances_received_by_fkey(full_name),verifier:profiles!cash_remittances_verified_by_fkey(full_name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('events').select('id,name,coordinator_id,event_date,status,coordinator:profiles!events_coordinator_id_fkey(full_name)').not('coordinator_id', 'is', null).in('status', ['confirmed', 'in_progress', 'completed']).order('event_date', { ascending: false }).limit(100),
      ])
      result = remittanceResult
      setRemittanceEvents(eventResult.data || [])
      const remittanceError = eventResult.error
      if (remittanceError) setError(remittanceError.message)
    } else {
      result = await supabase.from('financial_transactions').select('id,payment_id,booking_id,event_id,provider_id,transaction_type,payment_method,gross_amount,commission_amount,provider_net_amount,amount_received,amount_released,status,transaction_at').order('transaction_at', { ascending: false }).limit(250)
    }
    if (result.error) setError(result.error.message)
    else setRows(Array.isArray(result.data) ? result.data as Row[] : [])
    setLoading(false)
  }, [section])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function assign(eventId: string, coordinatorId: string) {
    const supabase = getSupabase(); if (!supabase || !coordinatorId) return
    setBusy(`assign:${eventId}`)
    const { error: actionError } = await supabase.rpc('staff_assign_event_coordinator', { target_event_id: eventId, target_coordinator_id: coordinatorId })
    setBusy('')
    if (actionError) setError(actionError.message); else void load()
  }

  async function retryAssignment(eventId: string) {
    const supabase = getSupabase(); if (!supabase) return
    setBusy(`retry:${eventId}`)
    const { error: actionError } = await supabase.rpc('retry_event_coordinator_assignment', { target_event_id: eventId })
    setBusy('')
    if (actionError) setError(actionError.message); else void load()
  }

  async function updateTicket(ticketId: string, status: string, priority: string | null = null) {
    const supabase = getSupabase(); if (!supabase) return
    setBusy(ticketId)
    const { error: actionError } = await supabase.rpc('update_support_ticket', {
      target_ticket_id: ticketId, new_status: status, new_priority: priority, assign_to_self: false,
    })
    setBusy('')
    if (actionError) setError(actionError.message); else void load()
  }

  async function assignTicket(ticketId: string, assigneeId: string) {
    const supabase = getSupabase(); if (!supabase) return
    setBusy(`assign-ticket:${ticketId}`)
    const { error: actionError } = await supabase.rpc('assign_support_ticket', {
      target_ticket_id: ticketId,
      target_assignee_id: assigneeId || null,
    })
    setBusy('')
    if (actionError) setError(actionError.message); else void load()
  }

  async function openTicket(ticket: Row) {
    const supabase = getSupabase(); if (!supabase) return
    setSelectedTicket(ticket)
    setInternalReply(false)
    const { data, error: messageError } = await supabase.from('support_messages').select('id,sender_id,body,is_internal,created_at').eq('ticket_id', String(ticket.id)).order('created_at')
    if (messageError) setError(messageError.message); else setMessages(data || [])
  }

  async function sendReply() {
    const supabase = getSupabase(); if (!supabase || !selectedTicket || !reply.trim()) return
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) return
    setBusy('reply')
    const { error: replyError } = await supabase.from('support_messages').insert({ ticket_id: selectedTicket.id, sender_id: authData.user.id, body: reply.trim(), is_internal: internalReply })
    setBusy('')
    if (replyError) setError(replyError.message)
    else { setReply(''); setInternalReply(false); await load(); await openTicket(selectedTicket) }
  }

  async function loadRemittanceExpectations(eventId: string, selectedBookingId = '') {
    const supabase = getSupabase()
    if (!supabase || !eventId) {
      setRemittanceExpectations([])
      return
    }
    setBusy('expectations')
    const { data, error: expectationError } = await supabase.rpc('get_event_remittance_expectations', {
      target_event_id: eventId,
    })
    setBusy('')
    if (expectationError) {
      setError(expectationError.message)
      setRemittanceExpectations([])
      return
    }
    const expectations = Array.isArray(data) ? data as Row[] : []
    setRemittanceExpectations(expectations)
    if (selectedBookingId) {
      const selected = selectedBookingId === 'all'
        ? null
        : expectations.find((item) => String(item.booking_id) === selectedBookingId)
      const expected = selectedBookingId === 'all'
        ? sumRemittanceRemaining(expectations)
        : Number(selected?.amount_remaining || 0)
      setRemittance((current) => ({
        ...current,
        expected: String(expected),
      }))
    }
  }

  async function recordProviderDirectPayment(bookingId: string) {
    const supabase = getSupabase()
    if (!supabase || !remittance.eventId) return
    const expectation = remittanceExpectations.find((item) => String(item.booking_id) === bookingId)
    if (!expectation || Number(expectation.provider_outstanding || 0) <= 0) return
    const confirmed = window.confirm(
      `Confirm that ${String(expectation.provider_name)} received ${formatMoney(Number(expectation.provider_outstanding))} directly? This will leave only unpaid MULTIVENT commission in the remittance calculation.`,
    )
    if (!confirmed) return

    setBusy(`provider-payment:${bookingId}`)
    const { error: actionError } = await supabase.rpc('record_provider_direct_payment', {
      target_booking_id: bookingId,
      reference_number: null,
      notes: 'Provider payment confirmed from the remittance workspace.',
    })
    setBusy('')
    if (actionError) setError(actionError.message)
    else await loadRemittanceExpectations(remittance.eventId, remittance.bookingId)
  }

  async function recordRemittance(event: React.FormEvent) {
    event.preventDefault()
    const supabase = getSupabase(); if (!supabase) return
    const eventRow = remittanceEvents.find((item) => String(item.id) === remittance.eventId)
    const allServices = remittance.bookingId === 'all'
    const expectation = remittanceExpectations.find((item) => String(item.booking_id) === remittance.bookingId)
    const automaticTotal = sumRemittanceRemaining(remittanceExpectations)
    if (!eventRow?.coordinator_id || (!allServices && !expectation) || (allServices && automaticTotal <= 0)) return
    if (eventRow.status !== 'completed') {
      setError('Coordinator cash remittance can only be recorded after the event is completed.')
      return
    }
    setBusy('remittance')
    const { error: actionError } = allServices
      ? await supabase.rpc('record_all_cash_remittances', {
          target_event_id: remittance.eventId,
          target_coordinator_id: eventRow.coordinator_id,
          received_amount: Number(remittance.received),
          reference_number: remittance.reference.trim() || null,
          notes: remittance.notes.trim() || null,
        })
      : await supabase.rpc('record_cash_remittance', {
          target_event_id: remittance.eventId, target_booking_id: remittance.bookingId,
          target_coordinator_id: eventRow.coordinator_id,
          expected_amount: Number(expectation?.amount_expected), received_amount: Number(remittance.received),
          reference_number: remittance.reference.trim() || null, notes: remittance.notes.trim() || null,
        })
    setBusy('')
    if (actionError) setError(actionError.message)
    else {
      setRemittance((current) => ({ ...current, received: '', reference: '', notes: '' }))
      await loadRemittanceExpectations(remittance.eventId, remittance.bookingId)
      void load()
    }
  }

  async function reviewRemittance(id: string, status: 'verified' | 'disputed') {
    const supabase = getSupabase(); if (!supabase) return
    const reason = status === 'disputed' ? window.prompt('Why is this remittance disputed? This reason is recorded and sent to the coordinator.')?.trim() : null
    if (status === 'disputed' && !reason) return
    if (status === 'verified' && !window.confirm('Verify this fully received cash remittance?')) return
    setBusy(id)
    const { error: actionError } = await supabase.rpc('review_cash_remittance', { target_remittance_id: id, new_status: status, reason })
    setBusy('')
    if (actionError) setError(actionError.message); else void load()
  }

  async function addAvailability(event: React.FormEvent) {
    event.preventDefault()
    const supabase = getSupabase(); if (!supabase) return
    const startsAt = new Date(availability.startsAt)
    const endsAt = new Date(availability.endsAt)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      setError('Availability must end after it starts.')
      return
    }
    const { data: authData } = await supabase.auth.getUser()
    setBusy('availability')
    const { error: actionError } = await supabase.from('coordinator_availability').insert({
      coordinator_id: availability.coordinatorId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: availability.status,
      reason: availability.reason.trim() || null,
      created_by: authData.user?.id || null,
    })
    setBusy('')
    if (actionError) setError(actionError.message)
    else { setAvailability({ coordinatorId: '', startsAt: '', endsAt: '', status: 'unavailable', reason: '' }); void load() }
  }

  async function removeAvailability(id: string) {
    const supabase = getSupabase(); if (!supabase) return
    setBusy(`availability:${id}`)
    const { error: actionError } = await supabase.from('coordinator_availability').delete().eq('id', id)
    setBusy('')
    if (actionError) setError(actionError.message); else void load()
  }

  const visibleRows = useMemo(() => {
    if (section === 'support') {
      const needle = supportSearch.trim().toLowerCase()
      return rows.filter((row) => {
        const user = row.profiles as Row | null
        const matchesSearch = !needle || [row.ticket_number, row.subject, row.description, row.category, user?.full_name, user?.email]
          .some((value) => String(value || '').toLowerCase().includes(needle))
        const matchesStatus = supportStatus === 'all'
          || (supportStatus === 'active' && !['resolved', 'closed'].includes(String(row.status)))
          || String(row.status) === supportStatus
        const matchesPriority = supportPriority === 'all' || String(row.priority) === supportPriority
        const matchesAssignment = supportAssignment === 'all'
          || (supportAssignment === 'unassigned' && !row.assigned_to)
          || String(row.assigned_to) === supportAssignment
        return matchesSearch && matchesStatus && matchesPriority && matchesAssignment
      })
    }
    if (section === 'remittances') {
      return remittanceStatus === 'all' ? rows : rows.filter((row) => String(row.status) === remittanceStatus)
    }
    if (section !== 'cashflow' || dateFilter === 'all') return rows
    if (dateFilter === 'custom') {
      const start = customDates.start ? new Date(`${customDates.start}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY
      const end = customDates.end ? new Date(`${customDates.end}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY
      return rows.filter((row) => {
        const timestamp = new Date(String(row.transaction_at)).getTime()
        return timestamp >= start && timestamp <= end
      })
    }
    const now = new Date()
    const start = new Date(now)
    if (dateFilter === 'today') start.setHours(0, 0, 0, 0)
    else if (dateFilter === 'week') start.setDate(now.getDate() - 7)
    else start.setMonth(now.getMonth() - 1)
    return rows.filter((row) => new Date(String(row.transaction_at)).getTime() >= start.getTime())
  }, [customDates.end, customDates.start, dateFilter, remittanceStatus, rows, section, supportAssignment, supportPriority, supportSearch, supportStatus])

  const remittanceGroups = useMemo(() => {
    const groups = groupRemittancesByEvent(rows)
    return remittanceStatus === 'all'
      ? groups
      : groups.filter((group) => group.rows.some((row) => String(row.status) === remittanceStatus))
  }, [remittanceStatus, rows])

  const selectedEvent = remittanceEvents.find((item) => String(item.id) === remittance.eventId)
  const selectedExpectation = remittanceExpectations.find((item) => String(item.booking_id) === remittance.bookingId)
  const allServicesSelected = remittance.bookingId === 'all'
  const allServicesRemaining = sumRemittanceRemaining(remittanceExpectations)
  const selectedRemaining = allServicesSelected
    ? allServicesRemaining
    : Number(selectedExpectation?.amount_remaining || 0)
  const validRemittanceSelection = allServicesSelected
    ? allServicesRemaining > 0
    : Boolean(selectedExpectation) && selectedRemaining > 0
  const activeTicket = selectedTicket ? rows.find((row) => String(row.id) === String(selectedTicket.id)) || selectedTicket : null

  return (
    <div className="screen-stack">
      <Heading section={section} onRefresh={() => void load()} />
      {error && <InlineError message={error} onClose={() => setError('')} />}
      {section === 'remittances' && can('remittance.create') && (
        <form className="panel remittance-form" onSubmit={recordRemittance}>
          <header>
            <div>
              <span className="eyebrow">RECORD CASH HANDOFF</span>
              <h2>New remittance</h2>
              <p>Provider payments can be acknowledged on the event day. Coordinator cash handoffs become available after completion.</p>
            </div>
          </header>
          <div>
            <label>
              Event
              <select
                required
                value={remittance.eventId}
                onChange={(event) => {
                  const eventId = event.target.value
                  setRemittance({ ...remittance, eventId, bookingId: '', expected: '', received: '' })
                  void loadRemittanceExpectations(eventId)
                }}
              >
                <option value="">Select event</option>
                {remittanceEvents.map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.name)} · {formatDate(String(item.event_date))} · {String(item.status).replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label>
              Service booking
              <select
                required
                value={remittance.bookingId}
                disabled={!remittance.eventId || busy === 'expectations'}
                onChange={(event) => {
                  const bookingId = event.target.value
                  const expectation = remittanceExpectations.find((item) => String(item.booking_id) === bookingId)
                  const expected = bookingId === 'all'
                    ? sumRemittanceRemaining(remittanceExpectations)
                    : Number(expectation?.amount_remaining || 0)
                  setRemittance({
                    ...remittance,
                    bookingId,
                    expected: bookingId ? String(expected) : '',
                    received: '',
                  })
                }}
              >
                <option value="">{busy === 'expectations' ? 'Calculating…' : 'Select service booking'}</option>
                {allServicesRemaining > 0 && (
                  <option value="all">All services · {formatMoney(allServicesRemaining)}</option>
                )}
                {remittanceExpectations.map((item) => (
                  <option key={String(item.booking_id)} value={String(item.booking_id)} disabled={Number(item.amount_remaining || 0) <= 0}>
                    {String(item.service_name)} · {String(item.provider_name)}{Number(item.amount_remaining || 0) <= 0 ? ' · settled' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Coordinator
              <input readOnly value={String((selectedEvent?.coordinator as Row | null)?.full_name || (selectedEvent ? 'Assigned coordinator' : ''))} placeholder="Selected automatically" />
            </label>
            <label>
              Amount expected (automatic)
              <input readOnly value={validRemittanceSelection ? formatMoney(selectedRemaining) : ''} placeholder="Select a service or all services" />
            </label>
            <label>
              {allServicesSelected ? 'Received this handoff (complete total)' : 'Received this handoff'}
              <input required min="0.01" max={validRemittanceSelection ? selectedRemaining : undefined} step="0.01" type="number" value={remittance.received} onChange={(event) => setRemittance({ ...remittance, received: event.target.value })} />
            </label>
            <label>
              Reference
              <input maxLength={120} value={remittance.reference} onChange={(event) => setRemittance({ ...remittance, reference: event.target.value })} />
            </label>
            <label className="remittance-notes">
              Notes
              <input maxLength={1000} value={remittance.notes} onChange={(event) => setRemittance({ ...remittance, notes: event.target.value })} />
            </label>
            <button className="primary-button" disabled={busy === 'remittance' || selectedEvent?.status !== 'completed' || !validRemittanceSelection}>
              {selectedEvent && selectedEvent.status !== 'completed' ? 'Available after event completion' : busy === 'remittance' ? 'Recording…' : 'Record remittance'}
            </button>
          </div>
          {remittanceExpectations.length > 0 && (
            <footer className="remittance-expectations">
              {remittanceExpectations.map((item) => {
                const bookingId = String(item.booking_id)
                const providerOutstanding = Number(item.provider_outstanding || 0)
                return (
                  <article key={bookingId}>
                    <div>
                      <strong>{String(item.service_name)}</strong>
                      <span>{String(item.provider_name)}</span>
                    </div>
                    <dl>
                      <div><dt>Provider received</dt><dd>{formatMoney(Number(item.provider_received))}</dd></div>
                      <div><dt>Provider balance</dt><dd>{formatMoney(providerOutstanding)}</dd></div>
                      <div><dt>MULTIVENT commission</dt><dd>{formatMoney(Number(item.commission_outstanding))}</dd></div>
                      <div><dt>Remaining remittance</dt><dd>{formatMoney(Number(item.amount_remaining))}</dd></div>
                    </dl>
                    <button
                      type="button"
                      disabled={providerOutstanding <= 0 || busy === `provider-payment:${bookingId}` || Number(item.amount_remitted || 0) > 0}
                      onClick={() => void recordProviderDirectPayment(bookingId)}
                    >
                      {providerOutstanding <= 0 ? 'Provider fully paid' : busy === `provider-payment:${bookingId}` ? 'Recording…' : 'Mark provider paid directly'}
                    </button>
                  </article>
                )
              })}
            </footer>
          )}
        </form>
      )}
      {section === 'coordinators' && can('coordinators.assign') && <form className="panel remittance-form" onSubmit={addAvailability}><header><div><span className="eyebrow">WORKFORCE CALENDAR</span><h2>Add leave or availability record</h2><p>Blocking records immediately recheck future assignments. Overlapping records are rejected.</p></div></header><div><label>Coordinator<select required value={availability.coordinatorId} onChange={(event) => setAvailability({...availability,coordinatorId:event.target.value})}><option value="">Select coordinator</option>{coordinators.map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.full_name)}</option>)}</select></label><label>Starts<input required type="datetime-local" value={availability.startsAt} onChange={(event) => setAvailability({...availability,startsAt:event.target.value})}/></label><label>Ends<input required type="datetime-local" value={availability.endsAt} min={availability.startsAt || undefined} onChange={(event) => setAvailability({...availability,endsAt:event.target.value})}/></label><label>Status<select value={availability.status} onChange={(event) => setAvailability({...availability,status:event.target.value})}><option value="unavailable">Unavailable</option><option value="on_leave">On leave</option><option value="available">Available</option></select></label><label className="remittance-notes">Reason<input maxLength={500} value={availability.reason} onChange={(event) => setAvailability({...availability,reason:event.target.value})}/></label><button className="primary-button" disabled={busy === 'availability'}>{busy === 'availability' ? 'Saving…' : 'Save availability'}</button></div>{availabilityRows.length > 0 && <footer className="availability-summary">{availabilityRows.slice(0,10).map((item) => { const coordinator = coordinators.find((person) => String(person.id) === String(item.coordinator_id)); return <article key={String(item.id)}><div><StatusBadge value={String(item.status)} /><strong>{String(coordinator?.full_name || 'Coordinator')}</strong></div><span>{formatDateTime(item.starts_at)} – {formatDateTime(item.ends_at)}</span>{Boolean(item.reason) && <small>{String(item.reason)}</small>}<button type="button" disabled={busy === `availability:${String(item.id)}`} onClick={() => void removeAvailability(String(item.id))}>{busy === `availability:${String(item.id)}` ? 'Removing…' : 'Remove'}</button></article> })}</footer>}</form>}
      <section className="panel data-panel">
        {section === 'support' && <><div className="support-queue-filters"><input value={supportSearch} onChange={(event) => setSupportSearch(event.target.value)} placeholder="Search ticket, user, category, or description…" aria-label="Search support tickets"/><select value={supportPriority} onChange={(event) => setSupportPriority(event.target.value)} aria-label="Filter support priority"><option value="all">All priorities</option>{['urgent','high','normal','low'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select><select value={supportAssignment} onChange={(event) => setSupportAssignment(event.target.value)} aria-label="Filter support assignment"><option value="all">All assignments</option><option value="unassigned">Unassigned</option>{supportAgents.map((agent) => <option key={String(agent.id)} value={String(agent.id)}>{String(agent.full_name)}</option>)}</select></div><div className="filter-strip"><span>Status</span><SegmentedFilter ariaLabel="Filter support tickets by status" value={supportStatus} onChange={setSupportStatus} options={[["all", "All"], ["active", "Active queue"], ["open", "Open"], ["in_progress", "In progress"], ["waiting_for_user", "Waiting for user"], ["resolved", "Resolved"], ["closed", "Closed"]]} /></div></>}
        {section === 'remittances' && <div className="filter-strip"><span>Status</span><SegmentedFilter ariaLabel="Filter cash remittances by status" value={remittanceStatus} onChange={setRemittanceStatus} options={[["all", "All"], ["pending", "Pending"], ["partially_remitted", "Partial"], ["remitted", "Remitted"], ["verified", "Verified"], ["disputed", "Disputed"]]} /></div>}
        {section === 'cashflow' && <div className="filter-strip"><span>Date range</span><SegmentedFilter ariaLabel="Filter cash flow by date" value={dateFilter} onChange={setDateFilter} options={[["all", "All"], ["today", "Today"], ["week", "This week"], ["month", "This month"], ["custom", "Custom"]]} />{dateFilter === 'custom' && <><input aria-label="Cash-flow start date" type="date" value={customDates.start} onChange={(event) => setCustomDates({...customDates,start:event.target.value})}/><input aria-label="Cash-flow end date" type="date" value={customDates.end} min={customDates.start || undefined} onChange={(event) => setCustomDates({...customDates,end:event.target.value})}/></>}</div>}
        {section === 'remittances' ? (
          loading ? <TableSkeleton /> : remittanceGroups.length === 0
            ? <EmptyState title="No cash remittances found" copy="There is nothing requiring attention right now." />
            : <div className="table-scroll"><table className="data-table remittance-event-table"><thead><tr><th>Event</th><th>Coordinator</th><th>Services</th><th>Expected</th><th>Received</th><th>Recorded</th><th>Status / details</th></tr></thead><tbody>
              {remittanceGroups.map((group) => [
                <tr key={group.eventId}>
                  <td data-label="Event"><strong>{group.eventName}</strong><small className="table-subtitle">{formatDate(group.eventDate)}</small></td>
                  <td data-label="Coordinator">{group.coordinatorName}</td>
                  <td data-label="Services">{new Set(group.rows.filter((row) => String(row.status) !== 'disputed').map((row) => String(row.booking_id))).size}</td>
                  <td data-label="Expected">{formatMoney(group.amountExpected)}</td>
                  <td data-label="Received"><strong>{formatMoney(group.amountReceived)}</strong></td>
                  <td data-label="Recorded"><strong>{group.recordedBy}</strong><small className="table-subtitle">{formatDate(group.latestRecordedAt)}</small></td>
                  <td data-label="Status / details"><div className="remittance-review-actions"><StatusBadge value={group.status} /><button type="button" onClick={() => setExpandedRemittanceEventId((current) => current === group.eventId ? '' : group.eventId)}><MdiIcon path={mdiChevronDown} /> {expandedRemittanceEventId === group.eventId ? 'Hide breakdown' : 'View breakdown'}</button></div></td>
                </tr>,
                expandedRemittanceEventId === group.eventId ? <tr className="remittance-breakdown-row" key={`${group.eventId}:details`}><td colSpan={7}>
                  <div className="remittance-event-breakdown">
                    {group.rows.map((row) => <article key={String(row.id)}>
                      <div><strong>{String(((row.bookings as Row | null)?.services as Row | null)?.name || `Booking ${String(row.booking_id || '').slice(0, 8)}`)}</strong><small>{String(((row.bookings as Row | null)?.provider_profiles as Row | null)?.business_name || 'Service provider')}</small></div>
                      <span>{formatMoney(Number(row.amount_received))}</span>
                      <small>{String(row.reference_number || String(row.id).slice(0, 8)).toUpperCase()}</small>
                      <div className="remittance-review-actions"><StatusBadge value={String(row.status)} />{can('remittance.verify') && !['verified','disputed'].includes(String(row.status)) && <><button type="button" disabled={busy === row.id || String(row.status) !== 'remitted'} onClick={() => void reviewRemittance(String(row.id), 'verified')}><MdiIcon path={mdiCheck} /> Verify</button><button type="button" disabled={busy === row.id} onClick={() => void reviewRemittance(String(row.id), 'disputed')}>Dispute</button></>}</div>
                    </article>)}
                  </div>
                </td></tr> : null,
              ])}
            </tbody></table></div>
        ) : loading ? <TableSkeleton /> : visibleRows.length === 0 ? <EmptyState title={`No ${copy[section].title.toLowerCase()} found`} copy="There is nothing requiring attention right now." /> : (
          <div className="table-scroll"><table className="data-table"><thead><tr>
            {section === 'coordinators' ? <><th>Event</th><th>Schedule</th><th>Client</th><th>Reason</th><th>Assignment</th></> :
             section === 'support' ? <><th>Ticket</th><th>Concern</th><th>User</th><th>Priority</th><th>Assigned</th><th>Status</th><th>Updated</th></> :
             <><th>Date</th><th>Type</th><th>Method</th><th>Gross</th><th>Commission</th><th>Provider net</th><th>Received</th><th>Released</th><th>Status</th></>}
          </tr></thead><tbody>{visibleRows.map((row) => <tr key={String(row.id)}>
            {section === 'coordinators' ? <>
              <td data-label="Event"><strong>{String(row.name || 'Untitled event')}</strong><small className="table-subtitle">{String(row.event_type || 'Event')}</small></td>
              <td data-label="Schedule">{row.starts_at ? formatDateTime(row.starts_at) : `${formatDate(String(row.event_date || ''))} ${String(row.event_time || '').slice(0, 5)}`}</td>
              <td data-label="Client">{String(row.client_name || 'Client')}</td><td data-label="Reason">{String(row.assignment_note || 'Awaiting staff assignment')}</td>
              <td data-label="Assignment"><div className="coordinator-actions"><select className="inline-select" disabled={busy === `assign:${String(row.id)}` || busy === `retry:${String(row.id)}` || !can('coordinators.assign')} defaultValue="" onChange={(event) => void assign(String(row.id), event.target.value)}><option value="" disabled>Select coordinator</option>{coordinators.map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.full_name)}</option>)}</select><button type="button" className="table-action" disabled={busy === `assign:${String(row.id)}` || busy === `retry:${String(row.id)}` || !can('coordinators.assign')} onClick={() => void retryAssignment(String(row.id))}>{busy === `retry:${String(row.id)}` ? 'Retrying…' : 'Retry automatic'}</button></div></td>
            </> : section === 'support' ? <>
              <td data-label="Ticket"><strong>MV-{String(row.ticket_number).padStart(6, '0')}</strong><small className="table-subtitle">{formatDate(String(row.created_at))}</small></td>
              <td data-label="Concern"><button className="table-link" onClick={() => void openTicket(row)}><strong>{String(row.subject)}</strong><small className="table-subtitle">{String(row.category).replaceAll('_', ' ')}</small></button></td>
              <td data-label="User">{String((row.profiles as Row | null)?.full_name || (row.profiles as Row | null)?.email || 'MULTIVENT user')}</td>
              <td data-label="Priority"><StatusBadge value={String(row.priority)} /></td><td data-label="Assigned">{String((row.assignee as Row | null)?.full_name || 'Unassigned')}</td><td data-label="Status"><StatusBadge value={String(row.status)} /></td><td data-label="Updated">{formatDate(String(row.last_message_at || row.updated_at))}</td>
            </> : <>
              <td data-label="Date">{formatDate(String(row.transaction_at))}</td><td data-label="Type">{String(row.transaction_type).replaceAll('_',' ')}</td><td data-label="Method">{String(row.payment_method || '—')}</td><td data-label="Gross">{formatMoney(Number(row.gross_amount))}</td><td data-label="Commission">{formatMoney(Number(row.commission_amount))}</td><td data-label="Provider net">{formatMoney(Number(row.provider_net_amount))}</td><td data-label="Received">{formatMoney(Number(row.amount_received))}</td><td data-label="Released">{formatMoney(Number(row.amount_released))}</td><td data-label="Status"><StatusBadge value={String(row.status)} /></td>
            </>}
          </tr>)}</tbody></table></div>
        )}
      </section>
      {section === 'support' && activeTicket && <section className="panel support-thread"><header><div><span className="eyebrow">TICKET MV-{String(activeTicket.ticket_number).padStart(6, '0')}</span><h2>{String(activeTicket.subject)}</h2><p>{String(activeTicket.description)}</p><small>{String((activeTicket.profiles as Row | null)?.full_name || (activeTicket.profiles as Row | null)?.email || 'MULTIVENT user')}{activeTicket.events ? ` · ${String((activeTicket.events as Row).name)}` : ''}{activeTicket.bookings ? ` · Booking ${String((activeTicket.bookings as Row).status).replaceAll('_', ' ')}` : ''}</small></div><button className="secondary-button" onClick={() => setSelectedTicket(null)}>Close details</button></header><div className="support-ticket-controls"><label>Status<select value={String(activeTicket.status)} disabled={busy === activeTicket.id || !can('support.respond')} onChange={(event) => void updateTicket(String(activeTicket.id), event.target.value)}>{['open','in_progress','waiting_for_user','resolved','closed'].map((status) => <option key={status} value={status} disabled={status === 'closed' && !['resolved','closed'].includes(String(activeTicket.status))}>{status.replaceAll('_',' ')}</option>)}</select></label><label>Priority<select value={String(activeTicket.priority)} disabled={busy === activeTicket.id || !can('support.respond')} onChange={(event) => void updateTicket(String(activeTicket.id), String(activeTicket.status), event.target.value)}>{['low','normal','high','urgent'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label><label>Assigned staff<select value={String(activeTicket.assigned_to || '')} disabled={busy === `assign-ticket:${String(activeTicket.id)}` || !can('support.assign')} onChange={(event) => void assignTicket(String(activeTicket.id), event.target.value)}><option value="">Unassigned</option>{supportAgents.map((agent) => <option key={String(agent.id)} value={String(agent.id)}>{String(agent.full_name)}</option>)}</select></label><div><span>Created</span><strong>{formatDate(String(activeTicket.created_at))}</strong></div><div><span>Resolved</span><strong>{activeTicket.resolved_at ? formatDate(String(activeTicket.resolved_at)) : '—'}</strong></div></div><div className="support-context-grid"><article><span>Category</span><strong>{String(activeTicket.category).replaceAll('_',' ')}</strong></article><article><span>Event</span><strong>{String((activeTicket.events as Row | null)?.name || 'Not linked')}</strong></article><article><span>Booking / payment</span><strong>{activeTicket.booking_id ? `Booking ${String(activeTicket.booking_id).slice(0,8)}` : 'Not linked'}</strong><small>{formatSupportPayment(activeTicket.bookings)}</small></article><article><span>Account</span><strong>{String((activeTicket.profiles as Row | null)?.default_role || 'user').replaceAll('_',' ')}</strong><small>{String((activeTicket.profiles as Row | null)?.account_status || '')}</small></article></div><div className="support-thread__messages">{messages.length === 0 ? <p>No replies yet.</p> : messages.map((message) => <article key={String(message.id)} className={message.is_internal ? 'support-message--internal' : ''}><strong>{message.is_internal ? 'Internal note' : String(message.sender_id) === String(activeTicket.user_id) ? 'User' : 'MULTIVENT Support'}</strong><p>{String(message.body)}</p><time>{formatDate(String(message.created_at))}</time></article>)}</div>{can('support.respond') && String(activeTicket.status) !== 'closed' && <footer><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder={internalReply ? 'Write a private note for support staff…' : 'Write a helpful response to the user…'} maxLength={4000}/><label className="support-internal-toggle"><input type="checkbox" checked={internalReply} onChange={(event) => setInternalReply(event.target.checked)}/><span>Internal note</span></label><button className="primary-button" disabled={busy === 'reply' || !reply.trim()} onClick={() => void sendReply()}>{internalReply ? 'Save internal note' : 'Send response'}</button></footer>}</section>}
    </div>
  )
}

function PermissionsScreen() {
  const { can, profile } = useStaff()
  const canManagePermissions = can('users.permissions.manage')
  const canCreateAnyStaff = can('users.create')
  const canCreateCoordinator = can('coordinators.create')
  const [roles, setRoles] = useState<Row[]>([])
  const [permissions, setPermissions] = useState<Row[]>([])
  const [grants, setGrants] = useState<Row[]>([])
  const [staffUsers, setStaffUsers] = useState<Row[]>([])
  const [userGrants, setUserGrants] = useState<Row[]>([])
  const [selectedRole, setSelectedRole] = useState('assistant')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: 'event_coordinator', account_status: 'active', password: '' })
  const [createOverrides, setCreateOverrides] = useState<Record<string, PermissionChoice>>({})
  const [expandedPermissionGroups, setExpandedPermissionGroups] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const supabase = getSupabase(); if (!supabase) return
    if (!canManagePermissions) return
    const { data, error: queryError } = await supabase.rpc('get_permission_management_data')
    if (queryError) {
      setError(queryError.message)
      return
    }

    const snapshot = (data || {}) as Row
    const nextRoles = Array.isArray(snapshot.roles) ? snapshot.roles as Row[] : []
    const nextPermissions = Array.isArray(snapshot.permissions) ? snapshot.permissions as Row[] : []
    const nextGrants = Array.isArray(snapshot.role_permissions) ? snapshot.role_permissions as Row[] : []
    const nextUsers = Array.isArray(snapshot.users) ? snapshot.users as Row[] : []
    const nextUserGrants = Array.isArray(snapshot.user_permissions) ? snapshot.user_permissions as Row[] : []
    setRoles(nextRoles)
    setPermissions(nextPermissions)
    setGrants(nextGrants)
    setStaffUsers(nextUsers)
    setUserGrants(nextUserGrants)
    setSelectedRole((current) => nextRoles.some((role) => String(role.name) === current)
      ? current
      : String(nextRoles[0]?.name || 'assistant'))
    setSelectedUserId((current) => nextUsers.some((user) => String(user.id) === current)
      ? current
      : String(nextUsers[0]?.id || ''))
  }, [canManagePermissions])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const selectedRoleRow = roles.find((role) => String(role.name) === selectedRole)
  const enabled = useMemo(() => new Set(grants.filter((grant) => String(grant.role_id) === String(selectedRoleRow?.id)).map((grant) => String(grant.permission_id))), [grants, selectedRoleRow])
  const selectedUser = staffUsers.find((user) => String(user.id) === selectedUserId)
  const selectedUserRole = roles.find((role) => String(role.name) === String(selectedUser?.default_role))
  const selectedUserDefaults = useMemo(() => new Set(
    grants
      .filter((grant) => String(grant.role_id) === String(selectedUserRole?.id))
      .map((grant) => String(grant.permission_id))
  ), [grants, selectedUserRole])
  const selectedUserOverrides = useMemo(() => new Map(
    userGrants
      .filter((grant) => String(grant.user_id) === selectedUserId)
      .map((grant) => [String(grant.permission_id), Boolean(grant.granted)])
  ), [selectedUserId, userGrants])
  const creationRole = roles.find((role) => String(role.name) === form.role)
  const creationDefaults = useMemo(() => new Set(
    grants
      .filter((grant) => String(grant.role_id) === String(creationRole?.id))
      .map((grant) => String(grant.permission_id))
  ), [creationRole, grants])
  const permissionGroups = useMemo(() => buildPermissionGroups(permissions), [permissions])

  function togglePermissionGroupDisclosure(key: string) {
    setExpandedPermissionGroups((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function toggleGroup(group: PermissionGroup) {
    const supabase = getSupabase(); if (!supabase) return
    const nextEnabled = booleanGroupState(group, enabled) !== 'on'
    const changedPermissions = group.permissions.filter((permission) => enabled.has(String(permission.id)) !== nextEnabled)
    if (changedPermissions.length === 0) return
    setBusy(`role-group:${group.key}`)
    setError('')
    const results = await Promise.all(changedPermissions.map((permission) => supabase.rpc('superadmin_set_role_permission', {
      target_role: selectedRole,
      target_permission: String(permission.code),
      enabled: nextEnabled,
    })))
    setBusy('')
    const actionError = results.find((result) => result.error)?.error
    if (actionError) setError(`${actionError.message} Some access rules may already have changed; refresh before trying again.`)
    else void load()
  }

  async function togglePermissionAction(permission: Row) {
    const supabase = getSupabase(); if (!supabase) return
    const permissionId = String(permission.id)
    const permissionCode = String(permission.code)
    setBusy(`role-action:${permissionCode}`)
    setError('')
    const { error: actionError } = await supabase.rpc('superadmin_set_role_permission', {
      target_role: selectedRole,
      target_permission: permissionCode,
      enabled: !enabled.has(permissionId),
    })
    setBusy('')
    if (actionError) setError(actionError.message)
    else void load()
  }

  async function setUserPermissionGroup(group: PermissionGroup, choice: PermissionChoice) {
    const supabase = getSupabase(); if (!supabase || !selectedUserId) return
    const changedPermissions = group.permissions.filter((permission) => {
      const permissionId = String(permission.id)
      if (choice === 'inherit') return selectedUserOverrides.has(permissionId)
      return !selectedUserOverrides.has(permissionId) || selectedUserOverrides.get(permissionId) !== (choice === 'grant')
    })
    if (changedPermissions.length === 0) return
    setBusy(`user-group:${selectedUserId}:${group.key}`)
    setError('')
    const results = await Promise.all(changedPermissions.map((permission) => supabase.rpc('superadmin_set_user_permission', {
      target_user_id: selectedUserId,
      target_permission: String(permission.code),
      granted: choice === 'inherit' ? null : choice === 'grant',
    })))
    setBusy('')
    const actionError = results.find((result) => result.error)?.error
    if (actionError) setError(`${actionError.message} Some access rules may already have changed; refresh before trying again.`)
    else void load()
  }

  async function setUserPermissionAction(permission: Row, choice: PermissionChoice) {
    const supabase = getSupabase(); if (!supabase || !selectedUserId) return
    const permissionCode = String(permission.code)
    setBusy(`user-action:${selectedUserId}:${permissionCode}`)
    setError('')
    const { error: actionError } = await supabase.rpc('superadmin_set_user_permission', {
      target_user_id: selectedUserId,
      target_permission: permissionCode,
      granted: choice === 'inherit' ? null : choice === 'grant',
    })
    setBusy('')
    if (actionError) setError(actionError.message)
    else void load()
  }

  function setCreationPermissionGroup(group: PermissionGroup, choice: PermissionChoice) {
    setCreateOverrides((current) => {
      const next = { ...current }
      group.permissions.forEach((permission) => {
        const code = String(permission.code)
        if (choice === 'inherit') delete next[code]
        else next[code] = choice
      })
      return next
    })
  }

  function setCreationPermissionAction(permission: Row, choice: PermissionChoice) {
    const code = String(permission.code)
    setCreateOverrides((current) => {
      const next = { ...current }
      if (choice === 'inherit') delete next[code]
      else next[code] = choice
      return next
    })
  }

  function openCreateDialog() {
    const initialRole = canCreateCoordinator ? 'event_coordinator' : 'assistant'
    setForm({ full_name: '', email: '', phone: '', role: initialRole, account_status: 'active', password: '' })
    setCreateOverrides({})
    setNotice('')
    setShowCreate(true)
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault(); const supabase = getSupabase(); if (!supabase) return
    setBusy('create-user')
    setError('')
    setNotice('')
    const permissionOverrides = Object.fromEntries(
      Object.entries(createOverrides)
        .filter(([, choice]) => choice !== 'inherit')
        .map(([code, choice]) => [code, choice === 'grant'])
    )
    const { data, error: actionError } = await supabase.functions.invoke('admin-create-user', {
      body: { ...form, permission_overrides: permissionOverrides },
    })
    setBusy('')
    if (actionError) {
      let message = actionError.message
      const context = (actionError as { context?: Response }).context
      if (context) {
        const payload = await context.clone().json().catch(() => null) as { error?: string } | null
        if (payload?.error) message = payload.error
      }
      setError(message)
      return
    }
    if (data && typeof data === 'object' && 'error' in data) {
      setError(String((data as { error: unknown }).error))
      return
    }

    const createdName = form.full_name.trim()
    const createdRole = form.role.replaceAll('_', ' ')
    setShowCreate(false)
    setCreateOverrides({})
    setNotice(`${createdName} was created as ${createdRole}.`)
    void load()
  }

  return <div className="screen-stack">
    <Heading section="permissions" onRefresh={() => void load()} />
    {error && <InlineError message={error} onClose={() => setError('')} />}
    {notice && <div className="success-notice" role="status">{notice}</div>}
    <section className="permission-toolbar">
      {canManagePermissions ? <label>Role<select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>{roles.map((role) => <option key={String(role.id)} value={String(role.name)}>{String(role.name).replaceAll('_',' ')}</option>)}</select></label> : <div />}
      {(canCreateCoordinator || canCreateAnyStaff) && <button className="primary-button" onClick={openCreateDialog}><MdiIcon path={mdiAccountPlusOutline} /> Create internal account</button>}
    </section>
    {canManagePermissions && <>
      <section className="panel permission-panel">
        <header><div><span className="eyebrow">DEFAULT ACCESS</span><h2>{selectedRole.replaceAll('_',' ')} feature access</h2><p>Use the main switch for the complete feature, or expand a row to choose the individual actions included in it.</p></div><MdiIcon path={mdiShieldKeyOutline} /></header>
        <div className="permission-feature-list">{permissionGroups.map((group) => {
          const state = booleanGroupState(group, enabled)
          const enabledCount = group.permissions.filter((permission) => enabled.has(String(permission.id))).length
          const disclosureKey = `role:${group.key}`
          const expanded = expandedPermissionGroups.has(disclosureKey)
          const stateLabel = state === 'on'
            ? `All ${group.permissions.length} ${group.permissions.length === 1 ? 'action' : 'actions'} enabled`
            : state === 'partial'
              ? `${enabledCount} of ${group.permissions.length} actions enabled`
              : 'No actions enabled'
          return <article className={`permission-feature${state === 'partial' ? ' permission-feature--partial' : ''}`} key={group.key}>
            <div className="permission-feature__summary">
              <button type="button" className="permission-feature__copy" aria-expanded={expanded} onClick={() => togglePermissionGroupDisclosure(disclosureKey)}>
                <strong>{group.label}</strong><small>{group.description}</small><em>{stateLabel}</em>
              </button>
              <button type="button" role="checkbox" aria-checked={state === 'partial' ? 'mixed' : state === 'on'} aria-label={`${state === 'on' ? 'Disable' : 'Enable'} all ${group.label} permissions`} disabled={Boolean(busy)} className={`permission-switch${state === 'on' ? ' permission-switch--on' : ''}${state === 'partial' ? ' permission-switch--partial' : ''}`} onClick={() => void toggleGroup(group)}><i /></button>
              <button type="button" className={`permission-feature__expand${expanded ? ' permission-feature__expand--open' : ''}`} aria-label={`${expanded ? 'Hide' : 'Show'} ${group.label} actions`} aria-expanded={expanded} onClick={() => togglePermissionGroupDisclosure(disclosureKey)}><MdiIcon path={mdiChevronDown} /></button>
            </div>
            {expanded && <div className="permission-feature__actions">{group.permissions.map((permission) => {
              const permissionId = String(permission.id)
              const permissionCode = String(permission.code)
              const actionEnabled = enabled.has(permissionId)
              return <div className="permission-action-row" key={permissionCode}>
                <span><strong>{permissionActionLabel(permission)}</strong><small>{String(permission.description || '')}</small></span>
                <button type="button" role="switch" aria-checked={actionEnabled} aria-label={`${actionEnabled ? 'Disable' : 'Enable'} ${permissionActionLabel(permission)}`} disabled={Boolean(busy)} className={`permission-switch permission-switch--small${actionEnabled ? ' permission-switch--on' : ''}`} onClick={() => void togglePermissionAction(permission)}><i /></button>
              </div>
            })}</div>}
          </article>
        })}</div>
      </section>
      <section className="panel permission-panel">
        <header><div><span className="eyebrow">INDIVIDUAL ACCESS</span><h2>Staff-specific access</h2><p>Use an override only when this person needs different access from their role.</p></div><MdiIcon path={mdiShieldKeyOutline} /></header>
        <div className="permission-user-toolbar">
          <label>Staff account<select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">Select a staff account</option>{staffUsers.map((user) => <option key={String(user.id)} value={String(user.id)}>{String(user.full_name || user.email || 'Unnamed staff')} · {String(user.default_role).replaceAll('_', ' ')}</option>)}</select></label>
          {selectedUser && <span><StatusBadge value={String(selectedUser.account_status)} /> Role defaults: {String(selectedUser.default_role).replaceAll('_', ' ')}</span>}
        </div>
        {selectedUserId ? <div className="permission-feature-list permission-feature-list--overrides">{permissionGroups.map((group) => {
          const override = overrideGroupChoice(group, selectedUserOverrides)
          const defaultState = booleanGroupState(group, selectedUserDefaults)
          const defaultLabel = defaultState === 'on' ? 'Role allows this feature' : defaultState === 'partial' ? 'Role allows part of this feature' : 'Role does not allow this feature'
          const disclosureKey = `user:${group.key}`
          const expanded = expandedPermissionGroups.has(disclosureKey)
          return <article className={`permission-feature${override === 'mixed' ? ' permission-feature--partial' : ''}`} key={group.key}>
            <div className="permission-feature__summary permission-feature__summary--select">
              <button type="button" className="permission-feature__copy" aria-expanded={expanded} onClick={() => togglePermissionGroupDisclosure(disclosureKey)}>
                <strong>{group.label}</strong><small>{group.description}</small><em>{defaultLabel}</em>
              </button>
              <select aria-label={`${group.label} override`} disabled={Boolean(busy)} value={override} onChange={(event) => void setUserPermissionGroup(group, event.target.value as PermissionChoice)}>{override === 'mixed' && <option value="mixed" disabled>Custom actions</option>}<option value="inherit">Use role default</option><option value="grant">Allow full feature</option><option value="deny">Block full feature</option></select>
              <button type="button" className={`permission-feature__expand${expanded ? ' permission-feature__expand--open' : ''}`} aria-label={`${expanded ? 'Hide' : 'Show'} ${group.label} actions`} aria-expanded={expanded} onClick={() => togglePermissionGroupDisclosure(disclosureKey)}><MdiIcon path={mdiChevronDown} /></button>
            </div>
            {expanded && <div className="permission-feature__actions">{group.permissions.map((permission) => {
              const permissionId = String(permission.id)
              const permissionCode = String(permission.code)
              const choice: PermissionChoice = selectedUserOverrides.has(permissionId) ? (selectedUserOverrides.get(permissionId) ? 'grant' : 'deny') : 'inherit'
              const roleAllows = selectedUserDefaults.has(permissionId)
              return <label className="permission-action-row permission-action-row--select" key={permissionCode}>
                <span><strong>{permissionActionLabel(permission)}</strong><small>{roleAllows ? 'Allowed by role default' : 'Not allowed by role default'}</small></span>
                <select disabled={Boolean(busy)} value={choice} onChange={(event) => void setUserPermissionAction(permission, event.target.value as PermissionChoice)}><option value="inherit">Use role default</option><option value="grant">Allow</option><option value="deny">Block</option></select>
              </label>
            })}</div>}
          </article>
        })}</div> : <EmptyState title="Select a staff account" copy="Choose an internal staff member to inspect or customize their access." />}
      </section>
    </>}
    {showCreate && <div className="modal-backdrop modal-backdrop--front">
      <form className="confirmation-dialog staff-create-dialog" onSubmit={createUser}>
        <h2>Create internal account</h2>
        <p>Accounts created here are managed MULTIVENT personnel and cannot be self-registered.</p>
        <input required maxLength={160} placeholder="Full name" value={form.full_name} onChange={(event) => setForm({...form, full_name:event.target.value})}/>
        <input required maxLength={320} type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({...form, email:event.target.value})}/>
        <input maxLength={50} placeholder="Contact number" value={form.phone} onChange={(event) => setForm({...form, phone:event.target.value})}/>
        <select aria-label="Internal role" value={form.role} onChange={(event) => { setForm({...form, role:event.target.value}); setCreateOverrides({}) }}>
          {canCreateCoordinator && <option value="event_coordinator">Event coordinator</option>}
          {canCreateAnyStaff && <><option value="assistant">Assistant</option><option value="customer_service">Customer service</option>{profile.default_role === 'superadmin' && <option value="admin">Admin</option>}</>}
        </select>
        <select aria-label="Initial account status" value={form.account_status} onChange={(event) => setForm({...form, account_status:event.target.value})}>
          <option value="active">Active</option><option value="suspended">Suspended</option><option value="disabled">Disabled</option>
        </select>
        <input required minLength={8} maxLength={128} type="password" placeholder="Temporary password (8–128 characters)" value={form.password} onChange={(event) => setForm({...form, password:event.target.value})}/>
        {canManagePermissions && form.role !== 'event_coordinator' && <div className="create-permission-overrides">
          <span>Custom feature access (optional)</span>
          <small>Keep “Use role default” unless this new staff member needs different access.</small>
          {permissionGroups.map((group) => {
            const choice = creationGroupChoice(group, createOverrides)
            const defaultState = booleanGroupState(group, creationDefaults)
            const defaultLabel = defaultState === 'on' ? 'Role allows this feature' : defaultState === 'partial' ? 'Role allows part of this feature' : 'Role does not allow this feature'
            const disclosureKey = `create:${group.key}`
            const expanded = expandedPermissionGroups.has(disclosureKey)
            return <article className={`create-permission-feature${choice === 'mixed' ? ' create-permission-feature--partial' : ''}`} key={group.key}>
              <div className="create-permission-feature__summary">
                <button type="button" className="permission-feature__copy" aria-expanded={expanded} onClick={() => togglePermissionGroupDisclosure(disclosureKey)}><strong>{group.label}</strong><small>{group.description}</small><em>{defaultLabel}</em></button>
                <select aria-label={`${group.label} access for new account`} value={choice} onChange={(event) => setCreationPermissionGroup(group, event.target.value as PermissionChoice)}>{choice === 'mixed' && <option value="mixed" disabled>Custom actions</option>}<option value="inherit">Use role default</option><option value="grant">Allow full feature</option><option value="deny">Block full feature</option></select>
                <button type="button" className={`permission-feature__expand${expanded ? ' permission-feature__expand--open' : ''}`} aria-label={`${expanded ? 'Hide' : 'Show'} ${group.label} actions`} aria-expanded={expanded} onClick={() => togglePermissionGroupDisclosure(disclosureKey)}><MdiIcon path={mdiChevronDown} /></button>
              </div>
              {expanded && <div className="permission-feature__actions">{group.permissions.map((permission) => {
                const permissionCode = String(permission.code)
                const actionChoice = createOverrides[permissionCode] || 'inherit'
                const roleAllows = creationDefaults.has(String(permission.id))
                return <label className="permission-action-row permission-action-row--select" key={permissionCode}>
                  <span><strong>{permissionActionLabel(permission)}</strong><small>{roleAllows ? 'Allowed by role default' : 'Not allowed by role default'}</small></span>
                  <select value={actionChoice} onChange={(event) => setCreationPermissionAction(permission, event.target.value as PermissionChoice)}><option value="inherit">Use role default</option><option value="grant">Allow</option><option value="deny">Block</option></select>
                </label>
              })}</div>}
            </article>
          })}
        </div>}
        <div className="confirmation-dialog__actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button className="confirm-button confirm-button--approve" disabled={busy === 'create-user'}>{busy === 'create-user' ? 'Creating…' : 'Create account'}</button></div>
      </form>
    </div>}
  </div>
}
