// The PYN sync report as the app uses it. Mirrors PynSyncRunResponse in PynSyncController.cs
// (only the fields the sync button shows).
export interface PynSyncRun {
  succeeded: boolean
  eventsInserted: number
  eventsUpdated: number
  registrationsInserted: number
  registrationsUpdated: number
  registrationsEventNotFound: number
  registrationsEventAmbiguous: number
}

function count(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// One readable sentence for the sidebar, e.g. "2 new events, 40 new sign-ups, 3 updated."
// Sign-ups that could not be linked to exactly one event are mentioned, so nobody wonders
// why they are missing from the charts.
export function describeSyncRun(run: PynSyncRun): string {
  const added = run.eventsInserted + run.registrationsInserted
  const updated = run.eventsUpdated + run.registrationsUpdated
  const unmatched = run.registrationsEventNotFound + run.registrationsEventAmbiguous

  let text = added === 0 && updated === 0
    ? 'Everything was already up to date.'
    : `${count(run.eventsInserted, 'new event')}, ${count(run.registrationsInserted, 'new sign-up')}, ${updated} updated.`
  if (unmatched > 0) text += ` ${count(unmatched, 'sign-up')} could not be matched to an event.`
  return text
}
