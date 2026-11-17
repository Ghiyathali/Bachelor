import { api } from './client'

// "Forgot password?" on the login page: asks for a new password. It only takes effect after
// an Admin approves it (PasswordRequestsController.cs). Same answer whether the account exists or not.
export async function requestPasswordReset(identifier: string, newPassword: string): Promise<string> {
  const { data } = await api.post<{ message: string }>('/api/auth/forgot-password', { identifier, newPassword })
  return data.message
}

export interface PasswordRequest {
  id: number
  accountId: number
  username: string
  email: string
  requestedAt: string
}

// The Admin's notification bell.
export async function listPasswordRequests(): Promise<PasswordRequest[]> {
  return (await api.get<PasswordRequest[]>('/api/admin/password-requests')).data
}

export async function approvePasswordRequest(id: number): Promise<void> {
  await api.post(`/api/admin/password-requests/${id}/approve`)
}

export async function declinePasswordRequest(id: number): Promise<void> {
  await api.post(`/api/admin/password-requests/${id}/decline`)
}
