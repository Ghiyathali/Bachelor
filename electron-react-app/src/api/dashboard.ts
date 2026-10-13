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
