import axios from 'axios'

export interface Todo {
  id: number
  title: string
  isComplete: boolean
  createdAt: string
}

// Set VITE_API_URL when the packaged desktop app should use a deployed API.
// In development, the Vite proxy forwards this relative URL to localhost:5000.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
})

export async function getTodos(): Promise<Todo[]> {
  const { data } = await api.get<Todo[]>('/api/todos')
  return data
}
