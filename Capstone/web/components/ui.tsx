'use client'

import { mdiAlertCircleOutline, mdiChevronLeft, mdiChevronRight, mdiClose, mdiInformationOutline } from '@mdi/js'
import { MdiIcon } from './icons'

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const normalized = (value || 'unknown').toLowerCase()
  const positive = ['active', 'verified', 'paid', 'fully_paid', 'confirmed', 'completed', 'approved', 'published', 'processed'].includes(normalized)
  const caution = ['pending', 'pending_review', 'deposit_paid', 'processing', 'requested', 'payment_required', 'planning'].includes(normalized)
  const negative = ['suspended', 'disabled', 'rejected', 'failed', 'cancelled', 'expired'].includes(normalized)
  const tone = positive ? 'positive' : caution ? 'caution' : negative ? 'negative' : 'neutral'
  const label = normalized === 'deposit_paid' ? '35% downpayment' : normalized.replaceAll('_', ' ')
  return <span className={`status-badge status-badge--${tone}`}><i />{label}</span>
}

export function SegmentedFilter({
  ariaLabel,
  options,
  value,
  onChange,
  className = '',
}: {
  ariaLabel: string
  options: ReadonlyArray<readonly [value: string, label: string]>
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={`segmented-filter ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {options.map(([optionValue, label]) => (
        <button
          type="button"
          key={optionValue}
          className={value === optionValue ? 'active' : ''}
          aria-pressed={value === optionValue}
          onClick={() => onChange(optionValue)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <span><MdiIcon path={mdiInformationOutline} /></span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  )
}

export function InlineError({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div className="inline-error" role="alert">
      <MdiIcon path={mdiAlertCircleOutline} />
      <span>{message}</span>
      {onClose && <button onClick={onClose} aria-label="Dismiss"><MdiIcon path={mdiClose} /></button>}
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="table-skeleton">{Array.from({ length: rows }, (_, index) => <i key={index} />)}</div>
}

export const TABLE_PAGE_SIZE = 10

export function paginateItems<T>(items: readonly T[], requestedPage: number, pageSize = TABLE_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(Math.max(1, requestedPage), totalPages)
  const start = items.length ? (page - 1) * pageSize : 0
  return {
    end: Math.min(start + pageSize, items.length),
    page,
    rows: items.slice(start, start + pageSize),
    start,
    totalPages,
  }
}

export function TablePagination({
  itemLabel = 'records',
  page,
  totalItems,
  totalPages,
  onPageChange,
}: {
  itemLabel?: string
  page: number
  totalItems: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  const start = totalItems ? (page - 1) * TABLE_PAGE_SIZE + 1 : 0
  const end = Math.min(page * TABLE_PAGE_SIZE, totalItems)
  return <footer className="table-footer table-footer--pagination">
    <span>Showing {start}–{end} of {totalItems.toLocaleString()} {itemLabel}</span>
    <div>
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page"><MdiIcon path={mdiChevronLeft} /></button>
      <b>Page {page} of {totalPages}</b>
      <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page"><MdiIcon path={mdiChevronRight} /></button>
    </div>
  </footer>
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value))
}

export function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Number(value || 0))
}
