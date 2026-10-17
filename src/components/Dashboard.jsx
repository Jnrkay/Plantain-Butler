// A1 · Dashboard (Figma 23:5539)
import { useEffect, useState } from 'react'
import { C, TX, sans, mono } from '../lib/theme'
import { MONTHS_LONG, money, monthlyBudget, sum, isLow } from '../lib/derive'
import { Header, Tag, Money, Barcode, Icon, reset } from './ui'

function Stat({ label, value, sub, first }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, padding: first ? '12px 0' : '12px 0 12px 12px',
      borderLeft: first ? 'none' : `1px solid ${C.ink18}`,
    }}>
      <span style={TX.micro}>{label}</span>
      <span style={sans(30, 300, { letterSpacing: -0.9, color: C.ink })}>{value}</span>
      <span style={sans(11, 400, { color: C.ink80, whiteSpace: 'nowrap' })}>{sub}</span>
    </div>
  )
}

// The month's total counts up the first time Home opens in a session (then stays put)
let countedUp = false
function useCountUp(target, ms = 650) {
  const [v, setV] = useState(countedUp ? target : 0)
  useEffect(() => {
    if (countedUp || !target || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { countedUp = true; setV(target); return }
    countedUp = true
    let raf, start
    const tick = (t) => {
      start ??= t
      const p = Math.min(1, (t - start) / ms)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); setV(target) }
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps
  return v
}

// Hero figure shrinks for very large totals so it never overflows the column
const heroSize = (s) => {
  const len = s.replace(/,/g, '').length + s.split(',').length * 0.35
  return len <= 6.4 ? 72 : Math.max(44, Math.floor((72 * 6.4) / len))
}

const STEPS = [
  { key: 'stock', label: 'Add what’s at home', done: (d) => d.inventory.length >= 3 || d.progress.stock, go: (a) => a.openSheet('manual') },
  { key: 'logged', label: 'Log a purchase', done: (d) => d.transactions.length > 0, go: (a) => a.openSheet('quickAdd') },
  { key: 'scanned', label: 'Scan a receipt', done: (d) => d.progress.scanned, go: (a) => a.openSheet('receipt') },
  { key: 'askedButler', label: 'Ask Butler something', done: (d) => d.progress.askedButler, go: (a) => a.setPage('assistant') },
  { key: 'invited', label: 'Invite your household', done: (d) => d.progress.invited, go: (a) => a.openSheet('household') },
]

const COLLAPSE_KEY = 'pb-checklist-collapsed'

function GettingStarted({ profile, inventory, transactions, openSheet, setPage, saveProfile }) {
  // Open or folded is remembered on this phone
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false } })
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* ignore */ } return !c })
  const progress = profile?.progress || {}
  if (progress.hideChecklist) return null
  const d = { inventory, transactions, progress }
  const done = STEPS.filter((s) => s.done(d)).length
  if (done === STEPS.length) return null
  const next = STEPS.find((s) => !s.done(d))
  return (
    <section style={{ padding: '0 20px 16px' }}>
      <div style={{ background: C.row, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Show getting started steps' : 'Fold getting started steps'}
            style={{ ...reset, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={TX.label}>GETTING STARTED · {done}/{STEPS.length}</span>
            <span style={{ display: 'flex', transition: 'transform .25s var(--ease-out)', transform: collapsed ? 'rotate(-90deg)' : 'none' }}><Icon name="chev@14" /></span>
          </button>
          <button onClick={() => saveProfile({ ...profile, progress: { ...progress, hideChecklist: true } })} style={{ ...reset, ...mono(10, 400, { letterSpacing: 0.8, color: C.ink80 }) }}>HIDE</button>
        </div>
        <button onClick={toggle} tabIndex={-1} aria-hidden style={{ ...reset, display: 'flex', gap: 4, width: '100%' }}>
          {STEPS.map((s) => <div key={s.key} style={{ flex: 1, height: 3, background: s.done(d) ? C.ink : C.ink15, transition: 'background-color .3s ease' }} />)}
        </button>
        {/* Folding uses a grid row that animates between 0 and its natural height */}
        <div style={{ display: 'grid', gridTemplateRows: collapsed ? '0fr' : '1fr', transition: 'grid-template-rows .3s var(--ease-out)', marginTop: collapsed ? -12 : 0 }}>
          <div style={{ overflow: 'hidden', minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: collapsed ? 0 : 1, transition: 'opacity .2s ease' }}>
              {STEPS.map((s) => {
                const ok = s.done(d)
                return (
                  <button key={s.key} disabled={ok} tabIndex={collapsed ? -1 : 0} onClick={() => s.go({ openSheet, setPage })} style={{ ...reset, display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: ok ? 'default' : 'pointer' }}>
                    <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ok ? C.ink : 'transparent', border: ok ? 'none' : `1.5px solid ${C.ink45}`, flexShrink: 0 }}>
                      {ok && <Icon name="check@12" color={C.amber} />}
                    </span>
                    <span style={{ ...sans(14, ok ? 400 : 500, { color: ok ? C.ink55 : C.ink, textDecoration: ok ? 'line-through' : 'none' }), flex: 1 }}>{s.label}</span>
                    {!ok && <Icon name="arrow@18" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        {/* Folded: just the next step, one tap away */}
        {collapsed && next && (
          <button onClick={() => next.go({ openSheet, setPage })} className="pb-msg" style={{ ...reset, display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <span style={mono(10, 400, { letterSpacing: 0.8, color: C.ink80 })}>NEXT</span>
            <span style={{ ...sans(14, 500, { color: C.ink }), flex: 1 }}>{next.label}</span>
            <Icon name="arrow@18" />
          </button>
        )}
      </div>
    </section>
  )
}

export default function Dashboard({ header, profile, inventory, transactions, monthTx, totalSpend, lowStock, shoppingList, openSheet, setPage, saveProfile }) {
  const month = MONTHS_LONG[new Date().getMonth()].toUpperCase()
  const budget = monthlyBudget(profile)
  const left = budget - totalSpend
  const totalStr = money(totalSpend)
  const size = heroSize(totalStr)
  const shown = useCountUp(totalSpend)

  const toBuy = shoppingList.filter((s) => !s.checked)
  const est = sum(toBuy, (s) => (Number(s.estPrice) || 0) * (Number(s.qty) || 1))
  const lowOnList = toBuy.filter((s) => isLow(inventory.find((i) => i.name.toLowerCase().trim() === String(s.name).toLowerCase().trim()))).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - env(safe-area-inset-top, 0px))' }}>
      <Header {...header} />

      {/* Hero 23:5561 */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 20px 12px' }}>
        <Tag>TOTAL SPENT · {month}</Tag>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={mono(13, 500, { color: C.ink80 })}>GHS</span>
          <Money value={money(shown)} size={size} tracking={-size * 0.05} />
        </div>
      </section>

      {/* Stats 23:5567 */}
      <section style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', borderTop: `1px solid ${C.ink18}`, borderBottom: `1px solid ${C.ink18}` }}>
          <Stat first label="IN STOCK" value={inventory.length} sub="items tracked" />
          <Stat label="LOW STOCK" value={lowStock.length} sub="needs restock" />
          <Stat label="THIS MONTH" value={monthTx.length} sub="transactions" />
        </div>
      </section>

      {/* Budget 23:5581 */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <span style={TX.label}>BUDGET LEFT</span>
          {budget > 0 ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, ...sans(24, 300, { letterSpacing: -0.72 }) }}>
              <span style={{ color: left < 0 ? C.ember : C.ink, whiteSpace: 'nowrap' }}>{left < 0 ? '−' : ''}{money(Math.abs(left))}</span>
              <span style={{ color: C.ink55, whiteSpace: 'nowrap' }}>/ {money(budget)}</span>
            </div>
          ) : (
            <button onClick={() => openSheet('budgets')} style={{ ...reset, ...sans(14, 500, { color: C.ink, textDecoration: 'underline', textUnderlineOffset: 3 }) }}>
              Set a monthly budget
            </button>
          )}
        </div>
        <Barcode bars={88} fraction={budget > 0 ? totalSpend / budget : 0} on={left < 0 ? C.ember : C.ink} />
      </section>

      <GettingStarted profile={profile} inventory={inventory} transactions={transactions} openSheet={openSheet} setPage={setPage} saveProfile={saveProfile} />

      {/* CTA stack 23:5678 */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 387 }}>
        <button
          onClick={() => openSheet('quickAdd')}
          style={{
            ...reset, height: 172, marginBottom: -24, flexShrink: 0, background: C.amber, borderRadius: '26px 26px 0 0',
            padding: '16px 20px 36px', display: 'flex', flexDirection: 'column', width: '100%',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span style={TX.label}>QUICK ADD</span>
            <span style={TX.label}>RECEIPT · ITEM</span>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <Icon name="plus@40" />
          </div>
        </button>

        <div
          style={{
            position: 'relative', flex: 1, minHeight: 239, background: C.teal, borderRadius: '26px 26px 0 0',
            padding: '16px 20px 36px', display: 'flex', flexDirection: 'column', gap: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ ...TX.label, color: C.blush80 }}>SHOPPING LIST</span>
            <span style={{ ...TX.label, color: C.blush80 }}>NEXT TRIP</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={sans(26, 300, { letterSpacing: -0.52, color: C.blush, whiteSpace: 'nowrap' })}>
                {toBuy.length === 0 ? 'Nothing to buy' : `${toBuy.length} ${toBuy.length === 1 ? 'item' : 'items'} to buy`}
              </span>
              <span style={sans(12, 400, { color: C.blush80, whiteSpace: 'nowrap' })}>
                {toBuy.length === 0 ? 'Build it from low stock' : `Est. GHS ${money(est)}${lowOnList ? ` · ${lowOnList} running low` : ''}`}
              </span>
            </div>
            <button aria-label="Open shopping list" onClick={() => setPage('shopping')}
              style={{ ...reset, width: 44, height: 44, background: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="arrow@18" />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
