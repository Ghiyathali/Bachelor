import {
  Link,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { refreshSession } from './auth/session'
import App from './App'
import AccountsPage from './pages/AccountsPage'
import { ACCOUNT_ADMIN_ROLES, DASHBOARD_ROLES, QR_CODE_ROLES, hasRole } from './auth/permissions'
import DashboardPage from './pages/DashboardPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import QrCodePage from './pages/QrCodePage'
import RegisterPage from './pages/RegisterPage'
import SettingsPage from './pages/SettingsPage'
import { isLoggedIn, useAuthStore } from './stores/authStore'
import { useDashboardFilterStore } from './stores/dashboardFilterStore'
import { useDashboardPreferencesStore } from './stores/dashboardPreferencesStore'
import { getDefaultDateRange } from './stores/defaultDateRange'
import { clearRememberedFilters, readRememberedFilters, saveRememberedFilters } from './stores/rememberedDashboardFilters'

// Only save filters belonging to the account that last opened the dashboard.
let dashboardOwner: string | undefined
useDashboardFilterStore.subscribe(state => {
  const username = useAuthStore.getState().user?.username
  if (username && username === dashboardOwner && useDashboardPreferencesStore.getState().rememberFilters) {
    saveRememberedFilters(username, state.filters)
  }
})
useDashboardPreferencesStore.subscribe((state, previous) => {
  if (state.rememberFilters === previous.rememberFilters) return
  const username = useAuthStore.getState().user?.username
  if (!username) return
  if (!state.rememberFilters) clearRememberedFilters(username)
  else if (username === dashboardOwner) saveRememberedFilters(username, useDashboardFilterStore.getState().filters)
})

// Guard for protected pages: no valid token -> go to /login.
async function requireAuth() {
  if (!isLoggedIn()) {
    useAuthStore.getState().logout() // clear an expired token, if any
    throw redirect({ to: '/login' })
  }
  await refreshSession()
}

// Guard for role-restricted pages: logged in, but wrong role -> go to the home page.
function requireRole(allowed: readonly string[]) {
  return async () => {
    await requireAuth()
    if (!hasRole(useAuthStore.getState().user?.role, allowed)) {
      throw redirect({ to: '/' })
    }
  }
}

// Guard for the login page: already logged in -> go to the home page.
function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    throw redirect({ to: '/' })
  }
}

function NotFoundPage() {
  return (
    <section className="max-w-2xl">
      <h1 className="text-4xl font-bold text-ink">Page not found</h1>
      <Link to="/" className="mt-6 inline-block font-medium text-brand-ink hover:underline">Return home</Link>
    </section>
  )
}

const rootRoute = createRootRoute({
  component: App,
  notFoundComponent: NotFoundPage,
})

// Protected pages
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: requireAuth,
  component: HomePage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'settings',
  beforeLoad: requireAuth,
  component: SettingsPage,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'dashboard',
  beforeLoad: requireRole(DASHBOARD_ROLES),
  onEnter: () => {
    const username = useAuthStore.getState().user!.username
    const preferences = useDashboardPreferencesStore.getState()
    const remembered = preferences.rememberFilters ? readRememberedFilters(username) : undefined
    const sameAccount = dashboardOwner === username
    dashboardOwner = username
    useDashboardFilterStore.setState(state => ({
      filters: remembered ?? {
        ...(sameAccount ? state.filters : {}),
        from: undefined,
        to: undefined,
        ...getDefaultDateRange(preferences.defaultDateRange),
      },
    }))
  },
  component: DashboardPage,
})

// FR-02 + FR-12: only Admin and Event Manager may generate the QR code
const qrCodeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'qr-code',
  beforeLoad: requireRole(QR_CODE_ROLES),
  component: QrCodePage,
})

// Public pages
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  beforeLoad: redirectIfLoggedIn,
  component: LoginPage,
})

// #52: creating accounts is Admin only (no public self-registration)
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'register',
  beforeLoad: requireRole(ACCOUNT_ADMIN_ROLES),
  component: RegisterPage,
})

const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'accounts',
  beforeLoad: requireRole(ACCOUNT_ADMIN_ROLES),
  component: AccountsPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  settingsRoute,
  qrCodeRoute,
  loginRoute,
  registerRoute,
  accountsRoute,
])

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
})
