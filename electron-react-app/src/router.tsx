import {
  Link,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import App from './App'
import { ACCOUNT_ADMIN_ROLES, DASHBOARD_ROLES, QR_CODE_ROLES, currentUserHasRole } from './auth/permissions'
import DashboardPage from './pages/DashboardPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import QrCodePage from './pages/QrCodePage'
import RegisterPage from './pages/RegisterPage'
import { isLoggedIn, useAuthStore } from './stores/authStore'

// Guard for protected pages: no valid token -> go to /login.
function requireAuth() {
  if (!isLoggedIn()) {
    useAuthStore.getState().logout() // clear an expired token, if any
    throw redirect({ to: '/login' })
  }
}

// Guard for role-restricted pages: logged in, but wrong role -> go to the home page.
function requireRole(allowed: readonly string[]) {
  return () => {
    requireAuth()
    if (!currentUserHasRole(allowed)) {
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

function SettingsPage() {
  return (
    <section className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Pangaea Analytics</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">Settings</h1>
      <p className="mt-6 text-lg leading-8 text-slate-300">Account settings will be available here.</p>
    </section>
  )
}

function NotFoundPage() {
  return (
    <section className="max-w-2xl">
      <h1 className="text-4xl font-bold text-white">Page not found</h1>
      <Link to="/" className="mt-6 inline-block font-medium text-sky-400 hover:text-sky-300">Return home</Link>
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

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  settingsRoute,
  qrCodeRoute,
  loginRoute,
  registerRoute,
])

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
})
