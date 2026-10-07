export const config = {
  maxDuration: 60,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 55000)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const text = await response.text()

    let data
    try {
      data = JSON.parse(text)
    } catch {
      return res.status(502).json({ error: 'Invalid response from API', detail: text.slice(0, 200) })
    }

    return res.status(response.ok ? 200 : response.status).json(data)
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out — try a smaller image' })
    }
    return res.status(500).json({ error: 'Failed to reach Anthropic API', detail: err.message })
  }
}
