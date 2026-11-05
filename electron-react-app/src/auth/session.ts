import { api } from '../api/client'
import { useAuthStore, type AuthUser } from '../stores/authStore'

// Refresh permissions from the server; persisted browser state is only a display cache.
export async function refreshSession() {
  const { token, expiresAt } = useAuthStore.getState()
  if (!token || !expiresAt) return
  const { data } = await api.get<AuthUser>('/api/auth/me')
  const current = useAuthStore.getState()
  if (current.token === token && (current.user?.role !== data.role || current.user?.username !== data.username || current.user?.email !== data.email)) {
    current.setSession(token, expiresAt, data)
  }
}
