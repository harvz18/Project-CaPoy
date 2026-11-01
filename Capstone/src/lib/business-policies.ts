import { supabase } from './supabase'

export type BusinessPolicyStatus = 'draft' | 'published'

export type BusinessPolicyCategory =
  | 'advance_booking'
  | 'rescheduling'
  | 'late_arrival'
  | 'additional_charges'
  | 'cancellation'
  | 'refunds'
  | 'service_preparation'
  | 'delivery_or_pickup'
  | 'fitting_appointments'
  | 'overtime'
  | 'service_conditions'

export type BusinessPolicy = {
  category: BusinessPolicyCategory
  createdAt?: string
  id: string
  publishedAt?: string
  status: BusinessPolicyStatus
  text: string
  title: string
  updatedAt?: string
  version: number
}

export type BusinessPolicyResult<T = undefined> = {
  data?: T
  message?: string
  ok: boolean
}

export const policyPresetTemplates: ReadonlyArray<Pick<BusinessPolicy, 'category' | 'text' | 'title'>> = [
  {
    category: 'advance_booking',
    title: 'Advance booking',
    text: 'Bookings should be made at least [number] days before the event.',
  },
  {
    category: 'rescheduling',
    title: 'Rescheduling',
    text: 'Rescheduling requests are subject to availability.',
  },
  {
    category: 'late_arrival',
    title: 'Late arrival',
    text: 'Late arrivals may affect the scheduled service duration.',
  },
  {
    category: 'additional_charges',
    title: 'Additional charges',
    text: 'Additional services outside the agreed package may require separate charges.',
  },
]

const isPolicyCategory = (value: unknown): value is BusinessPolicyCategory => typeof value === 'string'
  && [
    'advance_booking', 'rescheduling', 'late_arrival', 'additional_charges',
    'cancellation', 'refunds', 'service_preparation', 'delivery_or_pickup',
    'fitting_appointments', 'overtime', 'service_conditions',
  ].includes(value)

const parsePolicy = (value: unknown): BusinessPolicy | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.text !== 'string') return undefined
  return {
    category: isPolicyCategory(row.category) ? row.category : 'service_conditions',
    createdAt: typeof row.created_at === 'string' ? row.created_at : undefined,
    id: row.id,
    publishedAt: typeof row.published_at === 'string' ? row.published_at : undefined,
    status: row.status === 'published' ? 'published' : 'draft',
    text: row.text,
    title: row.title,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    version: typeof row.version === 'number' ? row.version : 1,
  }
}

const normalizedPolicy = (value: Pick<BusinessPolicy, 'category' | 'status' | 'text' | 'title'>) => ({
  category: value.category,
  status: value.status,
  text: value.text.trim(),
  title: value.title.trim(),
})

const validatePolicy = (value: Pick<BusinessPolicy, 'text' | 'title'>) => {
  if (!value.title.trim()) return 'Enter a policy title.'
  if (!value.text.trim()) return 'Enter the policy details.'
  if (value.title.trim().length > 120) return 'Policy titles must be 120 characters or fewer.'
  if (value.text.trim().length > 2_000) return 'Policy details must be 2,000 characters or fewer.'
  return undefined
}

export const loadMyBusinessPolicies = async (): Promise<BusinessPolicyResult<BusinessPolicy[]>> => {
  if (!supabase) return { message: 'Connect Supabase to manage business policies.', ok: false }
  const { data, error } = await supabase
    .from('business_policies')
    .select('id, category, title, text, status, version, created_at, updated_at, published_at')
    .order('created_at', { ascending: true })
  if (error) return { message: error.message, ok: false }
  return { data: (data ?? []).flatMap((row) => {
    const policy = parsePolicy(row)
    return policy ? [policy] : []
  }), ok: true }
}

export const loadPublishedBusinessPolicies = async (
  ownerId?: string
): Promise<BusinessPolicyResult<BusinessPolicy[]>> => {
  if (!supabase || !ownerId) return { data: [], ok: true }
  const { data, error } = await supabase
    .from('business_policies')
    .select('id, category, title, text, status, version, created_at, updated_at, published_at')
    .eq('owner_id', ownerId)
    .eq('status', 'published')
    .order('published_at', { ascending: true })
  if (error) return { data: [], message: error.message, ok: false }
  return { data: (data ?? []).flatMap((row) => {
    const policy = parsePolicy(row)
    return policy ? [policy] : []
  }), ok: true }
}

export const saveMyBusinessPolicy = async (
  policy: BusinessPolicy
): Promise<BusinessPolicyResult<BusinessPolicy>> => {
  if (!supabase) return { message: 'Connect Supabase to save business policies.', ok: false }
  const validationMessage = validatePolicy(policy)
  if (validationMessage) return { message: validationMessage, ok: false }
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return { message: authError?.message ?? 'Sign in to save business policies.', ok: false }

  const payload = normalizedPolicy(policy)
  const request = policy.id.startsWith('new:')
    ? supabase.from('business_policies').insert({ ...payload, owner_id: authData.user.id })
    : supabase.from('business_policies').update(payload).eq('id', policy.id).eq('owner_id', authData.user.id)
  const { data, error } = await request
    .select('id, category, title, text, status, version, created_at, updated_at, published_at')
    .single()
  if (error) return { message: error.message, ok: false }
  const saved = parsePolicy(data)
  return saved ? { data: saved, ok: true } : { message: 'The saved policy could not be read.', ok: false }
}

export const removeMyBusinessPolicy = async (policyId: string): Promise<BusinessPolicyResult> => {
  if (!supabase) return { message: 'Connect Supabase to manage business policies.', ok: false }
  if (policyId.startsWith('new:')) return { ok: true }
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return { message: authError?.message ?? 'Sign in to remove business policies.', ok: false }
  const { error } = await supabase
    .from('business_policies')
    .delete()
    .eq('id', policyId)
    .eq('owner_id', authData.user.id)
  return error ? { message: error.message, ok: false } : { ok: true }
}
