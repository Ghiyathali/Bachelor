import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { getAttendanceEstimate, getFilterOptions } from '../api/dashboard'
import { getErrorMessage } from '../api/client'

const inputClass = 'mt-1 block w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink'

function Message({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`flex h-40 items-center justify-center text-center text-sm ${error ? 'text-danger' : 'text-muted'}`}>{children}</div>
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="rounded-lg border border-line bg-canvas p-4">
    <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
    <p className="mt-1 text-3xl font-bold text-ink">{value}</p>
    <p className="mt-1 text-xs text-muted">{hint}</p>
  </div>
}

// FR-14: how many participants to expect at a planned event, from past events of the same type.
export default function AttendanceEstimateCard() {
  const [eventTypeId, setEventTypeId] = useState<number>()
  const [date, setDate] = useState('')
  // Same query key as the filter bar, so the event-type list is reused, not fetched twice.
  const options = useQuery({ queryKey: ['dashboard', 'filter-options'], queryFn: getFilterOptions })
  const ready = eventTypeId !== undefined && date !== ''
  const estimate = useQuery({
    queryKey: ['dashboard', 'estimate', eventTypeId, date],
    queryFn: () => getAttendanceEstimate(eventTypeId!, date),
    enabled: ready,
  })
  const data = estimate.data

  return <section className="min-w-0 rounded-xl border border-line bg-surface p-5 shadow-card">
    <h2 className="text-lg font-semibold text-ink">Attendance estimate</h2>
    <p className="mt-1 text-sm text-muted">How many participants to expect at a planned event, based on past events of the same type.</p>

    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:max-w-xl">
      <label className="text-xs font-medium text-body">Event type
        <select className={inputClass} value={eventTypeId ?? ''}
          onChange={e => setEventTypeId(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Choose a type</option>
          {options.data?.eventTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-body">Planned date
        <input type="date" className={inputClass} value={date} onChange={e => setDate(e.target.value)} />
      </label>
    </div>

    <div className="mt-5">
      {!ready ? <Message>Choose an event type and a planned date to see an estimate.</Message>
        : estimate.isLoading ? <Message>Calculating estimate…</Message>
        : estimate.error ? <Message error>{getErrorMessage(estimate.error)}</Message>
        : !data || data.estimate === null ? <Message>
            Not enough history: {data?.basedOnEvents ?? 0} past “{data?.eventTypeName}” event{data?.basedOnEvents === 1 ? '' : 's'} with sign-ups – at least 3 are needed.
          </Message>
        : <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Typical turnout" value={String(data.average)} hint="Average of past events" />
            <Stat label="Trend estimate" value={String(data.estimate)} hint="Linear trend at the planned date" />
            <Stat label="Likely range" value={`${data.low}–${data.high}`} hint="Give or take the usual deviation" />
          </div>
          <p className="mt-3 text-sm text-muted">
            Based on {data.basedOnEvents} past “{data.eventTypeName}” events with sign-ups, counting accepted participants.
          </p>
        </>}
      <p className="mt-2 text-xs text-muted">
        An estimate from past trends, not a guarantee. Not affected by the dashboard filters above.
      </p>
    </div>
  </section>
}
