import type { DashboardFilters } from './dashboardFilterStore'

// Decides which filters the dashboard starts with when it is opened.
// - Remembered filters (Settings → Remember dashboard filters) always win.
// - The default date range is only applied on the first visit after logging in. Coming back
//   from another page keeps the filters as they were, including the dates the user picked.
export function filtersOnDashboardEnter(options: {
  remembered: DashboardFilters | undefined
  firstVisit: boolean
  current: DashboardFilters
  defaultDates: { from?: string; to?: string }
}): DashboardFilters {
  if (options.remembered) return options.remembered
  if (!options.firstVisit) return options.current
  return { ...options.defaultDates }
}
