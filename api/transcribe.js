// Speech-to-text for Butler voice notes and audio/video attachments.
// - Only signed-in users (Supabase access token), counted against the same daily allowance.
// - The browser sends short 16 kHz mono WAV chunks (≤ ~60 s each), base64 in JSON.
// - Works with any OpenAI-compatible transcription API. Configure in Vercel:
//     TRANSCRIBE_API_KEY   (or OPENAI_API_KEY)
//     TRANSCRIBE_BASE_URL  default https://api.openai.com/v1   (Groq: https://api.groq.com/openai/v1)
//     TRANSCRIBE_MODEL     default gpt-4o-mini-transcribe       (Groq: whisper-large-v3-turbo)
import { SUPABASE_URL as PUBLIC_URL, SUPABASE_ANON_KEY as PUBLIC_KEY } from '../src/lib/supabaseConfig.js'

export const config = { maxDuration: 60 }

const SUPABASE_URL = (process.env.SUPABASE_URL || PUBLIC_URL).replace(/\/$/, '')
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || PUBLIC_KEY
const DAILY_LIMIT = Number(process.env.BUTLER_DAILY_LIMIT) || 100
const KEY = process.env.TRANSCRIBE_API_KEY || process.env.OPENAI_API_KEY || ''
const BASE = (process.env.TRANSCRIBE_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
const MODEL = process.env.TRANSCRIBE_MODEL || (BASE.includes('groq') ? 'whisper-large-v3-turbo' : 'gpt-4o-mini-transcribe')
const MAX_BYTES = 3.2 * 1024 * 1024
// Helps the model with local words it would otherwise mishear
const HINT = 'A household in Ghana talking about groceries and shopping: gari, kenkey, Milo, Voltic, Frytol, Ideal milk, Golden Penny, Indomie, Bel-Aqua, plantain, kontomire, shito, cedis, GHS, Adez Mart, Melcom, Shoprite, Makola.'

async function verifyUser(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  const u = await r.json()
  return u?.id ? u : null
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sign in to use voice notes.' })
  const user = await verifyUser(token).catch(() => null)
  if (!user) return res.status(401).json({ error: 'Your session expired. Sign in again.' })

  // The app asks this once to know whether to offer voice notes
  if (req.method === 'GET') return res.status(200).json({ configured: !!KEY })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!KEY) return res.status(501).json({ error: 'Voice notes aren’t switched on yet — a transcription key needs adding to the app’s settings.' })

  const b64 = String(req.body?.audio || '')
  const mime = /^audio\/(wav|x-wav|mp4|m4a|mpeg|webm|ogg)$/.test(req.body?.mime || '') ? req.body.mime : 'audio/wav'
  if (!b64) return res.status(400).json({ error: 'No audio received.' })
  const bytes = Buffer.from(b64, 'base64')
  if (bytes.length > MAX_BYTES) return res.status(413).json({ error: 'That clip is too long. Keep voice notes under 2 minutes.' })

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bump_ai_usage`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
    })
    if (r.ok && Number(await r.json()) > DAILY_LIMIT) return res.status(429).json({ error: `You've used today's ${DAILY_LIMIT} Butler requests. It resets at midnight (UTC).` })
  } catch { /* don't block transcription on the counter */ }

  try {
    const form = new FormData()
    const ext = { 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/m4a': 'm4a', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/ogg': 'ogg' }[mime]
    form.append('file', new Blob([bytes], { type: mime }), `clip.${ext}`)
    form.append('model', MODEL)
    form.append('prompt', HINT)
    form.append('response_format', 'json')
    const r = await fetch(`${BASE}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: form })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(502).json({ error: d?.error?.message ? `Transcription failed: ${String(d.error.message).slice(0, 160)}` : `Transcription failed (${r.status})` })
    return res.status(200).json({ text: String(d.text || '').trim() })
  } catch (e) {
    return res.status(502).json({ error: 'Couldn’t reach the transcription service. Try again.', detail: String(e.message).slice(0, 120) })
  }
}
