import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import './index.css'
import { useAuthStore } from './stores/authStore'

const queryClient = new QueryClient()
useAuthStore.subscribe((state, previous) => {
  if (state.token !== previous.token || state.user?.role !== previous.user?.role) {
    queryClient.clear()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
