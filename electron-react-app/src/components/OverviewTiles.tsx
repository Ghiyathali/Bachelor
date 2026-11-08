import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getDashboardOverview } from '../api/dashboard'
import { getErrorMessage } from '../api/client'
import { hasPeopleFilter, hasValidDateRange, useDashboardFilterStore } from '../stores/dashboardFilterStore'

// FR-04: the key metrics at the top of the dashboard, one tile per number.
// #25: they follow the filter bar; numbers based on fewer than 5 people come back as null.
export default function OverviewTiles() {
  const filters = useDashboardFilterStore((state) => state.filters)
  const overview = useQuery({
    queryKey: ['dashboard', 'overview', filters],
    queryFn: () => getDashboardOverview(filters),
    placeholderData: keepPreviousData, // keep the old numbers on screen while new ones load
    enabled: hasValidDateRange(filters),
  })

  if (overview.error) {
    return (
      <p className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Could not load the key metrics: {getErrorMessage(overview.error)}
      </p>
    )
  }

  const data = overview.data
  // Feedback is anonymous, so city/age/gender filters cannot apply to the feedback tiles.
  const feedbackNote = hasPeopleFilter(filters) ? 'Not filtered by city, age or gender' : undefined
  const tiles = [
    { label: 'Total events', value: data?.totalEvents },
    { label: 'Participants', value: data?.totalParticipants },
    {
      label: 'Average satisfaction',
      value: data && (data.averageSatisfaction === null ? null : `${data.averageSatisfaction.toFixed(1)} / 5`),
      note: feedbackNote,
    },
    { label: 'Feedback responses', value: data?.feedbackResponses, note: feedbackNote },
    {
      label: 'Acceptance rate',
      value: data && (data.acceptanceRate === null ? null : `${data.acceptanceRate.toFixed(1)} %`),
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((tile) => (
        <section
          key={tile.label}
          className="rounded-xl border border-stone-200 bg-white p-5 shadow-card"
        >
          <h2 className="text-sm font-medium text-stone-500">{tile.label}</h2>
          {overview.isLoading ? (
            <p className="mt-2 text-3xl font-bold tracking-tight text-stone-900">…</p>
          ) : tile.value === null || tile.value === undefined ? (
            // NFR-02: hidden because it covers fewer than 5 people.
            <p className="mt-3 text-base font-semibold text-stone-500">Not enough data</p>
          ) : (
            <p className="mt-2 text-3xl font-bold tracking-tight text-stone-900">{tile.value}</p>
          )}
          {tile.note && <p className="mt-2 text-xs text-stone-500">{tile.note}</p>}
        </section>
      ))}
    </div>
  )
}
