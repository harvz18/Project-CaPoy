'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { mdiCashCheck, mdiCashMultiple, mdiChartLine, mdiDownloadOutline, mdiRefresh } from '@mdi/js'
import { MdiIcon } from '@/components/icons'
import { useDashboardControls, useStaff } from '@/components/dashboard-shell'
import { EmptyState, formatDate, formatMoney, InlineError, SegmentedFilter, StatusBadge, TableSkeleton } from '@/components/ui'
import { getSupabase } from '@/lib/supabase'

type Row = Record<string, unknown>
type DateFilter = 'today' | 'three_days' | 'week' | 'month' | 'all' | 'custom'

const dateFilterOptions: ReadonlyArray<readonly [DateFilter, string]> = [
  ['today', 'Today'], ['three_days', '3 days'], ['week', '1 week'], ['month', '1 month'], ['all', 'All'], ['custom', 'Custom'],
]

function reportRange(filter: DateFilter, customStart: string, customEnd: string) {
  if (filter === 'all') return { start: null as string | null, end: null as string | null }
  if (filter === 'custom') return {
    start: customStart ? new Date(`${customStart}T00:00:00`).toISOString() : null,
    end: customEnd ? new Date(`${customEnd}T23:59:59.999`).toISOString() : null,
  }

  const end = new Date()
  const start = new Date(end)
  start.setHours(0, 0, 0, 0)
  if (filter === 'three_days') start.setDate(start.getDate() - 2)
  if (filter === 'week') start.setDate(start.getDate() - 6)
  if (filter === 'month') start.setDate(1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function asRows(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : []
}

function asRow(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}

function text(value: unknown, fallback = '—') {
  const output = String(value ?? '').trim()
  return output || fallback
}

function number(value: unknown) {
  return Number(value || 0)
}

function formatDateTime(value: unknown) {
  const parsed = new Date(String(value || ''))
  return Number.isNaN(parsed.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function reportColumnKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function downloadCsv(filename: string, columns: string[], rows: Row[]) {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const contents = [columns, ...rows.map((row) => columns.map((column) => row[reportColumnKey(column)]))]
    .map((line) => line.map(escape).join(','))
    .join('\r\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8;' }))
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0)
}

function DateControls({ filter, customStart, customEnd, onFilter, onStart, onEnd }: {
  filter: DateFilter
  customStart: string
  customEnd: string
  onFilter: (filter: DateFilter) => void
  onStart: (value: string) => void
  onEnd: (value: string) => void
}) {
  return <div className="finance-date-controls">
    <SegmentedFilter ariaLabel="Financial reporting date range" options={dateFilterOptions} value={filter} onChange={(value) => onFilter(value as DateFilter)} />
    {filter === 'custom' && <div className="finance-custom-range">
      <label>From<input type="date" value={customStart} onChange={(event) => onStart(event.target.value)} /></label>
      <label>To<input type="date" value={customEnd} onChange={(event) => onEnd(event.target.value)} /></label>
    </div>}
  </div>
}

function SectionHeading({ eyebrow, title, copy, onRefresh }: { eyebrow: string; title: string; copy: string; onRefresh: () => void }) {
  return <section className="page-heading page-heading--with-action">
    <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>
    <button className="secondary-button" onClick={onRefresh}><MdiIcon path={mdiRefresh} /> Refresh</button>
  </section>
}

export function FinancialOverviewScreen() {
  const { liveDataVersion } = useDashboardControls()
  const [filter, setFilter] = useState<DateFilter>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [data, setData] = useState<Row>({})
  const [reconciliation, setReconciliation] = useState<Row>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const range = useMemo(() => reportRange(filter, customStart, customEnd), [customEnd, customStart, filter])

  const load = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return }
    setLoading(true); setError('')
    const [overviewResult, reconciliationResult] = await Promise.all([
      supabase.rpc('get_admin_financial_overview', {
        range_start: range.start,
        range_end: range.end,
      }),
      supabase.rpc('get_admin_phase11_receivables_reconciliation'),
    ])
    if (overviewResult.error) setError(overviewResult.error.message)
    else {
      setData(asRow(overviewResult.data))
      // Keep the established financial report usable if a deployment reaches
      // the web client before the additive Phase 5 migration is applied.
      setReconciliation(reconciliationResult.error ? {} : asRow(reconciliationResult.data))
    }
    setLoading(false)
  }, [range.end, range.start])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [liveDataVersion, load])

  const summary = asRow(data.summary)
  const paymentModel = asRow(data.payment_model)
  const paymentStatuses = asRows(data.payment_statuses)
  const paymentRows = asRows(data.latest_payments)
  const payoutRows = asRows(data.payout_requests)
  const reconciliationSummary = asRow(reconciliation.summary)
  const reconciliationItems = asRows(reconciliation.items)

  return <div className="screen-stack financial-screen">
    <SectionHeading
      eyebrow="FINANCE"
      title="Financial overview"
      copy="Read-only payment, platform-fee, provider-fund, and payout reporting from the financial ledger."
      onRefresh={() => void load()}
    />
    <DateControls filter={filter} customStart={customStart} customEnd={customEnd} onFilter={setFilter} onStart={setCustomStart} onEnd={setCustomEnd} />
    {error && <InlineError message={error} onClose={() => setError('')} />}
    {loading ? <TableSkeleton rows={6} /> : <>
      <section className="finance-model-note">
        <MdiIcon path={mdiCashCheck} />
        <div><strong>Current payment model</strong><p>A client’s initial payment is {number(paymentModel.initial_payment_rate) * 100}%: {number(paymentModel.provider_initial_rate) * 100}% is the provider allocation and {number(paymentModel.platform_fee_rate) * 100}% is the MULTIVENT fee. The remaining {number(paymentModel.remaining_payment_rate) * 100}% is paid directly to the provider and is not counted as platform revenue.</p></div>
      </section>
      <section className="finance-metric-grid">
        <Metric label="Platform-recorded payments" value={formatMoney(number(summary.recorded_client_payments))} detail={`${number(summary.recognized_payment_count)} paid or verified ledger entries`} icon={mdiCashMultiple} />
        <Metric label="Recognized MULTIVENT fees" value={formatMoney(number(summary.recognized_platform_fees))} detail="Fees only — not total booking value" icon={mdiChartLine} tone="green" />
        <Metric label="Provider funds held" value={formatMoney(number(summary.provider_funds_held))} detail="Awaiting provider acceptance or resolution" icon={mdiCashCheck} />
        <Metric label="Pending payout requests" value={formatMoney(number(summary.pending_payout_requests))} detail="Requested or processing payouts" icon={mdiCashMultiple} />
        <Metric label="Provider allocations released" value={formatMoney(number(summary.provider_allocations_released))} detail="Recorded platform releases" icon={mdiCashCheck} />
        <Metric label="Tracked direct balance due" value={formatMoney(number(summary.tracked_direct_balance_due))} detail={`${number(summary.tracked_direct_balance_count)} booking${number(summary.tracked_direct_balance_count) === 1 ? '' : 's'} with a recorded outstanding balance`} icon={mdiChartLine} />
      </section>
      {Object.keys(reconciliation).length > 0 && <section className="panel finance-panel finance-reconciliation-panel">
        <header><div><span className="eyebrow">RECEIVABLES CONTROL</span><h2>Held funds and reconciliation</h2><p>Current custody is separated from payout requests and actual completed payouts. Refund/hold exposure is a protected review amount, not a completed client refund.</p></div></header>
        <div className="finance-metric-grid finance-reconciliation-metrics">
          <Metric label="Held allocations" value={formatMoney(number(reconciliationSummary.heldAllocations))} detail="Provider and coordinator receivables still held" icon={mdiCashCheck} />
          <Metric label="Available after reservations" value={formatMoney(number(reconciliationSummary.availableAllocations))} detail="Validated allocations not reserved by payout requests" icon={mdiCashMultiple} tone="green" />
          <Metric label="Pending payout requests" value={formatMoney(number(reconciliationSummary.pendingPayoutRequests))} detail={`${number(reconciliationSummary.pendingPayoutCount)} requested or processing`} icon={mdiCashMultiple} />
          <Metric label="Completed payout requests" value={formatMoney(number(reconciliationSummary.completedPayoutRequests))} detail={`${number(reconciliationSummary.completedPayoutCount)} recorded as paid`} icon={mdiCashCheck} tone="green" />
          <Metric label="Refund / hold exposure" value={formatMoney(number(reconciliationSummary.refundHoldExposure))} detail="Protected while cancellation or refund policy review is unresolved" icon={mdiCashCheck} />
          <Metric label="Needs reconciliation" value={formatMoney(number(reconciliationSummary.reconciliationRequiredAmount))} detail={`${number(reconciliationSummary.reconciliationRequiredCount)} ledger allocation${number(reconciliationSummary.reconciliationRequiredCount) === 1 ? '' : 's'} flagged for review`} icon={mdiChartLine} />
        </div>
        <p className="finance-reconciliation-note">Ledger liability: {formatMoney(number(reconciliationSummary.remainingLedgerLiability))}. Recorded refunds: {formatMoney(number(reconciliationSummary.recordedRefunds))}. Historic unmapped payout requests: {number(reconciliationSummary.historicUnmappedPayoutCount)} ({formatMoney(number(reconciliationSummary.historicUnmappedPayoutAmount))}).</p>
        {reconciliationItems.length > 0 && <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Type</th><th>Recipient / event</th><th>Event date</th><th>Amount</th><th>State</th><th>Review reason</th></tr></thead><tbody>{reconciliationItems.map((item) => <tr key={`${text(item.itemType)}-${text(item.id)}`}><td>{titleCase(text(item.itemType, 'record'))}</td><td><strong>{text(item.recipientName)}</strong><small>{text(item.eventName, 'No linked event')}</small></td><td>{item.eventDate ? formatDate(String(item.eventDate)) : '—'}</td><td><strong>{formatMoney(number(item.amount))}</strong></td><td><StatusBadge value={text(item.financialState)} /></td><td>{text(item.reason)}</td></tr>)}</tbody></table></div>}
      </section>}
      <section className="finance-disclosure-grid">
        <article className="panel finance-panel">
          <header><div><span className="eyebrow">PAYMENT SUMMARY</span><h2>Ledger status</h2><p>Amounts show platform-recorded booking payments for the selected period.</p></div></header>
          {paymentStatuses.length === 0 ? <EmptyState title="No payment records" copy="Paid and verified booking payments will appear here." /> : <div className="finance-status-list">{paymentStatuses.map((item) => <div key={text(item.status)}><StatusBadge value={text(item.status, 'unknown')} /><span>{number(item.count)} transaction{number(item.count) === 1 ? '' : 's'}</span><strong>{formatMoney(number(item.amount))}</strong></div>)}</div>}
        </article>
        <article className="panel finance-panel finance-panel--direct">
          <header><div><span className="eyebrow">DIRECT-TO-PROVIDER</span><h2>Completion payments</h2><p>Provider-confirmed direct payments are reported separately from platform-held funds.</p></div></header>
          <div className="finance-direct-summary"><span>Recorded direct provider payments</span><strong>{formatMoney(number(summary.recorded_direct_provider_payments))}</strong><small>Direct payment confirmations are provider-reported and do not increase MULTIVENT revenue.</small></div>
          <div className="finance-direct-summary"><span>Accepted provider allocations</span><strong>{formatMoney(number(summary.provider_allocations_accepted))}</strong><small>Provider allocation recorded from paid or verified platform payments.</small></div>
        </article>
      </section>
      <section className="panel finance-panel">
        <header><div><span className="eyebrow">PAYMENT SUMMARY</span><h2>Latest platform-recorded payments</h2><p>References, providers, and ledger treatment — no payment action can be performed from this view.</p></div></header>
        {paymentRows.length === 0 ? <EmptyState title="No recognized payments" copy="No paid or verified platform transactions fall within this period." /> : <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Recorded</th><th>Reference</th><th>Provider</th><th>Received</th><th>Platform fee</th><th>Provider treatment</th><th>Status</th></tr></thead><tbody>{paymentRows.map((item) => <tr key={text(item.id)}><td>{formatDateTime(item.transaction_at)}</td><td><strong>{text(item.reference)}</strong><small>{text(item.payment_method, 'Unspecified')}</small></td><td>{text(item.provider_name)}</td><td>{formatMoney(number(item.amount_received))}</td><td>{formatMoney(number(item.commission_amount))}</td><td><span>{number(item.held_provider_amount) > 0 ? `${formatMoney(number(item.held_provider_amount))} held` : `${formatMoney(number(item.provider_net_amount))} allocated`}</span><small>{number(item.amount_released) > 0 ? `${formatMoney(number(item.amount_released))} released` : titleCase(text(item.provider_funds_status, 'legacy'))}</small></td><td><StatusBadge value={text(item.status)} /></td></tr>)}</tbody></table></div>}
      </section>
      <section className="panel finance-panel">
        <header><div><span className="eyebrow">PROVIDER PAYOUTS</span><h2>Latest payout requests</h2><p>Request status is visible without exposing provider payout-account information.</p></div></header>
        {payoutRows.length === 0 ? <EmptyState title="No payout requests" copy="Provider payout requests from the selected period will appear here." /> : <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Requested</th><th>Provider</th><th>Amount</th><th>Processed</th><th>Status</th></tr></thead><tbody>{payoutRows.map((item) => <tr key={text(item.id)}><td>{formatDateTime(item.requested_at)}</td><td>{text(item.provider_name)}</td><td><strong>{formatMoney(number(item.amount))}</strong></td><td>{item.processed_at ? formatDateTime(item.processed_at) : '—'}</td><td><StatusBadge value={text(item.status)} /></td></tr>)}</tbody></table></div>}
      </section>
    </>}
  </div>
}

