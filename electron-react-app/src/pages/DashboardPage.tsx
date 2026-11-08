import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  getAttendanceByEvent,
  getSatisfactionDistribution,
} from '../api/dashboard'
import { getErrorMessage } from '../api/client'
import DashboardFilterBar from '../components/DashboardFilterBar'
import ExportReportButtons from '../components/ExportReportButtons'
import OverviewTiles from '../components/OverviewTiles'
import { hasPeopleFilter, hasValidDateRange, useDashboardFilterStore } from '../stores/dashboardFilterStore'
import TrendsCard from '../components/TrendsCard'
import EventTypeComparisonCard from '../components/EventTypeComparisonCard'
import ReturningParticipantsCard from '../components/ReturningParticipantsCard'
import PromotionChannelsCard from '../components/PromotionChannelsCard'
import AttendanceByEventChart from '../components/charts/AttendanceByEventChart'
import SatisfactionDistributionChart from '../components/charts/SatisfactionDistributionChart'

function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="min-w-0 rounded-xl border border-stone-200 bg-white p-5 shadow-card">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      <p className="mt-1 text-sm text-stone-500">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function ChartMessage({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`flex h-80 items-center justify-center text-sm ${error ? 'text-rose-700' : 'text-stone-500'}`}>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  // #25: every chart on the page follows the shared filter bar.
  const filters = useDashboardFilterStore((state) => state.filters)
  const satisfaction = useQuery({
    queryKey: ['dashboard', 'satisfaction', filters],
    queryFn: () => getSatisfactionDistribution(filters),
    placeholderData: keepPreviousData,
    enabled: hasValidDateRange(filters),
  })
  const attendance = useQuery({
    queryKey: ['dashboard', 'attendance', filters],
    queryFn: () => getAttendanceByEvent(10, filters),
    placeholderData: keepPreviousData,
    enabled: hasValidDateRange(filters),
  })
  const totalResponses = satisfaction.data?.totalResponses

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">Insights</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-stone-900">Dashboard</h1>
          <p className="mt-3 max-w-2xl text-stone-600">
            Aggregated feedback and attendance across your events.
          </p>
        </div>
        <ExportReportButtons />
      </div>

      <div className="mt-8">
        <DashboardFilterBar />
      </div>

      <div className="mt-6">
        <OverviewTiles />
      </div>

      <TrendsCard />
      <EventTypeComparisonCard />

      <div className="mt-8 grid min-w-0 gap-6 xl:grid-cols-2">
        <ChartCard
          title="Satisfaction distribution"
          description={
            (typeof totalResponses === 'number' ? `${totalResponses} responses` : 'Ratings from 1 to 5') +
            (hasPeopleFilter(filters) ? ' · not filtered by city, age or gender (feedback is anonymous)' : '')
          }
        >
          {satisfaction.isLoading && <ChartMessage>Loading satisfaction data…</ChartMessage>}
          {satisfaction.error && <ChartMessage error>{getErrorMessage(satisfaction.error)}</ChartMessage>}
          {/* NFR-02: fewer than 5 responses (including none) are never shown */}
          {satisfaction.data && totalResponses === null && (
            <ChartMessage>Not enough data: fewer than 5 feedback responses match these filters.</ChartMessage>
          )}
          {satisfaction.data && typeof totalResponses === 'number' && (
            <>
              <SatisfactionDistributionChart data={satisfaction.data} />
              <p className="mt-2 text-xs text-stone-500">Ratings given by fewer than 5 people are hidden.</p>
            </>
          )}
        </ChartCard>

        <ChartCard
          title="Sign-ups per event"
          description="Everyone who signed up compared with those who got a spot"
        >
          {attendance.isLoading && <ChartMessage>Loading attendance data…</ChartMessage>}
          {attendance.error && <ChartMessage error>{getErrorMessage(attendance.error)}</ChartMessage>}
          {attendance.data && attendance.data.events.length === 0 && (
            <ChartMessage>No events match these filters.</ChartMessage>
          )}
          {attendance.data && attendance.data.events.length > 0 && (
            <>
              <div className="mb-1 flex flex-wrap justify-end gap-4 text-xs text-stone-600">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-brand" />Signed up</span>
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-teal-600" />Accepted</span>
              </div>
              <AttendanceByEventChart data={attendance.data} />
              <p className="mt-2 text-xs text-stone-500">Bars for fewer than 5 people are hidden.</p>
            </>
          )}
        </ChartCard>
      </div>

      {/* Who our participants are: FR-09 and FR-10 */}
      <div className="mt-8 grid min-w-0 gap-6 xl:grid-cols-2">
        <ReturningParticipantsCard />
        <PromotionChannelsCard />
      </div>
    </section>
  )
}
