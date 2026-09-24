export type StaffRole = 'admin' | 'superadmin'

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
  | 'reviews'
  | 'audit'
  | 'settings'
