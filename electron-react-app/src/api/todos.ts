import { api } from './client'

export interface Todo {
  id: number
  title: string
  isComplete: boolean
  createdAt: string
}

export async function getTodos(): Promise<Todo[]> {
  const { data } = await api.get<Todo[]>('/api/todos')
  return data
}
