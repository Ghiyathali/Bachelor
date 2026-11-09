import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
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
import Icon from './Icon'

type ReportFormat = 'svg' | 'pdf' | 'csv'

const FORMATS: { format: ReportFormat; label: string; hint: string }[] = [
  { format: 'pdf', label: 'PDF', hint: 'For funders' },
  { format: 'svg', label: 'SVG', hint: 'Image' },
  { format: 'csv', label: 'CSV', hint: 'For Excel' },
]

interface Toast {
  error: boolean
  text: string
  filePath?: string
}

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
// #80: one "Export report" button with a small menu, and a toast message after saving.
export default function ExportReportButtons() {
  const role = useAuthStore((state) => state.user?.role)
  const filters = useDashboardFilterStore((state) => state.filters)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  // Close the menu when clicking anywhere else.
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    menu.current?.querySelector('button')?.focus() // keyboard users start on the first option
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // The toast disappears by itself after a few seconds.
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(timer)
  }, [toast])

  // FR-12: the interface hides actions the role may not use.
  if (!hasRole(role, REPORT_EXPORT_ROLES)) return null

  function handleMenuKeys(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(menu.current?.querySelectorAll('button') ?? [])]
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') {
      setOpen(false)
      button.current?.focus()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      items[(index + step + items.length) % items.length]?.focus()
    }
  }

  async function handleExport(format: ReportFormat) {
    setOpen(false)
    const saveReport = window.electronAPI?.saveReport
    if (format === 'pdf' && !saveReport) {
      setToast({ error: true, text: 'PDF export only works in the desktop app.' })
      return
    }
    setBusy(true)
    setToast(null)
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
        // Cancelled in the save dialog: nothing happened, so no message.
        if (result.saved) setToast({ error: false, text: `${format.toUpperCase()} report saved`, filePath: result.filePath })
      } else {
        download(content, format === 'csv' ? 'text/csv' : 'image/svg+xml', fileName)
      }
    } catch {
      setToast({ error: true, text: "Couldn't export the report. Try again." })
    } finally {
      setBusy(false)
    }
  }

  const invalidRange = !hasValidDateRange(filters)
  const showInFolder = window.electronAPI?.showInFolder

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={button}
        type="button"
        disabled={busy || invalidRange}
        title={invalidRange ? 'Fix the date range first' : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        <Icon name="download" className="h-4 w-4" />
        {busy ? 'Preparing…' : 'Export report'}
        <Icon name="chevronDown" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label="Export format"
          onKeyDown={handleMenuKeys}
          className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          {FORMATS.map((item) => (
            <button
              key={item.format}
              type="button"
              role="menuitem"
              onClick={() => void handleExport(item.format)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink hover:bg-hover focus-visible:bg-hover"
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-xs text-muted">{item.hint}</span>
            </button>
          ))}
        </div>
      )}

      {toast && (
        <div
          role={toast.error ? 'alert' : 'status'}
          className={`fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ${
            toast.error ? 'border border-danger-line bg-danger-soft text-danger' : 'bg-ink text-canvas'
          }`}
        >
          <Icon name={toast.error ? 'alert' : 'circleCheck'} className="h-5 w-5" />
          <span className="font-medium">{toast.text}</span>
          {toast.filePath && showInFolder && (
            <button type="button" onClick={() => void showInFolder(toast.filePath!)}
              className="whitespace-nowrap font-medium text-brand-soft underline-offset-2 hover:underline">
              Show in folder
            </button>
          )}
          <button type="button" aria-label="Close message" onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
