import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACCOUNT_ADMIN_ROLES,
  ACCOUNT_MANAGER_ROLES,
  DASHBOARD_ROLES,
  EVENT_MANAGEMENT_ROLES,
  OWN_ACCOUNT_ONLY_ROLES,
  QR_CODE_ROLES,
  REPORT_EXPORT_ROLES,
  ROLES,
  SYNC_ROLES,
  hasRole,
} from '../src/auth/permissions.ts'

// FR-12 (updated): the permission matrix the group agreed on.
const matrix = [
  { role: 'Admin', dashboard: true, export: true, events: true, qr: true, sync: true, manageAccounts: true, adminOnly: true, ownOnly: false },
  { role: 'Event Manager', dashboard: true, export: true, events: true, qr: true, sync: true, manageAccounts: false, adminOnly: false, ownOnly: true },
  { role: 'Marketing Manager', dashboard: true, export: true, events: true, qr: true, sync: true, manageAccounts: false, adminOnly: false, ownOnly: true },
  { role: 'Standard User', dashboard: true, export: false, events: true, qr: true, sync: false, manageAccounts: false, adminOnly: false, ownOnly: true },
]
for (const row of matrix) {
  test(`${row.role}: menu, shortcuts and route permission lists`, () => {
    assert.equal(hasRole(row.role, DASHBOARD_ROLES), row.dashboard)
    assert.equal(hasRole(row.role, REPORT_EXPORT_ROLES), row.export)
    assert.equal(hasRole(row.role, EVENT_MANAGEMENT_ROLES), row.events)
    assert.equal(hasRole(row.role, QR_CODE_ROLES), row.qr)
    assert.equal(hasRole(row.role, SYNC_ROLES), row.sync)
    assert.equal(hasRole(row.role, ACCOUNT_MANAGER_ROLES), row.manageAccounts)
    assert.equal(hasRole(row.role, ACCOUNT_ADMIN_ROLES), row.adminOnly)
    assert.equal(hasRole(row.role, OWN_ACCOUNT_ONLY_ROLES), row.ownOnly)
  })
}
test('role names match the requirements; unknown and legacy roles get no privileged UI', () => {
  assert.deepEqual(ROLES, matrix.map(row => row.role))
  for (const role of [undefined, 'User', 'admin', 'Unknown']) {
    for (const allowed of [DASHBOARD_ROLES, QR_CODE_ROLES, ACCOUNT_ADMIN_ROLES, ACCOUNT_MANAGER_ROLES, REPORT_EXPORT_ROLES, SYNC_ROLES]) {
      assert.equal(hasRole(role, allowed), false)
    }
  }
})
