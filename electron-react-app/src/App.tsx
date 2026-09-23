import { Link, Outlet } from '@tanstack/react-router'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <nav className="mx-auto flex max-w-5xl items-center gap-6" aria-label="Main navigation">
          <Link to="/" className="text-lg font-semibold tracking-tight text-white">
            Electron React App
          </Link>
          <Link
            to="/settings"
            className="ml-auto text-sm font-medium text-slate-300 transition hover:text-white"
            activeProps={{ className: 'text-white' }}
          >
            Settings
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Outlet />
      </main>
    </div>
  )
}
