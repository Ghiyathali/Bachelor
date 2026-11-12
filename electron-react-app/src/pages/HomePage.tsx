import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  getAttendanceByEvent,
  getDashboardOverview,
  getPromotionChannels,
  getReturningParticipants,
  getTrends,
} from '../api/dashboard'
import { ACCOUNT_ADMIN_ROLES, DASHBOARD_ROLES, QR_CODE_ROLES, hasRole } from '../auth/permissions'
import Icon from '../components/Icon'
import type { IconName } from '../components/Icon'
import { useAuthStore } from '../stores/authStore'

// The start page after logging in: a welcome, quick links to what this role may use and, for
// roles that may see dashboard data, a short overview. The same role lists as the menu, so the
// page never offers something the role cannot open. NFR-02: every number about people comes from
// the dashboard API, which already hides groups under 5 (null).
const QUICK_LINKS: { to: string; title: string; description: string; icon: IconName; roles: readonly string[] }[] = [
  { to: '/dashboard', title: 'Dashboard', description: 'Charts and reports', icon: 'chart', roles: DASHBOARD_ROLES },
  { to: '/qr-code', title: 'QR code', description: 'Feedback poster', icon: 'qrcode', roles: QR_CODE_ROLES },
  { to: '/accounts', title: 'Accounts', description: 'Staff and roles', icon: 'users', roles: ACCOUNT_ADMIN_ROLES },
]

const DAY = 24 * 60 * 60 * 1000

function greeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(value: string, now = new Date()) {
  const start = new Date(value)
  const days = Math.round((Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) -
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

// The last 12 months, this month included.
const now = new Date()
const LAST_12_MONTHS = {
  from: isoDate(new Date(now.getFullYear(), now.getMonth() - 11, 1)),
  to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
}

function Card({ title, aside, children, className = '' }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-surface p-6 shadow-card ${className}`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Skeleton({ className }: { className: string }) {
  return <div aria-label="Loading" className={`animate-pulse rounded-md bg-line ${className}`} />
}

// Participants per month for the last 12 months, as simple bars.
function ParticipantsPerMonth() {
  const trends = useQuery({
    queryKey: ['home', 'trends', LAST_12_MONTHS],
    queryFn: () => getTrends({ interval: 'month', ...LAST_12_MONTHS }),
  })
  const total = useQuery({
    queryKey: ['home', 'overview', LAST_12_MONTHS],
    queryFn: () => getDashboardOverview(LAST_12_MONTHS),
  })
  const periods = trends.data?.periods ?? []
  const highest = Math.max(1, ...periods.map((p) => p.participants ?? 0))

  return (
    <Card title="Participants per month" aside={<span className="text-sm text-muted">Last 12 months</span>} className="lg:col-span-2">
      <div className="mt-2 flex items-baseline gap-2">
        {total.isLoading ? <Skeleton className="h-8 w-16" />
          : total.data?.totalParticipants == null ? <span className="text-base font-semibold text-muted">Not enough data</span>
          : <span className="font-display text-3xl font-bold tracking-tight text-ink tabular-nums">{total.data.totalParticipants}</span>}
        <span className="text-sm text-muted">participants</span>
      </div>

      {trends.isLoading ? <Skeleton className="mt-6 h-40 w-full" />
        : trends.error ? <p className="mt-6 text-sm text-danger">Couldn't load participation.</p>
        : (
          <div className="mt-6">
            <div className="flex h-40 items-end gap-2">
              {periods.map((period) => {
                const month = new Date(`${period.periodStart}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                const value = period.participants
                const label = period.eventCount === 0 ? `${month}: no events`
                  : value === null ? `${month}: not enough data` : `${month}: ${value} participants`
                return (
                  <div key={period.periodStart} title={label} aria-label={label} role="img" className="flex h-full flex-1 items-end">
                    {value === null
                      ? <div className="h-1 w-full rounded-full bg-line" />
                      : <div className="w-full rounded-t-md bg-chart-primary" style={{ height: `${Math.max(4, (value / highest) * 100)}%` }} />}
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex gap-2 text-center text-xs text-muted">
              {periods.map((period) => (
                <span key={period.periodStart} className="flex-1">
                  {new Date(`${period.periodStart}T00:00:00`).toLocaleDateString('en-GB', { month: 'short' })}
                </span>
              ))}
            </div>
          </div>
        )}
    </Card>
  )
}

