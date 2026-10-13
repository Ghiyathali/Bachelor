import { useAuthStore } from '../stores/authStore'

// Which roles may generate and print the QR code (FR-12).
// The names must match the roles seeded in the backend (AppDbContext.cs).
export const QR_CODE_ROLES = ['Admin', 'Event Manager'] as const
export const DASHBOARD_ROLES = ['Admin', 'Event Manager'] as const

// True if the logged-in user's role is one of the given roles.
export function hasRole(role: string | undefined, allowed: readonly string[]): boolean {
  return role !== undefined && allowed.includes(role)
}

// Same check, reading the current user straight from the auth store.
export function currentUserHasRole(allowed: readonly string[]): boolean {
  return hasRole(useAuthStore.getState().user?.role, allowed)
}
