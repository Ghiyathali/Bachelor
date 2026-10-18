import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  getAttendanceByEvent,
  getSatisfactionDistribution,
} from '../api/dashboard'
import { getErrorMessage } from '../api/client'
import OverviewTiles from '../components/OverviewTiles'
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
    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/10">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function ChartMessage({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`flex h-80 items-center justify-center text-sm ${error ? 'text-rose-300' : 'text-slate-400'}`}>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const satisfaction = useQuery({
    queryKey: ['dashboard', 'satisfaction'],
    queryFn: getSatisfactionDistribution,
  })
  const attendance = useQuery({
    queryKey: ['dashboard', 'attendance'],
    queryFn: () => getAttendanceByEvent(10),
  })

  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Insights</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">Dashboard</h1>
      <p className="mt-3 max-w-2xl text-slate-300">
        Aggregated feedback and attendance across your events.
      </p>

      <div className="mt-8">
        <OverviewTiles />
      </div>

      <div className="mt-8 grid min-w-0 gap-6 xl:grid-cols-2">
        <ChartCard
          title="Satisfaction distribution"
          description={satisfaction.data ? `${satisfaction.data.totalResponses} responses` : 'Ratings from 1 to 5'}
        >
          {satisfaction.isLoading && <ChartMessage>Loading satisfaction data…</ChartMessage>}
          {satisfaction.error && <ChartMessage error>{getErrorMessage(satisfaction.error)}</ChartMessage>}
          {satisfaction.data && satisfaction.data.totalResponses === 0 && (
            <ChartMessage>No feedback responses yet.</ChartMessage>
          )}
          {satisfaction.data && satisfaction.data.totalResponses > 0 && (
            <SatisfactionDistributionChart data={satisfaction.data} />
          )}
        </ChartCard>

        <ChartCard
          title="Sign-ups per event"
          description="Everyone who signed up compared with those who got a spot"
        >
          {attendance.isLoading && <ChartMessage>Loading attendance data…</ChartMessage>}
          {attendance.error && <ChartMessage error>{getErrorMessage(attendance.error)}</ChartMessage>}
          {attendance.data && attendance.data.events.length === 0 && (
            <ChartMessage>No events available yet.</ChartMessage>
          )}
          {attendance.data && attendance.data.events.length > 0 && (
            <>
              <div className="mb-1 flex flex-wrap justify-end gap-4 text-xs text-slate-300">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-sky-400" />Signed up</span>
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />Accepted</span>
              </div>
              <AttendanceByEventChart data={attendance.data} />
            </>
          )}
        </ChartCard>
      </div>
    </section>
  )
}
