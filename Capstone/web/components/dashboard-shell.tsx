'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'
import {
  mdiAccountGroupOutline,
  mdiBellOutline,
  mdiBookOpenPageVariantOutline,
  mdiCashMultiple,
  mdiChevronDown,
  mdiClipboardTextClockOutline,
  mdiCogOutline,
  mdiCreditCardOutline,
  mdiLogout,
  mdiMenu,
  mdiShieldAccountOutline,
  mdiShieldCrownOutline,
  mdiStarOutline,
  mdiStoreCheckOutline,
  mdiStorefrontOutline,
  mdiViewDashboardOutline,
} from '@mdi/js'
import { Brand } from './brand'
import { MdiIcon } from './icons'
import { getSupabase } from '@/lib/supabase'
import type { StaffProfile } from '@/lib/types'

type StaffContextValue = {
  can: (permission: string) => boolean
  permissions: string[]
  profile: StaffProfile
}

const StaffContext = createContext<StaffContextValue | null>(null)

export function useStaff() {
  const context = useContext(StaffContext)
  if (!context) throw new Error('useStaff must be used inside DashboardShell')
  return context
}

const baseNavigation = [
  { href: '/dashboard', label: 'Overview', icon: mdiViewDashboardOutline, permission: null },
  { href: '/dashboard/users', label: 'Users', icon: mdiAccountGroupOutline, permission: 'users.view' },
  { href: '/dashboard/providers', label: 'Provider applications', icon: mdiStorefrontOutline, permission: 'providers.view' },
  { href: '/dashboard/services', label: 'Service applications', icon: mdiStoreCheckOutline, permission: 'services.view' },
  { href: '/dashboard/bookings', label: 'Events & bookings', icon: mdiBookOpenPageVariantOutline, permission: 'events.view' },
  { href: '/dashboard/coordinators', label: 'Coordinator queue', icon: mdiShieldAccountOutline, permission: 'coordinators.view' },
  { href: '/dashboard/support', label: 'Customer support', icon: mdiBellOutline, permission: 'support.view' },
  { href: '/dashboard/payments', label: 'Payments', icon: mdiCreditCardOutline, permission: 'cashflow.view' },
  { href: '/dashboard/revenue', label: 'Revenue', icon: mdiStarOutline, permission: 'revenue.view' },
  { href: '/dashboard/cashflow', label: 'Cash flow', icon: mdiCreditCardOutline, permission: 'cashflow.view' },
  { href: '/dashboard/remittances', label: 'Remittances', icon: mdiCashMultiple, permission: 'remittance.view' },
  { href: '/dashboard/reviews', label: 'Reviews', icon: mdiStarOutline, permission: 'providers.view' },
]

const governanceNavigation = [
  { href: '/dashboard/permissions', label: 'Staff & permissions', icon: mdiShieldCrownOutline, permission: ['users.permissions.manage', 'users.create', 'coordinators.create'] },
  { href: '/dashboard/audit', label: 'Audit log', icon: mdiClipboardTextClockOutline, permission: 'system.audit_logs' },
  { href: '/dashboard/settings', label: 'System settings', icon: mdiCogOutline, permission: 'system.settings' },
]