function Metric({ label, value, detail, icon, tone = 'wine' }: { label: string; value: string; detail: string; icon: string; tone?: 'wine' | 'green' }) {
  return <article className="finance-metric"><span className={`finance-metric__icon finance-metric__icon--${tone}`}><MdiIcon path={icon} /></span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>
}

type ReportDefinition = { kind: string; label: string; description: string; allowed: boolean }

export function ReportsScreen() {
  const { can } = useStaff()
  const { liveDataVersion } = useDashboardControls()
  const definitions = useMemo<ReportDefinition[]>(() => [
    { kind: 'bookings', label: 'Bookings', description: 'Booking requests and values', allowed: can('events.view') },
    { kind: 'provider_performance', label: 'Provider performance', description: 'Provider booking performance', allowed: can('providers.view') },
    { kind: 'popular_categories', label: 'Popular categories', description: 'Demand by service category', allowed: can('events.view') },
    { kind: 'revenue', label: 'Revenue', description: 'Recorded fees and provider funds', allowed: can('revenue.view') || can('cashflow.view') },
    { kind: 'client_activity', label: 'Client activity', description: 'Events and bookings by client', allowed: can('users.view') && can('events.view') },
    { kind: 'coordinator_activity', label: 'Coordinator activity', description: 'Accepted coordinator assignments', allowed: can('coordinators.view') },
  ], [can])
  const available = useMemo(() => definitions.filter((definition) => definition.allowed), [definitions])
  const [kind, setKind] = useState('bookings')
  const [filter, setFilter] = useState<DateFilter>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [data, setData] = useState<Row>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const range = useMemo(() => reportRange(filter, customStart, customEnd), [customEnd, customStart, filter])

  const effectiveKind = available.some((definition) => definition.kind === kind) ? kind : (available[0]?.kind || '')

  const load = useCallback(async () => {
    if (!available.some((definition) => definition.kind === effectiveKind)) { setLoading(false); return }
    const supabase = getSupabase()
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return }
    setLoading(true); setError('')
    const { data: result, error: requestError } = await supabase.rpc('get_admin_report', {
      report_kind: effectiveKind,
      range_start: range.start,
      range_end: range.end,
    })
    if (requestError) setError(requestError.message)
    else setData(asRow(result))
    setLoading(false)
  }, [available, effectiveKind, range.end, range.start])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [liveDataVersion, load])

  const columns = Array.isArray(data.columns) ? data.columns.map((column) => String(column)) : []
  const rows = asRows(data.rows)
  const summary = asRow(data.summary)
  const selected = definitions.find((definition) => definition.kind === effectiveKind)
  const printableTitle = text(data.title, selected?.label || 'Report')
  const printReport = () => {
    document.body.classList.add('printing-report')
    window.print()
    window.setTimeout(() => document.body.classList.remove('printing-report'), 250)
  }

  return <div className="screen-stack reports-screen">
    <SectionHeading eyebrow="REPORTS" title="Reports" copy="Permission-scoped operational reports with exact date filtering, CSV export, and print-friendly output." onRefresh={() => void load()} />
    {available.length === 0 ? <EmptyState title="No report access" copy="Your role does not currently have access to any report source." /> : <>
      <section className="report-controls">
        <label>Report type<select value={effectiveKind} onChange={(event) => setKind(event.target.value)}>{available.map((definition) => <option key={definition.kind} value={definition.kind}>{definition.label}</option>)}</select><small>{selected?.description}</small></label>
        <DateControls filter={filter} customStart={customStart} customEnd={customEnd} onFilter={setFilter} onStart={setCustomStart} onEnd={setCustomEnd} />
        <div className="report-actions"><button className="secondary-button" disabled={loading || rows.length === 0} onClick={() => downloadCsv(`${effectiveKind}-${new Date().toISOString().slice(0, 10)}.csv`, columns, rows)}><MdiIcon path={mdiDownloadOutline} /> Export CSV</button><button className="secondary-button" disabled={loading} onClick={printReport}>Print</button></div>
      </section>
      {error && <InlineError message={error} onClose={() => setError('')} />}
      {loading ? <TableSkeleton rows={6} /> : <section className="panel report-output">
        <header><div><span className="eyebrow">{titleCase(effectiveKind)}</span><h2>{printableTitle}</h2><p>{text(data.description, 'Results reflect the selected date range.')}</p></div><small>Generated {formatDateTime(data.generated_at)}</small></header>
        <div className="report-summary-grid">{Object.entries(summary).map(([key, value]) => <article key={key}><span>{titleCase(key)}</span><strong>{isMoneyMetric(key) ? formatMoney(number(value)) : number(value).toLocaleString('en-PH')}</strong></article>)}</div>
        {rows.length === 0 ? <EmptyState title="No results for this period" copy="Try a wider date range or a different report type." /> : <div className="finance-table-wrap"><table className="finance-table report-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${index}-${text(row.id, text(row.booking, text(row.provider, text(row.client, text(row.coordinator, 'row')))))}`}>{columns.map((column) => <td key={column}>{reportValue(reportColumnKey(column), row[reportColumnKey(column)])}</td>)}</tr>)}</tbody></table></div>}
      </section>}
    </>}
  </div>
}

function isMoneyMetric(key: string) {
  return ['value', 'amount', 'total', 'payment', 'fee', 'held', 'released'].some((term) => key.includes(term))
}

function reportValue(key: string, value: unknown) {
  if (key === 'status') return <StatusBadge value={text(value, 'unknown')} />
  if (['requested', 'event_date', 'recorded'].includes(key)) return key === 'recorded' ? formatDateTime(value) : formatDate(String(value || ''))
  if (isMoneyMetric(key)) return formatMoney(number(value))
  if (typeof value === 'number') return value.toLocaleString('en-PH')
  return text(value)
}
