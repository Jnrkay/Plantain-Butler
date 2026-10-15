// Server-side proxy to the Anthropic API.
// - Only signed-in household members can use it (Supabase access token required).
// - Each user gets a daily allowance (counted in the database).
// - The model and output size are fixed here, so the client can't choose a pricier model.
import { SUPABASE_URL as PUBLIC_URL, SUPABASE_ANON_KEY as PUBLIC_KEY } from '../src/lib/supabaseConfig.js'

export const config = { maxDuration: 60 }

const MODEL = 'claude-sonnet-5-5'
const MAX_OUTPUT_TOKENS = 2048
const DAILY_LIMIT = Number(process.env.BUTLER_DAILY_LIMIT) || 60

const SUPABASE_URL = (process.env.SUPABASE_URL || PUBLIC_URL).replace(/\/$/, '')
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || PUBLIC_KEY

async function verifyUser(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  const u = await r.json()
  return u?.id ? u : null
}

async function countRequest(token) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bump_ai_usage`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!r.ok) throw new Error(`usage check failed (${r.status})`)
  return Number(await r.json())
}

function cleanBody(b) {
  if (!b || typeof b !== 'object' || !Array.isArray(b.messages) || !b.messages.length) return null
  const messages = b.messages.slice(-30).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
  if (!messages.length || messages[0].role !== 'user') {
    while (messages.length && messages[0].role !== 'user') messages.shift()
    if (!messages.length) return null
  }
  const out = {
    model: MODEL,
    max_tokens: Math.min(Math.max(Number(b.max_tokens) || 1024, 64), MAX_OUTPUT_TOKENS),
    messages,
  }
  if (typeof b.system === 'string') out.system = b.system.slice(0, 30000)
  return out
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' })

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sign in to use Butler.' })

  try {
    const user = await verifyUser(token)
    if (!user) return res.status(401).json({ error: 'Your session expired. Sign in again.' })

    const used = await countRequest(token)
    if (used > DAILY_LIMIT) {
      return res.status(429).json({ error: `You've used today's ${DAILY_LIMIT} Butler requests. It resets at midnight (UTC).` })
    }
  } catch (err) {
    return res.status(503).json({ error: 'Could not verify your account. Try again in a moment.', detail: String(err.message).slice(0, 120) })
  }

  const body = cleanBody(req.body)
  if (!body) return res.status(400).json({ error: 'Invalid request' })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 55000)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { return res.status(502).json({ error: 'Invalid response from API', detail: text.slice(0, 200) }) }
    if (!response.ok) {
      const msg = data?.error?.message || ''
      if (/usage limits/i.test(msg)) return res.status(503).json({ error: 'Butler has hit its monthly spending cap. Raise it in the Claude Console to continue.' })
      return res.status(response.status).json({ error: msg || `API error ${response.status}` })
    }
    return res.status(200).json(data)
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({ error: 'Request timed out — try a smaller image' })
    return res.status(500).json({ error: 'Failed to reach Anthropic API', detail: err.message })
  }
}
