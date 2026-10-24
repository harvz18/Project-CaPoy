export type StaffRole = 'admin' | 'superadmin' | 'assistant' | 'customer_service'

export type StaffProfile = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url?: string | null
  default_role: StaffRole
  account_status: string
}

export type SectionKey =
  | 'overview'
  | 'users'
  | 'clients'
  | 'providers'
  | 'categories'
  | 'services'
  | 'bookings'
  | 'payments'
  | 'financial'
  | 'reports'
  | 'revenue'
  | 'cashflow'
  | 'insights'
  | 'remittances'
  | 'coordinators'
  | 'support'
  | 'permissions'
  | 'reviews'
  | 'audit'
  | 'settings'
