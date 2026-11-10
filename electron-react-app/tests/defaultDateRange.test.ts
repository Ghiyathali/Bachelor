import assert from 'node:assert/strict'
import test from 'node:test'
import { getDefaultDateRange } from '../src/stores/defaultDateRange.ts'

test('month includes the entire current calendar month, including leap day', () => {
  assert.deepEqual(getDefaultDateRange('month', new Date(2028, 1, 15)), {
    from: '2028-02-01', to: '2028-02-29',
  })
})

test('quarters use calendar boundaries for every month', () => {
  for (let month = 0; month < 12; month++) {
    const quarter = Math.floor(month / 3)
    assert.deepEqual(getDefaultDateRange('quarter', new Date(2026, month, 15)), [
      { from: '2026-01-01', to: '2026-03-31' },
      { from: '2026-04-01', to: '2026-06-30' },
      { from: '2026-07-01', to: '2026-09-30' },
      { from: '2026-10-01', to: '2026-12-31' },
    ][quarter])
  }
})

test('year covers January through December even at year end', () => {
  assert.deepEqual(getDefaultDateRange('year', new Date(2026, 11, 31, 23, 59)), {
    from: '2026-01-01', to: '2026-12-31',
  })
})

test('all time has no date constraints', () => {
  assert.deepEqual(getDefaultDateRange('all'), {})
})

test('month uses the local calendar near midnight', () => {
  assert.deepEqual(getDefaultDateRange('month', new Date(2026, 0, 1, 0, 1)), {
    from: '2026-01-01', to: '2026-01-31',
  })
})
