import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getReturningParticipants } from '../api/dashboard'
import { getErrorMessage } from '../api/client'
import { hasValidDateRange, useDashboardFilterStore } from '../stores/dashboardFilterStore'
import ResponsiveBarChart from './charts/ResponsiveBarChart'

const series = [{ key: 'returning', label: 'Returning participants', color: 'var(--color-chart-secondary)' }]

function Message({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`flex h-80 items-center justify-center text-center text-sm ${error ? 'text-danger' : 'text-muted'}`}>{children}</div>
}

// FR-09: share of accepted participants who said they had been to a Pangaea event before.
export default function ReturningParticipantsCard() {
  const filters = useDashboardFilterStore(state => state.filters)
  const returning = useQuery({
    queryKey: ['dashboard', 'returning', filters],
    queryFn: () => getReturningParticipants(filters),
    placeholderData: keepPreviousData,
    enabled: hasValidDateRange(filters),
  })
  const data = returning.data
  const types = data?.byEventType ?? []
  const chartData = types.map(type => ({
    key: String(type.eventTypeId ?? 'uncategorised'),
    label: type.name.length > 20 ? `${type.name.slice(0, 18)}…` : type.name,
    description: type.name,
    values: { returning: type.returningPercent },
  }))
  const hiddenTypes = types.filter(type => type.returningPercent === null).length

  return <section className="min-w-0 rounded-xl border border-line bg-surface p-5 shadow-card">
    <h2 className="text-lg font-semibold text-ink">Returning participants</h2>
    <p className="mt-1 text-sm text-muted">Share of participants who had been to a Pangaea event before.</p>
    <div className="mt-5">
      {returning.isLoading ? <Message>Loading returning participants…</Message>
        : returning.error ? <Message error>{getErrorMessage(returning.error)}</Message>
        // NFR-02: fewer than 5 answers (including none) are never shown.
        : !data || data.returningPercent === null ? <Message>Not enough data: fewer than 5 participants answered this question for these filters.</Message>
        : <>
          <p className="text-4xl font-bold text-success">{data.returningPercent.toFixed(1)}%</p>
          <p className="mt-1 text-sm text-muted">returning participants · based on {data.answered} answers</p>
          <h3 className="mb-2 mt-6 text-sm font-medium text-body">By event type</h3>
          <ResponsiveBarChart data={chartData} series={series} xAxisLabel="Event type" yAxisLabel="Returning (%)" yMax={100}
            formatTooltip={(datum, _series, value) => `${datum.description} · ${value.toFixed(1)}% returning`} />
          {hiddenTypes > 0 && <p className="mt-2 text-xs text-muted">
            {hiddenTypes} event type{hiddenTypes === 1 ? '' : 's'} hidden: fewer than 5 answers.
          </p>}
        </>}
      <p className="mt-2 text-xs text-muted">
        Self-reported on the sign-up form (“Have you attended before?”). Only accepted participants who answered are counted.
      </p>
    </div>
  </section>
}
