// TEMPORARY — end-to-end check with two throwaway users: Butler + data isolation. Removed right after use.
import crypto from 'node:crypto'
import { SUPABASE_URL as PUB_URL, SUPABASE_ANON_KEY as ANON } from '../src/lib/supabaseConfig.js'
export const config = { maxDuration: 60 }
const URL_ = (process.env.SUPABASE_URL || PUB_URL).replace(/\/$/, '')
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY

const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }
const admin = (path, opts = {}) => fetch(URL_ + path, { ...opts, headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } })
const as = (tok) => (path, opts = {}) => fetch(URL_ + path, { ...opts, headers: { apikey: ANON, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) } })

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.query.k !== '9b86011c0b131137') return res.status(404).end()
  const out = {}; const users = []
  try {
    for (const n of ['a', 'b']) {
      const email = `pb-e2e-${n}-${crypto.randomBytes(3).toString('hex')}@example.com`, password = crypto.randomBytes(12).toString('hex')
      const c = await j(await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) }))
      if (!c?.id) throw new Error('create user failed: ' + JSON.stringify(c).slice(0, 150))
      const s = await j(await fetch(URL_ + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }))
      users.push({ id: c.id, tok: s.access_token })
    }
    const A = as(users[0].tok), B = as(users[1].tok)
    // Butler as user A
    const br = await fetch(`https://${req.headers.host}/api/anthropic`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${users[0].tok}` },
      body: JSON.stringify({ max_tokens: 40, system: 'You are a test.', messages: [{ role: 'user', content: 'Reply with the word ok' }] }) })
    const bd = await j(br)
    out.butler = { status: br.status, text: bd?.content?.[0]?.text || null, error: bd?.error || null, detail: bd?.detail || null }
    // Isolation
    const ha = await j(await A('/rest/v1/rpc/ensure_household', { method: 'POST', body: '{}' }))
    const hb = await j(await B('/rest/v1/rpc/ensure_household', { method: 'POST', body: '{}' }))
    out.separateHouseholds = !!ha && !!hb && ha !== hb
    users[0].hid = ha; users[1].hid = hb
    const ins = await A('/rest/v1/inventory_items', { method: 'POST', body: JSON.stringify([{ id: 'e2e-' + crypto.randomBytes(4).toString('hex'), household_id: ha, name: 'Secret rice', qty: 2 }]) })
    out.ownerCanWrite = ins.status
    const t = {}
    for (const tbl of ['inventory_items', 'transactions', 'shopping_items', 'household_members']) {
      const r = await j(await B(`/rest/v1/${tbl}?household_id=eq.${ha}&select=*`)); t[tbl] = Array.isArray(r) ? r.length : r
    }
    t.households = (await j(await B(`/rest/v1/households?id=eq.${ha}&select=id`))).length
    t.ai_usage = await j(await B('/rest/v1/ai_usage?select=*'))
    out.otherUserCanRead = t
    const bi = await B('/rest/v1/inventory_items', { method: 'POST', body: JSON.stringify([{ id: 'e2e-x', household_id: ha, name: 'Intruder', qty: 1 }]) })
    out.otherUserInsertIntoA = bi.status
    const bu = await j(await B(`/rest/v1/households?id=eq.${ha}`, { method: 'PATCH', body: JSON.stringify({ name: 'hacked' }) }))
    out.otherUserUpdateA = Array.isArray(bu) ? bu.length : bu
    const bd2 = await j(await B(`/rest/v1/inventory_items?household_id=eq.${ha}`, { method: 'DELETE' }))
    out.otherUserDeleteA = Array.isArray(bd2) ? bd2.length : bd2
    const bm = await B('/rest/v1/household_members', { method: 'POST', body: JSON.stringify({ household_id: ha, user_id: users[1].id }) })
    out.otherUserJoinAByInsert = bm.status
    const anonRead = await j(await fetch(URL_ + `/rest/v1/inventory_items?select=*`, { headers: { apikey: ANON } }))
    out.anonCanRead = Array.isArray(anonRead) ? anonRead.length : anonRead
    const stillA = await j(await A(`/rest/v1/inventory_items?household_id=eq.${ha}&select=name`))
    out.ownerStillSeesOwn = stillA
  } catch (e) { out.error = String(e.message).slice(0, 200) } finally {
    for (const u of users) {
      if (u.hid) await admin(`/rest/v1/households?id=eq.${u.hid}`, { method: 'DELETE' })
      await admin(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })
    }
    out.cleanedUp = users.length
  }
  res.status(200).json(out)
}
