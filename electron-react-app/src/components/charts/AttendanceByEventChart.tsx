import type { AttendanceByEvent } from '../../api/dashboard'
import ResponsiveBarChart from './ResponsiveBarChart'

const series = [
  { key: 'signedUp', label: 'Signed up', color: 'var(--color-brand)' },
  { key: 'accepted', label: 'Accepted', color: 'var(--color-teal-600)' },
]

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
        },
      }))}
      series={series}
      xAxisLabel="Event"
      yAxisLabel="People"
      formatTooltip={(datum, item, value) => `${datum.description} · ${item.label}: ${value}`}
    />
  )
}
