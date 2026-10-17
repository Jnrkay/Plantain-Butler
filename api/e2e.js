// TEMPORARY — chat/memory privacy check with throwaway users. Removed right after use.
import crypto from 'node:crypto'
import { SUPABASE_URL as PUB_URL, SUPABASE_ANON_KEY as ANON } from '../src/lib/supabaseConfig.js'
export const config = { maxDuration: 60 }
const URL_ = (process.env.SUPABASE_URL || PUB_URL).replace(/\/$/, '')
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }
const admin = (path, opts = {}) => fetch(URL_ + path, { ...opts, headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } })
const as = (tok) => (path, opts = {}) => fetch(URL_ + path, { ...opts, headers: { apikey: ANON, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) } })
const rpc = (c, fn, body = {}) => c(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) }).then(j)
const n = (r) => (Array.isArray(r) ? r.length : r?.code || r)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.query.k !== '9b86011c0b131137') return res.status(404).end()
  const out = {}; const users = []; const hids = new Set()
  try {
    for (const x of ['a', 'b', 'c']) {
      const email = `pb-e2e-${x}-${crypto.randomBytes(3).toString('hex')}@example.com`, password = crypto.randomBytes(12).toString('hex')
      const c = await j(await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) }))
      const s = await j(await fetch(URL_ + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }))
      users.push({ id: c.id, tok: s.access_token })
    }
    const [A, B, C] = users.map((u) => as(u.tok))
    const ha = await rpc(A, 'ensure_household'); hids.add(ha); hids.add(await rpc(B, 'ensure_household')); hids.add(await rpc(C, 'ensure_household'))
    const inv = await rpc(A, 'create_invite'); await rpc(B, 'join_household', { p_code: inv.code })
    const chat = await j(await A('/rest/v1/butler_chats', { method: 'POST', body: JSON.stringify({ household_id: ha, title: 'A private chat', messages: [{ role: 'user', content: 'secret' }] }) }))
    const chatId = chat?.[0]?.id
    out.aCreatesChat = !!chatId
    await A('/rest/v1/butler_memories', { method: 'POST', body: JSON.stringify([{ household_id: ha, scope: 'household', fact: 'Buys water in packs of 12' }, { household_id: ha, scope: 'personal', fact: 'A personal note' }]) })
    out.aSeesMemories = n(await j(await A(`/rest/v1/butler_memories?household_id=eq.${ha}&select=fact,scope`)))
    out.bSeesAChats = n(await j(await B(`/rest/v1/butler_chats?select=id,title`)))
    out.bReadsAChatById = n(await j(await B(`/rest/v1/butler_chats?id=eq.${chatId}&select=*`)))
    out.bUpdatesAChat = n(await j(await B(`/rest/v1/butler_chats?id=eq.${chatId}`, { method: 'PATCH', body: JSON.stringify({ title: 'hacked' }) })))
    out.bDeletesAChat = n(await j(await B(`/rest/v1/butler_chats?id=eq.${chatId}`, { method: 'DELETE' })))
    out.bInsertsChatAsA = (await B('/rest/v1/butler_chats', { method: 'POST', body: JSON.stringify({ household_id: ha, user_id: users[0].id, title: 'spoof' }) })).status
    const bm = await j(await B(`/rest/v1/butler_memories?household_id=eq.${ha}&select=fact,scope`))
    out.bSeesMemories = Array.isArray(bm) ? bm.map((m) => m.scope) : bm
    out.bDeletesAPersonal = n(await j(await B(`/rest/v1/butler_memories?scope=eq.personal`, { method: 'DELETE' })))
    out.cSeesMemories = n(await j(await C(`/rest/v1/butler_memories?select=*`)))
    out.cSeesChats = n(await j(await C(`/rest/v1/butler_chats?select=*`)))
    out.cInsertsMemoryIntoA = (await C('/rest/v1/butler_memories', { method: 'POST', body: JSON.stringify({ household_id: ha, fact: 'intrude' }) })).status
    out.anonReadsChats = n(await j(await fetch(URL_ + '/rest/v1/butler_chats?select=*', { headers: { apikey: ANON } })))
    out.bAddsHouseholdMemory = (await B('/rest/v1/butler_memories', { method: 'POST', body: JSON.stringify({ household_id: ha, scope: 'household', fact: 'Shops on Saturdays' }) })).status
    out.aSeesBHouseholdMemory = n(await j(await A(`/rest/v1/butler_memories?fact=eq.Shops%20on%20Saturdays&select=id`)))
    out.aChatStillThere = n(await j(await A(`/rest/v1/butler_chats?id=eq.${chatId}&select=title`)))
  } catch (e) { out.error = String(e.stack || e.message).slice(0, 300) } finally {
    for (const h of hids) if (typeof h === 'string') await admin(`/rest/v1/households?id=eq.${h}`, { method: 'DELETE' })
    for (const u of users) { await admin(`/rest/v1/join_attempts?user_id=eq.${u.id}`, { method: 'DELETE' }); await admin(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' }) }
    out.cleanedUp = users.length
  }
  res.status(200).json(out)
}
