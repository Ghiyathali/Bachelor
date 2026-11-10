import { useThemeStore } from '../stores/themeStore'
import { useDashboardPreferencesStore, type DefaultDateRange } from '../stores/dashboardPreferencesStore'

export default function SettingsPage() {
  const theme = useThemeStore(state => state.theme)
  const setTheme = useThemeStore(state => state.setTheme)
  const dark = theme === 'dark'
  const defaultDateRange = useDashboardPreferencesStore(state => state.defaultDateRange)
  const setDefaultDateRange = useDashboardPreferencesStore(state => state.setDefaultDateRange)
  const rememberFilters = useDashboardPreferencesStore(state => state.rememberFilters)
  const setRememberFilters = useDashboardPreferencesStore(state => state.setRememberFilters)

  return (
    <section className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-ink">Preferences</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink">Settings</h1>
      <p className="mt-3 text-sm text-muted">Make your workspace feel right for you.</p>
      <section aria-labelledby="appearance-title" className="mt-8 rounded-xl border border-line bg-surface p-6 shadow-card">
        <h2 id="appearance-title" className="text-lg font-semibold text-ink">Appearance</h2>
        <div className="mt-6 flex items-center justify-between gap-6">
          <div>
            <h3 id="dark-mode-label" className="text-sm font-medium text-ink">Dark mode</h3>
            <p id="dark-mode-description" className="mt-1 text-sm leading-6 text-muted">Use a darker palette throughout the app.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={dark}
            aria-labelledby="dark-mode-label"
            aria-describedby="dark-mode-description"
            onClick={() => setTheme(dark ? 'light' : 'dark')}
            className="theme-switch"
          >
            <span className="theme-switch-thumb" />
          </button>
        </div>
        <p className="mt-6 border-t border-line pt-4 text-xs text-muted">Your appearance preference is saved on this device.</p>
      </section>
      <section aria-labelledby="dashboard-title" className="mt-6 rounded-xl border border-line bg-surface p-6 shadow-card">
        <h2 id="dashboard-title" className="text-lg font-semibold text-ink">Dashboard</h2>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <label htmlFor="default-date-range" className="text-sm font-medium text-ink">Default date range</label>
            <p id="default-date-range-description" className="mt-1 text-sm leading-6 text-muted">Apply when opening the dashboard unless saved filters are restored.</p>
          </div>
          <select
            id="default-date-range"
            aria-describedby="default-date-range-description"
            value={defaultDateRange}
            onChange={event => setDefaultDateRange(event.target.value as DefaultDateRange)}
            className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink"
          >
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
            <option value="year">This year</option>
            <option value="all">All time</option>
          </select>
        </div>
        <div className="mt-6 flex items-center justify-between gap-6 border-t border-line pt-6">
          <div>
            <h3 id="remember-filters-label" className="text-sm font-medium text-ink">Remember dashboard filters</h3>
            <p id="remember-filters-description" className="mt-1 text-sm leading-6 text-muted">Restore your last selected dashboard filters between visits, including dates. Saved filters take priority over the default date range.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={rememberFilters}
            aria-labelledby="remember-filters-label"
            aria-describedby="remember-filters-description"
            onClick={() => setRememberFilters(!rememberFilters)}
            className="theme-switch shrink-0"
          >
            <span className="theme-switch-thumb" />
          </button>
        </div>
        <p className="mt-6 border-t border-line pt-4 text-xs text-muted">Preferences are saved on this device. Remembered filters are saved separately for each account. Turning this off clears your saved filters.</p>
      </section>
    </section>
  )
}
