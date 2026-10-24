'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  mdiAccountGroupOutline,
  mdiAccountTieOutline,
  mdiChevronLeft,
  mdiChevronRight,
  mdiClose,
  mdiEyeOutline,
  mdiMagnify,
  mdiRefresh,
} from '@mdi/js'
import { MdiIcon } from '@/components/icons'
import { EmptyState, formatDate, formatMoney, InlineError, SegmentedFilter, StatusBadge, TableSkeleton } from '@/components/ui'
import { getSupabase } from '@/lib/supabase'

type Choice = { id: string; name: string }
type PageResponse<T> = { page: number; page_size: number; total: number; [key: string]: unknown } & Record<string, T[]>

type BookingRow = {
  id: string
  event_id: string
  event_name: string | null
  event_type: string | null
  event_date: string | null
  event_status: string
  client_id: string
  client_name: string | null
  client_email: string | null
  provider_id: string
  provider_name: string | null
  service_id: string
  service_name: string | null
  category_id: string | null
  category_name: string | null
  requested_date: string | null
  requested_time: string | null
  amount: number
  provider_amount: number | null
  status: string
  amount_paid: number
  payment_count: number
  latest_payment_status: string | null
  latest_paid_at: string | null
  created_at: string
}

type BookingDirectory = PageResponse<BookingRow> & { categories: Choice[]; providers: Choice[]; bookings: BookingRow[] }
type BookingDetail = {
  booking: Record<string, unknown>
  event: Record<string, unknown>
  client: Record<string, unknown>
  provider: Record<string, unknown>
  service: Record<string, unknown>
  payments: Array<Record<string, unknown>>
}

type ClientRow = {
  id: string
  full_name: string | null
  email: string | null
  account_status: string
  registered_at: string
  event_count: number
  active_event_count: number
  booking_count: number
  valid_booking_count: number
  latest_event_date: string | null
  latest_booking_at: string | null
}
type ClientDirectory = PageResponse<ClientRow> & { clients: ClientRow[] }
type ClientDetail = {
  client: Record<string, unknown>
  summary: Record<string, number>
  recent_events: Array<Record<string, unknown>>
  recent_bookings: Array<Record<string, unknown>>
}

type CoordinatorRow = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  account_status: string
  registered_at: string
  description: string
  coordination_fee: number
  currency: string | null
  specializations: string[]
  is_accepting_bookings: boolean
  active_event_count: number
  upcoming_event_count: number
  completed_event_count: number
  pending_request_count: number
  awaiting_payment_count: number
  next_event_date: string | null
}
type CoordinatorDirectory = PageResponse<CoordinatorRow> & { coordinators: CoordinatorRow[] }
type CoordinatorDetail = {
  coordinator: Record<string, unknown>
  summary: Record<string, number>
  upcoming_events: Array<Record<string, unknown>>
  recent_completed_events: Array<Record<string, unknown>>
  pending_requests: Array<Record<string, unknown>>
  availability: Array<Record<string, unknown>>
}

