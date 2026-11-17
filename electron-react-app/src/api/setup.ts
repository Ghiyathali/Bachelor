import { api } from './client'
import type { LoginResponse } from './auth'

// First start on a new database: is there an Admin yet? (SetupController.cs)
export async function getSetupStatus(): Promise<{ needsFirstAdmin: boolean }> {
  return (await api.get<{ needsFirstAdmin: boolean }>('/api/setup/status')).data
}

// Creates the first Admin and logs them straight in. Refused (409) once any Admin exists.
export async function createFirstAdmin(body: { username: string; email: string; password: string }): Promise<LoginResponse> {
  return (await api.post<LoginResponse>('/api/setup/first-admin', body)).data
}
