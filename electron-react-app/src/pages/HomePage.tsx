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
    <section className="py-4 sm:py-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-ink">Pangaea Analytics</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">Welcome, {user?.username}</h1>
      <p className="mt-2 text-sm text-muted">Signed in as {user?.role}</p>
      <p className="mt-6 text-lg leading-8 text-body">
        Event feedback and impact data for Pangaea Youth Network.
      </p>

      {links.length > 0 ? (
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group flex flex-col rounded-xl border border-line bg-surface p-6 shadow-card transition hover:border-brand"
            >
              <h2 className="text-lg font-semibold text-ink">{link.title}</h2>
              <p className="mt-2 max-w-xs text-sm leading-6 text-muted">{link.description}</p>
              <span aria-hidden="true" className="mt-8 text-lg text-brand-ink">↗</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-10 rounded-xl border border-line bg-surface p-5 text-body">
          Your role does not give access to any features yet. Contact an administrator if you need access.
        </p>
      )}
    </section>
  )
}