const bookingStatuses: ReadonlyArray<readonly [string, string]> = [
  ['all', 'All statuses'], ['requested', 'Requested'], ['approved', 'Approved'], ['payment_required', 'Payment required'],
  ['paid', 'Paid'], ['confirmed', 'Confirmed'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['rejected', 'Rejected'], ['expired', 'Expired'],
]
const clientStatuses: ReadonlyArray<readonly [string, string]> = [
  ['all', 'All'], ['active', 'Active'], ['pending', 'Pending'], ['suspended', 'Suspended'], ['disabled', 'Disabled'],
]
const coordinatorStatuses: ReadonlyArray<readonly [string, string]> = [
  ['all', 'All'], ['accepting', 'Accepting'], ['not_accepting', 'Not accepting'], ['pending', 'Pending requests'],
]

export function BookingsManagementScreen() {
  const searchParams = useSearchParams()
  const [directory, setDirectory] = useState<BookingDirectory | null>(null)
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [categoryId, setCategoryId] = useState('all')
  const [providerId, setProviderId] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('newest')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<BookingDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const load = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) { setError('Supabase is not configured for this deployment.'); setLoading(false); return }
    setLoading(true); setError('')
    const { data, error: requestError } = await supabase.rpc('get_admin_booking_directory', {
      p_category_id: categoryId === 'all' ? null : categoryId,
      p_status: status,
      p_provider_id: providerId === 'all' ? null : providerId,
      p_search: search,
      p_date_from: dateRange.from || null,
      p_date_to: dateRange.to || null,
      p_sort: sort,
      p_page: page,
      p_page_size: 10,
    })
    if (requestError) setError(requestError.message)
    else if (!isBookingDirectory(data)) setError('The booking directory returned an unexpected response. Refresh after the operations-management migration is available.')
    else setDirectory(data)
    setLoading(false)
  }, [categoryId, dateRange.from, dateRange.to, page, providerId, search, sort, status])

  useDeferredLoad(load)

  function resetPage(update: () => void) { update(); setPage(1) }
  async function openDetail(id: string) {
    const supabase = getSupabase(); if (!supabase) return
    setDetail(null); setDetailError(''); setDetailLoading(true)
    const { data, error: requestError } = await supabase.rpc('get_admin_booking_profile', { p_booking_id: id })
    if (requestError) setDetailError(requestError.message)
    else if (!isBookingDetail(data)) setDetailError('Booking detail returned an unexpected response.')
    else setDetail(data)
    setDetailLoading(false)
  }

  return <div className="screen-stack operations-management-screen">
    <ManagementHeading eyebrow="OPERATIONS" title="Events & bookings" description="Read the current booking lifecycle without overriding provider or client decisions." loading={loading} onRefresh={load} />
    {error && <InlineError message={error} onClose={() => setError('')} />}
    <section className="panel data-panel operations-directory-panel" aria-busy={loading}>
      <div className="operations-directory-toolbar">
        <label className="search-box"><MdiIcon path={mdiMagnify} /><input value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} placeholder="Search booking, event, client, provider..." /><kbd>CMD K</kbd></label>
        <label className="inline-select-wrap"><span>Category</span><select value={categoryId} onChange={(event) => resetPage(() => setCategoryId(event.target.value))}><option value="all">All categories</option>{directory?.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="inline-select-wrap"><span>Provider</span><select value={providerId} onChange={(event) => resetPage(() => setProviderId(event.target.value))}><option value="all">All providers</option>{directory?.providers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="inline-select-wrap"><span>Status</span><select value={status} onChange={(event) => resetPage(() => setStatus(event.target.value))}>{bookingStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="inline-select-wrap"><span>Sort</span><select value={sort} onChange={(event) => resetPage(() => setSort(event.target.value))}><option value="newest">Newest first</option><option value="event_date">Nearest event date</option><option value="amount">Highest amount</option></select></label>
        <div className="operations-date-range"><label>From<input type="date" aria-label="Event date from" value={dateRange.from} onChange={(event) => resetPage(() => setDateRange((current) => ({ ...current, from: event.target.value })))} /></label><label>To<input type="date" aria-label="Event date to" min={dateRange.from || undefined} value={dateRange.to} onChange={(event) => resetPage(() => setDateRange((current) => ({ ...current, to: event.target.value })))} /></label></div>
      </div>
      {loading && !directory ? <TableSkeleton rows={6} /> : !directory?.bookings.length ? <EmptyState title="No bookings found" copy={search || categoryId !== 'all' || providerId !== 'all' || status !== 'all' ? 'Try removing a filter or using another search term.' : 'Bookings will appear here as clients make service requests.'} /> : <div className="table-scroll"><table className="data-table operations-directory-table"><thead><tr><th>Booking</th><th>Event</th><th>Client</th><th>Provider / service</th><th>Event date</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{directory.bookings.map((row) => <tr key={row.id}>
        <td data-label="Booking"><strong className="record-id">MV-{row.id.slice(0, 8).toUpperCase()}</strong><small className="table-subcopy">{formatDate(row.created_at)}</small></td>
        <td data-label="Event"><strong>{row.event_name || 'Untitled event'}</strong><small className="table-subcopy">{row.event_type || 'Event'} · {row.category_name || 'Uncategorized'}</small></td>
        <td data-label="Client"><strong>{row.client_name || 'Client'}</strong><small className="table-subcopy">{row.client_email || 'No email'}</small></td>
        <td data-label="Provider / service"><strong>{row.provider_name || 'Provider'}</strong><small className="table-subcopy">{row.service_name || 'Service'}</small></td>
        <td data-label="Event date">{formatDate(row.event_date)}</td>
        <td data-label="Amount"><strong>{formatMoney(row.amount)}</strong><small className="table-subcopy">{row.payment_count ? `${formatMoney(row.amount_paid)} paid` : 'No payment record'}</small></td>
        <td data-label="Status"><div className="status-stack"><StatusBadge value={row.status} />{row.latest_payment_status && <small>Payment: {labelize(row.latest_payment_status)}</small>}</div></td>
        <td className="row-actions"><button className="review-button" type="button" onClick={() => void openDetail(row.id)}><MdiIcon path={mdiEyeOutline} /> Details</button></td>
      </tr>)}</tbody></table></div>}
      <Pagination directory={directory} page={page} loading={loading} label="bookings" onPage={setPage} />
    </section>
    {(detail || detailLoading || detailError) && <BookingDetailModal detail={detail} loading={detailLoading} error={detailError} onClose={() => { setDetail(null); setDetailError('') }} />}
  </div>
}

export function ClientsManagementScreen() {
  const searchParams = useSearchParams()
  const [directory, setDirectory] = useState<ClientDirectory | null>(null)
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<ClientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const load = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) { setError('Supabase is not configured for this deployment.'); setLoading(false); return }
    setLoading(true); setError('')
    const { data, error: requestError } = await supabase.rpc('get_admin_client_directory', { p_status: status, p_search: search, p_sort: sort, p_page: page, p_page_size: 10 })
    if (requestError) setError(requestError.message)
    else if (!isClientDirectory(data)) setError('The client directory returned an unexpected response. Refresh after the operations-management migration is available.')
    else setDirectory(data)
    setLoading(false)
  }, [page, search, sort, status])
  useDeferredLoad(load)
  function resetPage(update: () => void) { update(); setPage(1) }
  async function openDetail(id: string) {
    const supabase = getSupabase(); if (!supabase) return
    setDetail(null); setDetailError(''); setDetailLoading(true)
    const { data, error: requestError } = await supabase.rpc('get_admin_client_profile', { p_client_id: id })
    if (requestError) setDetailError(requestError.message)
    else if (!isClientDetail(data)) setDetailError('Client detail returned an unexpected response.')
    else setDetail(data)
    setDetailLoading(false)
  }
  return <div className="screen-stack operations-management-screen">
    <ManagementHeading eyebrow="COMMUNITY" title="Clients" description="Review client activity and account standing while preserving existing account controls." loading={loading} onRefresh={load} />
    {error && <InlineError message={error} onClose={() => setError('')} />}
    <section className="panel data-panel operations-directory-panel" aria-busy={loading}>
      <div className="operations-directory-toolbar">
        <label className="search-box"><MdiIcon path={mdiMagnify} /><input value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} placeholder="Search clients or email..." /><kbd>CMD K</kbd></label>
        <SegmentedFilter ariaLabel="Filter client status" options={clientStatuses} value={status} onChange={(value) => resetPage(() => setStatus(value))} />
        <label className="inline-select-wrap"><span>Sort</span><select value={sort} onChange={(event) => resetPage(() => setSort(event.target.value))}><option value="newest">Newest first</option><option value="events">Most events</option><option value="bookings">Most bookings</option></select></label>
      </div>
      {loading && !directory ? <TableSkeleton rows={6} /> : !directory?.clients.length ? <EmptyState title="No clients found" copy={search || status !== 'all' ? 'Try another search term or remove the status filter.' : 'Client accounts will appear here after registration.'} /> : <div className="table-scroll"><table className="data-table operations-directory-table"><thead><tr><th>Client</th><th>Events</th><th>Bookings</th><th>Latest event</th><th>Status</th><th>Registered</th><th /></tr></thead><tbody>{directory.clients.map((row) => <tr key={row.id}>
        <td data-label="Client"><Identity icon={mdiAccountGroupOutline} title={row.full_name || 'Unnamed client'} subtitle={row.email || 'No email'} /></td>
        <td data-label="Events"><strong>{row.event_count}</strong><small className="table-subcopy">{row.active_event_count} active</small></td>
        <td data-label="Bookings"><strong>{row.booking_count}</strong><small className="table-subcopy">{row.valid_booking_count} valid</small></td>
        <td data-label="Latest event">{formatDate(row.latest_event_date)}</td>
        <td data-label="Status"><StatusBadge value={row.account_status} /></td>
        <td data-label="Registered">{formatDate(row.registered_at)}</td>
        <td className="row-actions"><button className="review-button" type="button" onClick={() => void openDetail(row.id)}><MdiIcon path={mdiEyeOutline} /> Details</button></td>
      </tr>)}</tbody></table></div>}
      <Pagination directory={directory} page={page} loading={loading} label="clients" onPage={setPage} />
    </section>
    {(detail || detailLoading || detailError) && <ClientDetailModal detail={detail} loading={detailLoading} error={detailError} onClose={() => { setDetail(null); setDetailError('') }} />}
  </div>
}