// Three key numbers that answer PYN's main questions at a glance: are people happy (FR-06),
// do they come back (FR-09) and where did they hear about us (FR-10). All time.
function KeyNumbers() {
  const overview = useQuery({ queryKey: ['home', 'overview-all'], queryFn: () => getDashboardOverview() })
  const returning = useQuery({ queryKey: ['home', 'returning'], queryFn: () => getReturningParticipants() })
  const channels = useQuery({ queryKey: ['home', 'channels'], queryFn: () => getPromotionChannels() })

  // The biggest named channel; "Other" is a mix of small channels, so it never counts as the top one.
  const top = (channels.data?.channels ?? [])
    .filter((c) => c.count !== null && c.channel.toLowerCase() !== 'other')
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0]

  const rows: { icon: IconName; label: string; loading: boolean; value: ReactNode; detail?: string }[] = [
    {
      icon: 'star',
      label: 'Satisfaction',
      loading: overview.isLoading,
      value: overview.data?.averageSatisfaction == null ? null
        : <>{overview.data.averageSatisfaction.toFixed(1)}<span className="ml-1 text-base font-medium text-muted">/ 5</span></>,
      detail: overview.data?.feedbackResponses == null ? undefined : `${overview.data.feedbackResponses} responses`,
    },
    {
      icon: 'refresh',
      label: 'Returning participants',
      loading: returning.isLoading,
      value: returning.data?.returningPercent == null ? null
        : <>{returning.data.returningPercent.toFixed(1)}<span className="ml-1 text-base font-medium text-muted">%</span></>,
      detail: returning.data?.answered == null ? undefined : `Based on ${returning.data.answered} answers`,
    },
    {
      icon: 'megaphone',
      label: 'Top promotion channel',
      loading: channels.isLoading,
      value: top ? top.channel : null,
      detail: top ? `${top.count} participants heard about us here` : undefined,
    },
  ]

  return (
    <Card title="Key numbers" aside={<span className="text-sm text-muted">All time</span>}>
      <ul className="mt-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-start gap-4 border-t border-line py-4 first:border-t-0 last:pb-0">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
              <Icon name={row.icon} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted">{row.label}</p>
              {row.loading ? <Skeleton className="mt-1 h-7 w-24" />
                : row.value === null ? <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-muted"><Icon name="lock" className="h-4 w-4" />Not enough data</p>
                : <p className="font-display truncate text-2xl font-bold tracking-tight text-ink tabular-nums">{row.value}</p>}
              {row.detail && !row.loading && <p className="text-xs text-helper">{row.detail}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// Upcoming events (with a countdown) next to the latest ones (with their sign-ups).
function EventLists() {
  const events = useQuery({ queryKey: ['home', 'events'], queryFn: () => getAttendanceByEvent(10) })
  const all = events.data?.events ?? []
  const today = Date.now()
  const upcoming = all.filter((e) => new Date(e.startsAt).getTime() >= today).slice(0, 3)
  const latest = all.filter((e) => new Date(e.startsAt).getTime() < today).reverse().slice(0, 3)
  const signedUp = (value: number | null) => (value === null ? 'Not enough data' : `${value} signed up`)

  const list = (items: typeof all, empty: string, right: (e: (typeof all)[number]) => ReactNode) =>
    events.isLoading ? <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      : events.error ? <p className="mt-4 text-sm text-danger">Couldn't load events.</p>
      : items.length === 0 ? <p className="mt-4 text-sm text-muted">{empty}</p>
      : (
        <ul className="mt-2">
          {items.map((event) => (
            <li key={event.eventId} className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{event.eventName}</p>
                <p className="text-sm text-muted">{shortDate(event.startsAt)}</p>
              </div>
              {right(event)}
            </li>
          ))}
        </ul>
      )

  return (
    <>
      <Card title="Upcoming events">
        {list(upcoming, 'No upcoming events.', (event) => (
          <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-ink">{daysUntil(event.startsAt)}</span>
        ))}
      </Card>
      <Card
        title="Latest events"
        aside={<Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline">Dashboard <Icon name="arrowRight" className="h-4 w-4" /></Link>}
      >
        {list(latest, 'No events yet.', (event) => (
          <span className="shrink-0 text-sm text-muted tabular-nums">{signedUp(event.signedUpCount)}</span>
        ))}
      </Card>
    </>
  )
}

export default function HomePage() {
  const user = useAuthStore((state) => state.user)
  const links = QUICK_LINKS.filter((link) => hasRole(user?.role, link.roles))

  return (
    <section className="py-4 sm:py-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-ink">Pangaea Analytics</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">{greeting()}, {user?.username}</h1>
      <p className="mt-2 text-sm text-muted">{user?.role}</p>

      {links.length > 0 ? (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-card transition hover:border-brand"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                <Icon name={link.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{link.title}</span>
                <span className="block text-sm text-muted">{link.description}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-xl border border-line bg-surface p-5 text-body">
          Your role does not give access to any features yet. Contact an administrator if you need access.
        </p>
      )}

      {hasRole(user?.role, DASHBOARD_ROLES) && (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <ParticipantsPerMonth />
            <KeyNumbers />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <EventLists />
          </div>
        </>
      )}
    </section>
  )
}
