import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { DEFAULT_PROFILE } from './lib/constants'
import { useHouseholdStore } from './lib/store'
import { uid, today, monthKey } from './lib/utils'
import { C, sans } from './lib/theme'
import { initials as toInitials, lineTotal, sum, isLow, withQty } from './lib/derive'
import { buildModel, annotate, typeOf, typeKey, ruleType, guessBrand, findItem, learnFromCount } from './lib/learn'
import { classifyNames } from './lib/ai'
import { useButlerData, CHAT_KEY } from './lib/butlerData'
import { Icon, reset } from './components/ui'

import Onboarding from './components/Onboarding'
import Dashboard from './components/Dashboard'
import InventoryPage from './components/InventoryPage'
import TransactionsPage from './components/TransactionsPage'
import AnalyticsPage from './components/AnalyticsPage'
import ShoppingPage from './components/ShoppingPage'
import AssistantPage from './components/AssistantPage'
import OverflowMenu from './components/OverflowMenu'
import Sheets from './components/Sheets'
import SignIn from './components/SignIn'
import LinkData from './components/LinkData'
import { Button } from './components/ui'
import PullToRefresh from './components/PullToRefresh'
import UpdateBanner from './components/UpdateBanner'

const clean = (i) => Object.fromEntries(Object.entries(i).filter(([k]) => !k.startsWith('_')))
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10
// One entry per product type (the most recently bought item stands in for its type)
const lowByType = (inventory) => {
  const seen = new Map()
  inventory.filter(isLow).forEach((i) => {
    const k = typeKey(typeOf(i))
    const cur = seen.get(k)
    if (!cur || String(i.lastPurchased || '') > String(cur.lastPurchased || '')) seen.set(k, i)
  })
  return [...seen.values()]
}

// Tab bar (23:5697) — labels and icons exactly as in Figma
const TABS = [
  { key: 'dashboard', icon: 'home', label: 'Home' },
  { key: 'inventory', icon: 'box', label: 'Stock' },
  { key: 'transactions', icon: 'receipt', label: 'Spend' },
  { key: 'analytics', icon: 'chart', label: 'Insights' },
  { key: 'shopping', icon: 'cart', label: 'List' },
  { key: 'assistant', icon: 'chat', label: 'Butler' },
]

