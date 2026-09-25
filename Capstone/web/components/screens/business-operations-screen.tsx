'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  mdiAccountPlusOutline,
  mdiCashCheck,
  mdiChartLine,
  mdiCheck,
  mdiRefresh,
  mdiShieldKeyOutline,
} from '@mdi/js'
import { MdiIcon } from '@/components/icons'
import { EmptyState, formatDate, formatMoney, InlineError, StatusBadge, TableSkeleton } from '@/components/ui'
import { useStaff } from '@/components/dashboard-shell'
import { getSupabase } from '@/lib/supabase'

export type BusinessSection = 'revenue' | 'cashflow' | 'remittances' | 'coordinators' | 'support' | 'permissions'
type Row = Record<string, unknown>

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
  const maximum = Math.max(1, ...monthly.map((item) => Number(item.gross || 0)))
  return (
    <div className="screen-stack">
      <Heading section="revenue" onRefresh={() => void load()} />
      {error && <InlineError message={error} />}
      {loading ? <TableSkeleton rows={4} /> : <>
        <section className="stat-grid">
          {[
            ['Gross transaction value', data.gross_amount, 'Before commission'],
            ['Commission revenue', data.commission_amount, 'MULTIVENT income'],
            ['Provider net amount', data.provider_net_amount, 'Payable to providers'],
            ['Transactions', data.transaction_count, 'Recorded payments'],
          ].map(([label, value, detail], index) => (
            <article className="stat-card" key={String(label)}>
              <span className={`stat-card__icon stat-card__icon--${index === 1 ? 'green' : 'wine'}`}><MdiIcon path={index === 3 ? mdiCashCheck : mdiChartLine} /></span>
              <div><p>{String(label)}</p><strong>{index === 3 ? Number(value || 0).toLocaleString() : formatMoney(Number(value || 0))}</strong><small>{String(detail)}</small></div>
            </article>
          ))}
        </section>
        <section className="panel business-panel">
          <header><div><span className="eyebrow">LAST 12 MONTHS</span><h2>Gross value and commission</h2></div></header>
          {monthly.length === 0 ? <EmptyState title="No recognized revenue yet" copy="Paid and verified provider transactions will appear here." /> : (
            <div className="revenue-bars">{monthly.map((item) => <div key={String(item.month)}><span>{String(item.month)}</span><i style={{ width: `${Math.max(2, Number(item.gross || 0) / maximum * 100)}%` }} /><strong>{formatMoney(Number(item.commission || 0))}</strong></div>)}</div>
          )}
        </section>
      </>}
    </div>
  )
}