export function CoordinatorsManagementScreen() {
  const [directory, setDirectory] = useState<CoordinatorDirectory | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('upcoming')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<CoordinatorDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const load = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) { setError('Supabase is not configured for this deployment.'); setLoading(false); return }
    setLoading(true); setError('')
    const { data, error: requestError } = await supabase.rpc('get_admin_coordinator_directory', { p_status: status, p_search: search, p_sort: sort, p_page: page, p_page_size: 10 })
    if (requestError) setError(requestError.message)
    else if (!isCoordinatorDirectory(data)) setError('The coordinator directory returned an unexpected response. Refresh after the operations-management migration is available.')
    else setDirectory(data)
    setLoading(false)
  }, [page, search, sort, status])
  useDeferredLoad(load)
  function resetPage(update: () => void) { update(); setPage(1) }
  async function openDetail(id: string) {
    const supabase = getSupabase(); if (!supabase) return
    setDetail(null); setDetailError(''); setDetailLoading(true)
    const { data, error: requestError } = await supabase.rpc('get_admin_coordinator_profile', { p_coordinator_id: id })
    if (requestError) setDetailError(requestError.message)
    else if (!isCoordinatorDetail(data)) setDetailError('Coordinator detail returned an unexpected response.')
    else setDetail(data)
    setDetailLoading(false)
  }
  return <div className="screen-stack operations-management-screen">
    <ManagementHeading eyebrow="MARKETPLACE" title="Event coordinators" description="Review client-selected coordinator work, requests, and published availability. Staff cannot rematch these events." loading={loading} onRefresh={load} />
    {error && <InlineError message={error} onClose={() => setError('')} />}
    <section className="panel data-panel operations-directory-panel" aria-busy={loading}>
      <div className="operations-directory-toolbar">
        <label className="search-box"><MdiIcon path={mdiMagnify} /><input value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} placeholder="Search coordinators, email, or specialization..." /><kbd>CMD K</kbd></label>
        <SegmentedFilter ariaLabel="Filter coordinator availability" options={coordinatorStatuses} value={status} onChange={(value) => resetPage(() => setStatus(value))} />
        <label className="inline-select-wrap"><span>Sort</span><select value={sort} onChange={(event) => resetPage(() => setSort(event.target.value))}><option value="upcoming">Upcoming workload</option><option value="completed">Completed events</option><option value="newest">Newest first</option></select></label>
      </div>
      {loading && !directory ? <TableSkeleton rows={6} /> : !directory?.coordinators.length ? <EmptyState title="No coordinators found" copy={search || status !== 'all' ? 'Try another search term or remove the filter.' : 'Coordinator profiles will appear here after account setup.'} /> : <div className="table-scroll"><table className="data-table operations-directory-table"><thead><tr><th>Coordinator</th><th>Marketplace availability</th><th>Fee</th><th>Upcoming</th><th>Completed</th><th>Requests</th><th>Account</th><th /></tr></thead><tbody>{directory.coordinators.map((row) => <tr key={row.id}>
        <td data-label="Coordinator"><Identity icon={mdiAccountTieOutline} title={row.full_name || 'Unnamed coordinator'} subtitle={row.email || 'No email'} /></td>
        <td data-label="Marketplace availability"><StatusBadge value={row.is_accepting_bookings && row.account_status === 'active' ? 'active' : 'not_accepting'} /><small className="table-subcopy">{row.next_event_date ? `Next event ${formatDate(row.next_event_date)}` : 'No upcoming accepted event'}</small></td>
        <td data-label="Fee"><strong>{row.coordination_fee ? formatMoney(row.coordination_fee) : 'Not set'}</strong><small className="table-subcopy">{row.specializations.length ? row.specializations.slice(0, 2).join(', ') : 'No specializations'}</small></td>
        <td data-label="Upcoming"><strong>{row.upcoming_event_count}</strong><small className="table-subcopy">{row.active_event_count} active</small></td>
        <td data-label="Completed">{row.completed_event_count}</td>
        <td data-label="Requests"><strong>{row.pending_request_count}</strong><small className="table-subcopy">{row.awaiting_payment_count} awaiting payment</small></td>
        <td data-label="Account"><StatusBadge value={row.account_status} /></td>
        <td className="row-actions"><button className="review-button" type="button" onClick={() => void openDetail(row.id)}><MdiIcon path={mdiEyeOutline} /> Details</button></td>
      </tr>)}</tbody></table></div>}
      <Pagination directory={directory} page={page} loading={loading} label="coordinators" onPage={setPage} />
    </section>
    {(detail || detailLoading || detailError) && <CoordinatorDetailModal detail={detail} loading={detailLoading} error={detailError} onClose={() => { setDetail(null); setDetailError('') }} />}
  </div>
}

