import assert from 'node:assert/strict'
import test from 'node:test'
import { describeSyncRun, type PynSyncRun } from '../src/api/syncSummary.ts'

const run = (changes: Partial<PynSyncRun>): PynSyncRun => ({
  succeeded: true, eventsInserted: 0, eventsUpdated: 0, registrationsInserted: 0,
  registrationsUpdated: 0, registrationsEventNotFound: 0, registrationsEventAmbiguous: 0, ...changes,
})

test('a sync with new data says what was added and updated', () => {
  assert.equal(
    describeSyncRun(run({ eventsInserted: 2, registrationsInserted: 40, eventsUpdated: 1, registrationsUpdated: 2 })),
    '2 new events, 40 new sign-ups, 3 updated.')
})

test('one of something is not written as a plural', () => {
  assert.equal(describeSyncRun(run({ eventsInserted: 1, registrationsInserted: 1 })), '1 new event, 1 new sign-up, 0 updated.')
})

test('a sync without changes says everything is up to date', () => {
  assert.equal(describeSyncRun(run({})), 'Everything was already up to date.')
})

test('sign-ups that match no event or several events are mentioned', () => {
  assert.equal(
    describeSyncRun(run({ registrationsInserted: 5, registrationsEventNotFound: 2, registrationsEventAmbiguous: 1 })),
    '0 new events, 5 new sign-ups, 0 updated. 3 sign-ups could not be matched to an event.')
})
