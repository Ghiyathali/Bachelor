import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Icon from './Icon'

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
      // Refresh mounted queries now; other cached pages reload when opened.
      // Throw on failure so a partial refresh is never reported as successful.
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
