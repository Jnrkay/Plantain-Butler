// Household data store: local-first with cloud sync.
//
// - The UI reads from React state, mirrored to localStorage (pb-* keys) so the app
//   opens instantly and keeps working offline.
// - Every save diffs the new list against the last synced snapshot and queues only
//   the rows that changed. The queue lives in localStorage, so edits made offline
//   survive a restart and upload when the connection returns.
// - When the app comes back into focus, it pulls the latest from the cloud so
//   changes made on another device show up.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { DEFAULT_PROFILE } from './constants'
import { uid, today } from './utils'

/* ---------------- row mapping ---------------- */
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d)
const numOrNull = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v))
const strOrNull = (v) => (v === null || v === undefined || !String(v).trim() ? null : String(v).trim())
const dateOrNull = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null)
const STATUSES = ['high', 'medium', 'low']

export const COLLECTIONS = {
  inventory: {
    table: 'inventory_items', cacheKey: 'pb-inventory',
    toRow: (i, h) => ({
      id: String(i.id), household_id: h, name: String(i.name || 'Unnamed').trim() || 'Unnamed', qty: num(i.qty),
      category: i.category || 'Other', status: STATUSES.includes(i.status) ? i.status : 'high',
      last_price: numOrNull(i.lastPrice), last_purchased: dateOrNull(i.lastPurchased), store: i.store || null,
      full_qty: numOrNull(i.fullQty), due_ack: dateOrNull(i.dueAck),
      brand: strOrNull(i.brand), product_type: strOrNull(i.productType),
    }),
    fromRow: (r) => ({
      id: r.id, name: r.name, qty: Number(r.qty), category: r.category, status: r.status,
      lastPrice: r.last_price === null ? undefined : Number(r.last_price),
      lastPurchased: r.last_purchased || undefined, store: r.store || '',
      fullQty: r.full_qty === null || r.full_qty === undefined ? undefined : Number(r.full_qty),
      dueAck: r.due_ack || undefined,
      brand: r.brand || '', productType: r.product_type || '',
    }),
  },
  transactions: {
    table: 'transactions', cacheKey: 'pb-transactions',
    toRow: (t, h) => ({
      id: String(t.id), household_id: h, item: String(t.item || t.name || 'Unnamed').trim() || 'Unnamed',
      qty: num(t.qty, 1), price: num(t.price), category: t.category || 'Other', store: t.store || null,
      date: dateOrNull(t.date) || today(),
      brand: strOrNull(t.brand), product_type: strOrNull(t.productType),
    }),
    fromRow: (r) => ({
      id: r.id, item: r.item, qty: Number(r.qty), price: Number(r.price), category: r.category,
      store: r.store || '', date: r.date, brand: r.brand || '', productType: r.product_type || '',
    }),
  },
  shoppingList: {
    table: 'shopping_items', cacheKey: 'pb-shopping-list',
    toRow: (s, h) => ({
      id: String(s.id), household_id: h, name: String(s.name || 'Unnamed').trim() || 'Unnamed', qty: num(s.qty, 1),
      est_price: num(s.estPrice), category: s.category || 'Other', store: s.store || null, checked: !!s.checked,
    }),
    fromRow: (r) => ({
      id: r.id, name: r.name, qty: Number(r.qty), estPrice: Number(r.est_price), category: r.category,
      store: r.store || '', checked: r.checked,
    }),
  },
}
const KEYS = Object.keys(COLLECTIONS)

/* ---------------- local cache ---------------- */
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage full or blocked */ } },
  del: (k) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
}
const LINK_KEY = 'pb-linked-household'
const QUEUE_KEY = 'pb-sync-queue'
const PROFILE_KEY = 'pb-profile'
const BUDGETS_KEY = 'pb-budgets'
const LEARNING_KEY = 'pb-learning'
const SNAP_KEY = 'pb-last-synced'
// Bump when the shape of synced rows changes, so an app update re-reads the account
// before trusting this phone's saved snapshot (prevents stale overwrites after updates).
const SNAP_V = 3

const withIds = (list) => (Array.isArray(list) ? list : []).map((x) => (x && x.id ? x : { ...x, id: uid() }))

export function readLocalData() {
  return {
    profile: LS.get(PROFILE_KEY, null),
    budgets: LS.get(BUDGETS_KEY, {}),
    learning: LS.get(LEARNING_KEY, {}),
    inventory: withIds(LS.get('pb-inventory', [])),
    transactions: withIds(LS.get('pb-transactions', [])),
    shoppingList: withIds(LS.get('pb-shopping-list', [])),
  }
}
const hasData = (d) => !!(d.inventory.length || d.transactions.length || d.shoppingList.length || d.profile?.onboarded)

