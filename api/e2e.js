// TEMPORARY — security + sharing check with throwaway users. Removed right after use.
import crypto from 'node:crypto'
import { SUPABASE_URL as PUB_URL, SUPABASE_ANON_KEY as ANON } from '../src/lib/supabaseConfig.js'
export const config = { maxDuration: 60 }
const URL_ = (process.env.SUPABASE_URL || PUB_URL).replace(/\/$/, '')
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }
const admin = (path, opts = {}) => fetch(URL_ + path, { ...opts, headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } })
const as = (tok) => (path, opts = {}) => fetch(URL_ + path, { ...opts, headers: { apikey: ANON, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) } })
const rpc = (c, fn, body = {}) => c(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) }).then(j)
const count = async (c, path) => { const r = await j(await c(path)); return Array.isArray(r) ? r.length : (r?.code || r) }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.query.k !== '9b86011c0b131137') return res.status(404).end()
  const out = {}; const users = []; const hids = new Set()
  try {
    for (const n of ['a', 'b', 'c']) {
      const email = `pb-e2e-${n}-${crypto.randomBytes(3).toString('hex')}@example.com`, password = crypto.randomBytes(12).toString('hex')
      const c = await j(await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) }))
      const s = await j(await fetch(URL_ + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }))
      users.push({ id: c.id, tok: s.access_token })
    }
    const [A, B, C] = users.map((u) => as(u.tok))
    const ha = await rpc(A, 'ensure_household'); const hb = await rpc(B, 'ensure_household'); const hc = await rpc(C, 'ensure_household')
    ;[ha, hb, hc].forEach((h) => hids.add(h))
    await A('/rest/v1/inventory_items', { method: 'POST', body: JSON.stringify([{ id: 'e2e-' + crypto.randomBytes(4).toString('hex'), household_id: ha, name: 'Secret rice', qty: 2, brand: 'Royal Aroma', product_type: 'Rice' }]) })
    await A(`/rest/v1/households?id=eq.${ha}`, { method: 'PATCH', body: JSON.stringify({ learning: { rice: { factor: 1 } } }) })

    out.isolation = {
      bSeesAInventory: await count(B, `/rest/v1/inventory_items?household_id=eq.${ha}&select=id`),
      bSeesAHousehold: await count(B, `/rest/v1/households?id=eq.${ha}&select=id,learning`),
      bReadsInvitesTable: await count(B, '/rest/v1/household_invites?select=*'),
      bReadsJoinAttempts: await count(B, '/rest/v1/join_attempts?select=*'),
      bInsertsInvite: (await B('/rest/v1/household_invites', { method: 'POST', body: JSON.stringify({ code: 'HACK12', household_id: ha }) })).status,
      bInsertsMembership: (await B('/rest/v1/household_members', { method: 'POST', body: JSON.stringify({ household_id: ha, user_id: users[1].id, role: 'owner' }) })).status,
      anonCallsCreateInvite: (await fetch(URL_ + '/rest/v1/rpc/create_invite', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: '{}' })).status,
    }
    const inv = await rpc(A, 'create_invite')
    out.invite = { codeLen: inv?.code?.length, hasExpiry: !!inv?.expires_at }
    out.cWrongCode = (await rpc(C, 'join_household', { p_code: 'ZZZZZZ' }))?.status
    const jb = await rpc(B, 'join_household', { p_code: inv.code.toLowerCase().split('').join(' ') })
    out.bJoin = jb?.status
    out.bActiveIsA = (await rpc(B, 'ensure_household')) === ha
    out.bNowSeesAInventory = await count(B, `/rest/v1/inventory_items?household_id=eq.${ha}&select=id`)
    out.bCanWriteA = (await B('/rest/v1/shopping_items', { method: 'POST', body: JSON.stringify([{ id: 'e2e-s1', household_id: ha, name: 'Milk', qty: 1 }]) })).status
    const members = await rpc(B, 'list_members')
    out.members = Array.isArray(members) ? members.map((m) => ({ role: m.role, isMe: m.is_me, hasEmail: !!m.email })) : members
    out.cSeesMembersOfA = (await rpc(C, 'list_members'))?.length
    out.cReuseCode = (await rpc(C, 'join_household', { p_code: inv.code }))?.status
    out.bRemovesA = (await rpc(B, 'remove_member', { p_user: users[0].id }))?.status
    out.aLeavesOwn = (await rpc(A, 'leave_household'))?.status
    out.aRemovesB = (await rpc(A, 'remove_member', { p_user: users[1].id }))?.status
    out.bAfterRemoval = { seesA: await count(B, `/rest/v1/inventory_items?household_id=eq.${ha}&select=id`), activeIsOwn: (await rpc(B, 'ensure_household')) === hb }
    // member leaves
    const inv2 = await rpc(A, 'create_invite'); await rpc(C, 'join_household', { p_code: inv2.code })
    out.cLeave = (await rpc(C, 'leave_household'))?.status
    out.cAfterLeave = { seesA: await count(C, `/rest/v1/inventory_items?household_id=eq.${ha}&select=id`), activeIsOwn: (await rpc(C, 'ensure_household')) === hc }
    // guessing limit
    let last
    for (let i = 0; i < 12; i++) last = (await rpc(C, 'join_household', { p_code: 'AAAAA' + i }))?.status
    out.guessLimit = last
    const inv3 = await rpc(A, 'create_invite')
    out.validCodeAfterLimit = (await rpc(C, 'join_household', { p_code: inv3.code }))?.status
    out.aiUsageReadable = await count(B, '/rest/v1/ai_usage?select=*')
  } catch (e) { out.error = String(e.stack || e.message).slice(0, 300) } finally {
    for (const h of hids) if (h && typeof h === 'string') await admin(`/rest/v1/households?id=eq.${h}`, { method: 'DELETE' })
    for (const u of users) { await admin(`/rest/v1/join_attempts?user_id=eq.${u.id}`, { method: 'DELETE' }); await admin(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' }) }
    out.cleanedUp = users.length
  }
  res.status(200).json(out)
}
