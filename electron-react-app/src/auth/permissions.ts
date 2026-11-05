// Which roles may generate and print the QR code (FR-12).
// The names must match the roles seeded in the backend (AppDbContext.cs).
export const QR_CODE_ROLES = ['Admin', 'Event Manager'] as const
export const DASHBOARD_ROLES = ['Admin', 'Event Manager', 'Marketing Manager'] as const
// Only an Admin may create accounts (#52). The backend enforces the same rule.
export const ACCOUNT_ADMIN_ROLES = ['Admin'] as const

// True if the logged-in user's role is one of the given roles.
export function hasRole(role: string | undefined, allowed: readonly string[]): boolean {
  return role !== undefined && allowed.includes(role)
}

export const ROLES = ['Admin', 'Event Manager', 'Marketing Manager', 'Standard User'] as const
