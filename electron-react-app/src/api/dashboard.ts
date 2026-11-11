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

// FR-09: returning participants. Mirrors ReturningParticipantsResponse in ReturningParticipantsController.cs.
// Per type only the percentage is sent (NFR-02); null = fewer than 5 answers.
export interface ReturningByEventType {
  eventTypeId: number | null
  name: string
  returningPercent: number | null
}

export interface ReturningParticipants {
  answered: number | null
  returningPercent: number | null
  byEventType: ReturningByEventType[]
}

export async function getReturningParticipants(filters: DashboardFilters = {}): Promise<ReturningParticipants> {
  const { data } = await api.get<ReturningParticipants>('/api/dashboard/returning', { params: filters })
  return data
}

// FR-10: promotion channels. Mirrors PromotionChannelsResponse in PromotionChannelsController.cs.
// Small channels are merged into "Other"; count null = fewer than 5 people (NFR-02).
export interface ChannelCount {
  channel: string
  count: number | null
}

export interface PromotionChannels {
  channels: ChannelCount[]
}

export async function getPromotionChannels(filters: DashboardFilters = {}): Promise<PromotionChannels> {
  const { data } = await api.get<PromotionChannels>('/api/dashboard/channels', { params: filters })
  return data
}

// FR-14: estimated attendance for a planned event. Mirrors AttendanceEstimateResponse in AttendanceEstimateController.cs.
// average/estimate/low/high are null when there are fewer than 3 past events of the type.
export interface AttendanceEstimate {
  eventTypeId: number
  eventTypeName: string
  date: string
  basedOnEvents: number
  average: number | null
  estimate: number | null
  low: number | null
  high: number | null
}

export async function getAttendanceEstimate(eventTypeId: number, date: string): Promise<AttendanceEstimate> {
  const { data } = await api.get<AttendanceEstimate>('/api/dashboard/estimate', { params: { eventTypeId, date } })
  return data
}
