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

const formatDateTime = (value: unknown) => {
  const date = new Date(String(value || ''))
  return Number.isNaN(date.getTime())
    ? 'Schedule incomplete'
    : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
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
  const [supportAgents, setSupportAgents] = useState<Row[]>([])
  const [remittanceEvents, setRemittanceEvents] = useState<Row[]>([])
  const [remittanceBookings, setRemittanceBookings] = useState<Row[]>([])
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
  const [supportStatus, setSupportStatus] = useState('active')
  const [supportPriority, setSupportPriority] = useState('all')
  const [supportAssignment, setSupportAssignment] = useState('all')
  const [dateFilter, setDateFilter] = useState('month')
  const [remittanceStatus, setRemittanceStatus] = useState('all')
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
      const [remittanceResult, eventResult, bookingResult] = await Promise.all([
        supabase.from('cash_remittances').select('id,event_id,booking_id,coordinator_id,amount_expected,amount_received,received_at,received_by,status,reference_number,notes,verified_at,verified_by,dispute_reason,created_at,events!cash_remittances_event_id_fkey(name,event_date),coordinator:profiles!cash_remittances_coordinator_id_fkey(full_name),receiver:profiles!cash_remittances_received_by_fkey(full_name),verifier:profiles!cash_remittances_verified_by_fkey(full_name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('events').select('id,name,coordinator_id,event_date,status,coordinator:profiles!events_coordinator_id_fkey(full_name)').not('coordinator_id', 'is', null).eq('status', 'completed').order('event_date', { ascending: false }).limit(100),
        supabase.from('bookings').select('id,event_id,amount,status,services(name),provider_profiles(business_name)').not('status', 'in', '(rejected,cancelled,expired)').order('created_at', { ascending: false }).limit(500),
      ])
      result = remittanceResult
      setRemittanceEvents(eventResult.data || [])
      setRemittanceBookings(bookingResult.data || [])
      const remittanceError = eventResult.error || bookingResult.error
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

  async function recordRemittance(event: React.FormEvent) {
    event.preventDefault()
    const supabase = getSupabase(); if (!supabase) return
    const eventRow = remittanceEvents.find((item) => String(item.id) === remittance.eventId)
    if (!eventRow?.coordinator_id) return
    setBusy('remittance')
    const { error: actionError } = await supabase.rpc('record_cash_remittance', {
      target_event_id: remittance.eventId, target_booking_id: remittance.bookingId || null,
      target_coordinator_id: eventRow.coordinator_id,
      expected_amount: Number(remittance.expected), received_amount: Number(remittance.received),
      reference_number: remittance.reference.trim() || null, notes: remittance.notes.trim() || null,
    })
    setBusy('')
    if (actionError) setError(actionError.message)
    else { setRemittance({ eventId: '', bookingId: '', expected: '', received: '', reference: '', notes: '' }); void load() }
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

  const selectedEvent = remittanceEvents.find((item) => String(item.id) === remittance.eventId)
  const eventBookings = remittanceBookings.filter((item) => String(item.event_id) === remittance.eventId)
  const activeTicket = selectedTicket ? rows.find((row) => String(row.id) === String(selectedTicket.id)) || selectedTicket : null

  return (
    <div className="screen-stack">
      <Heading section={section} onRefresh={() => void load()} />
      {error && <InlineError message={error} onClose={() => setError('')} />}
      {section === 'remittances' && can('remittance.create') && <form className="panel remittance-form" onSubmit={recordRemittance}><header><div><span className="eyebrow">RECORD CASH HANDOFF</span><h2>New remittance</h2><p>Only completed events are eligible. A later handoff is safely added to the same open remittance.</p></div></header><div><label>Completed event<select required value={remittance.eventId} onChange={(event) => setRemittance({...remittance,eventId:event.target.value,bookingId:'',expected:'',received:''})}><option value="">Select completed event</option>{remittanceEvents.map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.name)} · {formatDate(String(item.event_date))}</option>)}</select></label><label>Booking (optional)<select value={remittance.bookingId} disabled={!remittance.eventId} onChange={(event) => { const booking = eventBookings.find((item) => String(item.id) === event.target.value); setRemittance({...remittance,bookingId:event.target.value,expected:booking?.amount ? String(booking.amount) : remittance.expected}) }}><option value="">Whole event / no booking</option>{eventBookings.map((item) => <option key={String(item.id)} value={String(item.id)}>{String((item.services as Row | null)?.name || 'Booking')} · {String((item.provider_profiles as Row | null)?.business_name || String(item.id).slice(0,8))}</option>)}</select></label><label>Coordinator<input readOnly value={String((selectedEvent?.coordinator as Row | null)?.full_name || (selectedEvent ? 'Assigned coordinator' : ''))} placeholder="Selected automatically" /></label><label>Amount expected<input required min="0.01" step="0.01" type="number" value={remittance.expected} onChange={(event) => setRemittance({...remittance,expected:event.target.value})}/></label><label>Received this handoff<input required min="0" max={remittance.expected || undefined} step="0.01" type="number" value={remittance.received} onChange={(event) => setRemittance({...remittance,received:event.target.value})}/></label><label>Reference<input maxLength={120} value={remittance.reference} onChange={(event) => setRemittance({...remittance,reference:event.target.value})}/></label><label className="remittance-notes">Notes<input maxLength={1000} value={remittance.notes} onChange={(event) => setRemittance({...remittance,notes:event.target.value})}/></label><button className="primary-button" disabled={busy === 'remittance'}>{busy === 'remittance' ? 'Recording…' : 'Record remittance'}</button></div></form>}
      {section === 'coordinators' && can('coordinators.assign') && <form className="panel remittance-form" onSubmit={addAvailability}><header><div><span className="eyebrow">WORKFORCE CALENDAR</span><h2>Add leave or availability record</h2><p>Blocking records immediately recheck future assignments. Overlapping records are rejected.</p></div></header><div><label>Coordinator<select required value={availability.coordinatorId} onChange={(event) => setAvailability({...availability,coordinatorId:event.target.value})}><option value="">Select coordinator</option>{coordinators.map((person) => <option key={String(person.id)} value={String(person.id)}>{String(person.full_name)}</option>)}</select></label><label>Starts<input required type="datetime-local" value={availability.startsAt} onChange={(event) => setAvailability({...availability,startsAt:event.target.value})}/></label><label>Ends<input required type="datetime-local" value={availability.endsAt} min={availability.startsAt || undefined} onChange={(event) => setAvailability({...availability,endsAt:event.target.value})}/></label><label>Status<select value={availability.status} onChange={(event) => setAvailability({...availability,status:event.target.value})}><option value="unavailable">Unavailable</option><option value="on_leave">On leave</option><option value="available">Available</option></select></label><label className="remittance-notes">Reason<input maxLength={500} value={availability.reason} onChange={(event) => setAvailability({...availability,reason:event.target.value})}/></label><button className="primary-button" disabled={busy === 'availability'}>{busy === 'availability' ? 'Saving…' : 'Save availability'}</button></div>{availabilityRows.length > 0 && <footer className="availability-summary">{availabilityRows.slice(0,10).map((item) => { const coordinator = coordinators.find((person) => String(person.id) === String(item.coordinator_id)); return <article key={String(item.id)}><div><StatusBadge value={String(item.status)} /><strong>{String(coordinator?.full_name || 'Coordinator')}</strong></div><span>{formatDateTime(item.starts_at)} – {formatDateTime(item.ends_at)}</span>{Boolean(item.reason) && <small>{String(item.reason)}</small>}<button type="button" disabled={busy === `availability:${String(item.id)}`} onClick={() => void removeAvailability(String(item.id))}>{busy === `availability:${String(item.id)}` ? 'Removing…' : 'Remove'}</button></article> })}</footer>}</form>}
      <section className="panel data-panel">
        {section === 'support' && <div className="support-queue-filters"><input value={supportSearch} onChange={(event) => setSupportSearch(event.target.value)} placeholder="Search ticket, user, category, or description…" aria-label="Search support tickets"/><select value={supportStatus} onChange={(event) => setSupportStatus(event.target.value)} aria-label="Filter support status"><option value="active">Active queue</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_for_user">Waiting for user</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="all">All statuses</option></select><select value={supportPriority} onChange={(event) => setSupportPriority(event.target.value)} aria-label="Filter support priority"><option value="all">All priorities</option>{['urgent','high','normal','low'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select><select value={supportAssignment} onChange={(event) => setSupportAssignment(event.target.value)} aria-label="Filter support assignment"><option value="all">All assignments</option><option value="unassigned">Unassigned</option>{supportAgents.map((agent) => <option key={String(agent.id)} value={String(agent.id)}>{String(agent.full_name)}</option>)}</select></div>}
        {section === 'remittances' && <div className="business-filter"><span>Status</span>{[['all','All'],['pending','Pending'],['partially_remitted','Partial'],['remitted','Remitted'],['verified','Verified'],['disputed','Disputed']].map(([value,label]) => <button key={value} className={remittanceStatus === value ? 'selected' : ''} onClick={() => setRemittanceStatus(value)}>{label}</button>)}</div>}
        {section === 'cashflow' && <div className="business-filter"><span>Date range</span>{[['today','Today'],['week','This week'],['month','This month'],['custom','Custom'],['all','All']].map(([value,label]) => <button key={value} className={dateFilter === value ? 'selected' : ''} onClick={() => setDateFilter(value)}>{label}</button>)}{dateFilter === 'custom' && <><input aria-label="Cash-flow start date" type="date" value={customDates.start} onChange={(event) => setCustomDates({...customDates,start:event.target.value})}/><input aria-label="Cash-flow end date" type="date" value={customDates.end} min={customDates.start || undefined} onChange={(event) => setCustomDates({...customDates,end:event.target.value})}/></>}</div>}
        {loading ? <TableSkeleton /> : visibleRows.length === 0 ? <EmptyState title={`No ${copy[section].title.toLowerCase()} found`} copy="There is nothing requiring attention right now." /> : (
          <div className="table-scroll"><table className="data-table"><thead><tr>
            {section === 'coordinators' ? <><th>Event</th><th>Schedule</th><th>Client</th><th>Reason</th><th>Assignment</th></> :
             section === 'support' ? <><th>Ticket</th><th>Concern</th><th>User</th><th>Priority</th><th>Assigned</th><th>Status</th><th>Updated</th></> :
             section === 'remittances' ? <><th>Reference</th><th>Event / booking</th><th>Coordinator</th><th>Expected</th><th>Received</th><th>Recorded</th><th>Status</th></> :
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
            </> : section === 'remittances' ? <>
              <td data-label="Reference"><strong>{String(row.reference_number || String(row.id).slice(0, 8)).toUpperCase()}</strong>{Boolean(row.dispute_reason) && <small className="table-subtitle">{String(row.dispute_reason)}</small>}</td><td data-label="Event / booking"><strong>{String((row.events as Row | null)?.name || String(row.event_id).slice(0, 8))}</strong><small className="table-subtitle">{row.booking_id ? `Booking ${String(row.booking_id).slice(0,8)}` : 'Whole event'}</small></td><td data-label="Coordinator">{String((row.coordinator as Row | null)?.full_name || 'Coordinator')}</td><td data-label="Expected">{formatMoney(Number(row.amount_expected))}</td><td data-label="Received">{formatMoney(Number(row.amount_received))}</td><td data-label="Recorded"><strong>{String((row.receiver as Row | null)?.full_name || 'MULTIVENT staff')}</strong><small className="table-subtitle">{formatDate(String(row.received_at || row.created_at))}</small></td><td data-label="Status"><div className="remittance-review-actions"><StatusBadge value={String(row.status)} />{can('remittance.verify') && !['verified','disputed'].includes(String(row.status)) && <><button type="button" disabled={busy === row.id || String(row.status) !== 'remitted'} onClick={() => void reviewRemittance(String(row.id), 'verified')}><MdiIcon path={mdiCheck} /> Verify</button><button type="button" disabled={busy === row.id} onClick={() => void reviewRemittance(String(row.id), 'disputed')}>Dispute</button></>}</div></td>
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
  const [createOverrides, setCreateOverrides] = useState<Record<string, 'inherit' | 'grant' | 'deny'>>({})

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

  async function toggle(permission: Row) {
    const supabase = getSupabase(); if (!supabase) return
    const code = String(permission.code); setBusy(`role:${code}`)
    const { error: actionError } = await supabase.rpc('superadmin_set_role_permission', { target_role: selectedRole, target_permission: code, enabled: !enabled.has(String(permission.id)) })
    setBusy(''); if (actionError) setError(actionError.message); else void load()
  }

  async function setUserPermission(permission: Row, choice: 'inherit' | 'grant' | 'deny') {
    const supabase = getSupabase(); if (!supabase || !selectedUserId) return
    const code = String(permission.code)
    setBusy(`user:${selectedUserId}:${code}`)
    const { error: actionError } = await supabase.rpc('superadmin_set_user_permission', {
      target_user_id: selectedUserId,
      target_permission: code,
      granted: choice === 'inherit' ? null : choice === 'grant',
    })
    setBusy('')
    if (actionError) setError(actionError.message)
    else void load()
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
        <header><div><span className="eyebrow">DEFAULT ACCESS</span><h2>{selectedRole.replaceAll('_',' ')} permissions</h2></div><MdiIcon path={mdiShieldKeyOutline} /></header>
        <div className="permission-grid">{permissions.map((permission) => {
          const code = String(permission.code)
          const checked = enabled.has(String(permission.id))
          return <button key={String(permission.id)} disabled={busy === `role:${code}`} className={checked ? 'permission-card permission-card--on' : 'permission-card'} onClick={() => void toggle(permission)}><i>{checked && <MdiIcon path={mdiCheck} />}</i><span><strong>{code}</strong><small>{String(permission.description || '')}</small></span></button>
        })}</div>
      </section>
      <section className="panel permission-panel">
        <header><div><span className="eyebrow">INDIVIDUAL ACCESS</span><h2>User-specific overrides</h2></div><MdiIcon path={mdiShieldKeyOutline} /></header>
        <div className="permission-user-toolbar">
          <label>Staff account<select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">Select a staff account</option>{staffUsers.map((user) => <option key={String(user.id)} value={String(user.id)}>{String(user.full_name || user.email || 'Unnamed staff')} · {String(user.default_role).replaceAll('_', ' ')}</option>)}</select></label>
          {selectedUser && <span><StatusBadge value={String(selectedUser.account_status)} /> Role defaults: {String(selectedUser.default_role).replaceAll('_', ' ')}</span>}
        </div>
        {selectedUserId ? <div className="permission-override-grid">{permissions.map((permission) => {
          const permissionId = String(permission.id)
          const code = String(permission.code)
          const override = selectedUserOverrides.has(permissionId) ? (selectedUserOverrides.get(permissionId) ? 'grant' : 'deny') : 'inherit'
          const inherited = selectedUserDefaults.has(permissionId)
          return <label className="permission-override-row" key={permissionId}><span><strong>{code}</strong><small>{String(permission.description || '')}</small></span><em>{inherited ? 'Role allows' : 'Role blocks'}</em><select disabled={busy === `user:${selectedUserId}:${code}`} value={override} onChange={(event) => void setUserPermission(permission, event.target.value as 'inherit' | 'grant' | 'deny')}><option value="inherit">Inherit role</option><option value="grant">Allow</option><option value="deny">Deny</option></select></label>
        })}</div> : <EmptyState title="Select a staff account" copy="Choose an internal staff member to inspect or customize their access." />}
      </section>
    </>}
    {showCreate && <div className="modal-backdrop modal-backdrop--front"><form className="confirmation-dialog staff-create-dialog" onSubmit={createUser}><h2>Create internal account</h2><p>Accounts created here are managed MULTIVENT personnel and cannot be self-registered.</p><input required maxLength={160} placeholder="Full name" value={form.full_name} onChange={(event) => setForm({...form, full_name:event.target.value})}/><input required maxLength={320} type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({...form, email:event.target.value})}/><input maxLength={50} placeholder="Contact number" value={form.phone} onChange={(event) => setForm({...form, phone:event.target.value})}/><select aria-label="Internal role" value={form.role} onChange={(event) => { setForm({...form, role:event.target.value}); setCreateOverrides({}) }}>{canCreateCoordinator && <option value="event_coordinator">Event coordinator</option>}{canCreateAnyStaff && <><option value="assistant">Assistant</option><option value="customer_service">Customer service</option>{profile.default_role === 'superadmin' && <option value="admin">Admin</option>}</>}</select><select aria-label="Initial account status" value={form.account_status} onChange={(event) => setForm({...form, account_status:event.target.value})}><option value="active">Active</option><option value="suspended">Suspended</option><option value="disabled">Disabled</option></select><input required minLength={8} maxLength={128} type="password" placeholder="Temporary password (8–128 characters)" value={form.password} onChange={(event) => setForm({...form, password:event.target.value})}/>{canManagePermissions && form.role !== 'event_coordinator' && <div className="create-permission-overrides"><span>Custom access (optional)</span><small>Leave a permission on “Inherit” to use the selected role default.</small>{permissions.map((permission) => { const code = String(permission.code); const permissionId = String(permission.id); return <label key={permissionId}><span><strong>{code}</strong><small>{creationDefaults.has(permissionId) ? 'Role allows' : 'Role blocks'}</small></span><select value={createOverrides[code] || 'inherit'} onChange={(event) => setCreateOverrides((current) => ({...current, [code]: event.target.value as 'inherit' | 'grant' | 'deny'}))}><option value="inherit">Inherit</option><option value="grant">Allow</option><option value="deny">Deny</option></select></label> })}</div>}<div className="confirmation-dialog__actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button className="confirm-button confirm-button--approve" disabled={busy === 'create-user'}>{busy === 'create-user' ? 'Creating…' : 'Create account'}</button></div></form></div>}
  </div>
}
