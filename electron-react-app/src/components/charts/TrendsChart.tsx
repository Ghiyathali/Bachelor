import { axisBottom, axisLeft, axisRight, extent, format, line, max, scaleLinear, scaleUtc, select, utcFormat, utcMonth } from 'd3'
import { useEffect, useId, useMemo, useRef } from 'react'
import type { TrendPoint, Trends } from '../../api/dashboard'
import { useElementSize } from '../../hooks/useElementSize'

export function periodLabel(date: Date, interval: Trends['interval']) {
  if (interval === 'month') return utcFormat('%b %Y')(date)
  const month = date.getUTCMonth()
  const year = date.getUTCFullYear()
  return month === 11 ? `Winter ${year}/${year + 1}`
    : `${month === 2 ? 'Spring' : month === 5 ? 'Summer' : 'Autumn'} ${year}`
}

export default function TrendsChart({ data }: { data: Trends }) {
  const { ref, width } = useElementSize<HTMLDivElement>()
  const xAxis = useRef<SVGGElement>(null)
  const leftAxis = useRef<SVGGElement>(null)
  const rightAxis = useRef<SVGGElement>(null)
  const titleId = useId()
  // Reserve separate rows for tick labels, both gap markers, and the axis caption.
  const height = 375
  const margin = { top: 30, right: 65, bottom: 90, left: 55 }
  const chartWidth = Math.max(width, 320)
  const innerWidth = chartWidth - margin.left - margin.right
  const bottom = height - margin.bottom
  const points = useMemo(() => data.periods.map(p => ({ ...p, date: new Date(`${p.periodStart}T00:00:00Z`) })), [data])
  const x = useMemo(() => {
    const [first, last] = extent(points, p => p.date)
    return scaleUtc().domain([
      utcMonth.offset(first ?? new Date(), -1),
      utcMonth.offset(last ?? new Date(), 1),
    ]).range([margin.left, chartWidth - margin.right])
  }, [points, chartWidth])
  const satisfaction = useMemo(() => scaleLinear().domain([1, 5]).range([bottom, margin.top]), [bottom])
  const participants = useMemo(() => scaleLinear().domain([0, Math.max(1, max(points, p => p.participants ?? 0) ?? 0)])
    .nice().range([bottom, margin.top]), [points, bottom])

  useEffect(() => {
    if (!xAxis.current || !leftAxis.current || !rightAxis.current) return
    const stride = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(innerWidth / 125))))
    select(xAxis.current).call(axisBottom(x)
      .tickValues(points.filter((_, i) => i % stride === 0).map(p => p.date))
      .tickFormat(value => periodLabel(new Date(+value), data.interval)).tickSizeOuter(0))
    select(leftAxis.current).call(axisLeft(satisfaction).ticks(5).tickFormat(format('d')))
    select(rightAxis.current).call(axisRight(participants).ticks(Math.min(5, participants.domain()[1])).tickFormat(format('d')))
    for (const axis of [xAxis.current, leftAxis.current, rightAxis.current]) {
      select(axis).selectAll('path, line').attr('stroke', '#475569')
      select(axis).selectAll('text').attr('fill', '#cbd5e1').attr('font-size', 11)
    }
  }, [x, satisfaction, participants, points, innerWidth, data.interval])

  type Point = TrendPoint & { date: Date }
  const satisfactionLine = line<Point>().defined(p => p.averageSatisfaction !== null)
    .x(p => x(p.date)).y(p => satisfaction(p.averageSatisfaction!))
  const participantLine = line<Point>().defined(p => p.participants !== null)
    .x(p => x(p.date)).y(p => participants(p.participants!))
  const describe = (p: Point) => `${periodLabel(p.date, data.interval)}: ${p.eventCount} events; satisfaction ${p.averageSatisfaction?.toFixed(2) ?? 'no data'} (${p.feedbackResponses} responses); participants ${p.participants ?? 'no data'}`

  return (
    <div ref={ref} className="w-full">
      <div className="flex flex-wrap gap-4 text-xs text-slate-300">
        <span className="flex items-center gap-2"><span className="h-2 w-5 bg-sky-400" />Satisfaction · left axis (1–5)</span>
        <span className="flex items-center gap-2"><span className="h-2 w-5 bg-emerald-400" />Participants · right axis</span>
        <span>× Missing data · lines break at gaps</span>
      </div>
      {width > 0 && <svg className="block w-full" viewBox={`0 0 ${chartWidth} ${height}`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>Satisfaction and accepted participants over time, grouped by {data.interval}. Gaps indicate missing data.</title>
        {[1, 2, 3, 4, 5].map(value => <line key={value} x1={margin.left} x2={chartWidth - margin.right} y1={satisfaction(value)} y2={satisfaction(value)} stroke="#1e293b" />)}
        <g ref={xAxis} transform={`translate(0,${bottom})`} />
        <g ref={leftAxis} transform={`translate(${margin.left},0)`} />
        <g ref={rightAxis} transform={`translate(${chartWidth - margin.right},0)`} />
        <text x={margin.left} y={16} fill="#38bdf8" fontSize={12}>Satisfaction</text>
        <text x={chartWidth - margin.right} y={16} textAnchor="end" fill="#34d399" fontSize={12}>Participants</text>
        <text x={chartWidth / 2} y={height - 12} textAnchor="middle" fill="#94a3b8" fontSize={12}>Event start · UTC</text>
        <path d={satisfactionLine(points) ?? ''} fill="none" stroke="#38bdf8" strokeWidth={2} />
        <path d={participantLine(points) ?? ''} fill="none" stroke="#34d399" strokeWidth={2} />
        {points.map(p => <g key={p.periodStart} tabIndex={0} aria-label={describe(p)}>
          <title>{describe(p)}</title>
          <rect x={x(p.date) - 8} y={margin.top} width={16} height={bottom - margin.top} fill="transparent" />
          {p.averageSatisfaction !== null
            ? <circle cx={x(p.date)} cy={satisfaction(p.averageSatisfaction)} r={4} fill="#38bdf8" />
            : <text x={x(p.date)} y={bottom + 36} textAnchor="middle" fill="#38bdf8" fontSize={15}>×</text>}
          {p.participants !== null
            ? <circle cx={x(p.date)} cy={participants(p.participants)} r={4} fill="#34d399" />
            : <text x={x(p.date)} y={bottom + 49} textAnchor="middle" fill="#34d399" fontSize={15}>×</text>}
        </g>)}
      </svg>}
      <details className="mt-2 text-sm text-slate-400">
        <summary className="cursor-pointer">View trend values</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Values and missing data for each period</caption>
            <thead><tr>{['Period', 'Events', 'Satisfaction', 'Responses', 'Participants'].map(label => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
            <tbody>{points.map(p => <tr key={p.periodStart} className="border-t border-slate-800">
              <th scope="row" className="p-2">{periodLabel(p.date, data.interval)}</th>
              <td className="p-2">{p.eventCount}</td><td className="p-2">{p.averageSatisfaction?.toFixed(2) ?? 'No data'}</td>
              <td className="p-2">{p.feedbackResponses}</td><td className="p-2">{p.participants ?? 'No data'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
