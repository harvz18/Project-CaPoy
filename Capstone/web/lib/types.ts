export type StaffRole = 'admin' | 'superadmin' | 'assistant' | 'customer_service'

export type StaffProfile = {
  id: string
  full_name: string | null
  email: string | null
  default_role: StaffRole
  account_status: string
}

export type SectionKey =
  | 'overview'
  | 'users'
  | 'providers'
  | 'services'
  | 'bookings'
  | 'payments'
  | 'revenue'
  | 'cashflow'
  | 'remittances'
  | 'coordinators'
  | 'support'
  | 'permissions'
  | 'reviews'
  | 'audit'
  | 'settings'
