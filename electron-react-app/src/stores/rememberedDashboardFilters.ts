import type { DashboardFilters } from './dashboardFilterStore'

function storageKey(username: string): string {
  return `pangaea-dashboard-filters:${username}`
}

export function readRememberedFilters(username: string): DashboardFilters | undefined {
  try {
    const raw = localStorage.getItem(storageKey(username))
    if (raw === null) return undefined
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    const source = value as Record<string, unknown>
    const filters: DashboardFilters = {}
    for (const key of ['from', 'to', 'season', 'city', 'ageBand', 'gender'] as const) {
      if (typeof source[key] === 'string' && source[key]) filters[key] = source[key]
    }
    for (const key of ['eventId', 'eventTypeId'] as const) {
      if (typeof source[key] === 'number' && Number.isSafeInteger(source[key]) && source[key] > 0) filters[key] = source[key]
    }
    // Do not restore incomplete date input or an impossible range.
    for (const key of ['from', 'to'] as const) {
      const date = filters[key]
      if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date)) return undefined
    }
    if (filters.from && filters.to && filters.from > filters.to) return undefined
    return filters
  } catch {
    return undefined
  }
}

export function saveRememberedFilters(username: string, filters: DashboardFilters): void {
  try {
    localStorage.setItem(storageKey(username), JSON.stringify(filters))
  } catch {
    // Filters still work for this session if storage is unavailable.
  }
}

export function clearRememberedFilters(username: string): void {
  try {
    localStorage.removeItem(storageKey(username))
  } catch {
    // Storage may be unavailable.
  }
}
