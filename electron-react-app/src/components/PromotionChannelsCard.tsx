import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getPromotionChannels } from '../api/dashboard'
import { getErrorMessage } from '../api/client'
import { hasValidDateRange, useDashboardFilterStore } from '../stores/dashboardFilterStore'
import ResponsiveBarChart from './charts/ResponsiveBarChart'

const series = [{ key: 'people', label: 'Participants', color: 'var(--color-chart-primary)' }]

function Message({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`flex h-80 items-center justify-center text-center text-sm ${error ? 'text-danger' : 'text-muted'}`}>{children}</div>
}

// FR-10: how accepted participants heard about Pangaea.
export default function PromotionChannelsCard() {
  const filters = useDashboardFilterStore(state => state.filters)
  const channels = useQuery({
    queryKey: ['dashboard', 'channels', filters],
    queryFn: () => getPromotionChannels(filters),
    placeholderData: keepPreviousData,
    enabled: hasValidDateRange(filters),
  })
  const rows = channels.data?.channels ?? []
  const visible = rows.filter(row => row.count !== null)
  const hiddenOther = rows.some(row => row.count === null)
  const chartData = rows.map(row => ({
    key: row.channel,
    label: row.channel.length > 20 ? `${row.channel.slice(0, 18)}…` : row.channel,
    description: row.channel,
    values: { people: row.count },
  }))

  return <section className="min-w-0 rounded-xl border border-line bg-surface p-5 shadow-card">
    <h2 className="text-lg font-semibold text-ink">Promotion channels</h2>
    <p className="mt-1 text-sm text-muted">How participants heard about Pangaea.</p>
    <div className="mt-5">
      {channels.isLoading ? <Message>Loading promotion channels…</Message>
        : channels.error ? <Message error>{getErrorMessage(channels.error)}</Message>
        // NFR-02: nothing with 5 or more people to show.
        : visible.length === 0 ? <Message>Not enough data: fewer than 5 participants answered this question for these filters.</Message>
        : <>
          <ResponsiveBarChart data={chartData} series={series} xAxisLabel="Channel" yAxisLabel="Participants"
            formatTooltip={(datum, _series, value) => `${datum.description} · ${value} participant${value === 1 ? '' : 's'}`} />
          {hiddenOther && <p className="mt-2 text-xs text-helper">Other: fewer than 5 people (not shown).</p>}
        </>}
      <p className="mt-2 text-xs text-helper">
        From the sign-up form (“How did you hear about us?”). Only accepted participants who answered are counted. Channels chosen by fewer than 5 people are grouped into Other.
      </p>
    </div>
  </section>
}
