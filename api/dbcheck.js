// TEMPORARY — row counts only, no contents. Removed right after use.
import pg from 'pg'
export default async function handler(req, res) {
  const client = new pg.Client({ connectionString: (process.env.POSTGRES_URL_NON_POOLING || '').replace(/[?&]sslmode=[^&]*/, ''), ssl: { rejectUnauthorized: false } })
  const out = {}
  try {
    await client.connect()
    for (const t of ['households', 'household_members', 'inventory_items', 'transactions', 'shopping_items', 'ai_usage']) {
      out[t] = (await client.query(`select count(*)::int as n from public.${t}`)).rows[0].n
    }
    out.profileOnboarded = (await client.query(`select count(*)::int as n from public.households where (profile->>'onboarded')::boolean`)).rows[0].n
    out.lastWrite = (await client.query(`select greatest((select max(updated_at) from public.inventory_items),(select max(updated_at) from public.shopping_items),(select max(updated_at) from public.transactions),(select max(updated_at) from public.households)) as t`)).rows[0].t
  } catch (e) { out.error = String(e.message).slice(0, 200) } finally { await client.end().catch(() => {}) }
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json(out)
}