function OperationalQueue({ section }: { section: Exclude<BusinessSection, 'revenue' | 'permissions'> }) {
  const { can } = useStaff()
  const [rows, setRows] = useState<Row[]>([])
  const [coordinators, setCoordinators] = useState<Row[]>([])
  const [remittanceEvents, setRemittanceEvents] = useState<Row[]>([])
  const [availabilityRows, setAvailabilityRows] = useState<Row[]>([])
  const [availability, setAvailability] = useState({ coordinatorId: '', startsAt: '', endsAt: '', status: 'unavailable', reason: '' })
  const [remittance, setRemittance] = useState({ eventId: '', expected: '', received: '', reference: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<Row | null>(null)
  const [messages, setMessages] = useState<Row[]>([])
  const [reply, setReply] = useState('')
  const [dateFilter, setDateFilter] = useState('month')
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
        supabase.from('coordinator_availability').select('id,coordinator_id,starts_at,ends_at,status,reason').gte('ends_at', new Date().toISOString()).order('starts_at').limit(100),
      ])
      result = queue
      setCoordinators(Array.isArray(people.data) ? people.data as Row[] : [])
      setAvailabilityRows(availabilityResult.data || [])
    } else if (section === 'support') {
      result = await supabase.from('support_tickets').select('id,ticket_number,user_id,event_id,booking_id,category,subject,description,status,priority,assigned_to,created_at,updated_at,profiles!support_tickets_user_id_fkey(full_name,email),events(name,event_date),bookings(status,amount)').order('created_at', { ascending: false }).limit(200)
    } else if (section === 'remittances') {
      const [remittanceResult, eventResult] = await Promise.all([
        supabase.from('cash_remittances').select('id,event_id,booking_id,coordinator_id,amount_expected,amount_received,received_at,received_by,status,reference_number,notes,created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('events').select('id,name,coordinator_id,event_date,status').not('coordinator_id', 'is', null).in('status', ['confirmed', 'in_progress', 'completed']).order('event_date', { ascending: false }).limit(100),
      ])
      result = remittanceResult
      setRemittanceEvents(eventResult.data || [])
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
    setBusy(eventId)
    const { error: actionError } = await supabase.rpc('staff_assign_event_coordinator', { target_event_id: eventId, target_coordinator_id: coordinatorId })
    setBusy('')
    if (actionError) setError(actionError.message); else void load()
  }

  async function updateTicket(ticketId: string, status: string) {
    const supabase = getSupabase(); if (!supabase) return
    setBusy(ticketId)
    const { error: actionError } = await supabase.rpc('update_support_ticket', {
      target_ticket_id: ticketId, new_status: status, new_priority: null, assign_to_self: true,
    })
    setBusy('')
    if (actionError) setError(actionError.message); else void load()
  }

  async function openTicket(ticket: Row) {
    const supabase = getSupabase(); if (!supabase) return
    setSelectedTicket(ticket)
    const { data, error: messageError } = await supabase.from('support_messages').select('id,sender_id,body,is_internal,created_at').eq('ticket_id', String(ticket.id)).order('created_at')
    if (messageError) setError(messageError.message); else setMessages(data || [])
  }

  async function sendReply() {
    const supabase = getSupabase(); if (!supabase || !selectedTicket || !reply.trim()) return
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) return
    setBusy('reply')
    const { error: replyError } = await supabase.from('support_messages').insert({ ticket_id: selectedTicket.id, sender_id: authData.user.id, body: reply.trim(), is_internal: false })
    setBusy('')
    if (replyError) setError(replyError.message)
    else { setReply(''); await openTicket(selectedTicket) }
  }

  async function recordRemittance(event: React.FormEvent) {
    event.preventDefault()
    const supabase = getSupabase(); if (!supabase) return
    const eventRow = remittanceEvents.find((item) => String(item.id) === remittance.eventId)
    if (!eventRow?.coordinator_id) return
    setBusy('remittance')
    const { error: actionError } = await supabase.rpc('record_cash_remittance', {
      target_event_id: remittance.eventId, target_booking_id: null,
      target_coordinator_id: eventRow.coordinator_id,
      expected_amount: Number(remittance.expected), received_amount: Number(remittance.received),
      reference_number: remittance.reference.trim() || null, notes: remittance.notes.trim() || null,
    })
    setBusy('')
    if (actionError) setError(actionError.message)
    else { setRemittance({ eventId: '', expected: '', received: '', reference: '', notes: '' }); void load() }
  }

  async function verifyRemittance(id: string, status: string) {
    const supabase = getSupabase(); if (!supabase) return
    setBusy(id)
    const { error: actionError } = await supabase.rpc('verify_cash_remittance', { target_remittance_id: id, new_status: status })
    setBusy('')
    if (actionError) setError(actionError.message); else void load()
  }

  async function addAvailability(event: React.FormEvent) {
    event.preventDefault()
    const supabase = getSupabase(); if (!supabase) return
    const { data: authData } = await supabase.auth.getUser()
    setBusy('availability')
    const { error: actionError } = await supabase.from('coordinator_availability').insert({
      coordinator_id: availability.coordinatorId,
      starts_at: new Date(availability.startsAt).toISOString(),
      ends_at: new Date(availability.endsAt).toISOString(),
      status: availability.status,
      reason: availability.reason.trim() || null,
      created_by: authData.user?.id || null,
    })
    setBusy('')
    if (actionError) setError(actionError.message)
    else { setAvailability({ coordinatorId: '', startsAt: '', endsAt: '', status: 'unavailable', reason: '' }); void load() }
  }

  const visibleRows = useMemo(() => {
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
  }, [customDates.end, customDates.start, dateFilter, rows, section])

  return (
    <div className="screen-stack">
      <Heading section={section} onRefresh={() => void load()} />
      {error && <InlineError message={error} onClose={() => setError('')} />}
      {section === 'remittances' && can('remittance.create') && <form className="panel remittance-form" onSubmit={recordRemittance}><header><div><span className="eyebrow">RECORD CASH HANDOFF</span><h2>New remittance</h2></div></header><div><label>Event<select required value={remittance.eventId} onChange={(event) => setRemittance({...remittance,eventId:event.target.value})}><option value="">Select assigned event</option>{remittanceEvents.map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.name)} · {formatDate(String(item.event_date))}</option>)}</select></label><label>Amount expected<input required min="0" step="0.01" type="number" value={remittance.expected} onChange={(event) => setRemittance({...remittance,expected:event.target.value})}/></label><label>Amount received<input required min="0" step="0.01" type="number" value={remittance.received} onChange={(event) => setRemittance({...remittance,received:event.target.value})}/></label><label>Reference<input value={remittance.reference} onChange={(event) => setRemittance({...remittance,reference:event.target.value})}/></label><label className="remittance-notes">Notes<input value={remittance.notes} onChange={(event) => setRemittance({...remittance,notes:event.target.value})}/></label><button className="primary-button" disabled={busy === 'remittance'}>{busy === 'remittance' ? 'Recording…' : 'Record remittance'}</button></div></form>}
      {section === 'coordinators' && can('coordinators.assign') && <form className="panel remittance-form" onSubmit={addAvailability}><header><div><span className="eyebrow">WORKFORCE CALENDAR</span><h2>Add leave or availability record</h2></div></header><div><label>Coordinator<select required value={availability.coordinatorId} onChange={(event) => setAvailability({...availability,coordinatorId:event.target.value})}><option value="">Select coordinator</option>{coordinators.map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.full_name)}</option>)}</select></label><label>Starts<input required type="datetime-local" value={availability.startsAt} onChange={(event) => setAvailability({...availability,startsAt:event.target.value})}/></label><label>Ends<input required type="datetime-local" value={availability.endsAt} onChange={(event) => setAvailability({...availability,endsAt:event.target.value})}/></label><label>Status<select value={availability.status} onChange={(event) => setAvailability({...availability,status:event.target.value})}><option value="unavailable">Unavailable</option><option value="on_leave">On leave</option><option value="available">Available</option></select></label><label className="remittance-notes">Reason<input value={availability.reason} onChange={(event) => setAvailability({...availability,reason:event.target.value})}/></label><button className="primary-button" disabled={busy === 'availability'}>{busy === 'availability' ? 'Saving…' : 'Save availability'}</button></div>{availabilityRows.length > 0 && <footer className="availability-summary">{availabilityRows.slice(0,5).map((item) => <span key={String(item.id)}><StatusBadge value={String(item.status)} /> {coordinators.find((person) => person.id === item.coordinator_id)?.full_name as string || 'Coordinator'} · {formatDate(String(item.starts_at))}</span>)}</footer>}</form>}
      <section className="panel data-panel">
        {section === 'cashflow' && <div className="business-filter"><span>Date range</span>{[['today','Today'],['week','This week'],['month','This month'],['custom','Custom'],['all','All']].map(([value,label]) => <button key={value} className={dateFilter === value ? 'selected' : ''} onClick={() => setDateFilter(value)}>{label}</button>)}{dateFilter === 'custom' && <><input aria-label="Cash-flow start date" type="date" value={customDates.start} onChange={(event) => setCustomDates({...customDates,start:event.target.value})}/><input aria-label="Cash-flow end date" type="date" value={customDates.end} min={customDates.start || undefined} onChange={(event) => setCustomDates({...customDates,end:event.target.value})}/></>}</div>}
        {loading ? <TableSkeleton /> : visibleRows.length === 0 ? <EmptyState title={`No ${copy[section].title.toLowerCase()} found`} copy="There is nothing requiring attention right now." /> : (
          <div className="table-scroll"><table className="data-table"><thead><tr>
            {section === 'coordinators' ? <><th>Event</th><th>Schedule</th><th>Client</th><th>Reason</th><th>Assignment</th></> :
             section === 'support' ? <><th>Ticket</th><th>Concern</th><th>Priority</th><th>Status</th><th>Action</th></> :
             section === 'remittances' ? <><th>Reference</th><th>Event</th><th>Expected</th><th>Received</th><th>Status</th></> :
             <><th>Date</th><th>Type</th><th>Method</th><th>Gross</th><th>Commission</th><th>Provider net</th><th>Received</th><th>Released</th><th>Status</th></>}
          </tr></thead><tbody>{visibleRows.map((row) => <tr key={String(row.id)}>
            {section === 'coordinators' ? <>
              <td data-label="Event"><strong>{String(row.name || 'Untitled event')}</strong><small className="table-subtitle">{String(row.event_type || 'Event')}</small></td>
              <td data-label="Schedule">{formatDate(String(row.event_date || ''))} {String(row.event_time || '').slice(0, 5)}</td>
              <td data-label="Client">{String(row.client_name || 'Client')}</td><td data-label="Reason">{String(row.assignment_note || 'Awaiting staff assignment')}</td>
              <td data-label="Assignment"><select className="inline-select" disabled={busy === row.id || !can('coordinators.assign')} defaultValue="" onChange={(event) => void assign(String(row.id), event.target.value)}><option value="" disabled>Select coordinator</option>{coordinators.map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.full_name)}</option>)}</select></td>
            </> : section === 'support' ? <>
              <td data-label="Ticket"><strong>MV-{String(row.ticket_number).padStart(6, '0')}</strong><small className="table-subtitle">{formatDate(String(row.created_at))}</small></td>
              <td data-label="Concern"><button className="table-link" onClick={() => void openTicket(row)}><strong>{String(row.subject)}</strong><small className="table-subtitle">{String(row.category).replaceAll('_', ' ')}</small></button></td>
              <td data-label="Priority"><StatusBadge value={String(row.priority)} /></td><td data-label="Status"><StatusBadge value={String(row.status)} /></td>
              <td data-label="Action"><select className="inline-select" value={String(row.status)} disabled={busy === row.id || !can('support.respond')} onChange={(event) => void updateTicket(String(row.id), event.target.value)}>{['open','in_progress','waiting_for_user','resolved','closed'].map((status) => <option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></td>
            </> : section === 'remittances' ? <>
              <td data-label="Reference"><strong>{String(row.reference_number || String(row.id).slice(0, 8)).toUpperCase()}</strong></td><td data-label="Event">{String(row.event_id).slice(0, 8)}</td><td data-label="Expected">{formatMoney(Number(row.amount_expected))}</td><td data-label="Received">{formatMoney(Number(row.amount_received))}</td><td data-label="Status">{can('remittance.verify') && !['verified','disputed'].includes(String(row.status)) ? <select className="inline-select" disabled={busy === row.id} defaultValue="" onChange={(event) => void verifyRemittance(String(row.id), event.target.value)}><option value="" disabled>{String(row.status).replaceAll('_',' ')}</option><option value="verified">Verify</option><option value="disputed">Dispute</option></select> : <StatusBadge value={String(row.status)} />}</td>
            </> : <>
              <td data-label="Date">{formatDate(String(row.transaction_at))}</td><td data-label="Type">{String(row.transaction_type).replaceAll('_',' ')}</td><td data-label="Method">{String(row.payment_method || '—')}</td><td data-label="Gross">{formatMoney(Number(row.gross_amount))}</td><td data-label="Commission">{formatMoney(Number(row.commission_amount))}</td><td data-label="Provider net">{formatMoney(Number(row.provider_net_amount))}</td><td data-label="Received">{formatMoney(Number(row.amount_received))}</td><td data-label="Released">{formatMoney(Number(row.amount_released))}</td><td data-label="Status"><StatusBadge value={String(row.status)} /></td>
            </>}
          </tr>)}</tbody></table></div>
        )}
      </section>
      {section === 'support' && selectedTicket && <section className="panel support-thread"><header><div><span className="eyebrow">TICKET MV-{String(selectedTicket.ticket_number).padStart(6, '0')}</span><h2>{String(selectedTicket.subject)}</h2><p>{String(selectedTicket.description)}</p><small>{String((selectedTicket.profiles as Row | null)?.full_name || (selectedTicket.profiles as Row | null)?.email || 'MULTIVENT user')}{selectedTicket.events ? ` · ${String((selectedTicket.events as Row).name)}` : ''}{selectedTicket.bookings ? ` · Booking ${String((selectedTicket.bookings as Row).status).replaceAll('_', ' ')}` : ''}</small></div><button className="secondary-button" onClick={() => setSelectedTicket(null)}>Close</button></header><div className="support-thread__messages">{messages.length === 0 ? <p>No replies yet.</p> : messages.map((message) => <article key={String(message.id)}><strong>{String(message.sender_id) === String(selectedTicket.user_id) ? 'User' : 'MULTIVENT Support'}</strong><p>{String(message.body)}</p><time>{formatDate(String(message.created_at))}</time></article>)}</div>{can('support.respond') && <footer><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a helpful response…" maxLength={4000}/><button className="primary-button" disabled={busy === 'reply' || !reply.trim()} onClick={() => void sendReply()}>Send response</button></footer>}</section>}
    </div>
  )
}

