import { useState, useMemo, useCallback } from 'react'
import { DEFAULT_PROFILE } from './lib/constants'
import { useHouseholdStore } from './lib/store'
import { uid, today, monthKey } from './lib/utils'
import { C, sans } from './lib/theme'
import { initials as toInitials, lineTotal, sum, isLow } from './lib/derive'
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

// Tab bar (23:5697) — labels and icons exactly as in Figma
const TABS = [
  { key: 'dashboard', icon: 'home', label: 'Home' },
  { key: 'inventory', icon: 'box', label: 'Stock' },
  { key: 'transactions', icon: 'receipt', label: 'Spend' },
  { key: 'analytics', icon: 'chart', label: 'Insights' },
  { key: 'shopping', icon: 'cart', label: 'List' },
  { key: 'assistant', icon: 'chat', label: 'Butler' },
]

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
        return active ? (
          <button key={t.key} aria-current="page" onClick={() => setPage(t.key)}
            style={{ ...reset, display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px 0 12px', background: C.amber, borderRadius: 22, flexShrink: 0 }}>
            <Icon name={`${t.icon}@18`} color={C.ink} />
            <span style={sans(13, 500, { color: C.ink, whiteSpace: 'nowrap' })}>{t.label}</span>
          </button>
        ) : (
          <button key={t.key} aria-label={t.label} onClick={() => setPage(t.key)}
            style={{ ...reset, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 44, flexShrink: 0 }}>
            <Icon name={`${t.icon}@20`} color={C.cream} />
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
  const { profile, transactions, inventory, budgets, shoppingList, saveProfile, saveTx, saveInv, saveBudgets, saveSL } = store

  const setPage = useCallback((p) => { setPageRaw(p); setMenuOpen(false); window.scrollTo(0, 0) }, [])

  const addTransaction = (items, store, date) => {
    const newTx = items.map((it) => ({
      id: uid(),
      item: String(it.item).trim(),
      qty: Number(it.qty) || 1,
      price: Number(it.price) || 0,
      category: it.category || 'Other',
      store: store || '',
      date: date || today(),
    }))
    saveTx([...newTx, ...transactions])

    const inv = [...inventory]
    newTx.forEach((tx) => {
      const idx = inv.findIndex((i) => i.name.toLowerCase().trim() === tx.item.toLowerCase())
      if (idx >= 0) {
        inv[idx] = { ...inv[idx], qty: (Number(inv[idx].qty) || 0) + tx.qty, lastPurchased: tx.date, lastPrice: tx.price, store: tx.store || inv[idx].store, status: 'high' }
      } else {
        inv.push({ id: uid(), name: tx.item, qty: tx.qty, category: tx.category, lastPurchased: tx.date, lastPrice: tx.price, store: tx.store, status: 'high' })
      }
    })
    saveInv(inv)

    // Tick off anything on the shopping list that was just bought
    const bought = new Set(newTx.map((t) => t.item.toLowerCase()))
    if (shoppingList.some((s) => !s.checked && bought.has(String(s.name).toLowerCase().trim()))) {
      saveSL(shoppingList.map((s) => (bought.has(String(s.name).toLowerCase().trim()) ? { ...s, checked: true } : s)))
    }
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
    const low = inventory.filter(isLow)
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
      lowStock: inventory.filter(isLow),
    }
  }, [transactions, inventory])

  if (store.phase === 'loading' || store.phase === 'syncing') return <Splash text={store.phase === 'syncing' ? 'Loading your household…' : ''} />
  if (store.phase === 'signedOut') return <SignIn />
  if (store.phase === 'error') return <Splash text={store.error} action={{ label: 'Try again', onClick: store.retry }} secondary={{ label: 'Sign out', onClick: store.signOut }} />
  if (store.phase === 'link' && store.pendingLocal) {
    return <LinkData local={store.pendingLocal} onMerge={() => store.resolveLocal(true)} onDiscard={() => store.resolveLocal(false)} />
  }

  if (!profile?.onboarded) {
    return <Onboarding profile={profile || DEFAULT_PROFILE} saveProfile={saveProfile} />
  }

  const openSheet = (type, props = {}) => { setMenuOpen(false); setSheet({ type, ...props }) }
  const closeSheet = () => setSheet(null)
  const header = { initials: toInitials(profile.name), onMenu: () => setMenuOpen((o) => !o), menuOpen }
  const data = { profile, transactions, inventory, budgets, shoppingList }
  const account = { email: store.session?.user?.email, sync: store.sync, signOut: store.signOut }
  const actions = { saveProfile, saveTx, saveInv, saveBudgets, saveSL, addTransaction, addToShoppingList, genShoppingList, setPage, openSheet, account }

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
        {pages[page]}
        {menuOpen && <OverflowMenu {...data} {...actions} onClose={() => setMenuOpen(false)} />}
      </main>
      <TabBar page={page} setPage={setPage} />
      {sheet && <Sheets sheet={sheet} onClose={closeSheet} {...data} {...actions} />}
    </div>
  )
}
