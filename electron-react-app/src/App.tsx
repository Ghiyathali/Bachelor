import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useAuthStore } from './stores/authStore'

export default function App() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  async function handleLogout() {
    logout() // 1. throw the token away (FR-16)
    await navigate({ to: '/login' }) // 2. back to the login page
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <nav className="mx-auto flex max-w-5xl items-center gap-6" aria-label="Main navigation">
          <Link to="/" className="text-lg font-semibold tracking-tight text-white">
            Electron React App
          </Link>

          {user ? (
            <>
              <Link
                to="/settings"
                className="ml-auto text-sm font-medium text-slate-300 transition hover:text-white"
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
            <>
              <Link to="/login" className="ml-auto text-sm font-medium text-slate-300 hover:text-white">
                Log in
              </Link>
              <Link to="/register" className="text-sm font-medium text-slate-300 hover:text-white">
                Register
              </Link>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Outlet />
      </main>
    </div>
  )
}
