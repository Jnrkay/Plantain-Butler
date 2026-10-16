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
    const cols = (await client.query(`select column_name from information_schema.columns where table_schema='public' and table_name='inventory_items' order by ordinal_position`)).rows.map((r) => r.column_name)
    await client.query(`notify pgrst, 'reload schema'`)
    res.status(200).json({ applied: true, inventoryColumns: cols })
  } catch (e) { res.status(500).json({ error: String(e.message).slice(0, 200) }) } finally { await client.end().catch(() => {}) }
}
