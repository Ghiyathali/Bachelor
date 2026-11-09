import type { IconName } from './Icon'
import Icon from './Icon'
import { useDashboardFilterStore } from '../stores/dashboardFilterStore'

// #80: a calm message inside a chart card when there is nothing to draw, saying why and what
// to do next. NFR-02: for hidden data it explains that small groups are hidden for privacy.
export default function EmptyState({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const filters = useDashboardFilterStore((state) => state.filters)
  const reset = useDashboardFilterStore((state) => state.reset)
  const filtered = Object.values(filters).some((value) => value !== undefined)

  return (
    <div className="flex h-80 flex-col items-center justify-center px-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-xs text-sm leading-6 text-muted">{text}</p>
      {filtered && (
        <button type="button" onClick={reset} className="mt-3 px-2 py-1 text-sm font-medium text-brand-ink hover:underline">
          Clear filters
        </button>
      )}
    </div>
  )
}
