import { useEffect, useRef, useState } from 'react'
import { refreshSession } from './auth/session'
import { Link, Outlet, useNavigate, useRouter } from '@tanstack/react-router'
import { ACCOUNT_ADMIN_ROLES, DASHBOARD_ROLES, EVENT_MANAGEMENT_ROLES, QR_CODE_ROLES, hasRole } from './auth/permissions'
import { useAuthStore } from './stores/authStore'
import pangaeaLogo from '../pangaea-logo.png'

export default function App() {
  const navigate = useNavigate()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)

  useEffect(() => router.subscribe('onResolved', () => setMenuOpen(false)), [router])
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeMenu = () => setMenuOpen(false)
    desktop.addEventListener('change', closeMenu)
    return () => desktop.removeEventListener('change', closeMenu)
  }, [])

  const token = useAuthStore(state => state.token)
  const user = useAuthStore(state => state.user)
  const logout = useAuthStore(state => state.logout)

  useEffect(() => {
    if (!token) return
    const refresh = () => { void refreshSession().catch(() => {}) }
    const timer = window.setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [token])

  useEffect(() => { void router.invalidate() }, [user?.role, router])

  async function handleLogout() {
    logout()
    await navigate({ to: '/login' })
  }

  return (
    <div className={`app-shell ${user ? 'app-shell-authenticated' : ''}`}>
      <aside className="app-sidebar print:hidden" data-open={menuOpen} onKeyDown={event => {
        if (event.key === 'Escape' && menuOpen) {
          setMenuOpen(false)
          menuButton.current?.focus()
        }
      }}>
        <div className="app-sidebar-top">
          <Link to="/" aria-label="Pangaea home" className="relative block h-10 w-28 shrink-0">
            <img src={pangaeaLogo} alt="Pangaea Youth Network" className="app-logo absolute -left-3 -top-3 h-16 w-auto max-w-none" />
          </Link>
          {user && (
            <button ref={menuButton} type="button" className="app-menu-button"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen} aria-controls="app-navigation"
              onClick={() => setMenuOpen(open => !open)}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                {menuOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          )}
        </div>
        {user && (
          <div id="app-navigation" className="app-navigation-panel">
            <nav className="app-navigation" aria-label="Main navigation">
              <Link to="/" activeOptions={{ exact: true }} className="app-nav-link">Overview</Link>
              {hasRole(user.role, DASHBOARD_ROLES) && <Link to="/dashboard" className="app-nav-link">Dashboard</Link>}
              {hasRole(user.role, EVENT_MANAGEMENT_ROLES) && <Link to="/events" className="app-nav-link">Events</Link>}
              {hasRole(user.role, QR_CODE_ROLES) && <Link to="/qr-code" className="app-nav-link">QR code</Link>}
              {hasRole(user.role, ACCOUNT_ADMIN_ROLES) && <Link to="/accounts" className="app-nav-link">Manage accounts</Link>}
              <Link to="/settings" className="app-nav-link">Settings</Link>
            </nav>
            <div className="app-sidebar-footer">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={user.username}>{user.username}</p>
                <p className="mt-1 text-xs text-muted">{user.role}</p>
              </div>
              <button type="button" onClick={() => void handleLogout()} className="mt-4 w-full rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs font-medium text-body hover:bg-hover">Log out</button>
            </div>
          </div>
        )}
      </aside>
      <main className="app-main">
        <div className="mx-auto w-full max-w-7xl"><Outlet /></div>
      </main>
    </div>
  )
}
