import {
  Link,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import App from './App.jsx'

function HomePage() {
  return (
    <section className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Electron + React</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-6xl">Your desktop app is ready.</h1>
      <p className="mt-6 text-lg leading-8 text-slate-300">
        Routing and Tailwind CSS is now working.
      </p>
    </section>
  )
}

function SettingsPage() {
  return (
    <section className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Example route</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">Settings</h1>
      <p className="mt-6 text-lg leading-8 text-slate-300">This page verifies client-side navigation in both development and the packaged Electron app.</p>
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

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'settings',
  component: SettingsPage,
})

const routeTree = rootRoute.addChildren([indexRoute, settingsRoute])

// Hash history avoids file:// path-resolution problems in packaged Electron builds.
export const router = createRouter({
  routeTree,
  history: createHashHistory(),
})
