import { useEffect, useState } from 'react'
import { FeedbackResponse, FeedbackStats, getFeedbackStats } from './api'

// FR-13: cosmetic reward shown once after a successful submission.
// Nothing here is stored - not the points, not an id, nothing on the device.
const RATING_POINTS = 50
const COMMENT_POINTS = 20

export function calculatePoints(feedback: FeedbackResponse): number {
  const wroteSomething = [feedback.whatWorkedWell, feedback.whatCouldBeImproved, feedback.comment]
    .some((text) => text !== null && text.trim().length > 0)
  return RATING_POINTS + (wroteSomething ? COMMENT_POINTS : 0)
}

// 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 11 -> "11th", 237 -> "237th"
function ordinal(n: number): string {
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Counts from 0 up to `target` (skipped when the user prefers less motion).
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1)
      setValue(Math.round(target * progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return value
}

export function Reward({ feedback }: { feedback: FeedbackResponse }) {
  const points = calculatePoints(feedback)
  const shownPoints = useCountUp(points)
  const [stats, setStats] = useState<FeedbackStats | null>(null)

  // The community figure is an extra: if it fails to load, we simply don't show it.
  useEffect(() => {
    let cancelled = false
    getFeedbackStats()
      .then((result) => {
        if (!cancelled) setStats(result)
      })
      .catch(() => {
        // ignore - the thank-you message and points are still shown
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mt-8 space-y-4">
      <div className="reward-pop flex items-center gap-4 rounded-xl border border-[#f1d3c4] bg-[#fff7f2] px-5 py-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-[#d36f45] text-lg font-bold text-white">
          ★
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight text-[#9b4727]" aria-live="polite">
            +{shownPoints} points
          </p>
          <p className="text-sm text-[#7b5a4c]">
            {RATING_POINTS} for your ratings
            {points > RATING_POINTS ? ` + ${COMMENT_POINTS} for your written feedback` : ''}
          </p>
        </div>
      </div>

      {stats && <CommunityProgress stats={stats} />}
    </div>
  )
}

function CommunityProgress({ stats }: { stats: FeedbackStats }) {
  const { responsesThisMonth: count, monthlyGoal: goal } = stats
  const percent = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 100
  const message =
    count >= goal
      ? `You're the ${ordinal(count)} response this month — we've reached our goal of ${goal}!`
      : `You're the ${ordinal(count)} response this month — help us reach ${goal}!`

  return (
    <div className="rounded-xl bg-[#f6f4ee] px-5 py-4">
      <p className="text-sm font-medium text-[#314a43]">{message}</p>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#deddd6]"
        role="progressbar"
        aria-label="Community feedback goal"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(count, goal)}
      >
        <div className="reward-bar h-full rounded-full bg-[#27695d]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
