import { supabase, supabaseConfig } from './supabase'

export type SupportTicket = {
  category: string
  createdAt: string
  id: string
  priority: string
  status: string
  subject: string
  ticketNumber: number
}

export type SupportMessage = { body: string; createdAt: string; id: string; mine: boolean }

export const fetchMySupportTickets = async (): Promise<{ data: SupportTicket[]; message?: string }> => {
  if (!supabase || !supabaseConfig.isConfigured) return { data: [], message: 'Supabase is not configured.' }
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return { data: [], message: 'Sign in to view support tickets.' }
  const { data, error } = await supabase.from('support_tickets')
    .select('id,ticket_number,category,subject,status,priority,created_at')
    .eq('user_id', authData.user.id).order('created_at', { ascending: false })
  if (error) return { data: [], message: error.message }
  return { data: (data || []).map((row) => ({
    category: row.category, createdAt: row.created_at, id: row.id, priority: row.priority,
    status: row.status, subject: row.subject, ticketNumber: row.ticket_number,
  })) }
}

export const createSupportTicket = async (value: { category: string; description: string; subject: string }) => {
  if (!supabase || !supabaseConfig.isConfigured) return { ok: false, message: 'Supabase is not configured.' }
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return { ok: false, message: 'Sign in to contact support.' }
  const { error } = await supabase.from('support_tickets').insert({
    user_id: authData.user.id,
    category: value.category,
    subject: value.subject.trim(),
    description: value.description.trim(),
  })
  return error ? { ok: false, message: error.message } : { ok: true }
}

export const fetchSupportMessages = async (ticketId: string): Promise<{ data: SupportMessage[]; message?: string }> => {
  if (!supabase || !supabaseConfig.isConfigured) return { data: [], message: 'Supabase is not configured.' }
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return { data: [], message: 'Sign in to view replies.' }
  const { data, error } = await supabase.from('support_messages').select('id,sender_id,body,created_at').eq('ticket_id', ticketId).order('created_at')
  if (error) return { data: [], message: error.message }
  return { data: (data || []).map((row) => ({ body: row.body, createdAt: row.created_at, id: row.id, mine: row.sender_id === authData.user?.id })) }
}

export const sendSupportReply = async (ticketId: string, body: string) => {
  if (!supabase || !supabaseConfig.isConfigured) return { ok: false, message: 'Supabase is not configured.' }
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return { ok: false, message: 'Sign in to reply.' }
  const { error } = await supabase.from('support_messages').insert({ ticket_id: ticketId, sender_id: authData.user.id, body: body.trim(), is_internal: false })
  return error ? { ok: false, message: error.message } : { ok: true }
}
