import { api } from './client'

export interface RatingBucket {
  rating: number
  count: number
}

export interface SatisfactionDistribution {
  totalResponses: number
  ratings: RatingBucket[]
}

export interface EventAttendance {
  eventId: number
  eventName: string
  startsAt: string
  signedUpCount: number
  acceptedCount: number
}

export interface AttendanceByEvent {
  events: EventAttendance[]
}

// FR-04: key metrics for the KPI tiles. Mirrors OverviewResponse in DashboardController.cs.
export interface DashboardOverview {
  totalEvents: number
  totalParticipants: number
  averageSatisfaction: number | null
  feedbackResponses: number
  acceptanceRate: number | null
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const { data } = await api.get<DashboardOverview>('/api/dashboard/overview')
  return data
}

export async function getSatisfactionDistribution(): Promise<SatisfactionDistribution> {
  const { data } = await api.get<SatisfactionDistribution>('/api/dashboard/satisfaction')
  return data
}

export async function getAttendanceByEvent(limit = 10): Promise<AttendanceByEvent> {
  const { data } = await api.get<AttendanceByEvent>('/api/dashboard/attendance', {
    params: { limit },
  })
  return data
}

export interface TrendPoint {
  periodStart: string
  eventCount: number
  feedbackResponses: number
  averageSatisfaction: number | null
  participants: number | null
}

export interface TrendFilters {
  interval: 'month' | 'season'
  eventId?: number
  from?: string
  to?: string
}

export interface Trends {
  interval: TrendFilters['interval']
  periods: TrendPoint[]
}

export async function getTrends(filters: TrendFilters): Promise<Trends> {
  const { data } = await api.get<Trends>('/api/dashboard/trends', { params: filters })
  return data
}

export async function getTrendEvents(): Promise<{ id: number; name: string }[]> {
  const { data } = await api.get<{ id: number; name: string }[]>('/api/events', {
    params: { feedbackOpenOnly: false },
  })
  return data
}

export interface EventTypeComparison {
  eventTypeId: number | null
  name: string
  eventCount: number
  averageSatisfaction: number | null
  participants: number | null
}

export interface EventTypeFilters {
  from?: string
  to?: string
}

export async function getEventTypeComparison(filters: EventTypeFilters): Promise<{ types: EventTypeComparison[] }> {
  const { data } = await api.get<{ types: EventTypeComparison[] }>('/api/dashboard/event-types', { params: filters })
  return data
}
