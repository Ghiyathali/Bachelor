import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  getAttendanceByEvent,
  getSatisfactionDistribution,
} from '../api/dashboard'
import { getErrorMessage } from '../api/client'
import ActiveFilterChips from '../components/ActiveFilterChips'
import DashboardFilterBar from '../components/DashboardFilterBar'
import EmptyState from '../components/EmptyState'
import ExportReportButtons from '../components/ExportReportButtons'
import OverviewTiles from '../components/OverviewTiles'
import { hasPeopleFilter, hasValidDateRange, useDashboardFilterStore } from '../stores/dashboardFilterStore'
import TrendsCard from '../components/TrendsCard'
import EventTypeComparisonCard from '../components/EventTypeComparisonCard'
import ReturningParticipantsCard from '../components/ReturningParticipantsCard'
import PromotionChannelsCard from '../components/PromotionChannelsCard'
import AttendanceEstimateCard from '../components/AttendanceEstimateCard'
import AttendanceByEventChart, { hasWalkIns } from '../components/charts/AttendanceByEventChart'
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
    <section className="min-w-0 rounded-xl border border-line bg-surface p-5 shadow-card">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function ChartMessage({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`flex h-80 items-center justify-center text-sm ${error ? 'text-danger' : 'text-muted'}`}>
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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-ink">Insights</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-3 max-w-2xl text-body">
            Aggregated feedback and attendance across your events.
          </p>
        </div>
        <ExportReportButtons />
      </div>

      <div className="mt-8">
        <DashboardFilterBar />
      </div>

      {/* #80: the applied filters as chips, right above the numbers they change */}
      <div className="mt-6 empty:hidden">
        <ActiveFilterChips />
      </div>

      <div className="mt-4">
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
            <EmptyState
              icon="shield"
              title="Not enough data to show"
              text="Fewer than 5 feedback responses match these filters, so they're hidden to protect privacy."
            />
          )}
          {satisfaction.data && typeof totalResponses === 'number' && (
            <>
              <SatisfactionDistributionChart data={satisfaction.data} />
            </>
          )}
        </ChartCard>

        <ChartCard
          title="Sign-ups per event"
          description={attendance.data && hasWalkIns(attendance.data)
            ? 'Everyone who signed up, those who got a spot, and walk-ins'
            : 'Everyone who signed up compared with those who got a spot'}
        >
          {attendance.isLoading && <ChartMessage>Loading attendance data…</ChartMessage>}
          {attendance.error && <ChartMessage error>{getErrorMessage(attendance.error)}</ChartMessage>}
          {attendance.data && attendance.data.events.length === 0 && (
            <EmptyState icon="calendar" title="No events match" text="Try a wider date range or fewer filters." />
          )}
          {attendance.data && attendance.data.events.length > 0 && (
            <>
              <div className="mb-1 flex flex-wrap justify-end gap-4 text-xs text-body">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-chart-primary" />Signed up</span>
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-chart-secondary" />Accepted</span>
                {hasWalkIns(attendance.data) && (
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm border border-chart-primary bg-brand-soft" />Walk-ins</span>
                )}
              </div>
              <AttendanceByEventChart data={attendance.data} />
            </>
          )}
        </ChartCard>
      </div>

      {/* Who our participants are: FR-09 and FR-10 */}
      <div className="mt-8 grid min-w-0 gap-6 xl:grid-cols-2">
        <ReturningParticipantsCard />
        <PromotionChannelsCard />
      </div>

      {/* FR-14: planning help for a future event */}
      <div className="mt-8">
        <AttendanceEstimateCard />
      </div>
    </section>
  )
}