function ManagementHeading({ eyebrow, title, description, loading, onRefresh }: { eyebrow: string; title: string; description: string; loading: boolean; onRefresh: () => void }) {
  return <section className="page-heading page-heading--with-action"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="heading-actions"><button className="secondary-button" type="button" onClick={() => void onRefresh()} disabled={loading}><MdiIcon path={mdiRefresh} />{loading ? 'Refreshing...' : 'Refresh'}</button></div></section>
}

function Pagination<T>({ directory, page, loading, label, onPage }: { directory: PageResponse<T> | null; page: number; loading: boolean; label: string; onPage: (page: number) => void }) {
  const pageSize = directory?.page_size || 10
  const total = directory?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const activePage = directory?.page || page
  const start = total ? (activePage - 1) * pageSize + 1 : 0
  const end = Math.min(total, activePage * pageSize)
  return <footer className="table-footer"><span>Showing {start}-{end} of {total} {label}</span><div><button type="button" disabled={activePage <= 1 || loading} onClick={() => onPage(Math.max(1, activePage - 1))} aria-label="Previous page"><MdiIcon path={mdiChevronLeft} /></button><b>{activePage} / {totalPages}</b><button type="button" disabled={activePage >= totalPages || loading} onClick={() => onPage(activePage + 1)} aria-label="Next page"><MdiIcon path={mdiChevronRight} /></button></div></footer>
}

