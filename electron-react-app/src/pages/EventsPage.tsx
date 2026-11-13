import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getErrorMessage } from '../api/client'
import { type EventWalkIns, MAX_WALK_INS, getWalkIns, parseWalkIns, setWalkIns } from '../api/events'
import Icon from '../components/Icon'

function longDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

// A small calendar-style badge: day number on top, month below.
function DateBadge({ value, muted = false }: { value: string; muted?: boolean }) {
  const date = new Date(value)
  return (
    <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${muted ? 'bg-hover text-muted' : 'bg-brand-soft text-brand-ink'}`}>
      <span className="font-display text-lg font-bold leading-none">{date.getDate()}</span>
      <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider">
        {date.toLocaleDateString('en-GB', { month: 'short' })}
      </span>
    </span>
  )
}

// One past event: a number field with − and +, and Save once something changed.
function WalkInRow({ event }: { event: EventWalkIns }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(String(event.walkIns))
  const [saved, setSaved] = useState(false)
  const parsed = parseWalkIns(value)
  const changed = parsed !== null && parsed !== event.walkIns

  const save = useMutation({
    mutationFn: (walkIns: number) => setWalkIns(event.eventId, walkIns),
    onSuccess: async () => {
      setSaved(true)
      // Walk-ins change the participant numbers, so the dashboard and home page must reload them.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['events', 'walk-ins'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
      ])
    },
  })

  function update(next: string) {
    // "02" becomes "2": leading zeros are dropped as you type (an empty field stays empty).
    setValue(/^\d+$/.test(next) ? String(Number(next)) : next)
    setSaved(false)
    save.reset()
  }

  const step = (by: number) => update(String(Math.min(MAX_WALK_INS, Math.max(0, (parsed ?? event.walkIns) + by))))
  const inputId = `walk-ins-${event.eventId}`
  const stepButton = 'flex h-9 w-9 items-center justify-center text-lg text-body hover:bg-hover disabled:opacity-30'

  return (
    <li className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-4 first:border-t-0 sm:flex-nowrap">
      <DateBadge value={event.startsAt} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink" title={event.name}>{event.name}</p>
        <p className="text-sm text-muted">{longDate(event.startsAt)}</p>
        {parsed === null && <p role="alert" className="mt-1 text-xs text-danger">Enter a whole number from 0 to {MAX_WALK_INS}.</p>}
        {save.error && <p role="alert" className="mt-1 text-xs text-danger">{getErrorMessage(save.error)}</p>}
      </div>

      <form
        className="flex items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (changed && parsed !== null) save.mutate(parsed)
        }}
      >
        <label htmlFor={inputId} className="sr-only">Walk-ins at {event.name}</label>
        <div className={`flex items-center overflow-hidden rounded-lg border bg-canvas ${parsed === null ? 'border-danger' : 'border-line'}`}>
          <button type="button" aria-label={`One less walk-in at ${event.name}`} onClick={() => step(-1)}
            disabled={(parsed ?? 0) <= 0} className={`${stepButton} rounded-none!`}>−</button>
          <input
            id={inputId}
            inputMode="numeric"
            value={value}
            onChange={(e) => update(e.target.value)}
            onFocus={(e) => e.target.select()}
            // Leaving the field: empty becomes 0, anything invalid goes back to the saved number.
            onBlur={() => {
              if (value.trim() === '') update('0')
              else if (parsed === null) update(String(event.walkIns))
            }}
            aria-invalid={parsed === null}
            className="h-9 min-h-0! w-14 rounded-none! border-x border-line bg-surface text-center text-sm font-semibold text-ink tabular-nums outline-none!"
          />
          <button type="button" aria-label={`One more walk-in at ${event.name}`} onClick={() => step(1)}
            disabled={(parsed ?? 0) >= MAX_WALK_INS} className={`${stepButton} rounded-none!`}>+</button>
        </div>
        <div className="w-20">
          {changed ? (
            <button type="submit" disabled={save.isPending}
              className="w-full bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          ) : saved && !save.error ? (
            <p role="status" className="flex items-center justify-center gap-1 text-sm font-medium text-success">
              <Icon name="circleCheck" className="h-4 w-4" />Saved
            </p>
          ) : null}
        </div>
      </form>
    </li>
  )
}

function UpcomingRow({ event }: { event: EventWalkIns }) {
  return (
    <li className="flex items-center gap-4 border-t border-line px-5 py-3 first:border-t-0">
      <DateBadge value={event.startsAt} muted />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-body" title={event.name}>{event.name}</p>
        <p className="text-sm text-muted">{longDate(event.startsAt)}</p>
      </div>
      <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-ink">Upcoming</span>
    </li>
  )
}

// Walk-ins: people who came without signing up. Counting one number per event (instead of
// adding people one by one) means nobody can be counted twice and no personal data is stored.
export default function EventsPage() {
  const events = useQuery({ queryKey: ['events', 'walk-ins'], queryFn: getWalkIns })
  const [search, setSearch] = useState('')

  const now = Date.now()
  const all = events.data ?? []
  const past = all.filter((e) => new Date(e.startsAt).getTime() <= now)
  const upcoming = all.filter((e) => new Date(e.startsAt).getTime() > now).reverse()   // soonest first
  const matches = (e: EventWalkIns) => e.name.toLowerCase().includes(search.trim().toLowerCase())
  const shownPast = past.filter(matches)
  const shownUpcoming = upcoming.filter(matches)

  return (
    <section className="max-w-5xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-ink">Attendance</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink">Events</h1>
      <p className="mt-3 max-w-2xl text-body">
        Add how many people came without signing up. They count as participants on the dashboard.
      </p>

      {events.isLoading ? (
        <div className="mt-8 space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-line" />)}</div>
      ) : events.error ? (
        <p className="mt-8 flex items-center gap-2 rounded-xl border border-danger-line bg-danger-soft p-5 text-sm text-danger">
          <Icon name="alert" className="h-4 w-4 text-attention" />Couldn't load the events: {getErrorMessage(events.error)}
        </p>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-xl font-semibold text-ink">Past events</h2>
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Search events</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events"
                className="w-full rounded-lg border border-line bg-surface py-2 pl-3 pr-3 text-sm text-ink"
              />
            </label>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            {shownPast.length === 0 ? (
              <p className="p-6 text-sm text-muted">{search ? 'No past events match your search.' : 'No past events yet.'}</p>
            ) : (
              <ul>{shownPast.map((event) => <WalkInRow key={event.eventId} event={event} />)}</ul>
            )}
          </div>
          <p className="mt-3 text-xs text-helper">Count only people who were not on the sign-up list.</p>

          {upcoming.length > 0 && (
            <>
              <h2 className="mt-10 text-xl font-semibold text-ink">Upcoming</h2>
              <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
                {shownUpcoming.length === 0
                  ? <p className="p-6 text-sm text-muted">No upcoming events match your search.</p>
                  : <ul>{shownUpcoming.map((event) => <UpcomingRow key={event.eventId} event={event} />)}</ul>}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
