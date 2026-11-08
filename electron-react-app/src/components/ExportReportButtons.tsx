import { useState } from 'react'
import {
  getAttendanceByEvent,
  getDashboardOverview,
  getFilterOptions,
  getReturningParticipants,
  getSatisfactionDistribution,
} from '../api/dashboard'
import { REPORT_EXPORT_ROLES, hasRole } from '../auth/permissions'
import { buildReportSvg } from '../reports/impactReport'
import { buildReportCsv } from '../reports/reportCsv'
import { useAuthStore } from '../stores/authStore'
import { describeFilters, hasValidDateRange, useDashboardFilterStore } from '../stores/dashboardFilterStore'

type ReportFormat = 'svg' | 'pdf' | 'csv'

// Plain browser (no Electron): let the browser download the file.
function download(content: string, type: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

// FR-11 / #78: one click exports the impact report for the filters that are applied right now.
export default function ExportReportButtons() {
  const role = useAuthStore((state) => state.user?.role)
  const filters = useDashboardFilterStore((state) => state.filters)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null)

  // FR-12: the interface hides actions the role may not use.
  if (!hasRole(role, REPORT_EXPORT_ROLES)) return null

  async function handleExport(format: ReportFormat) {
    const saveReport = window.electronAPI?.saveReport
    if (format === 'pdf' && !saveReport) {
      setStatus({ text: 'PDF export only works in the desktop app.', error: true })
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      // The same requests and filters as the dashboard, so the report matches the screen.
      const [overview, satisfaction, attendance, returning, options] = await Promise.all([
        getDashboardOverview(filters),
        getSatisfactionDistribution(filters),
        getAttendanceByEvent(10, filters),
        getReturningParticipants(filters),
        getFilterOptions(),
      ])
      const now = new Date()
      const report = {
        generatedOn: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        filterSummary: describeFilters(filters, options),
        overview,
        satisfaction,
        attendance,
        returning,
      }
      // The CSV has the same numbers as a table; the PDF is made from the SVG.
      const content = format === 'csv' ? buildReportCsv(report) : buildReportSvg(report)
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const fileName = `impact-report-${date}.${format}`

      if (saveReport) {
        const result = await saveReport({ format, content, fileName })
        if (result.saved) setStatus({ text: `Saved to ${result.filePath}`, error: false })
      } else {
        download(content, format === 'csv' ? 'text/csv' : 'image/svg+xml', fileName)
      }
    } catch {
      setStatus({ text: 'Could not export the report. Please try again.', error: true })
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || !hasValidDateRange(filters)
  const buttonClass =
    'rounded-md border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent'

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex gap-3">
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => void handleExport('svg')}>
          Export SVG
        </button>
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => void handleExport('pdf')}>
          Export PDF
        </button>
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => void handleExport('csv')}>
          Export CSV
        </button>
      </div>
      {busy && <p className="text-xs text-stone-500">Preparing the report…</p>}
      {status && (
        <p role="status" className={`max-w-sm break-all text-xs sm:text-right ${status.error ? 'text-rose-700' : 'text-stone-500'}`}>
          {status.text}
        </p>
      )}
    </div>
  )
}
