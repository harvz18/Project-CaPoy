import { supabase } from './supabase'

export type ClientWalletTransaction = {
  amount: number
  createdAt: string
  currency: string
  eventDate?: string
  eventId: string
  eventName: string
  id: string
  reason: 'client_cancellation' | 'recipient_declined' | 'refund'
  reference: string
  serviceName: string
  status: 'available'
  type: 'refund_credit'
}

export type ClientWallet = {
  summary: {
    availableBalance: number
    currency: string
    totalRefunded: number
  }
  transactions: ClientWalletTransaction[]
}

export type ClientWalletResult = {
  data?: ClientWallet
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

export const emptyClientWallet = (): ClientWallet => ({
  summary: {
    availableBalance: 0,
    currency: 'PHP',
    totalRefunded: 0,
  },
  transactions: [],
})

export const fetchClientWallet = async (): Promise<ClientWalletResult> => {
  if (!supabase) {
    return { message: 'Connect Supabase to view your wallet.', ok: false }
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { message: authError?.message ?? 'Sign in to view your wallet.', ok: false }
  }

  const { data, error } = await supabase.rpc('get_my_client_wallet')
  if (error) return { message: error.message, ok: false }

  const payload = recordFrom(data)
  const summary = recordFrom(payload.summary)
  const rows = Array.isArray(payload.transactions) ? payload.transactions : []
  const transactions = rows.map((item) => {
    const row = recordFrom(item)
    const reason = textFrom(row.reason)
    return {
      amount: numberFrom(row.amount),
      createdAt: textFrom(row.createdAt),
      currency: textFrom(row.currency, 'PHP'),
      eventDate: textFrom(row.eventDate) || undefined,
      eventId: textFrom(row.eventId),
      eventName: textFrom(row.eventName, 'Event'),
      id: textFrom(row.id),
      reason: reason === 'client_cancellation' || reason === 'recipient_declined'
        ? reason
        : 'refund',
      reference: textFrom(row.reference),
      serviceName: textFrom(row.serviceName, 'Booking'),
      status: 'available',
      type: 'refund_credit',
    } satisfies ClientWalletTransaction
  }).filter((transaction) => transaction.id)

  return {
    data: {
      summary: {
        availableBalance: numberFrom(summary.availableBalance),
        currency: textFrom(summary.currency, 'PHP'),
        totalRefunded: numberFrom(summary.totalRefunded),
      },
      transactions,
    },
    ok: true,
  }
}
