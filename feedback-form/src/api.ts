// All calls from the feedback form to the REST API. VITE_API_URL is the API's address when the
// form is hosted. In development it is empty, and Vite forwards /api to the local API (vite.config.ts).
const API_URL = import.meta.env.VITE_API_URL ?? ''

export interface EventOption {
  id: number
  name: string
  startsAt: string
  endsAt: string
  location: string | null
  isFeedbackOpen: boolean
}

export interface FeedbackResponse {
  id: number
  eventId: number
  eventName: string
  rating: number
  usefulnessRating: number | null
  inclusionRating: number | null
  whatWorkedWell: string | null
  whatCouldBeImproved: string | null
  comment: string | null
  createdAt: string
}

interface ApiErrorBody {
  message?: string
  errors?: Record<string, string[]>
  title?: string
}

// An error that keeps the HTTP status, so the form can show the API's own message (for example
// 409 "Feedback is not open for this event" or 429 "Too many submissions").
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

// Shared fetch helper: sends the request and turns network failures and error answers into ApiError,
// using the API's message, or the validation errors when the API rejected a field.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new ApiError('Could not reach the server. Is the REST server running?', 0)
  }

  const body = (await response.json().catch(() => null)) as ApiErrorBody | T | null
  if (!response.ok) {
    const error = body as ApiErrorBody | null
    const validationMessage = error?.errors
      ? Object.values(error.errors).flat().join(' ')
      : null

    throw new ApiError(
      error?.message ?? validationMessage ?? error?.title ?? 'Something went wrong. Please try again.',
      response.status,
    )
  }

  return body as T
}

// Events with open feedback, for the dropdown.
export function getEvents(): Promise<EventOption[]> {
  return request<EventOption[]>('/api/events?feedbackOpenOnly=true')
}

// Sends one anonymous answer. Empty comment boxes are sent as null, not as empty text.
export function submitFeedback(
  eventId: number,
  rating: number,
  usefulnessRating: number,
  inclusionRating: number,
  whatWorkedWell: string,
  whatCouldBeImproved: string,
  comment: string,
): Promise<FeedbackResponse> {
  return request<FeedbackResponse>(`/api/events/${eventId}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rating,
      usefulnessRating,
      inclusionRating,
      whatWorkedWell: whatWorkedWell.trim() || null,
      whatCouldBeImproved: whatCouldBeImproved.trim() || null,
      comment: comment.trim() || null,
    }),
  })
}

export interface FeedbackStats {
  responsesThisMonth: number
  monthlyGoal: number
}

// FR-13: aggregate total for the community message (no personal data).
export function getFeedbackStats(): Promise<FeedbackStats> {
  return request<FeedbackStats>('/api/feedback/stats')
}