function BookingDetailModal({ detail, loading, error, onClose }: { detail: BookingDetail | null; loading: boolean; error: string; onClose: () => void }) {
  const booking = detail?.booking || {}
  const event = detail?.event || {}
  const client = detail?.client || {}
  const provider = detail?.provider || {}
  const service = detail?.service || {}
  return <DetailModal eyebrow="BOOKING DETAILS" title={detail ? `MV-${String(booking.id || '').slice(0, 8).toUpperCase()}` : 'Booking details'} loading={loading} error={error} onClose={onClose}>
    {detail && <><section className="operations-detail-hero"><div><strong>{text(event.name, 'Untitled event')}</strong><p>{text(event.type, 'Event')} · {formatDate(stringValue(event.date))} · {text(event.location, text(event.venue, 'Location not supplied'))}</p></div><StatusBadge value={stringValue(booking.status)} /></section>
      <MetricGrid items={[
        ['Booking amount', formatMoney(numberValue(booking.amount))], ['Recorded payments', String(detail.payments.length)], ['Event guests', text(event.guest_count, 'Not set')], ['Completion balance', text(booking.completion_payment_status, 'Not recorded')],
      ]} />
      <DetailSection label="CLIENT" title="Client"><DetailList items={[['Name', text(client.full_name, 'Client')], ['Email', text(client.email, 'No email')], ['Phone', text(client.phone, 'Not supplied')], ['Account', <StatusBadge key="booking-client-account" value={stringValue(client.account_status)} />]]} /></DetailSection>
      <DetailSection label="SERVICE" title="Provider booking"><DetailList items={[['Provider', text(provider.business_name, 'Provider')], ['Service', text(service.name, 'Service')], ['Category', text(service.category_name, 'Uncategorized')], ['Requested schedule', scheduleCopy(booking.requested_date, booking.requested_time)], ['Provider amount', booking.provider_amount == null ? 'Not recorded' : formatMoney(numberValue(booking.provider_amount))]]} /></DetailSection>
      <DetailSection label="PAYMENT ACTIVITY" title="Recorded payment attempts">{detail.payments.length ? <div className="operations-record-list">{detail.payments.map((payment) => <article key={stringValue(payment.id)}><div><strong>{formatMoney(numberValue(payment.amount))}</strong><small>{text(payment.method, 'Payment')} · {formatDateTime(payment.paid_at || payment.created_at)}</small></div><StatusBadge value={stringValue(payment.status)} /></article>)}</div> : <EmptyState title="No payment record" copy="Payment attempts for this booking will appear here." />}</DetailSection>
      {Boolean(booking.client_notes || booking.provider_notes) && <DetailSection label="NOTES" title="Booking notes"><div className="operations-note-grid">{Boolean(booking.client_notes) && <article><strong>Client note</strong><p>{text(booking.client_notes)}</p></article>}{Boolean(booking.provider_notes) && <article><strong>Provider note</strong><p>{text(booking.provider_notes)}</p></article>}</div></DetailSection>}
    </>}
  </DetailModal>
}

