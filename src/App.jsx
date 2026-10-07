import { useState, useEffect } from 'react'
import { DEFAULT_PROFILE } from './lib/constants'
import { save, load } from './lib/storage'
import { uid, today, monthKey } from './lib/utils'
import { useIsMobile } from './lib/hooks'
import { T, TAB_BAR } from './lib/theme'

import Onboarding from './components/Onboarding'
import Dashboard from './components/Dashboard'
import InventoryPage from './components/InventoryPage'
import TransactionsPage from './components/TransactionsPage'
import AnalyticsPage from './components/AnalyticsPage'
import ShoppingPage from './components/ShoppingPage'
import AssistantPage from './components/AssistantPage'
import SettingsPage from './components/SettingsPage'
import ManualAddModal from './components/ManualAddModal'
import ReceiptModal from './components/ReceiptModal'

// Inline SVG tab icons matching the Figma design
const TabIcon = ({ name, size = 20 }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'home':
      return <svg {...props}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V13h6v8"/></svg>
    case 'inventory':
      return <svg {...props}><path d="M21 8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16V8z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>
    case 'transactions':
      return <svg {...props}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>
    case 'insights':
      return <svg {...props}><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
    case 'shopping':
      return <svg {...props}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
    case 'butler':
      return <svg {...props}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    case 'settings':
      return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    default:
      return null
  }
}

const NAV_ITEMS = [
  { key: 'dashboard', icon: 'home', label: 'Home' },
  { key: 'inventory', icon: 'inventory', label: 'Stock' },
  { key: 'transactions', icon: 'transactions', label: 'History' },
  { key: 'analytics', icon: 'insights', label: 'Insights' },
  { key: 'shopping', icon: 'shopping', label: 'Shop' },
  { key: 'assistant', icon: 'butler', label: 'Butler' },
]

