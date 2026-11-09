import { useQuery } from '@tanstack/react-query'
import { getFilterOptions } from '../api/dashboard'
import {
  AGE_BAND_LABELS,
  SEASON_LABELS,
  type DashboardFilters,
  useDashboardFilterStore,
} from '../stores/dashboardFilterStore'
import Icon from './Icon'

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// #80: the filters that are applied right now, as small chips above the tiles.
// Each chip removes one filter; "Clear all" resets them all. Hidden when nothing is filtered.
export default function ActiveFilterChips() {
  const filters = useDashboardFilterStore((state) => state.filters)
  const setFilter = useDashboardFilterStore((state) => state.setFilter)
  const reset = useDashboardFilterStore((state) => state.reset)
  // Same query key as the filter bar, so the names come from the cache (no extra request).
  const options = useQuery({ queryKey: ['dashboard', 'filter-options'], queryFn: getFilterOptions })

  const nameOf = (list: { id: number; name: string }[] | undefined, id: number) =>
    list?.find((item) => item.id === id)?.name ?? '…'

  const chips: { key: keyof DashboardFilters; label: string }[] = []
  if (filters.from) chips.push({ key: 'from', label: `From ${formatDate(filters.from)}` })
  if (filters.to) chips.push({ key: 'to', label: `To ${formatDate(filters.to)}` })
  if (filters.season) chips.push({ key: 'season', label: SEASON_LABELS[filters.season] ?? filters.season })
  if (filters.eventId !== undefined) chips.push({ key: 'eventId', label: nameOf(options.data?.events, filters.eventId) })
  if (filters.eventTypeId !== undefined) chips.push({ key: 'eventTypeId', label: nameOf(options.data?.eventTypes, filters.eventTypeId) })
  if (filters.city) chips.push({ key: 'city', label: filters.city })
  if (filters.ageBand) chips.push({ key: 'ageBand', label: `Age ${AGE_BAND_LABELS[filters.ageBand] ?? filters.ageBand}` })
  if (filters.gender) chips.push({ key: 'gender', label: filters.gender })

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      <span className="mr-1 text-xs font-medium text-muted">Showing</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => setFilter(chip.key, undefined)}
          aria-label={`Remove filter: ${chip.label}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft py-1 pl-3 pr-2 text-xs font-medium text-brand-ink hover:bg-brand hover:text-white"
        >
          {chip.label}
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      ))}
      <button type="button" onClick={reset} className="px-2 py-1 text-xs font-medium text-brand-ink hover:underline">
        Clear all
      </button>
    </div>
  )
}
