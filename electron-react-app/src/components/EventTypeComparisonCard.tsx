import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getEventTypeComparison } from '../api/dashboard'
import type { EventTypeComparison, EventTypeFilters } from '../api/dashboard'
import { getErrorMessage } from '../api/client'
import { combineWithBar, useDashboardFilterStore } from '../stores/dashboardFilterStore'
import ResponsiveBarChart from './charts/ResponsiveBarChart'

type SortKey = 'averageSatisfaction' | 'participants' | 'eventCount' | 'name'
const satisfactionSeries = [{ key: 'satisfaction', label: 'Satisfaction', color: '#a78bfa' }]
const countSeries = [
  { key: 'participants', label: 'Accepted participants', color: '#38bdf8' },
  { key: 'events', label: 'Events', color: '#34d399' },
]
const inputClass = 'mt-1 block rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 [color-scheme:dark]'

export default function EventTypeComparisonCard() {
  const [filters, setFilters] = useState<EventTypeFilters>({})
  const [sortKey, setSortKey] = useState<SortKey>('averageSatisfaction')
  const [ascending, setAscending] = useState(false)
  const invalidRange = !!(filters.from && filters.to && filters.from > filters.to)
  // #25: this card's own dates work as before, and it also follows the dashboard filter bar.
  const bar = useDashboardFilterStore(state => state.filters)
  const combined = combineWithBar(filters, bar)
  const comparison = useQuery({
    queryKey: ['dashboard', 'event-types', filters, bar],
    queryFn: () => getEventTypeComparison(
      { from: combined.from, to: combined.to },
      { eventId: bar.eventId, eventTypeId: bar.eventTypeId, season: bar.season, city: bar.city, ageBand: bar.ageBand, gender: bar.gender }),
    enabled: !invalidRange && !combined.noOverlap,
  })
  const types = [...(comparison.data?.types ?? [])].sort((a: EventTypeComparison, b: EventTypeComparison) => {
    const left = a[sortKey], right = b[sortKey]
    if (left == null) return right == null ? a.name.localeCompare(b.name) : 1
    if (right == null) return -1
    const order = typeof left === 'string' && typeof right === 'string'
      ? left.localeCompare(right) : Number(left) - Number(right)
    return (ascending ? order : -order) || a.name.localeCompare(b.name)
  })
  const chartData = types.map(type => ({
    key: String(type.eventTypeId ?? 'uncategorised'),
    label: type.name.length > 20 ? `${type.name.slice(0, 18)}…` : type.name,
    description: type.name,
    values: { satisfaction: type.averageSatisfaction, participants: type.participants, events: type.eventCount },
  }))

  return <section className="mt-8 min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
    <h2 className="text-lg font-semibold text-white">Compare event types</h2>
    <p className="mt-1 text-sm text-slate-400">Compare satisfaction, accepted participants and event totals by topic. Satisfaction is weighted by feedback responses.</p>
    <div className="my-5 flex flex-wrap items-end gap-4">
      <label className="text-xs text-slate-300">From (inclusive, UTC)
        <input type="date" className={inputClass} value={filters.from ?? ''} onChange={e => setFilters(f => ({ ...f, from: e.target.value || undefined }))} />
      </label>
      <label className="text-xs text-slate-300">To (inclusive, UTC)
        <input type="date" className={inputClass} value={filters.to ?? ''} onChange={e => setFilters(f => ({ ...f, to: e.target.value || undefined }))} />
      </label>
      <label className="text-xs text-slate-300">Sort by
        <select className={inputClass} value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
          <option value="averageSatisfaction">Satisfaction</option>
          <option value="participants">Participants</option>
          <option value="eventCount">Number of events</option>
          <option value="name">Name</option>
        </select>
      </label>
      <label className="text-xs text-slate-300">Order
        <select className={inputClass} value={ascending ? 'asc' : 'desc'} onChange={e => setAscending(e.target.value === 'asc')}>
          <option value="desc">Descending</option><option value="asc">Ascending</option>
        </select>
      </label>
      <button className="rounded-md px-3 py-2 text-sm text-sky-400 hover:bg-slate-800" onClick={() => setFilters({})}>Reset dates</button>
    </div>
    <p className="mb-4 text-xs text-slate-400">Dates refer to event starts. Satisfaction requires at least 5 feedback responses per type; participants require at least 5 accepted registrations per type. Suppressed values have no bar and sort last. Participants count accepted places across events, so a person may be counted more than once.</p>
    <p className="mb-4 text-xs text-slate-500">Also follows the dashboard filters above.</p>
    {invalidRange ? <p role="alert" className="text-sm text-rose-300">From must be on or before To.</p>
      : combined.noOverlap ? <p className="py-24 text-center text-sm text-slate-400">This chart’s dates do not overlap with the dashboard filters.</p>
      : comparison.isLoading ? <p role="status" className="py-24 text-center text-sm text-slate-400">Loading event types…</p>
      : comparison.error ? <p role="alert" className="py-24 text-center text-sm text-rose-300">{getErrorMessage(comparison.error)}</p>
      : types.length === 0 ? <p className="py-24 text-center text-sm text-slate-400">No events match these dates.</p>
      : <>
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(280, types.length * 140) }}>
            <h3 className="mb-2 text-sm font-medium text-violet-300">Average satisfaction (1–5)</h3>
            <ResponsiveBarChart data={chartData} series={satisfactionSeries} xAxisLabel="Event type" yAxisLabel="Average rating" yMax={5}
              formatTooltip={(datum, _series, value) => `${datum.description} · Satisfaction: ${value.toFixed(2)} / 5`} />
            <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-300">
              {countSeries.map(series => <span key={series.key} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} />{series.label}</span>)}
            </div>
            <ResponsiveBarChart data={chartData} series={countSeries} xAxisLabel="Event type" yAxisLabel="Count" />
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <caption className="sr-only">Event type comparison, in the selected sort order</caption>
            <thead className="border-b border-slate-700 text-slate-400"><tr>
              <th scope="col" className="p-3">Event type</th><th scope="col" className="p-3">Satisfaction</th><th scope="col" className="p-3">Participants</th><th scope="col" className="p-3">Events</th>
            </tr></thead>
            <tbody>{types.map(type => <tr key={type.eventTypeId ?? 'uncategorised'} className="border-b border-slate-800">
              <th scope="row" className="p-3 font-medium text-white">{type.name}</th>
              <td className="p-3">{type.averageSatisfaction == null ? 'Insufficient feedback' : `${type.averageSatisfaction.toFixed(2)} / 5`}</td>
              <td className="p-3">{type.participants == null ? 'Insufficient participant data' : type.participants}</td>
              <td className="p-3">{type.eventCount}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
  </section>
}
