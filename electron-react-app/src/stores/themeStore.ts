import { create } from 'zustand'

type Theme = 'light' | 'dark'
const storageKey = 'pangaea-theme'

function savedTheme(): Theme {
  try {
    return localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>(set => ({
  theme: savedTheme(),
  setTheme: theme => {
    document.documentElement.dataset.theme = theme
    set({ theme })
    try {
      localStorage.setItem(storageKey, theme)
    } catch {
      // The selection still works for this session if storage is unavailable.
    }
  },
}))

// Apply before React renders so a saved dark theme does not flash light.
export function initializeTheme() {
  document.documentElement.dataset.theme = useThemeStore.getState().theme
}
