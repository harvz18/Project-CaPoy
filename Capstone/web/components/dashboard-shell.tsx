'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'
import {
  mdiAccountGroupOutline,
  mdiBellOutline,
  mdiBookOpenPageVariantOutline,
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
  profile: StaffProfile
}

const StaffContext = createContext<StaffContextValue | null>(null)

export function useStaff() {
  const context = useContext(StaffContext)
  if (!context) throw new Error('useStaff must be used inside DashboardShell')
  return context
}

const baseNavigation = [
  { href: '/dashboard', label: 'Overview', icon: mdiViewDashboardOutline },
  { href: '/dashboard/users', label: 'User management', icon: mdiAccountGroupOutline },
  { href: '/dashboard/providers', label: 'Provider approvals', icon: mdiStorefrontOutline },
  { href: '/dashboard/services', label: 'Service approvals', icon: mdiStoreCheckOutline },
  { href: '/dashboard/bookings', label: 'Bookings', icon: mdiBookOpenPageVariantOutline },
  { href: '/dashboard/payments', label: 'Payments', icon: mdiCreditCardOutline },
  { href: '/dashboard/reviews', label: 'Reviews', icon: mdiStarOutline },
]

const governanceNavigation = [
  { href: '/dashboard/audit', label: 'Audit log', icon: mdiClipboardTextClockOutline },
  { href: '/dashboard/settings', label: 'System settings', icon: mdiCogOutline },
]

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<StaffProfile | null>(null)
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

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, default_role, account_status')
        .eq('id', authData.user.id)
        .single()

      if (error || !data || !['admin', 'superadmin'].includes(data.default_role) || data.account_status !== 'active') {
        await supabase.auth.signOut()
        router.replace('/?error=unauthorized')
        return
      }

      if (active) {
        setProfile(data as StaffProfile)
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

  return (
    <StaffContext.Provider value={{ profile }}>
      <div className="dashboard-layout">
        <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
          <div className="sidebar__brand"><Brand compact /></div>
          <nav aria-label="Main navigation">
            <p>WORKSPACE</p>
            {baseNavigation.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            ))}
            {profile.default_role === 'superadmin' && (
              <>
                <p className="nav-group">GOVERNANCE</p>
                {governanceNavigation.map((item) => (
                  <NavLink key={item.href} {...item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                ))}
              </>
            )}
          </nav>
          <div className="sidebar__bottom">
            <div className="role-card">
              <MdiIcon path={profile.default_role === 'superadmin' ? mdiShieldCrownOutline : mdiShieldAccountOutline} />
              <div><span>Signed in as</span><strong>{profile.default_role === 'superadmin' ? 'Superadmin' : 'Administrator'}</strong></div>
            </div>
            <button className="signout-button" onClick={signOut}><MdiIcon path={mdiLogout} /><span>Sign out</span></button>
          </div>
        </aside>
        {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

        <div className="dashboard-main">
          <header className="topbar">
            <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><MdiIcon path={mdiMenu} /></button>
            <div className="topbar__status"><span className="status-dot" /> All systems operational</div>
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
