import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import '@fontsource/oxygen/400.css'
import '@fontsource/oxygen/700.css'
import '@fontsource/signika/600.css'
import '@fontsource/signika/700.css'
import './index.css'
import { initializeTheme } from './stores/themeStore'
import { useAuthStore } from './stores/authStore'

// Apply the saved light/dark theme before the first render, so the screen doesn't flash.
initializeTheme()

// One shared TanStack Query cache for all server data. When someone logs in, logs out or gets
// a new role, the cache is emptied, so nobody ever sees data loaded for the previous user.
const queryClient = new QueryClient()
useAuthStore.subscribe((state, previous) => {
  if (state.token !== previous.token || state.user?.role !== previous.user?.role) {
    queryClient.clear()
  }
})

// Start React: the query cache and the router (pages, login guards: see router.tsx).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
