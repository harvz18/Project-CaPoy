'use client'

import { mdiAlertCircleOutline, mdiClose, mdiInformationOutline } from '@mdi/js'
import { MdiIcon } from './icons'

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const normalized = (value || 'unknown').toLowerCase()
  const positive = ['active', 'verified', 'paid', 'confirmed', 'completed', 'approved', 'published'].includes(normalized)
  const caution = ['pending', 'pending_review', 'processing', 'requested', 'payment_required', 'planning'].includes(normalized)
  const negative = ['suspended', 'disabled', 'rejected', 'failed', 'cancelled', 'expired'].includes(normalized)
  const tone = positive ? 'positive' : caution ? 'caution' : negative ? 'negative' : 'neutral'
  return <span className={`status-badge status-badge--${tone}`}><i />{normalized.replaceAll('_', ' ')}</span>
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

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value))
}

export function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Number(value || 0))
}
