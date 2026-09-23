import {
  Link,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import App from './App.jsx'
import { getTodos } from './api/todos.js'

function HomePage() {
  const { data: todos, error, isLoading } = useQuery({
    queryKey: ['todos'],
    queryFn: getTodos,
  })

  return (
    <section className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Electron + React</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-6xl">Your desktop app is ready.</h1>
      <p className="mt-6 text-lg leading-8 text-slate-300">
        Routing, Tailwind CSS, and the REST API are connected.
      </p>
      <section className="mt-10 rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold text-white">Todos from the API</h2>
        {isLoading && <p className="mt-3 text-slate-300">Loading todos…</p>}
        {error && (
          <p className="mt-3 text-rose-300">
            Could not reach the REST server. Confirm PostgreSQL is running and run `npm run dev`.
          </p>
        )}
        {todos && (todos.length === 0 ? (
          <p className="mt-3 text-slate-300">The API is connected. No todos yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-slate-300">
            {todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}
          </ul>
        ))}
      </section>
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
