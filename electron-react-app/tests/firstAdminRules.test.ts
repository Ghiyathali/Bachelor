import assert from 'node:assert/strict'
import test from 'node:test'
import { firstAdminProblems } from '../src/auth/passwordRules.ts'

const ok = { username: 'Jurgita', email: 'jurgita@pangaeayouth.org', password: 'JurgitaPass1', confirm: 'JurgitaPass1' }

test('valid first admin details have no problems', () => {
  assert.deepEqual(firstAdminProblems(ok), {})
})

test('username rules: 3 to 30 characters, no @ or spaces', () => {
  assert.ok(firstAdminProblems({ ...ok, username: 'ju' }).username)
  assert.ok(firstAdminProblems({ ...ok, username: 'a'.repeat(31) }).username)
  assert.ok(firstAdminProblems({ ...ok, username: 'has space' }).username)
  assert.ok(firstAdminProblems({ ...ok, username: 'has@at' }).username)
})

test('email must look like an address', () => {
  assert.ok(firstAdminProblems({ ...ok, email: 'not-an-email' }).email)
  assert.ok(firstAdminProblems({ ...ok, email: '' }).email)
})

test('password 8 to 72 characters, and confirm must match', () => {
  assert.match(firstAdminProblems({ ...ok, password: 'short7c', confirm: 'short7c' }).password!, /at least 8/)
  assert.match(firstAdminProblems({ ...ok, confirm: 'Different1' }).confirm!, /do not match/)
})

test('an empty password is flagged straight away', () => {
  assert.match(firstAdminProblems({ ...ok, password: '', confirm: '' }).password!, /at least 8/)
})
