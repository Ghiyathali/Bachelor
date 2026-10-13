import type { AttendanceByEvent } from '../../api/dashboard'
import ResponsiveBarChart from './ResponsiveBarChart'

const series = [
  { key: 'registered', label: 'Registered', color: '#38bdf8' },
  { key: 'attended', label: 'Attended', color: '#34d399' },
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
          registered: event.registeredCount,
          attended: event.attendedCount,
        },
      }))}
      series={series}
      xAxisLabel="Event"
      yAxisLabel="People"
      formatTooltip={(datum, item, value) => `${datum.description} · ${item.label}: ${value}`}
    />
  )
}
