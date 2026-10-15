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
  registeredCount: number
  attendedCount: number
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
  attendanceRate: number | null
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
