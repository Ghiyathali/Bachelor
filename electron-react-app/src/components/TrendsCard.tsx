import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getTrendEvents, getTrends } from '../api/dashboard'
import type { TrendFilters } from '../api/dashboard'
import { getErrorMessage } from '../api/client'
import { combineWithBar, useDashboardFilterStore } from '../stores/dashboardFilterStore'
import TrendsChart from './charts/TrendsChart'

export default function TrendsCard() {
  const [filters, setFilters] = useState<TrendFilters>({ interval: 'month' })
  const invalidRange = !!(filters.from && filters.to && filters.from > filters.to)
  const events = useQuery({ queryKey: ['trend-events'], queryFn: getTrendEvents })
  // #25: this card's own controls work as before, and it also follows the dashboard filter bar.
  const bar = useDashboardFilterStore(state => state.filters)
  const combined = combineWithBar(filters, bar)
  const trends = useQuery({
    queryKey: ['dashboard', 'trends', filters, bar],
    queryFn: () => getTrends(
      { interval: filters.interval, from: combined.from, to: combined.to, eventId: combined.eventId },
      { eventTypeId: bar.eventTypeId, season: bar.season, city: bar.city, ageBand: bar.ageBand, gender: bar.gender }),
    enabled: !invalidRange && !combined.noOverlap,
  })
  const inputClass = 'mt-1 block rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]'

  return <section className="mt-8 min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
    <h2 className="text-lg font-semibold text-white">Trends over time</h2>
    <p className="mt-1 text-sm text-slate-400">Feedback-weighted satisfaction and accepted participants, grouped by event start date in UTC.</p>
    <div className="my-5 flex flex-wrap items-end gap-4">
      <label className="text-xs text-slate-300">Group by
        <select className={inputClass} value={filters.interval} onChange={e => setFilters(f => ({ ...f, interval: e.target.value as TrendFilters['interval'] }))}>
          <option value="month">Month</option><option value="season">Season</option>
        </select>
      </label>
      <label className="text-xs text-slate-300">Event
        <select className={`${inputClass} max-w-64`} value={filters.eventId ?? ''} onChange={e => setFilters(f => ({ ...f, eventId: e.target.value ? Number(e.target.value) : undefined }))}>
          <option value="">All events</option>
          {events.data?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </label>
      <label className="text-xs text-slate-300">From (inclusive)
        <input type="date" className={inputClass} value={filters.from ?? ''} onChange={e => setFilters(f => ({ ...f, from: e.target.value || undefined }))} />
      </label>
      <label className="text-xs text-slate-300">To (inclusive)
        <input type="date" className={inputClass} value={filters.to ?? ''} onChange={e => setFilters(f => ({ ...f, to: e.target.value || undefined }))} />
      </label>
      <button className="rounded-md px-3 py-2 text-sm text-sky-400 hover:bg-slate-800" onClick={() => setFilters(f => ({ interval: f.interval }))}>Reset filters</button>
    </div>
    {filters.interval === 'season' && <p className="mb-4 text-xs text-slate-400">Winter: Dec–Feb · Spring: Mar–May · Summer: Jun–Aug · Autumn: Sep–Nov. Date filters may include only part of a season.</p>}
    {events.error && <p role="alert" className="mb-3 text-sm text-rose-300">Could not load event options: {getErrorMessage(events.error)}</p>}
    <p className="mb-4 text-xs text-slate-500">Also follows the dashboard filters above. Values based on fewer than 5 people are hidden.</p>
    {invalidRange ? <p role="alert" className="text-sm text-rose-300">From must be on or before To.</p>
      : combined.noOverlap ? <p className="py-24 text-center text-sm text-slate-400">This chart’s event or dates do not overlap with the dashboard filters.</p>
      : trends.isLoading ? <p role="status" className="py-24 text-center text-sm text-slate-400">Loading trends…</p>
      : trends.error ? <p role="alert" className="py-24 text-center text-sm text-rose-300">{getErrorMessage(trends.error)}</p>
      : trends.data && (trends.data.periods.length === 0
        ? <p className="py-24 text-center text-sm text-slate-400">No events match these filters. Choose a date range to display missing periods.</p>
        : <TrendsChart data={trends.data} />)}
  </section>
}
