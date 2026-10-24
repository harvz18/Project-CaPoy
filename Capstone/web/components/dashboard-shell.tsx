'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  mdiAccountGroupOutline,
  mdiBellOutline,
  mdiBookOpenPageVariantOutline,
  mdiCashMultiple,
  mdiChartBoxOutline,
  mdiChevronDown,
  mdiClipboardTextClockOutline,
  mdiCogOutline,
  mdiCreditCardOutline,
  mdiFormatListBulletedType,
  mdiLogout,
  mdiMagnify,
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
import type { SectionKey, StaffProfile, StaffRole } from '@/lib/types'

type StaffContextValue = {
  can: (permission: string) => boolean
  canAccessRoute: (route: SectionKey) => boolean
  permissions: string[]
  profile: StaffProfile
}

type DashboardControlsValue = {
  eventType: string
  eventTypes: string[]
  eventTypesError: string
  liveDataVersion: number
  liveStatus: 'connecting' | 'live' | 'reconnecting' | 'unavailable'
  setEventType: (value: string) => void
}

type DashboardNotification = {
  id: string
  title: string
  body: string | null
  resource_type: string | null
  resource_id: string | null
  status: string
  created_at: string
}

type DashboardSearchResult = {
  result_type: 'provider' | 'category' | 'booking' | 'client'
  id: string
  title: string
  subtitle: string
}

type NavigationItem = {
  href: string
  label: string
  icon: string
  permission: string | string[] | null
  route: SectionKey
}

const StaffContext = createContext<StaffContextValue | null>(null)
const DashboardControlsContext = createContext<DashboardControlsValue | null>(null)

export function useStaff() {
  const context = useContext(StaffContext)
  if (!context) throw new Error('useStaff must be used inside DashboardShell')
  return context
}

export function useDashboardControls() {
  const context = useContext(DashboardControlsContext)
  if (!context) throw new Error('useDashboardControls must be used inside DashboardShell')
  return context
}

const baseNavigation: NavigationItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: mdiViewDashboardOutline, permission: null, route: 'overview' },
  { href: '/dashboard/users', label: 'Users', icon: mdiAccountGroupOutline, permission: 'users.view', route: 'users' },
  { href: '/dashboard/clients', label: 'Clients', icon: mdiAccountGroupOutline, permission: 'users.view', route: 'clients' },
  { href: '/dashboard/providers', label: 'Service providers', icon: mdiStorefrontOutline, permission: 'providers.view', route: 'providers' },
  { href: '/dashboard/services', label: 'Service applications', icon: mdiStoreCheckOutline, permission: 'services.view', route: 'services' },
  { href: '/dashboard/bookings', label: 'Events & bookings', icon: mdiBookOpenPageVariantOutline, permission: 'events.view', route: 'bookings' },
  { href: '/dashboard/coordinators', label: 'Coordinator bookings', icon: mdiShieldAccountOutline, permission: 'coordinators.view', route: 'coordinators' },
  { href: '/dashboard/support', label: 'Customer support', icon: mdiBellOutline, permission: 'support.view', route: 'support' },
  { href: '/dashboard/payments', label: 'Payments', icon: mdiCreditCardOutline, permission: 'cashflow.view', route: 'payments' },
  { href: '/dashboard/financial', label: 'Financial overview', icon: mdiCashMultiple, permission: 'cashflow.view', route: 'financial' },
  { href: '/dashboard/reports', label: 'Reports', icon: mdiClipboardTextClockOutline, permission: ['events.view', 'providers.view', 'revenue.view', 'cashflow.view', 'coordinators.view'], route: 'reports' },
  { href: '/dashboard/revenue', label: 'Revenue', icon: mdiStarOutline, permission: 'revenue.view', route: 'revenue' },
  { href: '/dashboard/cashflow', label: 'Cash flow', icon: mdiCreditCardOutline, permission: 'cashflow.view', route: 'cashflow' },
  { href: '/dashboard/remittances', label: 'Remittances', icon: mdiCashMultiple, permission: 'remittance.view', route: 'remittances' },
  { href: '/dashboard/reviews', label: 'Reviews', icon: mdiStarOutline, permission: 'providers.view', route: 'reviews' },
]