const legacyAdminPermissions = [
  'dashboard.view',
  'users.view',
  'providers.view',
  'providers.approve',
  'services.view',
  'services.approve',
  'events.view',
  'cashflow.view',
]

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<StaffProfile | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let active = true

    async function verifyAccess() {
      const supabase = getSupabase()
      if (!supabase) {
        router.replace('/')
        return
      }

      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) {
        router.replace('/')
        return
      }

      const { data, error } = await supabase.rpc('get_my_staff_access')
      let access = data as { profile?: StaffProfile; permissions?: string[] } | null

      // Keep the existing Admin/Superadmin portal usable while migration 30 is
      // being rolled out. Once the RBAC RPC exists, it remains authoritative.
      if (error) {
        const { data: legacyProfile } = await supabase
          .from('profiles')
          .select('id, full_name, email, default_role, account_status')
          .eq('id', authData.user.id)
          .maybeSingle()
        const legacyStaff = legacyProfile as StaffProfile | null
        if (
          legacyStaff?.account_status === 'active'
          && (legacyStaff.default_role === 'admin' || legacyStaff.default_role === 'superadmin')
        ) {
          access = {
            profile: legacyStaff,
            permissions: legacyStaff.default_role === 'superadmin' ? ['*'] : legacyAdminPermissions,
          }
        }
      }

      if (!access?.profile || access.profile.account_status !== 'active') {
        await supabase.auth.signOut()
        router.replace('/?error=unauthorized')
        return
      }

      if (active) {
        setProfile(access.profile)
        setPermissions(Array.isArray(access.permissions) ? access.permissions : [])
        setLoading(false)
      }
    }

    void verifyAccess()
    return () => { active = false }
  }, [router])

  async function signOut() {
    const supabase = getSupabase()
    if (supabase) await supabase.auth.signOut()
    router.replace('/')
  }

  if (loading || !profile) {
    return (
      <div className="app-loader">
        <Brand />
        <span className="loader-ring" />
        <p>Verifying secure access…</p>
      </div>
    )
  }

  const initials = (profile.full_name || profile.email || 'MV')
    .split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  const can = (permission: string) =>
    profile.default_role === 'superadmin' || permissions.includes(permission)
  const canNavigate = (permission: string | string[] | null) => !permission
    || (Array.isArray(permission) ? permission.some(can) : can(permission))
  const visibleBaseNavigation = baseNavigation.filter((item) => canNavigate(item.permission))
  const visibleGovernanceNavigation = governanceNavigation.filter((item) => canNavigate(item.permission))
  const roleLabel = ({
    admin: 'Administrator',
    superadmin: 'Superadmin',
    assistant: 'Assistant',
    customer_service: 'Customer Service',
  } as const)[profile.default_role]

  return (
    <StaffContext.Provider value={{ can, permissions, profile }}>
      <div className="dashboard-layout">
        <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
          <div className="sidebar__brand"><Brand compact /></div>
          <nav aria-label="Main navigation">
            <p>WORKSPACE</p>
            {visibleBaseNavigation.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            ))}
            {visibleGovernanceNavigation.length > 0 && (
              <>
                <p className="nav-group">GOVERNANCE</p>
                {visibleGovernanceNavigation.map((item) => (
                  <NavLink key={item.href} {...item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                ))}
              </>
            )}
          </nav>
          <div className="sidebar__bottom">
            <div className="role-card">
              <MdiIcon path={profile.default_role === 'superadmin' ? mdiShieldCrownOutline : mdiShieldAccountOutline} />
              <div><span>Signed in as</span><strong>{roleLabel}</strong></div>
            </div>
            <button className="signout-button" onClick={signOut}><MdiIcon path={mdiLogout} /><span>Sign out</span></button>
          </div>
        </aside>
        {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

        <div className="dashboard-main">
          <header className="topbar">
            <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><MdiIcon path={mdiMenu} /></button>
            <div className="topbar__status"><span className="status-dot" /> Secure staff workspace</div>
            <div className="topbar__actions">
              <button className="notification-button" aria-label="Notifications"><MdiIcon path={mdiBellOutline} /><i /></button>
              <button className="profile-button">
                <span className="avatar">{initials}</span>
                <span className="profile-button__copy"><strong>{profile.full_name || 'MULTIVENT Staff'}</strong><small>{profile.email}</small></span>
                <MdiIcon path={mdiChevronDown} size={0.7} />
              </button>
            </div>
          </header>
          <div className="dashboard-content">{children}</div>
        </div>
      </div>
    </StaffContext.Provider>
  )
}

function NavLink({ href, label, icon, pathname, onNavigate }: { href: string; label: string; icon: string; pathname: string; onNavigate: () => void }) {
  const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
  return (
    <Link href={href} onClick={onNavigate} className={active ? 'nav-link nav-link--active' : 'nav-link'}>
      <MdiIcon path={icon} /><span>{label}</span>{active && <i />}
    </Link>
  )
}
