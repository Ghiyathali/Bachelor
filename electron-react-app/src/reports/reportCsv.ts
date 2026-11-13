import type { ReportData } from './impactReport'

// #78: the impact report's numbers as a CSV table, for Excel.
// Semicolons and decimal commas (3,9), because Danish Excel expects them; with commas,
// everything would land in one column. Same data as the SVG/PDF, so NFR-02 still holds.
const SEPARATOR = ';'
const NOT_ENOUGH_DATA = 'Not enough data'

function decimal(value: number): string {
  return value.toFixed(1).replace('.', ',')
}

// One cell, made safe:
// - Excel runs a cell starting with = + - @ as a formula ("CSV injection"), so an event named
//   "=HYPERLINK(...)" could do harm. A leading ' makes Excel treat it as plain text.
// - A cell containing the separator, a quote or a line break is put in quotes (quotes doubled).
export function csvCell(value: string): string {
  let safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  if (/[;"\r\n]/.test(safe)) safe = `"${safe.replace(/"/g, '""')}"`
  return safe
}

export function buildReportCsv(data: ReportData): string {
  const { overview, satisfaction, attendance, returning } = data
  const count = (value: number | null) => (value === null ? NOT_ENOUGH_DATA : String(value))
  const percent = (value: number | null) => (value === null ? NOT_ENOUGH_DATA : decimal(value))

  const rows: string[][] = [
    ['Impact report', 'Pangaea Youth Network'],
    ['Generated', data.generatedOn],
    ['Filters', data.filterSummary.length > 0 ? data.filterSummary.join(' · ') : 'None (all events)'],
    [],
    ['Section', 'Item', 'Measure', 'Value'],
    ['Headline', 'All events', 'Total events', String(overview.totalEvents)],
    ['Headline', 'All events', 'Participants', count(overview.totalParticipants)],
    ...(overview.walkIns ? [['Headline', 'All events', 'Walk-ins included in participants', String(overview.walkIns)]] : []),
    ['Headline', 'All events', 'Average satisfaction (1-5)', percent(overview.averageSatisfaction)],
    ['Headline', 'All events', 'Feedback responses', count(overview.feedbackResponses)],
    ['Headline', 'All events', 'Acceptance rate (%)', percent(overview.acceptanceRate)],
  ]

  if (satisfaction.totalResponses === null) {
    rows.push(['Satisfaction', 'All ratings', 'Responses', NOT_ENOUGH_DATA])
  } else {
    for (const bucket of satisfaction.ratings) {
      rows.push(['Satisfaction', `Rating ${bucket.rating}`, 'Responses', count(bucket.count)])
    }
  }

  if (attendance.events.length === 0) {
    rows.push(['Sign-ups per event', 'No events match these filters', '', ''])
  }
  for (const event of attendance.events) {
    rows.push(['Sign-ups per event', event.eventName, 'Signed up', count(event.signedUpCount)])
    rows.push(['Sign-ups per event', event.eventName, 'Accepted', count(event.acceptedCount)])
    if (event.walkInCount != null) rows.push(['Sign-ups per event', event.eventName, 'Walk-ins', String(event.walkInCount)])
  }

  rows.push(['Returning participants', 'All events', 'Returning (%)', percent(returning.returningPercent)])
  rows.push(['Returning participants', 'All events', 'Answers', count(returning.answered)])
  for (const type of returning.byEventType) {
    rows.push(['Returning participants', type.name, 'Returning (%)', percent(type.returningPercent)])
  }

  rows.push(
    [],
    ['Note', 'Numbers based on fewer than 5 people are hidden (Not enough data). The file contains no personal data.'],
    ['Note', 'Returning participants are self-reported on the sign-up form and cover any previous Pangaea event, not a specific event type.'],
    ['Note', 'Sign-ups per event shows at most the 10 latest events.'],
  )

  // ﻿ (a "BOM") tells Excel the file is UTF-8, so æ, ø and å show correctly.
  // \r\n line endings are the CSV standard (RFC 4180).
  return '﻿' + rows.map((row) => row.map(csvCell).join(SEPARATOR)).join('\r\n') + '\r\n'
}