// The admin reference navigation maps directly to existing,
// permission-scoped MULTIVENT modules. Each destination is live and retains
// its own authorization checks.
const adminReferenceNavigation: NavigationItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: mdiViewDashboardOutline, permission: null, route: 'overview' },
  { href: '/dashboard/providers', label: 'Providers', icon: mdiStorefrontOutline, permission: 'providers.view', route: 'providers' },
  { href: '/dashboard/categories', label: 'Categories', icon: mdiFormatListBulletedType, permission: 'providers.view', route: 'categories' },
  { href: '/dashboard/reviews', label: 'Ratings & reviews', icon: mdiStarOutline, permission: 'providers.view', route: 'reviews' },
  { href: '/dashboard/bookings', label: 'Bookings', icon: mdiBookOpenPageVariantOutline, permission: 'events.view', route: 'bookings' },
  { href: '/dashboard/revenue', label: 'Revenue', icon: mdiCashMultiple, permission: 'revenue.view', route: 'revenue' },
  { href: '/dashboard/insights', label: 'Insights', icon: mdiChartBoxOutline, permission: 'dashboard.analytics.view', route: 'insights' },
  { href: '/dashboard/reports', label: 'Reports', icon: mdiClipboardTextClockOutline, permission: ['events.view', 'providers.view', 'revenue.view', 'cashflow.view', 'coordinators.view'], route: 'reports' },
]

const governanceNavigation: NavigationItem[] = [
  { href: '/dashboard/permissions', label: 'Staff & permissions', icon: mdiShieldCrownOutline, permission: ['users.permissions.manage', 'users.create', 'coordinators.create'], route: 'permissions' },
  { href: '/dashboard/audit', label: 'Audit log', icon: mdiClipboardTextClockOutline, permission: 'system.audit_logs', route: 'audit' },
  { href: '/dashboard/settings', label: 'System settings', icon: mdiCogOutline, permission: 'system.settings', route: 'settings' },
]

const superadminRoutes = new Set<SectionKey>(['users', 'permissions', 'audit', 'settings'])
const adminRoutes = new Set<SectionKey>(['overview', 'clients', 'providers', 'categories', 'bookings', 'financial', 'reports', 'revenue', 'cashflow', 'reviews', 'insights'])

