// A1 · Dashboard (Figma 23:5539)
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

// Hero figure shrinks for very large totals so it never overflows the column
const heroSize = (s) => {
  const len = s.replace(/,/g, '').length + s.split(',').length * 0.35
  return len <= 6.4 ? 72 : Math.max(44, Math.floor((72 * 6.4) / len))
}

export default function Dashboard({ header, profile, inventory, monthTx, totalSpend, lowStock, shoppingList, openSheet, setPage }) {
  const month = MONTHS_LONG[new Date().getMonth()].toUpperCase()
  const budget = monthlyBudget(profile)
  const left = budget - totalSpend
  const totalStr = money(totalSpend)
  const size = heroSize(totalStr)

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
          <Money value={totalStr} size={size} tracking={-size * 0.05} />
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
