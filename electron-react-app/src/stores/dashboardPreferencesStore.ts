import { create } from 'zustand'

export type DefaultDateRange = 'month' | 'quarter' | 'year' | 'all'
const storageKey = 'pangaea-default-date-range'

function savedDateRange(): DefaultDateRange {
  try {
    const value = localStorage.getItem(storageKey)
    if (value === 'month' || value === 'quarter' || value === 'year') return value
  } catch {
    // Use all time if storage is unavailable.
  }
  return 'all'
}

interface DashboardPreferencesState {
  defaultDateRange: DefaultDateRange
  setDefaultDateRange: (range: DefaultDateRange) => void
}

export const useDashboardPreferencesStore = create<DashboardPreferencesState>(set => ({
  defaultDateRange: savedDateRange(),
  setDefaultDateRange: defaultDateRange => {
    set({ defaultDateRange })
    try {
      localStorage.setItem(storageKey, defaultDateRange)
    } catch {
      // The selection still works for this session if storage is unavailable.
    }
  },
}))