function PermissionsScreen() {
  const { can } = useStaff()
  const canManagePermissions = can('users.permissions.manage')
  const canCreateAnyStaff = can('users.create')
  const canCreateCoordinator = canCreateAnyStaff || can('coordinators.create')
  const [roles, setRoles] = useState<Row[]>([])
  const [permissions, setPermissions] = useState<Row[]>([])
  const [grants, setGrants] = useState<Row[]>([])
  const [selectedRole, setSelectedRole] = useState('assistant')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: 'event_coordinator', account_status: 'active', password: '' })

  const load = useCallback(async () => {
    const supabase = getSupabase(); if (!supabase) return
    if (!canManagePermissions) return
    const [roleResult, permissionResult, grantResult] = await Promise.all([
      supabase.from('roles').select('id,name,description').order('name'),
      supabase.from('permissions').select('id,code,description').order('code'),
      supabase.from('role_permissions').select('role_id,permission_id'),
    ])
    const firstError = roleResult.error || permissionResult.error || grantResult.error
    if (firstError) setError(firstError.message)
    else { setRoles(roleResult.data || []); setPermissions(permissionResult.data || []); setGrants(grantResult.data || []) }
  }, [canManagePermissions])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const selectedRoleRow = roles.find((role) => String(role.name) === selectedRole)
  const enabled = useMemo(() => new Set(grants.filter((grant) => String(grant.role_id) === String(selectedRoleRow?.id)).map((grant) => String(grant.permission_id))), [grants, selectedRoleRow])

  async function toggle(permission: Row) {
    const supabase = getSupabase(); if (!supabase) return
    const code = String(permission.code); setBusy(code)
    const { error: actionError } = await supabase.rpc('superadmin_set_role_permission', { target_role: selectedRole, target_permission: code, enabled: !enabled.has(String(permission.id)) })
    setBusy(''); if (actionError) setError(actionError.message); else void load()
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault(); const supabase = getSupabase(); if (!supabase) return
    setBusy('create-user')
    const { error: actionError } = await supabase.functions.invoke('admin-create-user', { body: form })
    setBusy('')
    if (actionError) setError(actionError.message)
    else { setShowCreate(false); setForm({ full_name: '', email: '', phone: '', role: 'event_coordinator', account_status: 'active', password: '' }) }
  }

  return <div className="screen-stack">
    <Heading section="permissions" onRefresh={() => void load()} />
    {error && <InlineError message={error} onClose={() => setError('')} />}
    <section className="permission-toolbar">{canManagePermissions ? <label>Role<select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>{roles.filter((role) => String(role.name) !== 'superadmin').map((role) => <option key={String(role.id)} value={String(role.name)}>{String(role.name).replaceAll('_',' ')}</option>)}</select></label> : <div />}{canCreateCoordinator && <button className="primary-button" onClick={() => setShowCreate(true)}><MdiIcon path={mdiAccountPlusOutline} /> Create internal account</button>}</section>
    {canManagePermissions && <section className="panel permission-panel"><header><div><span className="eyebrow">DEFAULT ACCESS</span><h2>{selectedRole.replaceAll('_',' ')} permissions</h2></div><MdiIcon path={mdiShieldKeyOutline} /></header><div className="permission-grid">{permissions.map((permission) => { const checked = enabled.has(String(permission.id)); return <button key={String(permission.id)} disabled={busy === permission.code} className={checked ? 'permission-card permission-card--on' : 'permission-card'} onClick={() => void toggle(permission)}><i>{checked && <MdiIcon path={mdiCheck} />}</i><span><strong>{String(permission.code)}</strong><small>{String(permission.description || '')}</small></span></button> })}</div></section>}
    {showCreate && <div className="modal-backdrop modal-backdrop--front"><form className="confirmation-dialog staff-create-dialog" onSubmit={createUser}><h2>Create internal account</h2><p>Accounts created here are managed MULTIVENT personnel and cannot be self-registered.</p><input required placeholder="Full name" value={form.full_name} onChange={(e) => setForm({...form, full_name:e.target.value})}/><input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})}/><input placeholder="Contact number" value={form.phone} onChange={(e) => setForm({...form, phone:e.target.value})}/><select value={form.role} onChange={(e) => setForm({...form, role:e.target.value})}><option value="event_coordinator">Event coordinator</option>{canCreateAnyStaff && <><option value="assistant">Assistant</option><option value="customer_service">Customer service</option><option value="admin">Admin</option></>}</select><select aria-label="Initial account status" value={form.account_status} onChange={(e) => setForm({...form, account_status:e.target.value})}><option value="active">Active</option><option value="suspended">Suspended</option><option value="disabled">Disabled</option></select><input required minLength={8} type="password" placeholder="Temporary password (8+ characters)" value={form.password} onChange={(e) => setForm({...form, password:e.target.value})}/><div className="confirmation-dialog__actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button className="confirm-button confirm-button--approve" disabled={busy === 'create-user'}>{busy === 'create-user' ? 'Creating…' : 'Create account'}</button></div></form></div>}
  </div>
}
