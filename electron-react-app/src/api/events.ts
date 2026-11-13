import { api } from './client'

// Walk-ins: people who came without signing up, one number per event (Admin and Event Manager).
// Mirrors EventWalkIns in WalkInsController.cs.
export interface EventWalkIns {
  eventId: number
  name: string
  startsAt: string
  walkIns: number
}

export { MAX_WALK_INS, parseWalkIns } from './walkInInput'

export async function getWalkIns(): Promise<EventWalkIns[]> {
  const { data } = await api.get<EventWalkIns[]>('/api/events/walk-ins')
  return data
}

export async function setWalkIns(eventId: number, walkIns: number): Promise<EventWalkIns> {
  const { data } = await api.patch<EventWalkIns>(`/api/events/${eventId}/walk-ins`, { walkIns })
  return data
}
