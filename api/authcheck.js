// TEMPORARY — sign-in event types and times only (no tokens, links or emails). Removed right after use.
import pg from 'pg'
export default async function handler(req, res) {
  const client = new pg.Client({ connectionString: (process.env.POSTGRES_URL_NON_POOLING || '').replace(/[?&]sslmode=[^&]*/, ''), ssl: { rejectUnauthorized: false } })
  const out = {}
  try {
    await client.connect()
    out.events = (await client.query(`select created_at, payload->>'action' as action, payload->'traits'->>'provider' as provider
      from auth.audit_log_entries where created_at > now() - interval '3 hours' order by created_at`)).rows
    out.users = (await client.query(`select created_at, email_confirmed_at is not null as confirmed, last_sign_in_at, (encrypted_password <> '') as has_password, raw_app_meta_data->'providers' as providers from auth.users`)).rows
    try {
      out.pendingTokens = (await client.query(`select token_type, created_at from auth.one_time_tokens order by created_at`)).rows
    } catch (e) { out.pendingTokens = 'n/a' }
    out.sessions = (await client.query(`select created_at, updated_at, user_agent from auth.sessions order by created_at`)).rows
      .map((s) => ({ ...s, user_agent: String(s.user_agent || '').replace(/\(([^)]*)\)/, (m, g) => '(' + g.split(';')[0] + ')').slice(0, 90) }))
  } catch (e) { out.error = String(e.message).slice(0, 200) } finally { await client.end().catch(() => {}) }
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json(out)
}
