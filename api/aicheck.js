// TEMPORARY — checks the server can reach the Anthropic API. Reports status only. Removed right after use.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.query.k !== '9b86011c0b131137') return res.status(404).end()
  const key = process.env.ANTHROPIC_API_KEY
  const out = { keyPresent: !!key, keyPrefix: key ? key.slice(0, 7) : null }
  for (const model of ['claude-sonnet-5-5', 'claude-haiku-5-5']) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key || '', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: 'Say ok' }] }) })
      const d = await r.json().catch(() => ({}))
      out[model] = { status: r.status, error: d?.error ? (d.error.type + ': ' + String(d.error.message).slice(0, 160)) : null, text: d?.content?.[0]?.text || null }
    } catch (e) { out[model] = { fetchError: String(e.message).slice(0, 120) } }
  }
  res.status(200).json(out)
}
