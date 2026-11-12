import { scaleLinear } from 'd3'
import type {
  AttendanceByEvent,
  DashboardOverview,
  ReturningParticipants,
  SatisfactionDistribution,
} from '../api/dashboard'

// FR-11: the impact report for funders, as one A4-shaped SVG.
// It is drawn from scratch instead of copied from the screen, because the dashboard's charts
// depend on the app's dark styling and would look broken as a separate file.
//
// NFR-02: everything here comes from the dashboard API, which has already hidden numbers
// based on fewer than 5 people (null). So the report cannot contain them, or any names.
export interface ReportData {
  generatedOn: string // already formatted, e.g. "7 November 2026"
  filterSummary: string[] // already readable, e.g. ["City: Aarhus"]; empty = no filters
  overview: DashboardOverview
  satisfaction: SatisfactionDistribution
  attendance: AttendanceByEvent
  returning: ReturningParticipants
}

const WIDTH = 794 // A4 proportions at 96 dpi, so the PDF is exactly one page
const HEIGHT = 1123
const MARGIN = 48
const CONTENT_WIDTH = WIDTH - MARGIN * 2

const INK = '#0f172a'
const MUTED = '#475569'
const HELPER = '#d9d9d9' // PYN Light Grey, for helper texts
const LINE = '#cbd5e1'
// PYN visual identity: Violet Blue and Tealish Green for the bars, Lavender for the tiles.
const TILE = '#f4f1fe'
const BLUE = '#6a02c6' // Violet Blue
const GREEN = '#12cc62' // Tealish Green (bars only: too light for text)
const VIOLET = '#6a02c6'
// Signika for titles and Oxygen for text, with common fonts as a fallback where they aren't installed.
const DISPLAY_FONT = 'Signika, Oxygen, Arial, Helvetica, sans-serif'

const NOT_ENOUGH_DATA = 'Not enough data'

// Event names come from the database. Without this, a name like "Q&A" would break the file.
export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // not allowed in XML at all
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

interface TextStyle {
  size?: number
  bold?: boolean
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
}

function text(x: number, y: number, value: string, style: TextStyle = {}): string {
  const { size = 12, bold = false, fill = INK, anchor = 'start' } = style
  const font = bold && size >= 13 ? ` font-family="${DISPLAY_FONT}"` : ''
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${bold ? 700 : 400}" fill="${fill}" text-anchor="${anchor}"${font}>${escapeXml(value)}</text>`
}

function rect(x: number, y: number, width: number, height: number, fill: string, radius = 0): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}"/>`
}

