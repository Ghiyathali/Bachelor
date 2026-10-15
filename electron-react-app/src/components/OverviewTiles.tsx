import { useQuery } from '@tanstack/react-query'
import { getDashboardOverview } from '../api/dashboard'
import { getErrorMessage } from '../api/client'

// FR-04: the key metrics at the top of the dashboard, one tile per number.
export default function OverviewTiles() {
  const overview = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: getDashboardOverview,
  })

  if (overview.error) {
    return (
      <p className="rounded-xl border border-rose-900 bg-rose-950/40 p-5 text-sm text-rose-300">
        Could not load the key metrics: {getErrorMessage(overview.error)}
      </p>
    )
  }

  const data = overview.data
  // While loading, every tile shows "…"; null means there is no data yet, shown as "–".
  const tiles = [
    { label: 'Total events', value: data?.totalEvents },
    { label: 'Participants', value: data?.totalParticipants },
    {
      label: 'Average satisfaction',
      value: data && (data.averageSatisfaction === null ? null : `${data.averageSatisfaction.toFixed(1)} / 5`),
    },
    { label: 'Feedback responses', value: data?.feedbackResponses },
    {
      label: 'Attendance rate',
      value: data && (data.attendanceRate === null ? null : `${data.attendanceRate.toFixed(1)} %`),
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((tile) => (
        <section
          key={tile.label}
          className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10"
        >
          <h2 className="text-sm font-medium text-slate-400">{tile.label}</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">
            {overview.isLoading ? '…' : (tile.value ?? '–')}
          </p>
        </section>
      ))}
    </div>
  )
}
