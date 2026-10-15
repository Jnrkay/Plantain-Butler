// TEMPORARY — applies supabase/schema.sql (idempotent) and runs a row-level-security
// self-test inside a transaction that is always rolled back. Removed after use.
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  const conn = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
  if (!conn) return res.status(500).json({ error: 'no database url' })
  const client = new pg.Client({ connectionString: conn.replace(/[?&]sslmode=[^&]*/, ''), ssl: { rejectUnauthorized: false } })
  const out = { schema: null, tests: {} }
  try {
    await client.connect()
    if (req.query.apply === '1') {
      const sql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'schema.sql'), 'utf8')
      await client.query(sql)
      out.schema = 'applied'
    }

    const t = out.tests
    const expectFail = async (name, q, params) => {
      await client.query('savepoint sp')
      try { await client.query(q, params); t[name] = 'FAIL (was allowed)' } catch (e) { t[name] = `ok (blocked: ${e.code})` }
      await client.query('rollback to savepoint sp')
    }
    const as = async (uid) => {
      await client.query('reset role')
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })])
      await client.query('set local role authenticated')
    }

    await client.query('begin')
    const a = '00000000-0000-4000-8000-0000000000a1'
    const b = '00000000-0000-4000-8000-0000000000b2'
    for (const [id, email] of [[a, 'rls-a@test.invalid'], [b, 'rls-b@test.invalid']]) {
      await client.query(`insert into auth.users (id, email, aud, role, instance_id) values ($1, $2, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')`, [id, email])
    }

    await as(a)
    const ha = (await client.query('select public.ensure_household() as h')).rows[0].h
    const ha2 = (await client.query('select public.ensure_household() as h')).rows[0].h
    t.ensureHouseholdStable = ha === ha2 ? 'ok' : 'FAIL'
    await client.query(`insert into inventory_items (id, household_id, name, qty) values ('t-inv-a', $1, 'Milo', 2)`, [ha])
    await client.query(`insert into transactions (id, household_id, item, qty, price) values ('t-tx-a', $1, 'Milo', 1, 70)`, [ha])
    await client.query(`update households set profile = '{"name":"A"}' where id = $1`, [ha])
    t.ownerCanReadOwn = (await client.query('select count(*)::int as n from inventory_items')).rows[0].n === 1 ? 'ok' : 'FAIL'

    await as(b)
    const hb = (await client.query('select public.ensure_household() as h')).rows[0].h
    t.separateHouseholds = hb !== ha ? 'ok' : 'FAIL'
    t.otherUserCannotSeeItems = (await client.query('select count(*)::int as n from inventory_items')).rows[0].n === 0 ? 'ok' : 'FAIL'
    t.otherUserCannotSeeTransactions = (await client.query('select count(*)::int as n from transactions')).rows[0].n === 0 ? 'ok' : 'FAIL'
    t.otherUserCannotSeeHousehold = (await client.query('select count(*)::int as n from households where id = $1', [ha])).rows[0].n === 0 ? 'ok' : 'FAIL'
    await expectFail('otherUserCannotInsertIntoTheirs', `insert into inventory_items (id, household_id, name) values ('t-x', $1, 'x')`, [ha])
    const upd = await client.query(`update inventory_items set qty = 99 where id = 't-inv-a'`)
    t.otherUserCannotUpdateTheirs = upd.rowCount === 0 ? 'ok' : 'FAIL'
    const del = await client.query(`delete from transactions where id = 't-tx-a'`)
    t.otherUserCannotDeleteTheirs = del.rowCount === 0 ? 'ok' : 'FAIL'
    await expectFail('clientCannotReadAiUsage', 'select * from ai_usage')
    const b1 = (await client.query('select public.bump_ai_usage() as n')).rows[0].n
    const b2 = (await client.query('select public.bump_ai_usage() as n')).rows[0].n
    t.aiCounterCountsOwnUser = b1 === 1 && b2 === 2 ? 'ok' : `FAIL ${b1},${b2}`

    await client.query('reset role')
    await client.query('set local role anon')
    await expectFail('anonCannotReadItems', 'select * from inventory_items')
    await expectFail('anonCannotReadHouseholds', 'select * from households')

    await expectFail('anonCannotBumpAiUsage', 'select public.bump_ai_usage()')
    await as(a)
    t.aiCounterSeparatePerUser = (await client.query('select public.bump_ai_usage() as n')).rows[0].n === 1 ? 'ok' : 'FAIL'

    await client.query('rollback')
    out.allPassed = Object.values(t).every((v) => String(v).startsWith('ok'))
  } catch (e) {
    try { await client.query('rollback') } catch { /* ignore */ }
    out.error = `${e.code || ''} ${String(e.message).slice(0, 300)}`
  } finally {
    await client.end().catch(() => {})
  }
  // Public, browser-safe values (they ship inside the app anyway)
  out.publicConfig = { url: process.env.SUPABASE_URL || null, anonKey: process.env.SUPABASE_ANON_KEY || null }
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json(out)
}
