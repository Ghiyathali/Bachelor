import axios from 'axios'

// Set VITE_API_URL when the packaged desktop app should use a deployed API.
// In development, the Vite proxy forwards this relative URL to localhost:5000.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
})

export async function getTodos() {
  const { data } = await api.get('/api/todos')
  return data
}
