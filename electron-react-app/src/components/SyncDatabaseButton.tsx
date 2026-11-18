import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { runPynSync } from '../api/sync'
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
  const [lastSynced, setLastSynced] = useState<string>()

  async function sync() {
    if (syncing.current) return
    syncing.current = true
    setStatus('syncing')
    try {
      // Step 1: import from PYN's database.
      try {
        const run = await runPynSync()
        if (!run.succeeded) throw new Error('The PYN sync failed.')
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 503) throw error
      }

      // Step 2: reload the open page. Throw on failure, so a partial refresh is never reported as done.
      await queryClient.invalidateQueries({ refetchType: 'active' }, { throwOnError: true })

      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      setStatus('success')
    } catch {
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
      <p role="status" aria-live="polite" className="mt-2 text-xs text-muted">
        {status === 'syncing' && 'Refreshing data…'}
        {status === 'success' && `Data refreshed at ${lastSynced}.`}
        {status === 'error' && 'Could not refresh all data. Check your connection and try again.'}
      </p>
    </div>
  )
}
