// TEMPORARY — creates one sign-in link for the owner's account without sending an email
// (the built-in email limit was hit). Guarded by a secret whose SHA-256 is below. Removed right after use.
import crypto from 'node:crypto'
const HASH = '302bafbfa64aa4dd5a86498859ec876cbcb3b0f84e7ec1f86dd7be011a48cab9'
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const k = String(req.query.k || '')
  const h = crypto.createHash('sha256').update(k).digest('hex')
  if (!k || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(HASH))) return res.status(404).end()
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const r = await fetch(base + '/auth/v1/admin/generate_link', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: 'beehyveworld@gmail.com', redirect_to: 'https://plantain-butler.vercel.app' }),
  })
  const j = await r.json().catch(() => ({}))
  res.status(r.ok ? 200 : 502).json({ link: j.action_link || j.properties?.action_link || null, code: j.email_otp || j.properties?.email_otp || null, error: r.ok ? null : (j.msg || j.message || r.status) })
}
