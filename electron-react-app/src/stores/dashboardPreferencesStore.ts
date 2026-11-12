import { create } from 'zustand'

export type DefaultDateRange = 'month' | 'quarter' | 'year' | 'all'
const storageKey = 'pangaea-default-date-range'
const rememberKey = 'pangaea-remember-dashboard-filters'

function savedRememberFilters(): boolean {
  try {
    return localStorage.getItem(rememberKey) === 'true'
  } catch {
    return false
  }
}

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
  rememberFilters: boolean
  setRememberFilters: (remember: boolean) => void
  defaultDateRange: DefaultDateRange
  setDefaultDateRange: (range: DefaultDateRange) => void
}

export const useDashboardPreferencesStore = create<DashboardPreferencesState>(set => ({
  rememberFilters: savedRememberFilters(),
  setRememberFilters: rememberFilters => {
    set({ rememberFilters })
    try {
      localStorage.setItem(rememberKey, String(rememberFilters))
    } catch {
      // The selection still works for this session if storage is unavailable.
    }
  },
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
