import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReportData } from '../src/reports/impactReport.ts'
import { buildReportCsv, csvCell } from '../src/reports/reportCsv.ts'

function reportData(changes: Partial<ReportData> = {}): ReportData {
  return {
    generatedOn: '8 November 2026',
    filterSummary: [],
    overview: { totalEvents: 8, totalParticipants: 45, averageSatisfaction: 3.94, feedbackResponses: 68, acceptanceRate: 71.4 },
    satisfaction: { totalResponses: 68, ratings: [{ rating: 1, count: null }, { rating: 4, count: 26 }] },
    attendance: { events: [{ eventId: 1, eventName: 'Football Day', startsAt: '2026-06-01', signedUpCount: 12, acceptedCount: 9 }] },
    returning: { answered: 45, returningPercent: 37.8, byEventType: [{ eventTypeId: 2, name: 'Sports', returningPercent: null }] },
    ...changes,
  }
}

const lines = (csv: string) => csv.replace('﻿', '').trimEnd().split('\r\n')

test('starts with a BOM and uses semicolons, decimal commas and CRLF', () => {
  const csv = buildReportCsv(reportData())
  assert.ok(csv.startsWith('﻿'))
  assert.ok(csv.includes('\r\n'))
  const rows = lines(csv)
  assert.ok(rows.includes('Section;Item;Measure;Value'))
  assert.ok(rows.includes('Headline;All events;Average satisfaction (1-5);3,9'))
  assert.ok(rows.includes('Headline;All events;Acceptance rate (%);71,4'))
  assert.ok(rows.includes('Sign-ups per event;Football Day;Signed up;12'))
  assert.ok(rows.includes('Returning participants;All events;Returning (%);37,8'))
})

test('NFR-02: hidden numbers say "Not enough data"', () => {
  const rows = lines(buildReportCsv(reportData()))
  assert.ok(rows.includes('Satisfaction;Rating 1;Responses;Not enough data'))
  assert.ok(rows.includes('Returning participants;Sports;Returning (%);Not enough data'))
  const hidden = buildReportCsv(reportData({
    overview: { totalEvents: 1, totalParticipants: null, averageSatisfaction: null, feedbackResponses: null, acceptanceRate: null },
    satisfaction: { totalResponses: null, ratings: [] },
    returning: { answered: null, returningPercent: null, byEventType: [] },
  }))
  assert.ok(lines(hidden).includes('Satisfaction;All ratings;Responses;Not enough data'))
  for (const bad of ['null', 'undefined', 'NaN']) assert.ok(!hidden.includes(bad))
})

test('no events: says so', () => {
  assert.ok(buildReportCsv(reportData({ attendance: { events: [] } })).includes('No events match these filters'))
})

test('separators, quotes and line breaks in names cannot break the table', () => {
  assert.equal(csvCell('Pizza; talk'), '"Pizza; talk"')
  assert.equal(csvCell('The "big" day'), '"The ""big"" day"')
  assert.equal(csvCell('Two\nlines'), '"Two\nlines"')
  assert.equal(csvCell('Æblefestival'), 'Æblefestival')
})

test('CSV injection: a name that looks like a formula becomes plain text', () => {
  for (const name of ['=HYPERLINK("http://x")', '+1', '-1', '@SUM(A1)']) {
    assert.ok(csvCell(name).replace(/^"/, '').startsWith("'"), name)
  }
  const csv = buildReportCsv(reportData({
    attendance: { events: [{ eventId: 1, eventName: '=cmd', startsAt: '2026-06-01', signedUpCount: 9, acceptedCount: 8 }] },
  }))
  assert.ok(csv.includes(";'=cmd;"))
})

test('the filters are in the file', () => {
  assert.ok(lines(buildReportCsv(reportData())).includes('Filters;None (all events)'))
  assert.ok(buildReportCsv(reportData({ filterSummary: ['City: Aarhus', 'Season: Summer (Jun–Aug)'] })).includes('Filters;City: Aarhus · Season: Summer (Jun–Aug)'))
})

test('extra fields, like personal data, never reach the file', () => {
  const event = { eventId: 1, eventName: 'Camp', startsAt: '2026-07-01', signedUpCount: 9, acceptedCount: 8, email: 'person@example.com' }
  assert.ok(!buildReportCsv(reportData({ attendance: { events: [event] } })).includes('person@example.com'))
})
