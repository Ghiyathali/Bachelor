import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// What we remember about the logged-in user (from the login response).
export interface AuthUser {
  username: string
  email: string
  role: string
}

interface AuthState {
  token: string | null
  expiresAt: string | null // ISO date string from the backend
  user: AuthUser | null
  setSession: (token: string, expiresAt: string, user: AuthUser) => void
  logout: () => void
}

// One global "memory" for login state.
// persist(...) saves it on disk (localStorage), so you stay logged in after restarting the app.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      expiresAt: null,
      user: null,
      setSession: (token, expiresAt, user) => set({ token, expiresAt, user }),
      // Logout = throw the wristband away. The backend needs no call (JWT is stateless).
      logout: () => set({ token: null, expiresAt: null, user: null }),
    }),
    { name: 'pyn-auth' }, // key name in localStorage
  ),
)

// True only if we have a token AND it has not expired yet.
export function isLoggedIn(): boolean {
  const { token, expiresAt } = useAuthStore.getState()
  if (!token || !expiresAt) return false
  return new Date(expiresAt).getTime() > Date.now()
}
