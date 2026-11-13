import assert from 'node:assert/strict'
import test from 'node:test'
import { EVENT_MANAGEMENT_ROLES, hasRole } from '../src/auth/permissions.ts'
import { MAX_WALK_INS, parseWalkIns } from '../src/api/walkInInput.ts'

test('walk-in input only accepts whole numbers from 0 to the maximum', () => {
  assert.equal(parseWalkIns('0'), 0)
  assert.equal(parseWalkIns(' 12 '), 12)
  assert.equal(parseWalkIns(String(MAX_WALK_INS)), MAX_WALK_INS)
  for (const bad of ['', ' ', '-1', '1.5', '2e3', 'abc', '12a', String(MAX_WALK_INS + 1)]) {
    assert.equal(parseWalkIns(bad), null, bad)
  }
})

test('only Admin and Event Manager may enter walk-ins', () => {
  assert.equal(hasRole('Admin', EVENT_MANAGEMENT_ROLES), true)
  assert.equal(hasRole('Event Manager', EVENT_MANAGEMENT_ROLES), true)
  for (const role of ['Marketing Manager', 'Standard User', undefined]) assert.equal(hasRole(role, EVENT_MANAGEMENT_ROLES), false)
})