function shorten(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

// SVG text does not wrap by itself, so long lines are split by hand.
function wrap(value: string, maxLength: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of value.split(' ')) {
    if (line && `${line} ${word}`.length > maxLength) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawTiles(overview: DashboardOverview, top: number): string {
  const tiles: { label: string; value: string | null }[] = [
    { label: 'Total events', value: String(overview.totalEvents) },
    { label: 'Participants', value: overview.totalParticipants === null ? null : String(overview.totalParticipants) },
    {
      label: 'Average satisfaction',
      value: overview.averageSatisfaction === null ? null : `${overview.averageSatisfaction.toFixed(1)} / 5`,
    },
    { label: 'Feedback responses', value: overview.feedbackResponses === null ? null : String(overview.feedbackResponses) },
    { label: 'Acceptance rate', value: overview.acceptanceRate === null ? null : `${overview.acceptanceRate.toFixed(1)} %` },
  ]
  const gap = 10
  const width = (CONTENT_WIDTH - gap * (tiles.length - 1)) / tiles.length
  return tiles
    .map((tile, index) => {
      const x = MARGIN + index * (width + gap)
      return [
        rect(x, top, width, 72, TILE, 6),
        text(x + 10, top + 22, tile.label, { size: 11, fill: MUTED }),
        tile.value === null
          ? text(x + 10, top + 50, NOT_ENOUGH_DATA, { size: 12, bold: true, fill: MUTED })
          : text(x + 10, top + 52, tile.value, { size: 22, bold: true }),
      ].join('')
    })
    .join('')
}

function drawHeading(title: string, description: string, top: number): string {
  return text(MARGIN, top, title, { size: 16, bold: true }) + text(MARGIN, top + 18, description, { size: 11, fill: HELPER })
}

const SATISFACTION_PLOT_HEIGHT = 130

// Vertical bars, one per rating from 1 to 5.
function drawSatisfaction(satisfaction: SatisfactionDistribution, top: number): string {
  const { totalResponses, ratings } = satisfaction
  const description = totalResponses === null ? 'Ratings from 1 to 5' : `${totalResponses} responses, ratings from 1 to 5`
  const heading = drawHeading('Satisfaction distribution', description, top)
  const plotTop = top + 44
  const baseline = plotTop + SATISFACTION_PLOT_HEIGHT

  if (totalResponses === null) {
    return heading + text(MARGIN, plotTop + 20, `${NOT_ENOUGH_DATA}: fewer than 5 feedback responses match these filters.`, { fill: MUTED })
  }

  const highest = Math.max(1, ...ratings.map((bucket) => bucket.count ?? 0))
  const y = scaleLinear().domain([0, highest]).range([0, SATISFACTION_PLOT_HEIGHT - 18])
  const slot = CONTENT_WIDTH / Math.max(1, ratings.length)
  const barWidth = Math.min(90, slot * 0.6)

  const bars = ratings.map((bucket, index) => {
    const centre = MARGIN + slot * index + slot / 2
    const label = text(centre, baseline + 16, String(bucket.rating), { anchor: 'middle', fill: MUTED })
    if (bucket.count === null) {
      return label + text(centre, baseline - 6, NOT_ENOUGH_DATA, { size: 10, fill: MUTED, anchor: 'middle' })
    }
    const barHeight = y(bucket.count)
    return (
      label +
      rect(centre - barWidth / 2, baseline - barHeight, barWidth, barHeight, BLUE, 2) +
      text(centre, baseline - barHeight - 5, String(bucket.count), { size: 11, bold: true, anchor: 'middle' })
    )
  })

  const axis = `<line x1="${MARGIN}" y1="${baseline}" x2="${MARGIN + CONTENT_WIDTH}" y2="${baseline}" stroke="${LINE}"/>`
  return heading + axis + bars.join('')
}

const ROW_HEIGHT = 34
const BAR_HEIGHT = 12
const EVENT_LABEL_WIDTH = 190

// Horizontal bars, so long event names stay readable. Two bars per event.
function drawAttendance(attendance: AttendanceByEvent, top: number): string {
  const { events } = attendance
  const heading = drawHeading('Sign-ups per event', 'Everyone who signed up compared with those who got a spot (at most the 10 latest events)', top)
  const rowsTop = top + 52

  if (events.length === 0) {
    return heading + text(MARGIN, rowsTop, 'No events match these filters.', { fill: MUTED })
  }

  const legendY = top + 2
  const legend =
    rect(WIDTH - MARGIN - 136, legendY - 9, 10, 10, BLUE, 2) +
    text(WIDTH - MARGIN - 122, legendY, 'Signed up', { size: 11, fill: MUTED }) +
    rect(WIDTH - MARGIN - 62, legendY - 9, 10, 10, GREEN, 2) +
    text(WIDTH - MARGIN - 48, legendY, 'Accepted', { size: 11, fill: MUTED })

  const barsLeft = MARGIN + EVENT_LABEL_WIDTH
  const highest = Math.max(1, ...events.flatMap((event) => [event.signedUpCount ?? 0, event.acceptedCount ?? 0]))
  const x = scaleLinear().domain([0, highest]).range([0, CONTENT_WIDTH - EVENT_LABEL_WIDTH - 40])

  function bar(value: number | null, y: number, color: string): string {
    if (value === null) return text(barsLeft + 4, y + 10, NOT_ENOUGH_DATA, { size: 10, fill: MUTED })
    return rect(barsLeft, y, x(value), BAR_HEIGHT, color, 2) + text(barsLeft + x(value) + 5, y + 10, String(value), { size: 10, bold: true })
  }

  const rows = events.map((event, index) => {
    const y = rowsTop + index * ROW_HEIGHT
    return (
      text(MARGIN, y + 17, shorten(event.eventName, 30), { size: 11 }) +
      bar(event.signedUpCount, y, BLUE) +
      bar(event.acceptedCount, y + BAR_HEIGHT + 2, GREEN)
    )
  })

  return heading + legend + rows.join('')
}

function drawReturning(returning: ReturningParticipants, top: number): string {
  const hidden = returning.returningPercent === null
  return [
    rect(MARGIN, top, CONTENT_WIDTH, 78, TILE, 6),
    text(MARGIN + 14, top + 24, 'Returning participants', { size: 13, bold: true }),
    hidden
      ? text(MARGIN + 14, top + 50, NOT_ENOUGH_DATA, { size: 13, bold: true, fill: MUTED })
      : text(MARGIN + 14, top + 56, `${returning.returningPercent?.toFixed(1)} %`, { size: 26, bold: true, fill: VIOLET }),
    // FR-09: the report must say what this figure does and does not mean.
    text(MARGIN + 170, top + 24, hidden ? 'Fewer than 5 participants answered this question.' : `Based on ${returning.answered} answers.`, { size: 11, fill: HELPER }),
    text(MARGIN + 170, top + 42, 'This figure is self-reported on the sign-up form.', { size: 11, fill: HELPER }),
    text(MARGIN + 170, top + 58, 'It covers any previous Pangaea event, not a specific event type.', { size: 11, fill: HELPER }),
  ].join('')
}

export function buildReportSvg(data: ReportData): string {
  const filterLines = wrap(
    data.filterSummary.length > 0 ? `Filters: ${data.filterSummary.join(' · ')}` : 'Filters: none (all events)',
    115,
  )

  const parts = [
    rect(0, 0, WIDTH, HEIGHT, '#ffffff'),
    text(MARGIN, 66, 'Impact report', { size: 30, bold: true }),
    text(MARGIN, 90, 'Pangaea Youth Network', { size: 13, fill: MUTED }),
    text(WIDTH - MARGIN, 90, `Generated ${data.generatedOn}`, { size: 12, fill: MUTED, anchor: 'end' }),
    `<line x1="${MARGIN}" y1="104" x2="${WIDTH - MARGIN}" y2="104" stroke="${LINE}"/>`,
    ...filterLines.map((line, index) => text(MARGIN, 124 + index * 16, line, { size: 12, fill: MUTED })),
  ]

  // Everything below moves down if the filters needed more than one line.
  let y = 124 + filterLines.length * 16
  parts.push(drawTiles(data.overview, y))
  y += 72 + 34
  parts.push(drawSatisfaction(data.satisfaction, y))
  y += 44 + SATISFACTION_PLOT_HEIGHT + 44
  parts.push(drawAttendance(data.attendance, y))
  y += 52 + Math.max(1, data.attendance.events.length) * ROW_HEIGHT + 10
  parts.push(drawReturning(data.returning, y))

  parts.push(
    text(MARGIN, HEIGHT - 32, 'To protect privacy, numbers based on fewer than 5 people are hidden (“Not enough data”). The report contains no personal data.', { size: 10, fill: HELPER }),
  )

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="Oxygen, Arial, Helvetica, sans-serif" role="img" aria-label="Impact report">` +
    parts.join('') +
    '</svg>'
  )
}