function writeCache(data) {
  LS.set(PROFILE_KEY, data.profile)
  LS.set(BUDGETS_KEY, data.budgets)
  LS.set(LEARNING_KEY, data.learning || {})
  KEYS.forEach((k) => LS.set(COLLECTIONS[k].cacheKey, data[k]))
}
export function clearLocalData() {
  [PROFILE_KEY, BUDGETS_KEY, LEARNING_KEY, LINK_KEY, QUEUE_KEY, SNAP_KEY, ...KEYS.map((k) => COLLECTIONS[k].cacheKey)].forEach(LS.del)
  ;['pb-chat-current', 'pb-chat-cache', 'pb-memories', 'pb-classified'].forEach(LS.del)
  try { sessionStorage.removeItem('pb-butler-chat') } catch { /* ignore */ }
}

/* ---------------- cloud I/O ---------------- */
async function fetchAll(table, hid) {
  const rows = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from(table).select('*').eq('household_id', hid).order('created_at').range(from, from + page - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < page) break
  }
  return rows
}

async function loadCloud(hid) {
  const [{ data: hh, error }, ...lists] = await Promise.all([
    supabase.from('households').select('profile,budgets,learning').eq('id', hid).single(),
    ...KEYS.map((k) => fetchAll(COLLECTIONS[k].table, hid)),
  ])
  if (error) throw error
  const out = { profile: hh.profile && Object.keys(hh.profile).length ? hh.profile : null, budgets: hh.budgets || {}, learning: hh.learning || {} }
  KEYS.forEach((k, i) => { out[k] = lists[i].map(COLLECTIONS[k].fromRow) })
  return out
}

async function uploadAll(hid, data) {
  const patch = {}
  if (data.profile) patch.profile = data.profile
  if (data.budgets && Object.keys(data.budgets).length) patch.budgets = data.budgets
  if (data.learning && Object.keys(data.learning).length) patch.learning = data.learning
  if (Object.keys(patch).length) {
    const { error } = await supabase.from('households').update(patch).eq('id', hid)
    if (error) throw error
  }
  for (const k of KEYS) {
    const rows = data[k].map((x) => COLLECTIONS[k].toRow(x, hid))
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(COLLECTIONS[k].table).upsert(rows.slice(i, i + 500))
      if (error) throw error
    }
  }
}

const snapshotOf = (k, list, hid) => new Map(list.map((x) => [String(x.id), JSON.stringify(COLLECTIONS[k].toRow(x, hid))]))

const EMPTY = { profile: null, budgets: {}, learning: {}, inventory: [], transactions: [], shoppingList: [] }

