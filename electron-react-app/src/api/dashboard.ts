import { api } from './client'
import type { DashboardFilters } from '../stores/dashboardFilterStore'

// #25 / NFR-02: every count or average about people is null when it covers fewer than
// 5 people. The backend hides it; the app shows "Not enough data".

export interface RatingBucket {
  rating: number
  count: number | null
}

export interface SatisfactionDistribution {
  totalResponses: number | null
  ratings: RatingBucket[]
}

export interface EventAttendance {
  eventId: number
  eventName: string
  startsAt: string
  signedUpCount: number | null
  acceptedCount: number | null
}

export interface AttendanceByEvent {
  events: EventAttendance[]
}

// FR-04: key metrics for the KPI tiles. Mirrors OverviewResponse in DashboardController.cs.
export interface DashboardOverview {
  totalEvents: number
  totalParticipants: number | null
  averageSatisfaction: number | null
  feedbackResponses: number | null
  acceptanceRate: number | null
}

export async function getDashboardOverview(filters: DashboardFilters = {}): Promise<DashboardOverview> {
  const { data } = await api.get<DashboardOverview>('/api/dashboard/overview', { params: filters })
  return data
}

export async function getSatisfactionDistribution(filters: DashboardFilters = {}): Promise<SatisfactionDistribution> {
  const { data } = await api.get<SatisfactionDistribution>('/api/dashboard/satisfaction', { params: filters })
  return data
}

export async function getAttendanceByEvent(limit = 10, filters: DashboardFilters = {}): Promise<AttendanceByEvent> {
  const { data } = await api.get<AttendanceByEvent>('/api/dashboard/attendance', {
    params: { ...filters, limit },
  })
  return data
}

// #25: the choices for the filter bar's dropdowns.
export interface FilterOption {
  id: number
  name: string
}

export interface FilterOptions {
  events: FilterOption[]
  eventTypes: FilterOption[]
  cities: string[]
  genders: string[]
  ageBands: string[]
  seasons: string[]
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const { data } = await api.get<FilterOptions>('/api/dashboard/filter-options')
  return data
}

export interface TrendPoint {
  periodStart: string
  eventCount: number
  feedbackResponses: number | null
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

// #25: the filter bar's other filters (event type, season, city, age band, gender) are
// sent too; the chart's own interval/event/from/to work as before.
export async function getTrends(filters: TrendFilters, barFilters: DashboardFilters = {}): Promise<Trends> {
  const { data } = await api.get<Trends>('/api/dashboard/trends', { params: { ...barFilters, ...filters } })
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

export async function getEventTypeComparison(
  filters: EventTypeFilters,
  barFilters: DashboardFilters = {},
): Promise<{ types: EventTypeComparison[] }> {
  const { data } = await api.get<{ types: EventTypeComparison[] }>('/api/dashboard/event-types', {
    params: { ...barFilters, ...filters },
  })
  return data
}
