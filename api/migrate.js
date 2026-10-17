// TEMPORARY — re-applies supabase/schema.sql (idempotent). Removed right after use.
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
export const config = { maxDuration: 60 }
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.query.apply !== '1') return res.status(404).end()
  const client = new pg.Client({ connectionString: (process.env.POSTGRES_URL_NON_POOLING || '').replace(/[?&]sslmode=[^&]*/, ''), ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query(fs.readFileSync(path.join(process.cwd(), 'supabase', 'schema.sql'), 'utf8'))
    const tables = (await client.query(`select tablename, rowsecurity from pg_tables where schemaname='public' order by 1`)).rows
    const policies = (await client.query(`select tablename, policyname from pg_policies where schemaname='public' and tablename like 'butler_%' order by 1,2`)).rows
    await client.query(`notify pgrst, 'reload schema'`)
    res.status(200).json({ applied: true, tables, policies })
  } catch (e) { res.status(500).json({ error: String(e.message).slice(0, 200) }) } finally { await client.end().catch(() => {}) }
}
