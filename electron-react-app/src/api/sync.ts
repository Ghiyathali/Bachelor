import { api } from './client'
import type { PynSyncRun } from './syncSummary'

// Copies new events and sign-ups from PYN's database into the app's tables (PynSyncService).
// 409 = a sync is already running, 503 = no PYN database is configured.
export async function runPynSync(): Promise<PynSyncRun> {
  const { data } = await api.post<PynSyncRun>('/api/admin/pyn-sync')
  return data
}
