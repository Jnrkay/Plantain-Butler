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
    const q = async (sql) => (await client.query(sql)).rows
    const cols = { inventory_items: [], transactions: [], households: [] }
    for (const t of Object.keys(cols)) cols[t] = (await q(`select column_name from information_schema.columns where table_schema='public' and table_name='${t}' order by ordinal_position`)).map((r) => r.column_name)
    const fns = (await q(`select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`)).map((r) => r.proname)
    const tables = (await q(`select tablename, rowsecurity from pg_tables where schemaname='public' order by 1`))
    await client.query(`notify pgrst, 'reload schema'`)
    res.status(200).json({ applied: true, cols, fns, tables })
  } catch (e) { res.status(500).json({ error: String(e.message).slice(0, 200) }) } finally { await client.end().catch(() => {}) }
}
