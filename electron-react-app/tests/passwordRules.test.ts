import assert from 'node:assert/strict'
import test from 'node:test'
import { passwordProblem, wantsPasswordChange } from '../src/auth/passwordRules.ts'

const fields = (newPassword: string, confirm: string, current = '', self = false) => ({ newPassword, confirm, current, self })

test('all password fields empty: keep the password, no problem', () => {
  assert.equal(wantsPasswordChange(fields('', '')), false)
  assert.equal(passwordProblem(fields('', '')), null)
})

test('length rules: 8 to 72 characters', () => {
  assert.match(passwordProblem(fields('short7c', 'short7c'))!, /at least 8/)
  assert.equal(passwordProblem(fields('eight888', 'eight888')), null)
  assert.equal(passwordProblem(fields('a'.repeat(72), 'a'.repeat(72))), null)
  assert.match(passwordProblem(fields('a'.repeat(73), 'a'.repeat(73)))!, /at most 72/)
})

test('the two new passwords must match', () => {
  assert.match(passwordProblem(fields('Password123', 'Password124'))!, /do not match/)
  assert.match(passwordProblem(fields('Password123', ''))!, /do not match/)
})

test('your own password needs the current one, someone else does not', () => {
  assert.match(passwordProblem(fields('Password123', 'Password123', '', true))!, /current password/)
  assert.equal(passwordProblem(fields('Password123', 'Password123', 'OldPassword1', true)), null)
  assert.equal(passwordProblem(fields('Password123', 'Password123', '', false)), null)
})

test('only typing the current password still counts as wanting a change', () => {
  assert.equal(wantsPasswordChange(fields('', '', 'OldPassword1', true)), true)
  assert.match(passwordProblem(fields('', '', 'OldPassword1', true))!, /at least 8/)
})
