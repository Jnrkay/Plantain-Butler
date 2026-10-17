// All AI calls go through /api/anthropic, which only answers signed-in users.
import { accessToken } from './supabase'

export async function callButler(body) {
  const token = await accessToken()
  if (!token) throw new Error('Please sign in again to use Butler.')
  let res
  try {
    res = await fetch('/api/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("Couldn't reach Butler — check your connection and try again.")
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 429) throw new Error(data.error || "You've reached today's Butler limit. It resets at midnight.")
  if (res.status === 401) throw new Error('Your session expired. Sign out and back in to keep using Butler.')
  if (res.status === 413) throw new Error('That was too big to send. Try a smaller photo.')
  if (!res.ok) throw new Error(data.error || `Butler error ${res.status}`)
  return data
}

export const textOf = (data) => (data?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()

const parseJson = (text, open = '[', close = ']') => {
  const t = String(text || '').replace(/```(?:json)?/gi, '')
  return JSON.parse(t.slice(t.indexOf(open), t.lastIndexOf(close) + 1))
}

// Sort product names into a brand and a generic product type.
export async function classifyNames(names) {
  const data = await callButler({
    max_tokens: 2048,
    system: `You sort grocery and household product names (from shops in Ghana) into a BRAND and a generic PRODUCT TYPE.
Return ONLY a JSON array, one object per input name, in the same order: [{"name":"<exactly as given>","brand":"Brand or empty string","type":"Generic type"}]
Rules for "type": short, plural where natural, Title Case, the thing a shopper would replace with any brand — e.g. "Water", "Paper towels", "Toilet roll", "Rice", "Cooking oil", "Chocolate drink", "Milk", "Tomato paste", "Detergent", "Soap", "Tinned fish", "Noodles". Size, flavour and pack count are NOT part of the type. Use the same type for the same kind of thing across different brands.
"brand" is the manufacturer/brand if the name contains one (e.g. "Voltic", "Bounty", "Frytol"), else "".`,
    messages: [{ role: 'user', content: names.map((n, i) => `${i + 1}. ${n}`).join('\n') }],
  })
  const arr = parseJson(textOf(data))
  return Array.isArray(arr) ? arr.filter((x) => x && x.name && x.type) : []
}

export { parseJson }
