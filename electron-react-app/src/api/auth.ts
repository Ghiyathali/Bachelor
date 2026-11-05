import { api } from './client'

// These types mirror the C# records in AuthController.cs (ASP.NET sends camelCase JSON).
export interface RegisterRequest {
  email: string
  username: string
  password: string
  role?: string
}

export interface RegisterResponse {
  id: number
  username: string
  email: string
  role: string
}

export interface LoginRequest {
  identifier: string // username OR email
  password: string
}

export interface LoginResponse {
  token: string
  expiresAt: string
  username: string
  email: string
  role: string
}

export async function register(body: RegisterRequest): Promise<RegisterResponse> {
  const { data } = await api.post<RegisterResponse>('/api/auth/register', body)
  return data
}

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/login', body)
  return data
}

export interface Account {
  id: number
  username: string
  email: string
  role: string
  isActive: boolean
}

export async function listAccounts(): Promise<Account[]> {
  return (await api.get<Account[]>('/api/admin/accounts')).data
}

export async function updateAccount(id: number, role: string, isActive: boolean): Promise<Account> {
  return (await api.put<Account>(`/api/admin/accounts/${id}`, { role, isActive })).data
}
