import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { getDashboardOverview } from '../api/dashboard'
import { getErrorMessage } from '../api/client'
import { hasPeopleFilter, hasValidDateRange, useDashboardFilterStore } from '../stores/dashboardFilterStore'
import type { IconName } from './Icon'
import Icon from './Icon'

interface Tile {
  label: string
  icon: IconName
  help: string // what the number means, shown in the ⓘ hint
  value: string | null | undefined // null = hidden (NFR-02), undefined = not loaded yet
  suffix?: string
  note?: string
}

function OverviewTile({ tile, loading }: { tile: Tile; loading: boolean }) {
  const helpId = useId()
  const hidden = tile.value === null
  const [helpOpen, setHelpOpen] = useState(false)
  const helpArea = useRef<HTMLDivElement>(null)

  // While the explanation is open: a click anywhere else, or Esc, closes it.
  useEffect(() => {
    if (!helpOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!helpArea.current?.contains(event.target as Node)) setHelpOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHelpOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [helpOpen])

  return (
    <section className="relative rounded-xl border border-line bg-surface p-5 shadow-card">
      <div ref={helpArea}>
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <Icon name={tile.icon} className="h-4 w-4 text-brand-ink" />
          <h2 className="truncate">{tile.label}</h2>
          {/* #80: the ⓘ explains the number; it opens only when clicked. */}
          <button type="button" aria-label={`About ${tile.label}`} aria-expanded={helpOpen} aria-controls={helpId}
            onClick={() => setHelpOpen((open) => !open)}
            className={`ml-auto rounded-full hover:text-brand-ink ${helpOpen ? 'text-brand-ink' : 'text-faint'}`}>
            <Icon name="info" className="h-4 w-4" />
          </button>
        </div>
        {helpOpen && (
          <div id={helpId} role="note"
            className="absolute right-3 top-full z-20 mt-2 w-64 rounded-lg bg-ink px-3 py-2 text-xs leading-5 text-canvas shadow-lg">
            <span aria-hidden="true" className="absolute -top-1 right-3 h-2.5 w-2.5 rotate-45 bg-ink" />
            {tile.help}
          </div>
        )}
      </div>

      {loading ? (
        // Skeleton: grey shapes in the size of the number, so nothing jumps when it arrives.
        <div aria-label="Loading" className="mt-3 h-8 w-2/3 animate-pulse rounded-md bg-line" />
      ) : hidden ? (
        // NFR-02: hidden because it covers fewer than 5 people.
        <>
          <p className="mt-3 flex items-center gap-1.5 text-base font-semibold text-muted">
            <Icon name="lock" className="h-4 w-4" />
            Not enough data
          </p>
        </>
      ) : (
        <p className="font-display mt-2 text-3xl font-bold tracking-tight text-ink tabular-nums">
          {tile.value}
          {tile.suffix && <span className="ml-1 text-base font-medium text-muted">{tile.suffix}</span>}
        </p>
      )}
      {tile.note && <p className="mt-2 text-xs text-helper">{tile.note}</p>}
    </section>
  )
}

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
      <p className="flex items-center gap-2 rounded-xl border border-danger-line bg-danger-soft p-5 text-sm text-danger">
        <Icon name="alert" className="h-4 w-4 text-attention" />
        Could not load the key metrics: {getErrorMessage(overview.error)}
      </p>
    )
  }

  const data = overview.data
  const count = (value: number | null | undefined) => (value === null || value === undefined ? value : String(value))
  // Feedback is anonymous, so city/age/gender filters cannot apply to the feedback tiles.
  const feedbackNote = hasPeopleFilter(filters) ? 'Not filtered by city, age or gender' : undefined
  const privacy = ' Hidden when fewer than 5 people.'
  const tiles: Tile[] = [
    { label: 'Total events', icon: 'calendar', help: 'Events that match the filters.', value: count(data?.totalEvents) },
    { label: 'Participants', icon: 'users', help: 'People who got a spot at an event (accepted sign-ups), plus walk-ins who came without signing up.' + privacy, value: count(data?.totalParticipants), note: data?.walkIns ? `Includes ${data.walkIns} walk-ins` : undefined },
    {
      label: 'Average satisfaction',
      icon: 'star',
      help: 'Average of all feedback ratings, from 1 (poor) to 5 (great).' + privacy,
      value: data && (data.averageSatisfaction === null ? null : data.averageSatisfaction.toFixed(1)),
      suffix: '/ 5',
      note: feedbackNote,
    },
    { label: 'Feedback responses', icon: 'message', help: 'Anonymous feedback forms submitted for these events.' + privacy, value: count(data?.feedbackResponses), note: feedbackNote },
    {
      label: 'Acceptance rate',
      icon: 'circleCheck',
      help: 'Share of sign-ups that got a spot: accepted ÷ all sign-ups.' + privacy,
      value: data && (data.acceptanceRate === null ? null : data.acceptanceRate.toFixed(1)),
      suffix: '%',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((tile) => (
        <OverviewTile key={tile.label} tile={tile} loading={overview.isLoading} />
      ))}
    </div>
  )
}
