import { FormEvent, useEffect, useState } from 'react'
import {
  EventOption,
  FeedbackResponse,
  getEvents,
  submitFeedback,
} from './api'
import { Reward } from './Reward'

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function App() {
  return (
    <div className="min-h-screen bg-[#f6f4ee] text-[#18322d]">
      <Header />
      <main className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-7 sm:px-6 sm:pt-10">
        <FeedbackForm />
      </main>
      <footer className="pb-8 text-center text-xs text-[#66756f]">
        Your feedback helps us create better experiences for young people.
      </footer>
    </div>
  )
}

function Header() {
  return (
    <header className="border-b border-black/5 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-[#27695d] text-sm font-bold text-white shadow-sm">
            PY
          </div>
          <div>
            <p className="text-sm font-semibold leading-none tracking-tight">Pangaea Youth</p>
            <p className="mt-1 text-[11px] text-[#71807a]">Event feedback</p>
          </div>
        </div>
        <span className="rounded-full bg-[#e4f0ec] px-3 py-1.5 text-xs font-semibold text-[#27695d]">
          Anonymous
        </span>
      </div>
    </header>
  )
}

function FeedbackForm() {
  const [events, setEvents] = useState<EventOption[]>([])
  const [eventId, setEventId] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [usefulnessRating, setUsefulnessRating] = useState<number | null>(null)
  const [inclusionRating, setInclusionRating] = useState<number | null>(null)
  const [whatWorkedWell, setWhatWorkedWell] = useState('')
  const [whatCouldBeImproved, setWhatCouldBeImproved] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<FeedbackResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadEvents() {
      setLoading(true)
      setError('')
      try {
        const result = await getEvents()
        if (!cancelled) setEvents(result)
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Unable to load events.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadEvents()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (
      !eventId ||
      rating === null ||
      usefulnessRating === null ||
      inclusionRating === null
    ) return

    setError('')
    setSubmitting(true)
    try {
      setSubmitted(await submitFeedback(
        Number(eventId),
        rating,
        usefulnessRating,
        inclusionRating,
        whatWorkedWell,
        whatCouldBeImproved,
        comment,
      ))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to submit feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return <SuccessCard feedback={submitted} />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-[#deddd6] bg-white shadow-[0_12px_40px_rgba(34,63,55,0.08)]">
        <div className="h-2 bg-[#27695d]" />
        <div className="px-6 py-7 sm:px-8 sm:py-9">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#d36f45]">
            Event feedback
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">How was your experience?</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#64716c]">
            We read every response. Your perspective helps our team make future Pangaea Youth events more useful, inclusive, and inspiring.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-[#ecebe6] pt-4 text-xs text-[#7b817e]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#3f514b]">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4 text-[#27695d]">
                <path d="M10 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM3.5 17.5a6.5 6.5 0 0 1 13 0h-13Z" />
              </svg>
              No name, email, or account is attached
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#d36f45]">* Required</span>
          </div>
        </div>
      </section>

      <QuestionCard title="Which event did you attend?" required>
        {loading ? (
          <div className="h-11 w-full animate-pulse rounded-lg bg-[#eef0ec] sm:w-2/3" />
        ) : events.length === 0 ? (
          <div className="rounded-lg bg-[#f6f4ee] p-4 text-sm text-[#65726d]">
            No events are currently accepting feedback.
          </div>
        ) : (
          <div className="relative max-w-md">
            <select
              id="event"
              required
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
              className="w-full appearance-none rounded-lg border border-[#cfd8d3] bg-white px-4 py-3 pr-10 text-sm text-[#253d36] outline-none transition focus:border-[#27695d] focus:ring-2 focus:ring-[#27695d]/15"
            >
              <option value="">Choose an event</option>
              {events.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {formatEventDate(item.startsAt)}
                  {item.location ? ` · ${item.location}` : ''}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-[#60716b]"
            >
              <path d="M5.25 7.5 10 12.25l4.75-4.75" />
            </svg>
          </div>
        )}
      </QuestionCard>

      <QuestionCard title="How would you rate the event?" required>
        <RatingScale
          name="rating"
          label="Overall event rating"
          value={rating}
          onChange={setRating}
          lowLabel="Not for me"
          highLabel="Excellent"
        />
      </QuestionCard>

      <QuestionCard title="How useful was the event for you?" required>
        <RatingScale
          name="usefulnessRating"
          label="Event usefulness rating"
          value={usefulnessRating}
          onChange={setUsefulnessRating}
          lowLabel="Not useful"
          highLabel="Very useful"
        />
      </QuestionCard>

      <QuestionCard title="Did you feel welcome and included?" required>
        <RatingScale
          name="inclusionRating"
          label="Welcome and inclusion rating"
          value={inclusionRating}
          onChange={setInclusionRating}
          lowLabel="Not at all"
          highLabel="Completely"
        />
      </QuestionCard>

      <QuestionCard title="What worked well?">
        <LongAnswer
          id="what-worked-well"
          value={whatWorkedWell}
          onChange={setWhatWorkedWell}
          placeholder="Tell us about a session, activity, or moment you valued…"
        />
      </QuestionCard>

      <QuestionCard title="What could we improve?">
        <LongAnswer
          id="what-could-be-improved"
          value={whatCouldBeImproved}
          onChange={setWhatCouldBeImproved}
          placeholder="What would have made the experience better for you?"
        />
      </QuestionCard>

      <QuestionCard title="Is there anything else you would like us to know?">
        <LongAnswer
          id="comment"
          value={comment}
          onChange={setComment}
          placeholder="Share any other thoughts with the team…"
        />
      </QuestionCard>

      {error && <ErrorMessage message={error} />}

      <section
        aria-labelledby="privacy-notice-title"
        className="rounded-2xl border border-[#deddd6] bg-[#eef4f1] px-6 py-5 text-sm leading-6 text-[#3f514b] sm:px-8"
      >
        <h2 id="privacy-notice-title" className="font-semibold text-[#263d36]">Your privacy</h2>
        <p className="mt-2">
          We collect your selected event, three ratings, any written feedback, and the submission time
          to improve Pangaea Youth events and measure community feedback progress. Your feedback is
          anonymous: no name, email, or account is attached. Please leave names and other identifying
          details out of your comments.
        </p>
        <p className="mt-2">
          The server uses your IP address in memory to limit repeat submissions; it is not saved with
          your feedback. For privacy questions, contact the Pangaea Youth event organiser.
        </p>
      </section>

      <div className="flex items-center justify-between px-1 pt-2">
        <button
          type="submit"
          disabled={
            submitting ||
            loading ||
            !eventId ||
            rating === null ||
            usefulnessRating === null ||
            inclusionRating === null
          }
          className="rounded-lg bg-[#27695d] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f594f] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#27695d]/30 focus:ring-offset-2"
        >
          {submitting ? 'Submitting…' : 'Submit feedback'}
        </button>
        <span className="text-xs text-[#89938f]">Your response is saved securely.</span>
      </div>
    </form>
  )
}

function QuestionCard({
  title,
  required = false,
  children,
}: {
  title: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[#deddd6] bg-white px-6 py-6 shadow-[0_4px_18px_rgba(34,63,55,0.045)] sm:px-8">
      <h2 className="mb-5 text-base font-medium text-[#263d36]">
        {title} {required && <span className="text-[#d36f45]">*</span>}
      </h2>
      {children}
    </section>
  )
}

function RatingScale({
  name,
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  name: string
  label: string
  value: number | null
  onChange: (value: number) => void
  lowLabel: string
  highLabel: string
}) {
  return (
    <>
      <div className="mt-1 grid max-w-lg grid-cols-5 gap-2 sm:gap-4" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((option) => (
          <label key={option} className="group cursor-pointer text-center">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="peer sr-only"
              required
            />
            <span className="mx-auto grid size-11 place-items-center rounded-full border border-[#bdcbc5] bg-white text-sm font-semibold transition group-hover:border-[#27695d] peer-checked:border-[#27695d] peer-checked:bg-[#27695d] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#27695d]/30 peer-focus-visible:ring-offset-2">
              {option}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex max-w-lg justify-between text-xs text-[#7b817e]">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </>
  )
}

function LongAnswer({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={2000}
        rows={4}
        placeholder={placeholder}
        className="w-full resize-y border-0 border-b border-[#aebbb6] bg-transparent px-0 py-2 text-[15px] leading-6 outline-none transition placeholder:text-[#9aa29f] focus:border-[#27695d] focus:ring-0"
      />
      <p className="mt-2 text-right text-xs text-[#89938f]">{value.length} / 2000</p>
    </>
  )
}

function SuccessCard({ feedback }: { feedback: FeedbackResponse }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#deddd6] bg-white shadow-[0_12px_40px_rgba(34,63,55,0.08)]">
      <div className="h-2 bg-[#27695d]" />
      <div className="px-6 py-10 sm:px-10 sm:py-12">
        <div className="mb-6 grid size-14 place-items-center rounded-full bg-[#e4f0ec] text-[#27695d]">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-7">
            <path d="m5 12 4 4L19 6" />
          </svg>
        </div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#d36f45]">Response received</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Thank you for sharing.</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#64716c]">
          Your feedback for <span className="font-semibold text-[#314a43]">{feedback.eventName}</span> has been submitted to the Pangaea Youth team.
        </p>
        <div className="mt-8 inline-flex items-center gap-3 rounded-xl bg-[#f6f4ee] px-4 py-3 text-sm text-[#52615c]">
          <span className="font-medium">Your rating</span>
          <span className="rounded-full bg-[#27695d] px-2.5 py-1 font-bold text-white">{feedback.rating} / 5</span>
        </div>
        <Reward feedback={feedback} />
      </div>
    </section>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl border border-[#efc7b7] bg-[#fff4ef] px-4 py-3 text-sm text-[#9b4727]">
      {message}
    </div>
  )
}

export default App