function ClientDetailModal({ detail, loading, error, onClose }: { detail: ClientDetail | null; loading: boolean; error: string; onClose: () => void }) {
  const client = detail?.client || {}
  const summary = detail?.summary || {}
  return <DetailModal eyebrow="CLIENT PROFILE" title={text(client.full_name, loading ? 'Loading client...' : 'Client details')} loading={loading} error={error} onClose={onClose}>
    {detail && <><section className="operations-detail-hero"><div><strong>{text(client.full_name, 'Client')}</strong><p>{text(client.email, 'No email')} · Joined {formatDate(stringValue(client.registered_at))}</p></div><StatusBadge value={stringValue(client.account_status)} /></section>
      <MetricGrid items={[['All events', String(numberValue(summary.events))], ['Active events', String(numberValue(summary.active_events))], ['All bookings', String(numberValue(summary.bookings))], ['Valid bookings', String(numberValue(summary.valid_bookings))]]} />
      <DetailSection label="CONTACT" title="Account information"><DetailList items={[['Email', text(client.email, 'No email')], ['Phone', text(client.phone, 'Not supplied')], ['Account standing', <StatusBadge key="client-account-standing" value={stringValue(client.account_status)} />], ['Registered', formatDate(stringValue(client.registered_at))]]} /></DetailSection>
      <DetailSection label="EVENTS" title="Recent events">{detail.recent_events.length ? <div className="operations-record-list">{detail.recent_events.map((event) => <article key={stringValue(event.id)}><div><strong>{text(event.name, 'Untitled event')}</strong><small>{text(event.type, 'Event')} · {formatDate(stringValue(event.event_date))} · {numberValue(event.valid_booking_count)} valid bookings</small></div><StatusBadge value={stringValue(event.status)} /></article>)}</div> : <EmptyState title="No events yet" copy="Events created by this client will appear here." />}</DetailSection>
      <DetailSection label="BOOKINGS" title="Recent service bookings">{detail.recent_bookings.length ? <div className="operations-record-list">{detail.recent_bookings.map((booking) => <article key={stringValue(booking.id)}><div><strong>{text(booking.service_name, 'Service')} · {formatMoney(numberValue(booking.amount))}</strong><small>{text(booking.provider_name, 'Provider')} · {text(booking.event_name, 'Event')} · {formatDate(stringValue(booking.event_date))}</small></div><StatusBadge value={stringValue(booking.status)} /></article>)}</div> : <EmptyState title="No bookings yet" copy="Service booking activity will appear here." />}</DetailSection>
    </>}
  </DetailModal>
}

