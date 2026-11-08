import type { SatisfactionDistribution } from '../../api/dashboard'
import ResponsiveBarChart from './ResponsiveBarChart'

const series = [{ key: 'responses', label: 'Responses', color: 'var(--color-brand)' }]

export default function SatisfactionDistributionChart({ data }: { data: SatisfactionDistribution }) {
  return (
    <ResponsiveBarChart
      data={data.ratings.map((bucket) => ({
        key: String(bucket.rating),
        label: String(bucket.rating),
        description: `${bucket.rating} out of 5`,
        values: { responses: bucket.count },
      }))}
      series={series}
      xAxisLabel="Satisfaction rating"
      yAxisLabel="Responses"
      formatTooltip={(datum, _series, value) => `${datum.description}: ${value} response${value === 1 ? '' : 's'}`}
    />
  )
}
