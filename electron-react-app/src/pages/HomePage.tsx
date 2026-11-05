import { Link } from '@tanstack/react-router'
import { ACCOUNT_ADMIN_ROLES, DASHBOARD_ROLES, QR_CODE_ROLES, hasRole } from '../auth/permissions'
import { useAuthStore } from '../stores/authStore'

// The start page after logging in: a welcome and quick links to what this role may use.
// The same role lists as the header menu, so the page never offers a link the role cannot open.
const QUICK_LINKS = [
  {
    to: '/dashboard',
    title: 'Dashboard',
    description: 'Key metrics and charts for your events.',
    roles: DASHBOARD_ROLES,
  },
  {
    to: '/qr-code',
    title: 'QR code',
    description: 'Print the feedback QR code to put up at events.',
    roles: QR_CODE_ROLES,
  },
  {
    to: '/accounts',
    title: 'Manage accounts',
    description: 'Create accounts, assign roles and deactivate staff access.',
    roles: ACCOUNT_ADMIN_ROLES,
  },
] as const

export default function HomePage() {
  const user = useAuthStore((state) => state.user)
  const links = QUICK_LINKS.filter((link) => hasRole(user?.role, link.roles))

  return (
    <section className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Pangaea Analytics</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">Welcome, {user?.username}</h1>
      <p className="mt-2 text-sm text-slate-400">Signed in as {user?.role}</p>
      <p className="mt-6 text-lg leading-8 text-slate-300">
        Event feedback and impact data for Pangaea Youth Network.
      </p>

      {links.length > 0 ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10 transition hover:border-sky-500"
            >
              <h2 className="text-lg font-semibold text-white">{link.title}</h2>
              <p className="mt-1 text-sm text-slate-400">{link.description}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-10 rounded-xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
          Your role does not give access to any features yet. Contact an administrator if you need access.
        </p>
      )}
    </section>
  )
}
