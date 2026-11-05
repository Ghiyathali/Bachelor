import assert from 'node:assert/strict'
import test from 'node:test'
import { ACCOUNT_ADMIN_ROLES, DASHBOARD_ROLES, QR_CODE_ROLES, ROLES, hasRole } from '../src/auth/permissions.ts'

const matrix = [
  { role: 'Admin', dashboard: true, qr: true, accounts: true },
  { role: 'Event Manager', dashboard: true, qr: true, accounts: false },
  { role: 'Marketing Manager', dashboard: true, qr: false, accounts: false },
  { role: 'Standard User', dashboard: false, qr: false, accounts: false },
]
for (const row of matrix) {
  test(`${row.role}: menu, shortcuts and route permission lists`, () => {
    assert.equal(hasRole(row.role, DASHBOARD_ROLES), row.dashboard)
    assert.equal(hasRole(row.role, QR_CODE_ROLES), row.qr)
    assert.equal(hasRole(row.role, ACCOUNT_ADMIN_ROLES), row.accounts)
  })
}
test('role names match the requirements; unknown and legacy roles get no privileged UI', () => {
  assert.deepEqual(ROLES, matrix.map(row => row.role))
  for (const role of [undefined, 'User', 'admin', 'Unknown']) {
    for (const allowed of [DASHBOARD_ROLES, QR_CODE_ROLES, ACCOUNT_ADMIN_ROLES]) {
      assert.equal(hasRole(role, allowed), false)
    }
  }
})
