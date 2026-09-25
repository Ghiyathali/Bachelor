import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

// ONE shared axios instance for the whole app.
// In development VITE_API_URL is empty, so '/api/...' goes through the Vite proxy to localhost:5000.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
})

// BEFORE every request: attach the token, if we have one.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// AFTER every response: a 401 on a protected call means the token is invalid or expired -> log out.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? ''
      // A wrong password on the login form is also a 401 - that must NOT log anyone out.
      const isAuthCall = url.includes('/api/auth/login') || url.includes('/api/auth/register')
      if (!isAuthCall) {
        useAuthStore.getState().logout()
        window.location.hash = '#/login'
      }
    }
    return Promise.reject(error)
  },
)

// Turns any API error into one readable sentence for the UI.
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errors?: Record<string, string[]> }
      | undefined
    if (data?.message) return data.message // our own messages (401, 409)
    if (data?.errors) return Object.values(data.errors).flat().join(' ') // validation errors (400)
    if (!error.response) return 'Could not reach the server. Is the backend running?'
  }
  return 'Something went wrong. Please try again.'
}
