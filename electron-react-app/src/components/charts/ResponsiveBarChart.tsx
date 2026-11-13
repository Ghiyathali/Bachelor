import { axisBottom, axisLeft, format, max, scaleBand, scaleLinear, select } from 'd3'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FocusEvent, PointerEvent } from 'react'
import { useElementSize } from '../../hooks/useElementSize'

export interface BarSeries {
  key: string
  label: string
  color: string
  stroke?: string // outline, for light colours like lavender that would vanish on white
}

export interface BarChartDatum {
  key: string
  label: string
  description?: string
  values: Record<string, number | null>
}

interface ResponsiveBarChartProps {
  data: BarChartDatum[]
  series: BarSeries[]
  xAxisLabel: string
  yAxisLabel: string
  yMax?: number
  formatTooltip?: (datum: BarChartDatum, series: BarSeries, value: number) => string
}

interface TooltipState {
  left: number
  top: number
  text: string
}

const height = 360
const margin = { top: 18, right: 18, bottom: 76, left: 62 }

export default function ResponsiveBarChart({
  data,
  series,
  xAxisLabel,
  yAxisLabel,
  yMax,
  formatTooltip = (datum, item, value) =>
    `${datum.description ?? datum.label} · ${item.label}: ${value}`,
}: ResponsiveBarChartProps) {
  const { ref: containerRef, width } = useElementSize<HTMLDivElement>()
  const xAxisRef = useRef<SVGGElement>(null)
  const yAxisRef = useRef<SVGGElement>(null)
  const titleId = useId()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const chartWidth = Math.max(width, 280)
  const innerWidth = Math.max(1, chartWidth - margin.left - margin.right)
  const innerHeight = height - margin.top - margin.bottom

  const x = useMemo(
    () => scaleBand<string>().domain(data.map((item) => item.key)).range([0, innerWidth]).padding(0.22),
    [data, innerWidth],
  )
  const xSeries = useMemo(
    () => scaleBand<string>().domain(series.map((item) => item.key)).range([0, x.bandwidth()]).padding(0.12),
    [series, x],
  )
  const maxValue = max(data.flatMap((datum) => series.map((item) => datum.values[item.key] ?? 0))) ?? 0
  const y = useMemo(
    () => scaleLinear().domain([0, yMax ?? Math.max(1, maxValue)]).nice().range([innerHeight, 0]),
    [innerHeight, maxValue, yMax],
  )

  useEffect(() => {
    if (!xAxisRef.current) return

    const labels = new Map(data.map((item) => [item.key, item.label]))
    const axis = select(xAxisRef.current).call(
      axisBottom(x).tickSizeOuter(0).tickFormat((key) => labels.get(key) ?? key),
    )
    axis.selectAll('path, line').attr('stroke', 'var(--color-line-strong)')
    axis
      .selectAll<SVGTextElement, string>('text')
      .attr('fill', 'var(--color-body)')
      .attr('font-size', 11)
      .attr('text-anchor', x.bandwidth() < 70 ? 'end' : 'middle')
      .attr('transform', x.bandwidth() < 70 ? 'rotate(-28)' : null)
      .attr('dx', x.bandwidth() < 70 ? '-0.45em' : null)
      .attr('dy', x.bandwidth() < 70 ? '0.15em' : '0.8em')
  }, [data, x])

  useEffect(() => {
    if (!yAxisRef.current) return

    const axis = select(yAxisRef.current).call(axisLeft(y).ticks(5).tickFormat(format('d')))
    axis.selectAll('path, line').attr('stroke', 'var(--color-line-strong)')
    axis.selectAll('text').attr('fill', 'var(--color-body)').attr('font-size', 11)
  }, [y, width])

  function showTooltip(
    event: PointerEvent<SVGRectElement> | FocusEvent<SVGRectElement>,
    datum: BarChartDatum,
    item: BarSeries,
    value: number,
  ) {
    const container = containerRef.current
    if (!container) return

    const bar = event.currentTarget.getBoundingClientRect()
    const bounds = container.getBoundingClientRect()
    const rawLeft = bar.left - bounds.left + bar.width / 2

    setTooltip({
      left: Math.max(76, Math.min(bounds.width - 76, rawLeft)),
      top: bar.top - bounds.top - 8,
      text: formatTooltip(datum, item, value),
    })
  }

  return (
    <div ref={containerRef} className="relative w-full" onPointerLeave={() => setTooltip(null)}>
      {width > 0 && (
        <svg
          className="block w-full overflow-visible"
          viewBox={`0 0 ${chartWidth} ${height}`}
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>{`${yAxisLabel} by ${xAxisLabel}`}</title>
          <g transform={`translate(${margin.left},${margin.top})`}>
            <g ref={yAxisRef} />
            <g ref={xAxisRef} transform={`translate(0,${innerHeight})`} />

            {data.flatMap((datum) =>
              series.map((item) => {
                const value = datum.values[item.key]
                // Missing/suppressed values must not appear as zero in bars or tooltips.
                if (value == null) return null
                const barX = (x(datum.key) ?? 0) + (xSeries(item.key) ?? 0)
                const barY = y(value)

                return (
                  <rect
                    key={`${datum.key}-${item.key}`}
                    x={barX}
                    y={barY}
                    width={xSeries.bandwidth()}
                    height={Math.max(0, innerHeight - barY)}
                    rx={3}
                    fill={item.color}
                    stroke={item.stroke}
                    strokeWidth={item.stroke ? 1 : undefined}
                    className="outline-none transition-opacity hover:opacity-80 focus:opacity-80"
                    tabIndex={0}
                    aria-label={formatTooltip(datum, item, value)}
                    onPointerEnter={(event) => showTooltip(event, datum, item, value)}
                    onFocus={(event) => showTooltip(event, datum, item, value)}
                    onBlur={() => setTooltip(null)}
                  >
                    <title>{formatTooltip(datum, item, value)}</title>
                  </rect>
                )
              }),
            )}

            <text
              x={innerWidth / 2}
              y={innerHeight + 66}
              textAnchor="middle"
              fill="var(--color-muted)"
              fontSize="12"
            >
              {xAxisLabel}
            </text>
            <text
              transform={`translate(${-46},${innerHeight / 2}) rotate(-90)`}
              textAnchor="middle"
              fill="var(--color-muted)"
              fontSize="12"
            >
              {yAxisLabel}
            </text>
          </g>
        </svg>
      )}

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 max-w-52 -translate-x-1/2 -translate-y-full rounded-md border border-line-strong bg-canvas px-3 py-2 text-xs font-medium text-ink shadow-xl"
          style={{ left: tooltip.left, top: tooltip.top }}
          role="tooltip"
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
