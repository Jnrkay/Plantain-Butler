// All AI calls go through /api/anthropic, which only answers signed-in users.
import { accessToken } from './supabase'

export async function callButler(body) {
  const token = await accessToken()
  if (!token) throw new Error('Please sign in again to use Butler.')
  const res = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 429) throw new Error(data.error || "You've reached today's Butler limit. It resets at midnight.")
  if (res.status === 401) throw new Error('Your session expired. Sign out and back in to keep using Butler.')
  if (!res.ok) throw new Error(data.error || `Butler error ${res.status}`)
  return data
}
