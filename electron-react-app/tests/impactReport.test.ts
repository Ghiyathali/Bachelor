import assert from 'node:assert/strict'
import test from 'node:test'
import { REPORT_EXPORT_ROLES, hasRole } from '../src/auth/permissions.ts'
import { buildReportSvg, escapeXml } from '../src/reports/impactReport.ts'
import type { ReportData } from '../src/reports/impactReport.ts'
import { describeFilters } from '../src/stores/dashboardFilterStore.ts'

function reportData(changes: Partial<ReportData> = {}): ReportData {
  return {
    generatedOn: '7 November 2026',
    filterSummary: [],
    overview: { totalEvents: 12, totalParticipants: 340, averageSatisfaction: 4.26, feedbackResponses: 87, acceptanceRate: 71.5 },
    satisfaction: {
      totalResponses: 87,
      ratings: [
        { rating: 1, count: null },
        { rating: 2, count: 6 },
        { rating: 3, count: 11 },
        { rating: 4, count: 30 },
        { rating: 5, count: 37 },
      ],
    },
    attendance: {
      events: [{ eventId: 1, eventName: 'Summer Camp', startsAt: '2026-07-01', signedUpCount: 40, acceptedCount: 25 }],
    },
    returning: { answered: 120, returningPercent: 42.5, byEventType: [] },
    ...changes,
  }
}

test('FR-11: the report has the headline metrics and two charts', () => {
  const svg = buildReportSvg(reportData())
  for (const expected of ['Total events', '340', '4.3 / 5', '87', '71.5 %', 'Satisfaction distribution', 'Sign-ups per event', 'Summer Camp']) {
    assert.ok(svg.includes(expected), `missing: ${expected}`)
  }
})

test('FR-09: the returning figure says it is self-reported and covers any previous event', () => {
  const svg = buildReportSvg(reportData())
  assert.ok(svg.includes('42.5 %'))
  assert.ok(svg.includes('self-reported'))
  assert.ok(svg.includes('any previous Pangaea event, not a specific event type'))
})

test('NFR-02: hidden numbers say "Not enough data" instead of a number', () => {
  const svg = buildReportSvg(reportData({
    overview: { totalEvents: 1, totalParticipants: null, averageSatisfaction: null, feedbackResponses: null, acceptanceRate: null },
    satisfaction: { totalResponses: null, ratings: [] },
    attendance: { events: [{ eventId: 1, eventName: 'Tiny', startsAt: '2026-07-01', signedUpCount: null, acceptedCount: null }] },
    returning: { answered: null, returningPercent: null, byEventType: [] },
  }))
  assert.ok(svg.includes('fewer than 5 feedback responses'))
  assert.ok(svg.includes('Fewer than 5 participants answered'))
  assert.ok(!svg.includes('null'))
  assert.ok(!svg.includes('undefined'))
  assert.ok(!svg.includes('NaN'))
})

test('no events: the report says so instead of drawing an empty chart', () => {
  const svg = buildReportSvg(reportData({ attendance: { events: [] } }))
  assert.ok(svg.includes('No events match these filters.'))
})

test('special characters in event names cannot break the file', () => {
  const svg = buildReportSvg(reportData({
    attendance: { events: [{ eventId: 1, eventName: 'Q&A <night>', startsAt: '2026-07-01', signedUpCount: 9, acceptedCount: 8 }] },
  }))
  assert.ok(svg.includes('Q&amp;A &lt;night&gt;'))
  assert.equal(escapeXml(`"it's"`), '&quot;it&apos;s&quot;')
})

test('a script hidden in an event name stays plain text', () => {
  const svg = buildReportSvg(reportData({ filterSummary: ['Event: <script>alert(1)</script>'] }))
  assert.ok(!svg.includes('<script'))
})

test('FR-11: extra fields, like personal data, never reach the report', () => {
  const event = { eventId: 1, eventName: 'Camp', startsAt: '2026-07-01', signedUpCount: 9, acceptedCount: 8, email: 'person@example.com' }
  const svg = buildReportSvg(reportData({ attendance: { events: [event] } }))
  assert.ok(!svg.includes('person@example.com'))
})

test('the filters are printed in words', () => {
  const options = { events: [{ id: 3, name: 'Summer Camp' }], eventTypes: [{ id: 2, name: 'Workshop' }] }
  assert.deepEqual(describeFilters({}, options), [])
  assert.deepEqual(describeFilters({ eventId: 3, eventTypeId: 2, season: 'Summer' }, options), [
    'Season: Summer (Jun–Aug)',
    'Event: Summer Camp',
    'Event type: Workshop',
  ])
  const people = describeFilters({ ageBand: 'From18To24' }, options)
  assert.equal(people[0], 'Age band: 18–24')
  assert.ok(people[1].includes('do not apply to feedback'))
})

test('the filters appear on the report, or it says there are none', () => {
  assert.ok(buildReportSvg(reportData()).includes('Filters: none'))
  assert.ok(buildReportSvg(reportData({ filterSummary: ['City: Aarhus'] })).includes('City: Aarhus'))
})

test('FR-12: everyone except a Standard User may export', () => {
  for (const role of ['Admin', 'Event Manager', 'Marketing Manager']) assert.equal(hasRole(role, REPORT_EXPORT_ROLES), true)
  for (const role of ['Standard User', undefined, 'Unknown']) assert.equal(hasRole(role, REPORT_EXPORT_ROLES), false)
})
