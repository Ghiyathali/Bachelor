import assert from 'node:assert/strict'
import test from 'node:test'
import { filtersOnDashboardEnter } from '../src/stores/dashboardEntryFilters.ts'

const defaultDates = { from: '2026-11-01', to: '2026-11-30' }
const picked = { from: '2026-03-01', to: '2026-06-30', city: 'Aarhus' }

test('first visit after logging in starts with the default date range only', () => {
  assert.deepEqual(filtersOnDashboardEnter({ remembered: undefined, firstVisit: true, current: picked, defaultDates }), defaultDates)
})

test('coming back from another page keeps the picked dates and other filters', () => {
  assert.deepEqual(filtersOnDashboardEnter({ remembered: undefined, firstVisit: false, current: picked, defaultDates }), picked)
})

test('remembered filters win over the default range and the current filters', () => {
  const remembered = { gender: 'Female' }
  assert.deepEqual(filtersOnDashboardEnter({ remembered, firstVisit: true, current: picked, defaultDates }), remembered)
  assert.deepEqual(filtersOnDashboardEnter({ remembered, firstVisit: false, current: picked, defaultDates }), remembered)
})

test('"All time" as default means no dates on the first visit', () => {
  assert.deepEqual(filtersOnDashboardEnter({ remembered: undefined, firstVisit: true, current: picked, defaultDates: {} }), {})
})
