import { supabase } from './supabase'

export type ClientRefundStatus =
  | 'pending_destination'
  | 'pending_disbursement'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'requires_reconciliation'
  | 'cancelled'

export type ClientRefundRecord = {
  amount: number
  channel: 'bank_transfer' | 'e_wallet' | 'unassigned'
  createdAt: string
  currency: string
  eventDate?: string
  eventId: string
  eventName: string
  id: string
  processedAt?: string
  reason: 'client_cancellation' | 'recipient_declined' | 'refund'
  reference: string
  serviceName: string
  status: ClientRefundStatus
}

export type HistoricalRefundRecord = Omit<ClientRefundRecord, 'channel' | 'processedAt' | 'status'>

export type ClientRefundOverview = {
  historicalRecords: HistoricalRefundRecord[]
  refunds: ClientRefundRecord[]
  summary: {
    completedRefunds: number
    currency: string
    historicalWalletCredits: number
    pendingExternalDisbursements: number
    requiresReconciliation: number
  }
}

export type ClientRefundOverviewResult = {
  data?: ClientRefundOverview
  message?: string
  ok: boolean
}

const numberFrom = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const textFrom = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback

const recordFrom = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

const reasonFrom = (value: unknown): ClientRefundRecord['reason'] => {
  const reason = textFrom(value)
  return reason === 'client_cancellation' || reason === 'recipient_declined'
    ? reason
    : 'refund'
}

const refundStatusFrom = (value: unknown): ClientRefundStatus => {
  const status = textFrom(value)
  return [
    'pending_destination',
    'pending_disbursement',
    'processing',
    'completed',
    'failed',
    'requires_reconciliation',
    'cancelled',
  ].includes(status)
    ? status as ClientRefundStatus
    : 'pending_destination'
}

const channelFrom = (value: unknown): ClientRefundRecord['channel'] => {
  const channel = textFrom(value)
  return channel === 'bank_transfer' || channel === 'e_wallet' ? channel : 'unassigned'
}

const refundRecordFrom = (value: unknown): ClientRefundRecord | undefined => {
  const row = recordFrom(value)
  const id = textFrom(row.id)
  if (!id) return undefined

  return {
    amount: numberFrom(row.amount),
    channel: channelFrom(row.channel),
    createdAt: textFrom(row.createdAt),
    currency: textFrom(row.currency, 'PHP'),
    eventDate: textFrom(row.eventDate) || undefined,
    eventId: textFrom(row.eventId),
    eventName: textFrom(row.eventName, 'Event'),
    id,
    processedAt: textFrom(row.processedAt) || undefined,
    reason: reasonFrom(row.reason),
    reference: textFrom(row.reference),
    serviceName: textFrom(row.serviceName, 'Booking'),
    status: refundStatusFrom(row.status),
  }
}

const historicalRecordFrom = (value: unknown): HistoricalRefundRecord | undefined => {
  const record = refundRecordFrom({ ...recordFrom(value), status: 'completed', channel: 'unassigned' })
  if (!record) return undefined
  return {
    amount: record.amount,
    createdAt: record.createdAt,
    currency: record.currency,
    eventDate: record.eventDate,
    eventId: record.eventId,
    eventName: record.eventName,
    id: record.id,
    reason: record.reason,
    reference: record.reference,
    serviceName: record.serviceName,
  }
}

export const emptyClientRefundOverview = (): ClientRefundOverview => ({
  historicalRecords: [],
  refunds: [],
  summary: {
    completedRefunds: 0,
    currency: 'PHP',
    historicalWalletCredits: 0,
    pendingExternalDisbursements: 0,
    requiresReconciliation: 0,
  },
})

export const fetchClientRefundOverview = async (): Promise<ClientRefundOverviewResult> => {
  if (!supabase) {
    return { message: 'Connect Supabase to view your refund records.', ok: false }
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { message: authError?.message ?? 'Sign in to view your refund records.', ok: false }
  }

  const { data, error } = await supabase.rpc('get_my_client_refund_overview_v14')
  if (error) return { message: error.message, ok: false }

  const payload = recordFrom(data)
  const summary = recordFrom(payload.summary)
  const refunds = (Array.isArray(payload.refunds) ? payload.refunds : [])
    .map(refundRecordFrom)
    .filter((record): record is ClientRefundRecord => Boolean(record))
  const historicalRecords = (Array.isArray(payload.historicalRecords) ? payload.historicalRecords : [])
    .map(historicalRecordFrom)
    .filter((record): record is HistoricalRefundRecord => Boolean(record))

  return {
    data: {
      historicalRecords,
      refunds,
      summary: {
        completedRefunds: numberFrom(summary.completedRefunds),
        currency: textFrom(summary.currency, 'PHP'),
        historicalWalletCredits: numberFrom(summary.historicalWalletCredits),
        pendingExternalDisbursements: numberFrom(summary.pendingExternalDisbursements),
        requiresReconciliation: numberFrom(summary.requiresReconciliation),
      },
    },
    ok: true,
  }
}
