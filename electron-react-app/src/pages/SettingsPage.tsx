import { useThemeStore } from '../stores/themeStore'

export default function SettingsPage() {
  const theme = useThemeStore(state => state.theme)
  const setTheme = useThemeStore(state => state.setTheme)
  const dark = theme === 'dark'

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
    </section>
  )
}