export default function App() {
  const mobile = useIsMobile()
  const [page, setPage] = useState('dashboard')
  const [sidebar, setSidebar] = useState(true)
  const [profile, setProfile] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [inventory, setInventory] = useState([])
  const [budgets, setBudgets] = useState({})
  const [shoppingList, setShoppingList] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  useEffect(() => {
    const p = load('pb-profile', null)
    const tx = load('pb-transactions', [])
    const inv = load('pb-inventory', [])
    const b = load('pb-budgets', {})
    const sl = load('pb-shopping-list', [])
    setProfile(p)
    setTransactions(tx)
    setInventory(inv)
    setBudgets(b)
    setShoppingList(sl)
    setLoading(false)
  }, [])

  const saveProfile = (v) => { setProfile(v); save('pb-profile', v) }
  const saveTx = (v) => { setTransactions(v); save('pb-transactions', v) }
  const saveInv = (v) => { setInventory(v); save('pb-inventory', v) }
  const saveBudgets = (v) => { setBudgets(v); save('pb-budgets', v) }
  const saveSL = (v) => { setShoppingList(v); save('pb-shopping-list', v) }

  const addTransaction = (items, store, date) => {
    const newTx = items.map(it => ({
      id: uid(),
      item: it.item,
      qty: Number(it.qty) || 1,
      price: Number(it.price) || 0,
      category: it.category || 'Other',
      store: store || '',
      date: date || today(),
    }))

    const updatedTx = [...newTx, ...transactions]
    saveTx(updatedTx)

    const updatedInv = [...inventory]
    newTx.forEach(tx => {
      const idx = updatedInv.findIndex(i => i.name.toLowerCase().trim() === tx.item.toLowerCase().trim())
      if (idx >= 0) {
        updatedInv[idx] = {
          ...updatedInv[idx],
          qty: (updatedInv[idx].qty || 0) + (tx.qty || 1),
          lastPurchased: tx.date,
          lastPrice: tx.price,
          store: tx.store,
          status: 'high',
        }
      } else {
        updatedInv.push({
          id: uid(),
          name: tx.item,
          qty: tx.qty || 1,
          category: tx.category,
          lastPurchased: tx.date,
          lastPrice: tx.price,
          store: tx.store,
          status: 'high',
        })
      }
    })
    saveInv(updatedInv)
  }

  const genShoppingList = () => {
    const lowItems = inventory.filter(i => i.status === 'low' || i.status === 'medium')
    const list = lowItems.map(i => ({
      id: uid(),
      name: i.name,
      category: i.category || 'Other',
      estPrice: i.lastPrice || 0,
      store: i.store || '',
      checked: false,
    }))
    saveSL(list)
    return list
  }

  // Computed values
  const cm = monthKey(today())
  const monthTx = transactions.filter(t => monthKey(t.date) === cm)
  const totalSpend = monthTx.reduce((s, t) => s + (Number(t.price) * (Number(t.qty) || 1)), 0)
  const lowStock = inventory.filter(i => i.status === 'low' || i.status === 'medium')

  if (loading) {
    return (
      <div style={{ height: '100vh', background: T.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: T.fontSans }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🍌</div>
        <p style={{ color: T.textLight, fontSize: 14 }}>Loading Plantain Butler...</p>
      </div>
    )
  }

  if (!profile?.onboarded) {
    return <Onboarding profile={profile || DEFAULT_PROFILE} saveProfile={saveProfile} mobile={mobile} />
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard totalSpend={totalSpend} inventory={inventory} lowStock={lowStock} monthTx={monthTx} transactions={transactions} profile={profile} setModal={setModal} setPage={setPage} mobile={mobile} />
      case 'inventory':
        return <InventoryPage inventory={inventory} saveInv={saveInv} mobile={mobile} />
      case 'transactions':
        return <TransactionsPage transactions={transactions} saveTx={saveTx} setModal={setModal} mobile={mobile} />
      case 'analytics':
        return <AnalyticsPage transactions={transactions} budgets={budgets} profile={profile} mobile={mobile} />
      case 'shopping':
        return <ShoppingPage shoppingList={shoppingList} saveSL={saveSL} genShoppingList={genShoppingList} inventory={inventory} mobile={mobile} />
      case 'assistant':
        return <AssistantPage transactions={transactions} inventory={inventory} profile={profile} mobile={mobile} />
      case 'settings':
        return <SettingsPage profile={profile} saveProfile={saveProfile} budgets={budgets} saveBudgets={saveBudgets} saveInv={saveInv} saveTx={saveTx} saveSL={saveSL} mobile={mobile} />
      default:
        return null
    }
  }

  // Desktop sidebar width
  const sideW = sidebar ? 220 : 56

  return (
    <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', minHeight: '100vh', background: T.surface, color: T.text, fontFamily: T.fontSans }}>
      {/* Desktop Sidebar */}
      {!mobile && (
        <div style={{
          width: sideW,
          background: T.surfaceDeep,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width 0.2s ease',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(244,221,211,0.1)' }}>
            <button onClick={() => setSidebar(!sidebar)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.warm, padding: 4, display: 'flex', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            {sidebar && <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', color: T.warm }}>Plantain Butler</span>}
          </div>
          <nav style={{ flex: 1, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[...NAV_ITEMS, { key: 'settings', icon: 'settings', label: 'Settings' }].map(({ key, icon, label }) => {
              const active = page === key
              return (
                <button key={key} onClick={() => setPage(key)} style={{
                  background: active ? `${T.amber}20` : 'transparent',
                  border: 'none',
                  borderRadius: T.radiusSm,
                  padding: sidebar ? '10px 12px' : '10px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  color: active ? T.amber : T.textOnTealMuted,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  fontFamily: T.fontSans,
                  justifyContent: sidebar ? 'flex-start' : 'center',
                  width: '100%',
                }}>
                  <TabIcon name={icon} size={18} />
                  {sidebar && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
                </button>
              )
            })}
          </nav>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: mobile ? 100 : 0 }}>
        {renderPage()}
      </div>

      {/* Mobile Floating Pill Tab Bar */}
      {mobile && (
        <div style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          right: 16,
          zIndex: 50,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          <nav style={{
            background: TAB_BAR.bg,
            borderRadius: TAB_BAR.radius,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '8px 6px',
            boxShadow: '0 8px 32px rgba(18,38,35,0.25)',
          }}>
            {NAV_ITEMS.map(({ key, icon, label }) => {
              const active = page === key
              return (
                <button key={key} onClick={() => setPage(key)} style={{
                  background: active ? TAB_BAR.activePill : 'transparent',
                  border: 'none',
                  borderRadius: TAB_BAR.radius,
                  padding: active ? '8px 14px' : '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: active ? 6 : 0,
                  cursor: 'pointer',
                  color: active ? TAB_BAR.activeText : TAB_BAR.inactiveIcon,
                  fontSize: 12,
                  fontWeight: T.medium,
                  fontFamily: T.fontSans,
                  transition: 'all 0.2s ease',
                }}>
                  <TabIcon name={icon} size={18} />
                  {active && <span>{label}</span>}
                </button>
              )
            })}
          </nav>
        </div>
      )}

      {/* Modals */}
      {modal === 'manual' && (
        <ManualAddModal onClose={() => setModal(null)} addTransaction={addTransaction} profile={profile} mobile={mobile} />
      )}
      {modal === 'receipt' && (
        <ReceiptModal onClose={() => setModal(null)} addTransaction={addTransaction} mobile={mobile} />
      )}
    </div>
  )
}
