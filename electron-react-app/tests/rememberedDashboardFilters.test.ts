import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import { clearRememberedFilters, readRememberedFilters, saveRememberedFilters } from '../src/stores/rememberedDashboardFilters.ts'

const values = new Map<string, string>()
beforeEach(() => {
  values.clear()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } })
})

test('restores all shared filters and keeps accounts separate', () => {
  const filters = {
    from: '2026-10-01', to: '2026-12-31', eventId: 12, eventTypeId: 3,
    season: 'Autumn', city: 'Copenhagen', ageBand: 'From18To24', gender: 'Female',
  }
  saveRememberedFilters('alice', filters)
  assert.deepEqual(readRememberedFilters('alice'), filters)
  assert.equal(readRememberedFilters('bob'), undefined)
})

test('reset to all time remains an explicit remembered choice', () => {
  saveRememberedFilters('alice', { from: '2026-01-01', city: 'Copenhagen' })
  saveRememberedFilters('alice', {})
  assert.deepEqual(readRememberedFilters('alice'), {})
})

test('disabling removes saved filters only for the current account', () => {
  saveRememberedFilters('alice', { eventId: 1 })
  saveRememberedFilters('bob', { eventId: 2 })
  clearRememberedFilters('alice')
  assert.equal(readRememberedFilters('alice'), undefined)
  assert.deepEqual(readRememberedFilters('bob'), { eventId: 2 })
})

test('malformed or invalid saved dates fall back to the default range', () => {
  for (const value of ['{', 'null', '[]', '{"from":"2026-02-30"}', '{"from":"2026-12-01","to":"2026-01-01"}']) {
    values.set('pangaea-dashboard-filters:alice', value)
    assert.equal(readRememberedFilters('alice'), undefined)
  }
})

test('restoration accepts only known filter fields with the correct types', () => {
  values.set('pangaea-dashboard-filters:alice', JSON.stringify({ city: 'Copenhagen', eventId: '1', eventTypeId: -1, token: 'ignored' }))
  assert.deepEqual(readRememberedFilters('alice'), { city: 'Copenhagen' })
})

test('unavailable storage does not break the dashboard', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('Unavailable') } })
  assert.equal(readRememberedFilters('alice'), undefined)
  assert.doesNotThrow(() => saveRememberedFilters('alice', {}))
  assert.doesNotThrow(() => clearRememberedFilters('alice'))
})