/* ---------------- the hook ---------------- */
// phase: 'loading' | 'signedOut' | 'syncing' | 'link' | 'ready' | 'error'
export function useHouseholdStore() {
  const [session, setSession] = useState(undefined)
  const [phase, setPhase] = useState('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState(EMPTY)
  const [sync, setSync] = useState({ state: 'idle', pending: 0, lastSynced: null })
  const [pendingLocal, setPendingLocal] = useState(null) // pre-account data awaiting a merge/discard decision

  const hidRef = useRef(null)
  const snap = useRef({})
  const queue = useRef(LS.get(QUEUE_KEY, {})) // key -> { t, op, id?, row?, patch?, tries }
  const flushing = useRef(false)
  const flushTimer = useRef(null)
  const editVersion = useRef(0)
  const dataRef = useRef(data)
  dataRef.current = data

  const setPendingCount = () => setSync((s) => ({ ...s, pending: Object.keys(queue.current).length }))
  const persistQueue = () => { LS.set(QUEUE_KEY, queue.current); setPendingCount() }

  /* ----- session ----- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: d }) => setSession(d.session || null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null))
    return () => sub.subscription.unsubscribe()
  }, [])

  /* ----- flushing ----- */
  const flush = useCallback(async () => {
    const hid = hidRef.current
    if (!hid || flushing.current) return
    const entries = Object.entries(queue.current)
    if (!entries.length) { setSync((s) => ({ ...s, state: 'synced', pending: 0 })); return }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setSync((s) => ({ ...s, state: 'offline' })); return }
    flushing.current = true
    setSync((s) => ({ ...s, state: 'syncing' }))
    let failed = false
    try {
      const groups = {}
      entries.forEach(([key, op]) => { (groups[`${op.t}|${op.op}`] ||= []).push([key, op]) })
      for (const [g, items] of Object.entries(groups)) {
        const [table, kind] = g.split('|')
        let res
        if (kind === 'upsert') res = await supabase.from(table).upsert(items.map(([, o]) => o.row))
        else if (kind === 'delete') res = await supabase.from(table).delete().in('id', items.map(([, o]) => o.id))
        else if (kind === 'update') res = await supabase.from('households').update(Object.assign({}, ...items.map(([, o]) => o.patch))).eq('id', hid)
        if (res?.error) {
          failed = true
          const transient = !res.error.code || /^(PGRST30|08|57|53)/.test(res.error.code) || res.status >= 500 || res.status === 0
          items.forEach(([key, o]) => {
            if (queue.current[key] !== o) return
            o.tries = (o.tries || 0) + 1
            if (!transient && o.tries >= 3) delete queue.current[key] // give up on rows the server keeps rejecting
          })
        } else {
          items.forEach(([key, o]) => { if (queue.current[key] === o) delete queue.current[key] }) // keep newer edits made mid-flush
        }
      }
    } catch {
      failed = true
    } finally {
      flushing.current = false
      persistQueue()
      const left = Object.keys(queue.current).length
      setSync((s) => ({ state: failed ? (navigator.onLine === false ? 'offline' : 'error') : left ? 'syncing' : 'synced', pending: left, lastSynced: failed ? s.lastSynced : new Date() }))
      if (left && !failed) setTimeout(() => flush(), 50)
    }
  }, [])

  const scheduleFlush = useCallback(() => {
    clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(() => flush(), 400)
  }, [flush])

  useEffect(() => {
    const onOnline = () => flush()
    window.addEventListener('online', onOnline)
    const iv = setInterval(() => { if (Object.keys(queue.current).length) flush() }, 30000)
    return () => { window.removeEventListener('online', onOnline); clearInterval(iv) }
  }, [flush])

  /* ----- applying data ----- */
  const applyData = useCallback((d, { fromCloud } = {}) => {
    const hid = hidRef.current
    const next = {
      profile: d.profile || null, budgets: d.budgets || {}, learning: d.learning || {},
      inventory: withIds(d.inventory), transactions: withIds(d.transactions), shoppingList: withIds(d.shoppingList),
    }
    if (fromCloud) KEYS.forEach((k) => { snap.current[k] = snapshotOf(k, next[k], hid) })
    setData(next)
    writeCache(next)
  }, [])

  const refresh = useCallback(async () => {
    const hid = hidRef.current
    if (!hid) return
    if (Object.keys(queue.current).length) { await flush(); if (Object.keys(queue.current).length) return }
    const v = editVersion.current
    try {
      const cloud = await loadCloud(hid)
      if (editVersion.current !== v || Object.keys(queue.current).length) return // a local edit happened meanwhile
      applyData(cloud, { fromCloud: true })
      setSync((s) => ({ ...s, state: 'synced', lastSynced: new Date() }))
    } catch {
      setSync((s) => ({ ...s, state: navigator.onLine === false ? 'offline' : 'error' }))
    }
  }, [applyData, flush])

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && phase === 'ready') refresh() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis) }
  }, [phase, refresh])

  /* ----- boot after sign-in ----- */
  const booted = useRef(null)
  useEffect(() => {
    if (session === undefined) return
    if (!session) { setPhase('signedOut'); booted.current = null; return }
    if (booted.current === session.user.id) return
    booted.current = session.user.id
    ;(async () => {
      const linked = LS.get(LINK_KEY, null)
      const local = readLocalData()
      // Fast path: this device already belongs to the user's household — show the cache, then refresh.
      const last = LS.get(SNAP_KEY, null)
      const trusted = !!(linked && last && last._v === SNAP_V)
      if (linked) {
        hidRef.current = linked
        KEYS.forEach((k) => { snap.current[k] = snapshotOf(k, [], linked) })
        // Snapshot reflects what the cloud had at last sync; queued ops cover the rest.
        if (trusted) KEYS.forEach((k) => { snap.current[k] = new Map(Object.entries(last[k] || {})) })
        applyData(local)
        // After an app update the saved snapshot can't be trusted: re-read the account first
        setPhase(trusted ? 'ready' : 'syncing')
      } else {
        setPhase('syncing')
      }
      try {
        const { data: hid, error: e1 } = await supabase.rpc('ensure_household')
        if (e1) throw e1
        if (linked && linked !== hid) { clearLocalData(); queue.current = {}; persistQueue() }
        hidRef.current = hid
        if (linked === hid) { await flush(); await refresh(); setPhase('ready'); return }

        const cloud = await loadCloud(hid)
        const cloudEmpty = !hasData(cloud)
        if (hasData(local) && !linked) {
          if (cloudEmpty) {
            await uploadAll(hid, local)
            LS.set(LINK_KEY, hid)
            applyData(local, { fromCloud: true })
          } else {
            applyData(cloud, { fromCloud: true })
            LS.set(LINK_KEY, hid)
            setPendingLocal(local)
            setPhase('link')
            return
          }
        } else {
          LS.set(LINK_KEY, hid)
          applyData(cloud, { fromCloud: true })
        }
        setSync({ state: 'synced', pending: 0, lastSynced: new Date() })
        setPhase('ready')
      } catch (e) {
        if (linked) { setSync((s) => ({ ...s, state: 'offline' })); setPhase('ready'); return } // keep working from the cache
        setError(e?.message || 'Could not reach your account.')
        setPhase('error')
        booted.current = null
      }
    })()
  }, [session, applyData, flush, refresh])

  // Remember the cloud snapshot so a cold start offline still diffs correctly
  useEffect(() => {
    if (phase !== 'ready') return
    const obj = { _v: SNAP_V }
    KEYS.forEach((k) => { obj[k] = Object.fromEntries(snap.current[k] || []) })
    LS.set(SNAP_KEY, obj)
  }, [sync.lastSynced, phase])

  /* ----- saving ----- */
  const saveCollection = useCallback((key) => (list) => {
    const hid = hidRef.current
    const cfg = COLLECTIONS[key]
    const items = withIds(list)
    editVersion.current++
    setData((d) => ({ ...d, [key]: items }))
    LS.set(cfg.cacheKey, items)
    if (!hid) return
    const prev = snap.current[key] || new Map()
    const next = snapshotOf(key, items, hid)
    next.forEach((json, id) => {
      if (prev.get(id) !== json) queue.current[`${cfg.table}:${id}`] = { t: cfg.table, op: 'upsert', row: JSON.parse(json) }
    })
    prev.forEach((_, id) => {
      if (!next.has(id)) queue.current[`${cfg.table}:${id}`] = { t: cfg.table, op: 'delete', id }
    })
    snap.current[key] = next
    persistQueue()
    scheduleFlush()
  }, [scheduleFlush])

  const saveHouseholdField = useCallback((field, cacheKey) => (value) => {
    editVersion.current++
    setData((d) => ({ ...d, [field]: value }))
    LS.set(cacheKey, value)
    if (!hidRef.current) return
    queue.current[`households:${field}`] = { t: 'households', op: 'update', patch: { [field]: value } }
    persistQueue()
    scheduleFlush()
  }, [scheduleFlush])

  const actions = {
    saveProfile: saveHouseholdField('profile', PROFILE_KEY),
    saveBudgets: saveHouseholdField('budgets', BUDGETS_KEY),
    saveLearning: saveHouseholdField('learning', LEARNING_KEY),
    saveInv: saveCollection('inventory'),
    saveTx: saveCollection('transactions'),
    saveSL: saveCollection('shoppingList'),
  }

  /* ----- pre-account data decision ----- */
  const resolveLocal = useCallback(async (merge) => {
    const local = pendingLocal
    setPendingLocal(null)
    if (merge && local) {
      const cur = dataRef.current
      const mergeList = (a, b) => { const ids = new Set(a.map((x) => String(x.id))); return [...a, ...b.filter((x) => !ids.has(String(x.id)))] }
      KEYS.forEach((k) => actions[{ inventory: 'saveInv', transactions: 'saveTx', shoppingList: 'saveSL' }[k]](mergeList(cur[k], local[k])))
      if (!cur.profile?.onboarded && local.profile) actions.saveProfile(local.profile)
      if (!Object.keys(cur.budgets || {}).length && local.budgets && Object.keys(local.budgets).length) actions.saveBudgets(local.budgets)
    }
    setPhase('ready')
  }, [pendingLocal]) // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(async () => {
    await flush()
    await supabase.auth.signOut().catch(() => {})
    clearLocalData()
    queue.current = {}
    hidRef.current = null
    snap.current = {}
    setData(EMPTY)
    setSync({ state: 'idle', pending: 0, lastSynced: null })
  }, [flush])

  // After joining or leaving a household: save pending edits, forget this phone's copy
  // of the old household, and load the new active one from the account.
  const switchHousehold = useCallback(async () => {
    await flush()
    clearLocalData()
    queue.current = {}
    persistQueue()
    hidRef.current = null
    snap.current = {}
    setData(EMPTY)
    setPhase('syncing')
    booted.current = null
    setSession((s) => (s ? { ...s } : s))
  }, [flush]) // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(() => { setError(''); booted.current = null; setSession((s) => (s ? { ...s } : s)) }, [])

  return {
    session, phase, error, sync, pendingLocal, retry, signOut, resolveLocal, refresh, switchHousehold,
    householdId: hidRef.current,
    profile: data.profile || null,
    budgets: data.budgets || {},
    learning: data.learning || {},
    inventory: data.inventory, transactions: data.transactions, shoppingList: data.shoppingList,
    ...actions,
    defaultProfile: DEFAULT_PROFILE,
  }
}
