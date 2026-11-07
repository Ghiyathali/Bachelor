import { create } from 'zustand'
import type { FilterOptions } from '../api/dashboard'

// The enum names from the backend, shown in a readable form.
export const AGE_BAND_LABELS: Record<string, string> = {
  Under18: 'Under 18',
  From18To24: '18–24',
  From25To30: '25–30',
  Over30: '31 and older',
}

export const SEASON_LABELS: Record<string, string> = {
  Winter: 'Winter (Dec–Feb)',
  Spring: 'Spring (Mar–May)',
  Summer: 'Summer (Jun–Aug)',
  Autumn: 'Autumn (Sep–Nov)',
}

// #25 / FR-05: the dashboard filter bar. One shared "memory" for the chosen filters,
// so every tile and chart on the dashboard reads the same values.
// The names match the backend's DashboardFilter query parameters.
export interface DashboardFilters {
  from?: string // yyyy-mm-dd, inclusive
  to?: string // yyyy-mm-dd, inclusive
  eventId?: number
  eventTypeId?: number
  season?: string // Winter | Spring | Summer | Autumn (derived from the event date)
  city?: string
  ageBand?: string
  gender?: string
}

interface DashboardFilterState {
  filters: DashboardFilters
  setFilter: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void
  reset: () => void
}

export const useDashboardFilterStore = create<DashboardFilterState>()((set) => ({
  filters: {},
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value || undefined } })),
  reset: () => set({ filters: {} }),
}))

// #25: charts with their own date/event controls (trends, event-type comparison) follow the
// filter bar too. Both must match, so dates are the overlap and two different events match nothing.
export function combineWithBar(
  own: { from?: string; to?: string; eventId?: number },
  bar: DashboardFilters,
): { from?: string; to?: string; eventId?: number; noOverlap: boolean } {
  const from = [own.from, bar.from].filter(Boolean).sort().at(-1) // the later start
  const to = [own.to, bar.to].filter(Boolean).sort().at(0) // the earlier end
  const eventsClash = own.eventId !== undefined && bar.eventId !== undefined && own.eventId !== bar.eventId
  return {
    from,
    to,
    eventId: own.eventId ?? bar.eventId,
    noOverlap: eventsClash || (from !== undefined && to !== undefined && from > to),
  }
}

// An impossible date range ("From" after "To") is never sent to the server: the filter bar
// shows a message and the tiles and charts keep showing their previous numbers.
export function hasValidDateRange(filters: DashboardFilters): boolean {
  return !(filters.from && filters.to && filters.from > filters.to)
}

// City, age band and gender only apply to sign-ups: feedback is anonymous.
export function hasPeopleFilter(filters: DashboardFilters): boolean {
  return Boolean(filters.city || filters.ageBand || filters.gender)
}

// #31: the chosen filters in words, printed on the exported report.
export function describeFilters(
  filters: DashboardFilters,
  options: Pick<FilterOptions, 'events' | 'eventTypes'>,
): string[] {
  const nameOf = (list: { id: number; name: string }[], id: number) =>
    list.find((item) => item.id === id)?.name ?? `#${id}`
  const summary: string[] = []
  if (filters.from) summary.push(`From: ${filters.from}`)
  if (filters.to) summary.push(`To: ${filters.to}`)
  if (filters.season) summary.push(`Season: ${SEASON_LABELS[filters.season] ?? filters.season}`)
  if (filters.eventId !== undefined) summary.push(`Event: ${nameOf(options.events, filters.eventId)}`)
  if (filters.eventTypeId !== undefined) summary.push(`Event type: ${nameOf(options.eventTypes, filters.eventTypeId)}`)
  if (filters.city) summary.push(`City: ${filters.city}`)
  if (filters.ageBand) summary.push(`Age band: ${AGE_BAND_LABELS[filters.ageBand] ?? filters.ageBand}`)
  if (filters.gender) summary.push(`Gender: ${filters.gender}`)
  // Feedback is anonymous, so a reader must know these filters do not apply to it.
  if (hasPeopleFilter(filters)) summary.push('City, age band and gender do not apply to feedback numbers')
  return summary
}
