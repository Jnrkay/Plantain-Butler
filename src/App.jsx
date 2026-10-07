import { useState, useEffect } from 'react'
import { Home, Package, Receipt, ShoppingCart, BarChart3, MessageSquare, Settings, Menu } from 'lucide-react'
import { DEFAULT_PROFILE } from './lib/constants'
import { save, load } from './lib/storage'
import { uid, today, monthKey } from './lib/utils'
import { useIsMobile } from './lib/hooks'

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

const NAV_ITEMS = [
  { key: 'dashboard', icon: Home, label: 'Home' },
  { key: 'inventory', icon: Package, label: 'Stock' },
  { key: 'transactions', icon: Receipt, label: 'History' },
  { key: 'analytics', icon: BarChart3, label: 'Stats' },
  { key: 'shopping', icon: ShoppingCart, label: 'Shop' },
  { key: 'assistant', icon: MessageSquare, label: 'AI' },
  { key: 'settings', icon: Settings, label: 'Settings' },
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
      <div style={{ height: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', fontFamily: 'system-ui' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🍌</div>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>Loading Plantain Butler...</p>
      </div>
    )
  }

  if (!profile?.onboarded) {
    return <Onboarding profile={profile || DEFAULT_PROFILE} saveProfile={saveProfile} mobile={mobile} />
  }

  const sideW = sidebar ? 220 : 56

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

  return (
    <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', height: '100vh', background: '#0f1117', color: '#e2e8f0', fontFamily: 'system-ui' }}>
      {/* Desktop Sidebar */}
      {!mobile && (
        <div style={{
          width: sideW,
          background: '#161822',
          borderRight: '1px solid #1e2030',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width 0.2s ease',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #1e2030' }}>
            <button onClick={() => setSidebar(!sidebar)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex', flexShrink: 0 }}>
              <Menu size={20} />
            </button>
            {sidebar && <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>🍌 Plantain Butler</span>}
          </div>
          <nav style={{ flex: 1, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_ITEMS.map(({ key, icon: Ic, label }) => {
              const active = page === key
              return (
                <button key={key} onClick={() => setPage(key)} style={{
                  background: active ? 'rgba(6,182,212,0.12)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  padding: sidebar ? '10px 12px' : '10px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  color: active ? '#06b6d4' : '#94a3b8',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  fontFamily: 'system-ui',
                  justifyContent: sidebar ? 'flex-start' : 'center',
                  width: '100%',
                }}>
                  <Ic size={18} style={{ flexShrink: 0 }} />
                  {sidebar && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
                </button>
              )
            })}
          </nav>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: mobile ? 68 : 0 }}>
        {renderPage()}
      </div>

      {/* Mobile Bottom Nav */}
      {mobile && (
        <nav style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#161822',
          borderTop: '1px solid #1e2030',
          display: 'flex',
          justifyContent: 'space-around',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          zIndex: 50,
        }}>
          {NAV_ITEMS.map(({ key, icon: Ic, label }) => {
            const active = page === key
            return (
              <button key={key} onClick={() => setPage(key)} style={{
                background: 'none',
                border: 'none',
                padding: '8px 4px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                cursor: 'pointer',
                color: active ? '#06b6d4' : '#64748b',
                fontSize: 10,
                fontFamily: 'system-ui',
                minWidth: 0,
                flex: 1,
              }}>
                <Ic size={18} />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>
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