// The amber pill grows out of the tab you tap; labels slide open rather than pop
function TabBar({ page, setPage }) {
  return (
    <nav
      style={{
        position: 'fixed', zIndex: 50, left: '50%', transform: 'translateX(-50%)',
        bottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) - 6px))',
        width: 'calc(min(100vw, 480px) - 40px)', height: 60, padding: 8,
        background: C.ink, borderRadius: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}
    >
      {TABS.map((t) => {
        const active = page === t.key
        return (
          <button key={t.key} aria-label={t.label} aria-current={active ? 'page' : undefined} onClick={() => setPage(t.key)}
            style={{
              ...reset, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, flexShrink: 0, borderRadius: 22,
              minWidth: 40, padding: active ? '0 16px 0 12px' : '0 10px', background: active ? C.amber : 'rgba(255,178,0,0)',
              transition: 'background-color .25s ease, padding .3s var(--ease-out), scale .18s var(--ease-spring)',
            }}>
            <span style={{ display: 'flex', transition: 'transform .3s var(--ease-spring)', transform: active ? 'scale(1)' : 'scale(.95)' }}>
              <Icon name={active ? `${t.icon}@18` : `${t.icon}@20`} color={active ? C.ink : C.cream} />
            </span>
            <span style={{
              ...sans(13, 500, { color: C.ink, whiteSpace: 'nowrap' }), overflow: 'hidden', display: 'inline-block',
              maxWidth: active ? 72 : 0, marginLeft: active ? 8 : 0, opacity: active ? 1 : 0,
              transition: 'max-width .3s var(--ease-out), margin-left .3s var(--ease-out), opacity .2s ease .05s',
            }}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function Splash({ text, action, secondary }) {
  return (
    <div style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 330, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'stretch' }}>
        {text && <p style={sans(14, 400, { color: C.ink70, textAlign: 'center', lineHeight: '20px' })}>{text}</p>}
        {action && <Button onClick={action.onClick}>{action.label}</Button>}
        {secondary && <Button variant="outline" onClick={secondary.onClick}>{secondary.label}</Button>}
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPageRaw] = useState('dashboard')
  const [sheet, setSheet] = useState(null) // { type, ...props }
  const [menuOpen, setMenuOpen] = useState(false)
  const store = useHouseholdStore()
  const { profile, transactions, budgets, shoppingList, learning, saveProfile, saveTx, saveBudgets, saveSL, saveLearning } = store
  // Butler's learning model: per product type usage, estimates and status.
  // Screens get items with `_`-prefixed model fields; those are stripped before saving.
  const model = useMemo(() => buildModel(store.inventory, transactions, learning), [store.inventory, transactions, learning])
  const inventory = useMemo(() => annotate(store.inventory, model), [store.inventory, model])
  const saveInv = useCallback((list) => store.saveInv(list.map(clean)), [store.saveInv])
  const myName = store.session?.user?.user_metadata?.name || profile?.name || ''
  // Butler's conversations (private to this person) and memories
  const butler = useButlerData(store.phase === 'ready' ? store.householdId : null, store.session?.user?.id)
  const [chatId, setChatIdRaw] = useState(() => { try { return JSON.parse(localStorage.getItem(CHAT_KEY)) } catch { return null } })
  const setChatId = useCallback((id) => { setChatIdRaw(id); try { localStorage.setItem(CHAT_KEY, JSON.stringify(id)) } catch { /* ignore */ } }, [])
  const [recentChats, setRecentChats] = useState([])
  const refreshChats = useCallback(async () => { try { setRecentChats(await butler.listChats()) } catch { /* offline */ } }, [butler.listChats]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (store.phase === 'ready') refreshChats() }, [store.phase, store.householdId]) // eslint-disable-line react-hooks/exhaustive-deps
  const markProgress = useCallback((key) => {
    if (profile?.progress?.[key]) return
    saveProfile({ ...profile, progress: { ...(profile?.progress || {}), [key]: true } })
  }, [profile, saveProfile])

  // Sort new item names into brand + product type in the background (one Butler call per batch)
  const classifying = useRef(0)
  useEffect(() => {
    if (store.phase !== 'ready' || !profile?.onboarded || Date.now() - classifying.current < 120000) return
    let done = new Set()
    try { done = new Set(JSON.parse(localStorage.getItem('pb-classified') || '[]')) } catch { /* ignore */ }
    const pending = [...new Set([
      ...store.inventory.filter((i) => !i.productType).map((i) => i.name),
      ...transactions.filter((t) => !t.productType).map((t) => t.item),
    ].map((n) => String(n || '').trim()).filter((n) => n && !done.has(n.toLowerCase())))].slice(0, 60)
    if (!pending.length) return
    const timer = setTimeout(async () => {
      classifying.current = Date.now()
      try {
        const found = await classifyNames(pending)
        const by = Object.fromEntries(found.map((f) => [String(f.name).toLowerCase().trim(), f]))
        const fill = (x, nameKey) => {
          const f = by[String(x[nameKey] || '').toLowerCase().trim()]
          if (!f || x.productType) return x
          return { ...x, productType: f.type || '', brand: x.brand || f.brand || '' }
        }
        const inv2 = store.inventory.map((i) => fill(i, 'name'))
        const tx2 = transactions.map((t) => fill(t, 'item'))
        if (inv2.some((x, i) => x !== store.inventory[i])) store.saveInv(inv2)
        if (tx2.some((x, i) => x !== transactions[i])) saveTx(tx2)
        pending.forEach((n) => done.add(n.toLowerCase()))
        localStorage.setItem('pb-classified', JSON.stringify([...done].slice(-2000)))
      } catch { /* try again later */ }
    }, 3000)
    return () => clearTimeout(timer)
  }, [store.phase, profile?.onboarded, store.inventory, transactions]) // eslint-disable-line react-hooks/exhaustive-deps

  const pageDir = useRef('up')
  const setPage = useCallback((p) => {
    setPageRaw((cur) => {
      const a = TABS.findIndex((t) => t.key === cur), b = TABS.findIndex((t) => t.key === p)
      pageDir.current = b > a ? 'r' : b < a ? 'l' : pageDir.current
      return p
    })
    setMenuOpen(false); window.scrollTo(0, 0)
  }, [])

  const addTransaction = (items, shop, date) => {
    let inv = store.inventory.map(clean)
    const newTx = items.map((it) => {
      const name = String(it.item).trim()
      const tx = {
        id: uid(), item: name, qty: Number(it.qty) || 1, price: Number(it.price) || 0, category: it.category || 'Other',
        store: shop || '', date: date || today(),
        brand: String(it.brand || '').trim(), productType: String(it.productType || '').trim(),
      }
      // Borrow brand/type from the item we already track, else from the built-in list
      const known = findItem(inv, tx)
      if (known) { tx.brand ||= known.brand || ''; tx.productType ||= known.productType || '' }
      tx.brand ||= guessBrand(name)
      tx.productType ||= ruleType(name)
      // A new brand of something we already track joins that product's category
      if (tx.category === 'Other' && tx.productType) {
        const sibling = inv.find((i) => typeKey(typeOf(i)) === typeKey(tx.productType) && i.category && i.category !== 'Other')
        if (sibling) tx.category = sibling.category
      }
      return tx
    })
    saveTx([...newTx, ...transactions])

    // Before restocking, bring each bought type down to what Butler estimates is left
    // (e.g. buying water because you ran out clears the old water that's been used up).
    new Set(newTx.map((t) => typeKey(typeOf(t)))).forEach((k) => {
      const T = model[k]
      if (!T?.learned) return
      inv = inv.map((i) => (T.itemEst[i.id] !== undefined ? { ...i, qty: round1(T.itemEst[i.id]) } : i))
    })
    newTx.forEach((tx) => {
      const hit = findItem(inv, tx)
      if (hit) {
        const qty = round1((Number(hit.qty) || 0) + tx.qty)
        const newer = !hit.lastPurchased || tx.date >= hit.lastPurchased
        inv = inv.map((i) => (i.id !== hit.id ? i : {
          ...i, qty, fullQty: qty, status: 'high',
          brand: i.brand || tx.brand, productType: i.productType || tx.productType,
          ...(newer ? { lastPurchased: tx.date, lastPrice: tx.price, store: tx.store || i.store } : {}),
        }))
      } else {
        inv.push({ id: uid(), name: tx.item, qty: tx.qty, fullQty: tx.qty, category: tx.category, lastPurchased: tx.date, lastPrice: tx.price, store: tx.store, status: 'high', brand: tx.brand, productType: tx.productType })
      }
    })
    store.saveInv(inv)

    // Tick off anything on the shopping list that was just bought (by name or by type)
    const bought = new Set(newTx.map((t) => t.item.toLowerCase()))
    const boughtTypes = new Set(newTx.map((t) => typeKey(typeOf(t))))
    const isBought = (s) => bought.has(String(s.name).toLowerCase().trim()) || boughtTypes.has(typeKey(typeOf({ name: s.name, productType: s.productType })))
    if (shoppingList.some((s) => !s.checked && isBought(s))) saveSL(shoppingList.map((s) => (!s.checked && isBought(s) ? { ...s, checked: true } : s)))
  }

  // A stock count for one item. `base` is the type's model when the count started,
  // so tapping +/− several times teaches Butler once, not once per tap.
  const recordCount = (itemId, qty, base, forceStatus) => {
    const ests = base?.itemEst || {}
    const next = store.inventory.map((raw) => {
      const i = clean(raw)
      if (i.id === itemId) return forceStatus ? { ...withQty(i, qty), status: forceStatus } : withQty(i, qty)
      if (ests[i.id] !== undefined) return { ...i, qty: round1(ests[i.id]) }
      return i
    })
    const total = next.filter((i) => ests[i.id] !== undefined || i.id === itemId).reduce((s, i) => s + (Number(i.qty) || 0), 0)
    store.saveInv(next)
    if (base?.key) saveLearning(learnFromCount(learning, base, total))
  }

  const addToShoppingList = (entries) => {
    const list = [...shoppingList]
    entries.forEach((e) => {
      const name = String(e.name).trim()
      if (!name) return
      const idx = list.findIndex((s) => String(s.name).toLowerCase().trim() === name.toLowerCase())
      const inv = inventory.find((i) => i.name.toLowerCase().trim() === name.toLowerCase())
      const entry = {
        id: uid(), name, qty: Number(e.qty) || 1,
        estPrice: Number(e.estPrice ?? inv?.lastPrice) || 0,
        category: e.category || inv?.category || 'Other',
        store: e.store || inv?.store || '',
        checked: false,
      }
      if (idx >= 0) list[idx] = { ...list[idx], ...entry, id: list[idx].id }
      else list.push(entry)
    })
    saveSL(list)
  }

  const genShoppingList = () => {
    const low = lowByType(inventory)
    const existing = new Set(shoppingList.map((s) => String(s.name).toLowerCase().trim()))
    const additions = low.filter((i) => !existing.has(i.name.toLowerCase().trim()))
    addToShoppingList(additions.map((i) => ({ name: i.name, qty: 1, estPrice: i.lastPrice, category: i.category, store: i.store })))
    return additions.length
  }

  const derived = useMemo(() => {
    const cm = monthKey(today())
    const monthTx = transactions.filter((t) => monthKey(t.date) === cm)
    return {
      monthTx,
      totalSpend: sum(monthTx, lineTotal),
      lowStock: lowByType(inventory),
    }
  }, [transactions, inventory])

  if (store.phase === 'loading' || store.phase === 'syncing') return <Splash text={store.phase === 'syncing' ? 'Loading your household…' : ''} />
  if (store.phase === 'signedOut') return <SignIn />
  if (store.phase === 'error') return <Splash text={store.error} action={{ label: 'Try again', onClick: store.retry }} secondary={{ label: 'Sign out', onClick: store.signOut }} />
  if (store.phase === 'link' && store.pendingLocal) {
    return <LinkData local={store.pendingLocal} onMerge={() => store.resolveLocal(true)} onDiscard={() => store.resolveLocal(false)} />
  }

  if (!profile?.onboarded) {
    return (
      <Onboarding profile={profile || DEFAULT_PROFILE} saveProfile={saveProfile} saveInv={saveInv} inventory={store.inventory}
        account={{ switchHousehold: () => { setChatId(null); return store.switchHousehold() } }} onDone={(next) => { if (next) setSheet({ type: next }) }} />
    )
  }

  const openSheet = (type, props = {}) => { setMenuOpen(false); setSheet({ type, ...props }) }
  const closeSheet = () => setSheet(null)
  const header = { initials: toInitials(myName), onMenu: () => setMenuOpen((o) => !o), menuOpen }
  const data = { profile, transactions, inventory, budgets, shoppingList }
  const account = { email: store.session?.user?.email, name: myName, sync: store.sync, signOut: store.signOut, switchHousehold: () => { setChatId(null); return store.switchHousehold() } }
  const actions = {
    saveProfile, saveTx, saveInv, saveBudgets, saveSL, saveLearning, addTransaction, addToShoppingList, genShoppingList,
    recordCount, markProgress, setPage, openSheet, account, model, learning,
    butler, chatId, setChatId, recentChats, refreshChats,
  }

  const pages = {
    dashboard: <Dashboard {...data} {...derived} {...actions} header={header} />,
    inventory: <InventoryPage {...data} {...actions} header={header} />,
    transactions: <TransactionsPage {...data} {...actions} header={header} />,
    analytics: <AnalyticsPage {...data} {...actions} header={header} />,
    shopping: <ShoppingPage {...data} {...actions} header={header} />,
    assistant: <AssistantPage {...data} {...derived} {...actions} header={header} />,
  }

  return (
    <div style={{ minHeight: '100dvh', background: C.cream, color: C.ink, display: 'flex', justifyContent: 'center' }}>
      <main style={{ position: 'relative', width: '100%', maxWidth: 480, minHeight: '100dvh', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div key={page} className={`pb-page-${pageDir.current}`} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {pages[page]}
        </div>
        {menuOpen && <OverflowMenu {...data} {...actions} onClose={() => setMenuOpen(false)} />}
      </main>
      <PullToRefresh onRefresh={store.refresh} disabled={page === 'assistant' || !!sheet || menuOpen} />
      <UpdateBanner />
      <TabBar page={page} setPage={setPage} />
      {sheet && <Sheets sheet={sheet} onClose={closeSheet} {...data} {...actions} />}
    </div>
  )
}
