import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { getErrorMessage } from '../api/client'
import { runPynSync } from '../api/sync'
import { describeSyncRun } from '../api/syncSummary'
import Icon from './Icon'

// "Sync database" in the sidebar (Admin, Event Manager, Marketing Manager). Two steps:
// 1. Import: POST /api/admin/pyn-sync copies new events and sign-ups from PYN's database into
//    the app's tables. Without it, new sign-ups on PYN's website never reach the dashboard,
//    because every chart only reads the app's tables.
// 2. Refresh: reload the open page's data, so the imported data shows straight away
//    (other pages reload when they are opened).
// When no PYN database is configured (503), only step 2 runs.
export default function SyncDatabaseButton() {
  const queryClient = useQueryClient()
  const syncing = useRef(false)
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function sync() {
    if (syncing.current) return
    syncing.current = true
    setStatus('syncing')
    try {
      // Step 1: import from PYN's database.
      let imported: string | null = null
      try {
        const run = await runPynSync()
        if (!run.succeeded) throw new Error('The sync failed. Check the PYN database connection and try again.')
        imported = describeSyncRun(run)
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 503) throw error
      }

      // Step 2: reload the open page. Throw on failure, so a partial refresh is never reported as done.
      await queryClient.invalidateQueries({ refetchType: 'active' }, { throwOnError: true })

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setMessage(imported === null
        ? `Data refreshed at ${time}. No PYN database is configured, so nothing was imported.`
        : `Synced at ${time}. ${imported}`)
      setStatus('success')
    } catch (error) {
      // Our own message for a failed run; the API's message otherwise (e.g. 409 "already running").
      setMessage(error instanceof Error && !axios.isAxiosError(error) ? error.message : getErrorMessage(error))
      setStatus('error')
    } finally {
      syncing.current = false
    }
  }

  return (
    <div className="mb-4">
      <button type="button" onClick={() => void sync()} disabled={status === 'syncing'}
        className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs font-medium text-body hover:bg-hover disabled:cursor-wait disabled:opacity-60"
        aria-busy={status === 'syncing'}>
        <Icon name="refresh" className={`h-4 w-4 ${status === 'syncing' ? 'motion-safe:animate-spin' : ''}`} />
        {status === 'syncing' ? 'Syncing…' : 'Sync database'}
      </button>
      <p role="status" aria-live="polite" className={`mt-2 text-xs ${status === 'error' ? 'text-danger' : 'text-muted'}`}>
        {status === 'syncing' ? 'Importing new data from PYN…' : message}
      </p>
    </div>
  )
}