function CoordinatorDetailModal({ detail, loading, error, onClose }: { detail: CoordinatorDetail | null; loading: boolean; error: string; onClose: () => void }) {
  const coordinator = detail?.coordinator || {}
  const summary = detail?.summary || {}
  const specializations = Array.isArray(coordinator.specializations) ? coordinator.specializations.map(String) : []
  return <DetailModal eyebrow="EVENT COORDINATOR" title={text(coordinator.full_name, loading ? 'Loading coordinator...' : 'Coordinator details')} loading={loading} error={error} onClose={onClose}>
    {detail && <><section className="operations-detail-hero"><div><strong>{text(coordinator.full_name, 'Coordinator')}</strong><p>{text(coordinator.email, 'No email')} · {coordinator.is_accepting_bookings ? 'Accepting marketplace bookings' : 'Not accepting marketplace bookings'}</p></div><StatusBadge value={stringValue(coordinator.account_status)} /></section>
      <MetricGrid items={[['Active events', String(numberValue(summary.active_events))], ['Upcoming events', String(numberValue(summary.upcoming_events))], ['Completed events', String(numberValue(summary.completed_events))], ['Pending requests', String(numberValue(summary.pending_requests))]]} />
      <DetailSection label="COORDINATION PROFILE" title="Published service"><DetailList items={[['Coordination fee', numberValue(coordinator.coordination_fee) ? formatMoney(numberValue(coordinator.coordination_fee)) : 'Not set'], ['Marketplace availability', coordinator.is_accepting_bookings ? 'Accepting bookings' : 'Not accepting bookings'], ['Account', <StatusBadge key="coordinator-account-standing" value={stringValue(coordinator.account_status)} />], ['Specializations', specializations.length ? specializations.join(', ') : 'Not supplied']]} /><p className="operations-description">{text(coordinator.description, 'No public coordinator description was supplied.')}</p></DetailSection>
      <DetailSection label="CLIENT-SELECTED WORK" title="Upcoming accepted events">{detail.upcoming_events.length ? <EventList rows={detail.upcoming_events} /> : <EmptyState title="No upcoming accepted events" copy="Accepted client coordinator bookings will appear here." />}</DetailSection>
      <DetailSection label="REQUESTS" title="Client selections">{detail.pending_requests.length ? <><p className="operations-helper-copy">A pending request was sent after downpayment. An awaiting-payment selection is not yet a coordinator request.</p><EventList rows={detail.pending_requests} request /></> : <EmptyState title="No active selections" copy="Current client coordinator selections will appear here." />}</DetailSection>
      <DetailSection label="AVAILABILITY" title="Published availability blocks">{detail.availability.length ? <div className="operations-record-list">{detail.availability.map((availability) => <article key={stringValue(availability.id)}><div><strong>{formatDateTime(availability.starts_at)} - {formatDateTime(availability.ends_at)}</strong><small>{text(availability.reason, 'No reason provided')}</small></div><StatusBadge value={stringValue(availability.status)} /></article>)}</div> : <EmptyState title="No future availability blocks" copy="This coordinator has not published a future unavailable or leave period." />}</DetailSection>
      {detail.recent_completed_events.length > 0 && <DetailSection label="HISTORY" title="Recently completed events"><EventList rows={detail.recent_completed_events} /></DetailSection>}
    </>}
  </DetailModal>
}

