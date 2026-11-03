import { create } from 'zustand'

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

// City, age band and gender only apply to sign-ups: feedback is anonymous.
export function hasPeopleFilter(filters: DashboardFilters): boolean {
  return Boolean(filters.city || filters.ageBand || filters.gender)
}
