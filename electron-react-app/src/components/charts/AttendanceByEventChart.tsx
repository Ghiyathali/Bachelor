import type { AttendanceByEvent } from '../../api/dashboard'
import ResponsiveBarChart from './ResponsiveBarChart'

const series = [
  { key: 'signedUp', label: 'Signed up', color: 'var(--color-chart-primary)' },
  { key: 'accepted', label: 'Accepted', color: 'var(--color-chart-secondary)' },
]
// Walk-ins only get a bar when at least one event in the chart has them.
const walkInSeries = { key: 'walkIns', label: 'Walk-ins', color: 'var(--color-brand-soft)', stroke: 'var(--color-chart-primary)' }

export function hasWalkIns(data: AttendanceByEvent) {
  return data.events.some((event) => event.walkInCount != null)
}

function shorten(value: string) {
  return value.length > 16 ? `${value.slice(0, 14)}…` : value
}

export default function AttendanceByEventChart({ data }: { data: AttendanceByEvent }) {
  return (
    <ResponsiveBarChart
      data={data.events.map((event) => ({
        key: String(event.eventId),
        label: shorten(event.eventName),
        description: event.eventName,
        values: {
          signedUp: event.signedUpCount,
          accepted: event.acceptedCount,
          walkIns: event.walkInCount ?? null,
        },
      }))}
      series={hasWalkIns(data) ? [...series, walkInSeries] : series}
      xAxisLabel="Event"
      yAxisLabel="People"
      formatTooltip={(datum, item, value) => `${datum.description} · ${item.label}: ${value}`}
    />
  )
}