export function canAccessWorkspaceRoute(role: StaffRole, route: SectionKey) {
  if (role === 'superadmin') return superadminRoutes.has(route)
  if (role === 'admin') return adminRoutes.has(route)
  return true
}

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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [eventType, setEventType] = useState('all')
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const [eventTypesError, setEventTypesError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DashboardSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [liveDataVersion, setLiveDataVersion] = useState(0)
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'reconnecting' | 'unavailable'>('connecting')
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [notificationActionBusy, setNotificationActionBusy] = useState(false)
  const currentRole = profile?.default_role
  const can = useCallback((permission: string) =>
    currentRole === 'superadmin' || permissions.includes(permission), [currentRole, permissions])
  const canAccessRoute = useCallback((route: SectionKey) =>
    currentRole ? canAccessWorkspaceRoute(currentRole, route) : false, [currentRole])
  const staffContextValue = useMemo<StaffContextValue | null>(() => profile
    ? { can, canAccessRoute, permissions, profile }
    : null, [can, canAccessRoute, permissions, profile])
  const dashboardControlsValue = useMemo(() => ({
    eventType,
    eventTypes,
    eventTypesError,
    liveDataVersion,
    liveStatus,
    setEventType,
  }), [eventType, eventTypes, eventTypesError, liveDataVersion, liveStatus])

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
          .select('id, full_name, email, avatar_url, default_role, account_status')
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

      if (!access?.profile || !['active', 'verified'].includes(access.profile.account_status)) {
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

  const hasDashboardAnalytics = Boolean(profile?.default_role === 'admin' && can('dashboard.analytics.view'))

  useEffect(() => {
    let active = true
    if (!hasDashboardAnalytics) {
      return () => { active = false }
    }

    async function loadEventTypes() {
      const supabase = getSupabase()
      if (!supabase) {
        if (active) setEventTypesError('Event-type filters are unavailable because Supabase is not configured.')
        return
      }
      const { data, error } = await supabase.rpc('get_admin_dashboard_event_types')
      if (!active) return
      if (error || !Array.isArray(data) || data.some((value) => typeof value !== 'string')) {
        setEventTypes([])
        setEventTypesError(error?.message || 'Event-type filters could not be loaded.')
        return
      }
      const types = [...new Set(data.map((value) => value.trim()).filter(Boolean))]
      setEventTypes(types)
      setEventType((current) => current !== 'all' && !types.includes(current) ? 'all' : current)
      setEventTypesError('')
    }

    void loadEventTypes()
    return () => { active = false }
  }, [hasDashboardAnalytics])

  useEffect(() => {
    let active = true
    const query = searchQuery.trim()
    if (!hasDashboardAnalytics || query.length < 2) {
      return () => { active = false }
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        const supabase = getSupabase()
        if (!supabase) {
          if (active) {
            setSearchResults([])
            setSearchError('Search is unavailable because Supabase is not configured.')
            setSearchLoading(false)
          }
          return
        }
        if (active) {
          setSearchLoading(true)
          setSearchError('')
        }
        const { data, error } = await supabase.rpc('search_admin_dashboard', { p_query: query, p_limit: 8 })
        if (!active) return
        if (error || !isDashboardSearchResponse(data)) {
          setSearchResults([])
          setSearchError(error?.message || 'Search returned an unexpected response.')
        } else {
          setSearchResults(data.results)
          setSearchError('')
        }
        setSearchLoading(false)
      })()
    }, 260)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [hasDashboardAnalytics, searchQuery])

  useEffect(() => {
    if (!hasDashboardAnalytics || !profile?.id) return undefined
    const client = getSupabase()
    if (!client) {
      const unavailableTimer = window.setTimeout(() => setLiveStatus('unavailable'), 0)
      return () => window.clearTimeout(unavailableTimer)
    }

    let active = true
    let dashboardRefreshTimer: number | undefined
    let notificationRefreshTimer: number | undefined

    const queueDashboardRefresh = () => {
      if (dashboardRefreshTimer) window.clearTimeout(dashboardRefreshTimer)
      dashboardRefreshTimer = window.setTimeout(() => {
        if (active) setLiveDataVersion((value) => value + 1)
      }, 550)
    }

    const loadNotifications = async () => {
      if (!active) return
      setNotificationLoading(true)
      const [recentResult, unreadResult] = await Promise.all([
        client
          .from('notifications')
          .select('id,title,body,resource_type,resource_id,status,created_at')
          .eq('user_id', profile.id)
          .neq('status', 'archived')
          .order('created_at', { ascending: false })
          .limit(12),
        client
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('status', 'unread'),
      ])
      if (!active) return

      if (recentResult.error || unreadResult.error) {
        setNotificationError(recentResult.error?.message || unreadResult.error?.message || 'Notifications could not be loaded.')
      } else {
        setNotifications(sortDashboardNotifications((recentResult.data || []) as DashboardNotification[]))
        setUnreadNotificationCount(unreadResult.count || 0)
        setNotificationError('')
      }
      setNotificationLoading(false)
    }

    const queueNotificationRefresh = () => {
      if (notificationRefreshTimer) window.clearTimeout(notificationRefreshTimer)
      notificationRefreshTimer = window.setTimeout(() => { void loadNotifications() }, 300)
    }

    const updateNotification = (record: unknown) => {
      const notification = asDashboardNotification(record)
      if (!notification || !active) return
      setNotifications((current) => sortDashboardNotifications([
        notification,
        ...current.filter((item) => item.id !== notification.id),
      ]).slice(0, 12))
      queueNotificationRefresh()
    }

    const watchTables = ['bookings', 'events', 'payments', 'financial_transactions', 'reviews', 'services', 'provider_profiles']
    let channel = client
      .channel(`admin-dashboard-live-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        updateNotification(payload.new)
        queueDashboardRefresh()
      })

    for (const table of watchTables) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, queueDashboardRefresh)
    }

    channel.subscribe((status) => {
      if (!active) return
      if (status === 'SUBSCRIBED') setLiveStatus('live')
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setLiveStatus('unavailable')
      else if (status === 'CLOSED') setLiveStatus('reconnecting')
      else setLiveStatus('connecting')
    })

    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') {
        void loadNotifications()
        queueDashboardRefresh()
      }
    }
    window.addEventListener('focus', refreshOnReturn)
    document.addEventListener('visibilitychange', refreshOnReturn)
    void loadNotifications()

    return () => {
      active = false
      if (dashboardRefreshTimer) window.clearTimeout(dashboardRefreshTimer)
      if (notificationRefreshTimer) window.clearTimeout(notificationRefreshTimer)
      window.removeEventListener('focus', refreshOnReturn)
      document.removeEventListener('visibilitychange', refreshOnReturn)
      void client.removeChannel(channel)
    }
  }, [hasDashboardAnalytics, profile?.id])

  function updateSearchQuery(value: string) {
    setSearchQuery(value)
    if (value.trim().length < 2) {
      setSearchResults([])
      setSearchError('')
      setSearchLoading(false)
    }
  }

  if (loading || !profile || !staffContextValue) {
    return (
      <div className="app-loader">
        <Brand />
        <span className="loader-ring" />
        <p>Verifying secure access…</p>
      </div>
    )
  }

  const staffProfile = profile
  const initials = (profile.full_name || profile.email || 'MV')
    .split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const avatarUrl = profile.avatar_url?.trim() || ''

  const canNavigate = (permission: string | string[] | null) => !permission
    || (Array.isArray(permission) ? permission.some(can) : can(permission))
  const workspaceNavigation = profile.default_role === 'admin' ? adminReferenceNavigation : baseNavigation
  const visibleBaseNavigation = workspaceNavigation.filter((item) => canAccessRoute(item.route) && canNavigate(item.permission))
  const visibleGovernanceNavigation = governanceNavigation.filter((item) => canAccessRoute(item.route) && canNavigate(item.permission))
  const activeNavigation = [...visibleBaseNavigation, ...visibleGovernanceNavigation]
    .find((item) => item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href))
  const roleLabel = ({
    admin: 'Admin',
    superadmin: 'Superadmin',
    assistant: 'Assistant',
    customer_service: 'Customer Service',
  } as const)[profile.default_role]

  const notificationDestination = (notification: DashboardNotification) => notificationRoute(notification)
  async function markNotificationRead(notification: DashboardNotification) {
    if (notification.status !== 'unread') return true
    const supabase = getSupabase()
    if (!supabase) return false

    const { error } = await supabase
      .from('notifications')
      .update({ status: 'read' })
      .eq('id', notification.id)
      .eq('user_id', staffProfile.id)
      .eq('status', 'unread')
    if (error) {
      setNotificationError(error.message)
      return false
    }
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, status: 'read' } : item))
    setUnreadNotificationCount((count) => Math.max(0, count - 1))
    return true
  }

  async function openNotification(notification: DashboardNotification) {
    if (notificationActionBusy) return
    setNotificationActionBusy(true)
    await markNotificationRead(notification)
    const destination = notificationDestination(notification)
    setNotificationPanelOpen(false)
    setNotificationActionBusy(false)
    if (destination && canAccessRoute(destination.route)) router.push(destination.href)
    else router.push('/dashboard')
  }

  async function markAllNotificationsRead() {
    const unreadIds = notifications.filter((notification) => notification.status === 'unread').map((notification) => notification.id)
    if (!unreadIds.length || notificationActionBusy) return
    const supabase = getSupabase()
    if (!supabase) return
    setNotificationActionBusy(true)
    const { error } = await supabase
      .from('notifications')
      .update({ status: 'read' })
      .eq('user_id', staffProfile.id)
      .in('id', unreadIds)
      .eq('status', 'unread')
    if (error) setNotificationError(error.message)
    else {
      setNotifications((current) => current.map((notification) => notification.status === 'unread' ? { ...notification, status: 'read' } : notification))
      setUnreadNotificationCount(0)
    }
    setNotificationActionBusy(false)
  }

  return (
    <StaffContext.Provider value={staffContextValue}>
      <DashboardControlsContext.Provider value={dashboardControlsValue}>
      <div className="dashboard-layout">
        <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
          <div className="sidebar__brand"><Brand /></div>
          <nav aria-label="Main navigation">
            <p>{profile.default_role === 'superadmin' ? 'GOVERNANCE' : 'WORKSPACE'}</p>
            {visibleBaseNavigation.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            ))}
            {visibleGovernanceNavigation.length > 0 && (
              <>
                {profile.default_role !== 'superadmin' && <p className="nav-group">GOVERNANCE</p>}
                {visibleGovernanceNavigation.map((item) => (
                  <NavLink key={item.href} {...item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                ))}
              </>
            )}
          </nav>
          <div className="sidebar__bottom">
            <div className="role-card">
              <span className="sidebar-avatar">{initials}</span>
              <div><strong>{profile.full_name || 'MULTIVENT Staff'}</strong><span>{roleLabel}</span></div>
            </div>
            <button className="signout-button" onClick={signOut}><MdiIcon path={mdiLogout} /><span>Sign out</span></button>
          </div>
        </aside>
        {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

        <div className="dashboard-main">
          <header className="topbar">
            <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><MdiIcon path={mdiMenu} /></button>
            <div className="topbar__page">{activeNavigation?.label || (profile.default_role === 'superadmin' ? 'Governance workspace' : 'Admin workspace')}</div>
            <div className="topbar__actions">
              {hasDashboardAnalytics && <div className="global-search-wrap">
                <label className="global-search" aria-label="Search providers, categories, bookings, or clients">
                  <MdiIcon path={mdiMagnify} size={0.84} />
                  <input value={searchQuery} onChange={(event) => updateSearchQuery(event.target.value)} placeholder="Search providers, categories, bookings, clients…" />
                </label>
                {searchQuery.trim().length >= 2 && <div className="global-search-results" role="status" aria-live="polite">
                  {searchLoading && <p>Searching secure dashboard records…</p>}
                  {!searchLoading && searchError && <p className="global-search-results__error">{searchError}</p>}
                  {!searchLoading && !searchError && searchResults.length === 0 && <p>No authorized records found.</p>}
                  {!searchLoading && !searchError && searchResults.map((result) => <Link key={`${result.result_type}:${result.id}`} href={searchResultHref(result)} className="global-search-result" onClick={() => updateSearchQuery('')}>
                    <span>{searchResultLabel(result.result_type)}</span><strong>{result.title}</strong><small>{result.subtitle}</small>
                  </Link>)}
                </div>}
              </div>}
              {hasDashboardAnalytics && <label className="scope-filter" title={eventTypesError || 'Filter dashboard metrics by event type'}>
                <MdiIcon path={mdiBookOpenPageVariantOutline} size={0.82} />
                <select value={eventType} onChange={(event) => setEventType(event.target.value)} aria-label="Filter dashboard by event type" disabled={Boolean(eventTypesError)}>
                  <option value="all">All event types</option>
                  {eventTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <MdiIcon path={mdiChevronDown} size={0.7} />
              </label>}
              {hasDashboardAnalytics && <div className="notification-menu-wrap">
                <button className="notification-button" type="button" onClick={() => setNotificationPanelOpen((open) => !open)} aria-label={unreadNotificationCount ? `${unreadNotificationCount} unread admin notifications` : 'Open admin notifications'} aria-expanded={notificationPanelOpen} aria-haspopup="dialog">
                  <MdiIcon path={mdiBellOutline} />
                  {unreadNotificationCount > 0 && <i>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</i>}
                </button>
                {notificationPanelOpen && <section className="notification-menu" role="dialog" aria-label="Admin notifications">
                  <header><div><strong>Notifications</strong><small>{unreadNotificationCount ? `${unreadNotificationCount} unread` : 'You are all caught up'}</small></div><button type="button" disabled={!unreadNotificationCount || notificationActionBusy} onClick={() => void markAllNotificationsRead()}>Mark all read</button></header>
                  {liveStatus !== 'live' && <p className="notification-menu__connection">{liveStatus === 'unavailable' ? 'Live updates are unavailable. Reopen this panel or refresh to retry.' : 'Reconnecting live updates...'}</p>}
                  {notificationError && <p className="notification-menu__error">{notificationError}</p>}
                  {notificationLoading && notifications.length === 0 ? <p className="notification-menu__empty">Loading notifications...</p> : notifications.length === 0 ? <p className="notification-menu__empty">No notifications yet.</p> : <div className="notification-menu__list">{notifications.map((notification) => <button type="button" key={notification.id} className={notification.status === 'unread' ? 'notification-menu__item notification-menu__item--unread' : 'notification-menu__item'} onClick={() => void openNotification(notification)} disabled={notificationActionBusy}><span className="notification-menu__dot" /><span><strong>{notification.title}</strong>{notification.body && <small>{notification.body}</small>}<time>{formatDashboardRelativeTime(notification.created_at)}</time></span></button>)}</div>}
                </section>}
              </div>}
              <div className="profile-menu-wrap">
                <button className="profile-button" type="button" onClick={() => setProfileMenuOpen((open) => !open)} aria-expanded={profileMenuOpen} aria-haspopup="menu">
                  <span className={avatarUrl ? 'avatar avatar--image' : 'avatar'} style={avatarUrl ? { backgroundImage: `url("${safeCssUrl(avatarUrl)}")` } : undefined}>{avatarUrl ? '' : initials}</span>
                  <span className="profile-button__copy"><strong>{profile.full_name || 'MULTIVENT Staff'}</strong><small>{roleLabel}</small></span>
                  <MdiIcon path={mdiChevronDown} size={0.7} />
                </button>
                {profileMenuOpen && <div className="profile-menu" role="menu">
                  <div><strong>{profile.full_name || 'MULTIVENT Staff'}</strong><span>{profile.email || roleLabel}</span></div>
                  <button type="button" role="menuitem" onClick={signOut}><MdiIcon path={mdiLogout} />Sign out</button>
                </div>}
              </div>
            </div>
          </header>
          <div className="dashboard-content">{children}</div>
        </div>
      </div>
      </DashboardControlsContext.Provider>
    </StaffContext.Provider>
  )
}

function isDashboardSearchResponse(value: unknown): value is { results: DashboardSearchResult[] } {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { results?: unknown }).results)) return false
  return (value as { results: unknown[] }).results.every((result) => {
    if (!result || typeof result !== 'object') return false
    const row = result as Partial<DashboardSearchResult>
    return ['provider', 'category', 'booking', 'client'].includes(String(row.result_type))
      && typeof row.id === 'string' && typeof row.title === 'string' && typeof row.subtitle === 'string'
  })
}

function searchResultLabel(type: DashboardSearchResult['result_type']) {
  return ({ provider: 'Provider', category: 'Category', booking: 'Booking', client: 'Client' } as const)[type]
}

function searchResultHref(result: DashboardSearchResult) {
  if (result.result_type === 'provider') return `/dashboard/providers?search=${encodeURIComponent(result.title)}`
  if (result.result_type === 'category') return `/dashboard/providers?category=${encodeURIComponent(result.id)}`
  if (result.result_type === 'booking') return `/dashboard/bookings?search=${encodeURIComponent(result.id)}`
  return `/dashboard/clients?search=${encodeURIComponent(result.title)}`
}

function asDashboardNotification(value: unknown): DashboardNotification | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<DashboardNotification>
  if (typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.created_at !== 'string') return null
  return {
    id: row.id,
    title: row.title,
    body: typeof row.body === 'string' ? row.body : null,
    resource_type: typeof row.resource_type === 'string' ? row.resource_type : null,
    resource_id: typeof row.resource_id === 'string' ? row.resource_id : null,
    status: typeof row.status === 'string' ? row.status : 'unread',
    created_at: row.created_at,
  }
}

function sortDashboardNotifications(notifications: DashboardNotification[]) {
  return [...notifications].sort((first, second) => {
    const secondTime = Date.parse(second.created_at)
    const firstTime = Date.parse(first.created_at)
    return (Number.isNaN(secondTime) ? 0 : secondTime) - (Number.isNaN(firstTime) ? 0 : firstTime)
  })
}

function notificationRoute(notification: DashboardNotification): { href: string; route: SectionKey } | null {
  const resourceType = notification.resource_type?.toLowerCase() || ''
  if (resourceType.includes('provider')) return { href: '/dashboard/providers', route: 'providers' }
  if (resourceType.includes('category')) return { href: '/dashboard/categories', route: 'categories' }
  if (resourceType.includes('review') || resourceType.includes('rating')) return { href: '/dashboard/reviews', route: 'reviews' }
  if (resourceType.includes('booking') || resourceType.includes('event')) return {
    href: notification.resource_id ? `/dashboard/bookings?search=${encodeURIComponent(notification.resource_id)}` : '/dashboard/bookings',
    route: 'bookings',
  }
  if (resourceType.includes('payment') || resourceType.includes('refund') || resourceType.includes('payout') || resourceType.includes('wallet') || resourceType.includes('remittance') || resourceType.includes('financial')) {
    return { href: '/dashboard/financial', route: 'financial' }
  }
  return { href: '/dashboard', route: 'overview' }
}

function formatDashboardRelativeTime(value: string) {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return 'Recently'
  const elapsedMinutes = Math.floor((Date.now() - timestamp) / 60000)
  if (elapsedMinutes < 1) return 'Just now'
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours}h ago`
  const elapsedDays = Math.floor(elapsedHours / 24)
  if (elapsedDays < 7) return `${elapsedDays}d ago`
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(timestamp))
}

function safeCssUrl(value: string) {
  return value.replace(/["\\]/g, '\\$&')
}

function NavLink({ href, label, icon, pathname, onNavigate }: { href: string; label: string; icon: string; pathname: string; onNavigate: () => void }) {
  const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
  return (
    <Link href={href} onClick={onNavigate} className={active ? 'nav-link nav-link--active' : 'nav-link'}>
      <MdiIcon path={icon} /><span>{label}</span>{active && <i />}
    </Link>
  )
}
