import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getFilterOptions } from '../api/dashboard'
import { getErrorMessage } from '../api/client'
import { hasPeopleFilter, useDashboardFilterStore } from '../stores/dashboardFilterStore'

// The enum names from the backend, shown in a readable form.
const AGE_BAND_LABELS: Record<string, string> = {
  Under18: 'Under 18',
  From18To24: '18–24',
  From25To30: '25–30',
  Over30: '31 and older',
}

const SEASON_LABELS: Record<string, string> = {
  Winter: 'Winter (Dec–Feb)',
  Spring: 'Spring (Mar–May)',
  Summer: 'Summer (Jun–Aug)',
  Autumn: 'Autumn (Sep–Nov)',
}

const inputClass =
  'mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="min-w-0 text-xs font-medium text-slate-300">
      {label}
      {children}
    </label>
  )
}

// #25 / FR-05: one filter bar that every tile and chart on the dashboard follows.
export default function DashboardFilterBar() {
  const filters = useDashboardFilterStore((state) => state.filters)
  const setFilter = useDashboardFilterStore((state) => state.setFilter)
  const reset = useDashboardFilterStore((state) => state.reset)
  const options = useQuery({ queryKey: ['dashboard', 'filter-options'], queryFn: getFilterOptions })

  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to)
  const active = Object.values(filters).some((value) => value !== undefined)

  return (
    <section
      aria-label="Dashboard filters"
      className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Filters</h2>
        <button
          type="button"
          onClick={reset}
          disabled={!active}
          className="rounded-md px-3 py-2 text-sm font-medium text-sky-400 hover:bg-slate-800 disabled:text-slate-600 disabled:hover:bg-transparent"
        >
          Reset filters
        </button>
      </div>

      {options.error && (
        <p className="mt-3 text-sm text-rose-300">Could not load the filter choices: {getErrorMessage(options.error)}</p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="From">
          <input type="date" className={inputClass} value={filters.from ?? ''}
            onChange={(e) => setFilter('from', e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" className={inputClass} value={filters.to ?? ''}
            onChange={(e) => setFilter('to', e.target.value)} />
        </Field>
        <Field label="Season">
          <select className={inputClass} value={filters.season ?? ''}
            onChange={(e) => setFilter('season', e.target.value)}>
            <option value="">All seasons</option>
            {options.data?.seasons.map((season) => (
              <option key={season} value={season}>{SEASON_LABELS[season] ?? season}</option>
            ))}
          </select>
        </Field>
        <Field label="Event">
          <select className={inputClass} value={filters.eventId ?? ''}
            onChange={(e) => setFilter('eventId', e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">All events</option>
            {options.data?.events.map((event) => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Event type">
          <select className={inputClass} value={filters.eventTypeId ?? ''}
            onChange={(e) => setFilter('eventTypeId', e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">All types</option>
            {options.data?.eventTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </Field>
        <Field label="City">
          <select className={inputClass} value={filters.city ?? ''}
            onChange={(e) => setFilter('city', e.target.value)}>
            <option value="">All cities</option>
            {options.data?.cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </Field>
        <Field label="Age band">
          <select className={inputClass} value={filters.ageBand ?? ''}
            onChange={(e) => setFilter('ageBand', e.target.value)}>
            <option value="">All ages</option>
            {options.data?.ageBands.map((band) => (
              <option key={band} value={band}>{AGE_BAND_LABELS[band] ?? band}</option>
            ))}
          </select>
        </Field>
        <Field label="Gender">
          <select className={inputClass} value={filters.gender ?? ''}
            onChange={(e) => setFilter('gender', e.target.value)}>
            <option value="">All genders</option>
            {options.data?.genders.map((gender) => <option key={gender} value={gender}>{gender}</option>)}
          </select>
        </Field>
      </div>

      {invalidRange && (
        <p role="alert" className="mt-3 text-sm text-rose-300">“From” must be on or before “To”.</p>
      )}
      {hasPeopleFilter(filters) && (
        <p className="mt-3 text-xs text-slate-400">
          City, age band and gender only filter sign-up numbers. Feedback is anonymous, so satisfaction
          and response counts are not filtered by them.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        To protect privacy, numbers based on fewer than 5 people are hidden (“Not enough data”).
      </p>
    </section>
  )
}
