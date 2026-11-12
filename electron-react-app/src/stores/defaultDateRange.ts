import type { DefaultDateRange } from './dashboardPreferencesStore'

// Use local calendar dates; converting local midnight to UTC can change the day.
export function getDefaultDateRange(range: DefaultDateRange, now = new Date()): { from?: string; to?: string } {
  if (range === 'all') return {}
  const year = now.getFullYear()
  const month = now.getMonth()
  const startMonth = range === 'year' ? 0 : range === 'quarter' ? Math.floor(month / 3) * 3 : month
  const months = range === 'year' ? 12 : range === 'quarter' ? 3 : 1
  const format = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return {
    from: format(new Date(year, startMonth, 1)),
    to: format(new Date(year, startMonth + months, 0)),
  }
}
