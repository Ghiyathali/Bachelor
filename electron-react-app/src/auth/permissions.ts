// FR-12 (updated): which role may use what. The names must match the roles seeded in the backend
// (AppDbContext.cs), and the backend enforces the same rules (RoleNames.cs) - hiding a button here
// is only for a clean interface, never the real protection.
//
// - Admin: everything. The ONLY role that may see/edit other accounts, create/delete accounts,
//   change roles and approve "forgot password" requests.
// - Event Manager / Marketing Manager: everything else the Admin has; only their own account.
// - Standard User: dashboard (without export), events, QR code, and their own account.
const EVERYONE = ['Admin', 'Event Manager', 'Marketing Manager', 'Standard User'] as const
const MANAGERS = ['Admin', 'Event Manager', 'Marketing Manager'] as const

export const DASHBOARD_ROLES = EVERYONE
export const QR_CODE_ROLES = EVERYONE
// The Events page (walk-ins).
export const EVENT_MANAGEMENT_ROLES = EVERYONE
// A Standard User sees the dashboard but may not export the report (FR-11).
export const REPORT_EXPORT_ROLES = MANAGERS
// "Sync database" (PYN sync).
export const SYNC_ROLES = MANAGERS
// Manage accounts (see and edit every account), create/delete accounts, change roles,
// and the password-request bell: Admin only.
export const ACCOUNT_ADMIN_ROLES = ['Admin'] as const
export const ACCOUNT_MANAGER_ROLES = ACCOUNT_ADMIN_ROLES
// "My account": edit only your own username, email and password.
export const OWN_ACCOUNT_ONLY_ROLES = ['Event Manager', 'Marketing Manager', 'Standard User'] as const

// True if the logged-in user's role is one of the given roles.
export function hasRole(role: string | undefined, allowed: readonly string[]): boolean {
  return role !== undefined && allowed.includes(role)
}

export const ROLES = EVERYONE