function DetailModal({ eyebrow, title, children, loading, error, onClose }: { eyebrow: string; title: string; children: React.ReactNode; loading: boolean; error: string; onClose: () => void }) {
  return <div className="modal-backdrop operations-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="operations-detail-modal" role="dialog" aria-modal="true" aria-labelledby="operations-detail-title"><header><button type="button" onClick={onClose} aria-label="Close details"><MdiIcon path={mdiClose} /></button><div><span className="eyebrow">{eyebrow}</span><h2 id="operations-detail-title">{title}</h2></div></header><div className="operations-detail-modal__body">{loading && <TableSkeleton rows={5} />}{error && <InlineError message={error} onClose={onClose} />}{children}</div><footer><button className="secondary-button" type="button" onClick={onClose}>Close</button></footer></section></div>
}

function DetailSection({ label, title, children }: { label: string; title: string; children: React.ReactNode }) { return <section className="operations-detail-section"><span className="detail-label">{label}</span><h3>{title}</h3>{children}</section> }
function DetailList({ items }: { items: Array<[string, React.ReactNode]> }) { return <dl className="operations-detail-list">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> }
function MetricGrid({ items }: { items: Array<[string, string]> }) { return <section className="operations-metric-grid">{items.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section> }
function EventList({ rows, request = false }: { rows: Array<Record<string, unknown>>; request?: boolean }) { return <div className="operations-record-list">{rows.map((row) => <article key={stringValue(row.id)}><div><strong>{text(row.name, 'Untitled event')}</strong><small>{text(row.client_name, 'Client')} · {formatDate(stringValue(row.event_date))}{row.event_time ? ` · ${String(row.event_time).slice(0, 5)}` : ''}{request && row.requested_at ? ` · requested ${formatDateTime(row.requested_at)}` : ''}</small></div><StatusBadge value={stringValue(row.assignment_status || row.status)} /></article>)}</div> }
function Identity({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) { return <div className="operations-identity"><span><MdiIcon path={icon} /></span><div><strong>{title}</strong><small>{subtitle}</small></div></div> }

function useDeferredLoad(load: () => Promise<void>) { useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load]) }
function text(value: unknown, fallback = '') { return typeof value === 'string' && value.trim() ? value : value === null || value === undefined ? fallback : String(value) }
function stringValue(value: unknown) { return typeof value === 'string' ? value : '' }
function numberValue(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function labelize(value: string) { return value.replaceAll('_', ' ') }
function formatDateTime(value: unknown) { const date = new Date(String(value || '')); return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) }
function scheduleCopy(date: unknown, time: unknown) { const dateText = formatDate(stringValue(date)); const timeText = stringValue(time); return timeText ? `${dateText} · ${timeText.slice(0, 5)}` : dateText }
function isBookingDirectory(value: unknown): value is BookingDirectory { return isPageResponse(value, 'bookings') && Array.isArray((value as BookingDirectory).categories) && Array.isArray((value as BookingDirectory).providers) }
function isClientDirectory(value: unknown): value is ClientDirectory { return isPageResponse(value, 'clients') }
function isCoordinatorDirectory(value: unknown): value is CoordinatorDirectory { return isPageResponse(value, 'coordinators') }
function isPageResponse(value: unknown, key: string): value is PageResponse<unknown> { return Boolean(value && typeof value === 'object' && typeof (value as PageResponse<unknown>).total === 'number' && Array.isArray((value as Record<string, unknown>)[key])) }
function isBookingDetail(value: unknown): value is BookingDetail { return Boolean(value && typeof value === 'object' && (value as BookingDetail).booking && Array.isArray((value as BookingDetail).payments)) }
function isClientDetail(value: unknown): value is ClientDetail { return Boolean(value && typeof value === 'object' && (value as ClientDetail).client && (value as ClientDetail).summary && Array.isArray((value as ClientDetail).recent_events) && Array.isArray((value as ClientDetail).recent_bookings)) }
function isCoordinatorDetail(value: unknown): value is CoordinatorDetail { return Boolean(value && typeof value === 'object' && (value as CoordinatorDetail).coordinator && (value as CoordinatorDetail).summary && Array.isArray((value as CoordinatorDetail).upcoming_events) && Array.isArray((value as CoordinatorDetail).availability)) }
