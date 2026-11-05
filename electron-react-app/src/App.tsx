import { useEffect } from 'react'
import { refreshSession } from './auth/session'
import { Link, Outlet, useNavigate, useRouter } from '@tanstack/react-router'
import { ACCOUNT_ADMIN_ROLES, DASHBOARD_ROLES, QR_CODE_ROLES, hasRole } from './auth/permissions'
import { useAuthStore } from './stores/authStore'

export default function App() {
  const navigate = useNavigate()
  const router = useRouter()
  const token = useAuthStore(state => state.token)
  useEffect(() => {
    if (!token) return
    const refresh = () => { void refreshSession().catch(() => {}) }
    const timer = window.setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [token])
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  useEffect(() => { void router.invalidate() }, [user?.role, router])

  async function handleLogout() {
    logout() // 1. throw the token away (FR-16)
    await navigate({ to: '/login' }) // 2. back to the login page
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 print:hidden">
        <nav className="mx-auto flex max-w-5xl items-center gap-6" aria-label="Main navigation">
          <Link to="/" className="text-lg font-semibold tracking-tight text-white">
            Pangaea
          </Link>

          {user ? (
            <>
              {hasRole(user.role, DASHBOARD_ROLES) && (
                <Link
                  to="/dashboard"
                  className="ml-auto text-sm font-medium text-slate-300 transition hover:text-white"
                  activeProps={{ className: 'text-white' }}
                >
                  Dashboard
                </Link>
              )}
              {/* FR-12: hide the QR link from roles that may not use it */}
              {hasRole(user.role, QR_CODE_ROLES) && (
                <Link
                  to="/qr-code"
                  className="text-sm font-medium text-slate-300 transition hover:text-white"
                  activeProps={{ className: 'text-white' }}
                >
                  QR code
                </Link>
              )}
              {/* #52: only Admins create accounts */}
              {hasRole(user.role, ACCOUNT_ADMIN_ROLES) && (
                <Link
                  to="/accounts"
                  className="text-sm font-medium text-slate-300 transition hover:text-white"
                  activeProps={{ className: 'text-white' }}
                >
                  Manage accounts
                </Link>
              )}
              <Link
                to="/settings"
                className={`${hasRole(user.role, DASHBOARD_ROLES) ? '' : 'ml-auto'} text-sm font-medium text-slate-300 transition hover:text-white`}
                activeProps={{ className: 'text-white' }}
              >
                Settings
              </Link>
              <span className="text-sm text-slate-400">
                {user.username} ({user.role})
              </span>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800"
              >
                Log out
              </button>
            </>
          ) : (
            <Link to="/login" className="ml-auto text-sm font-medium text-slate-300 hover:text-white">
              Log in
            </Link>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
        <Outlet />
      </main>
    </div>
  )
}
