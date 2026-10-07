import { useMemo } from 'react'
import { Plus, ArrowRight } from 'lucide-react'
import { fmt } from '../lib/utils'
import { T, monoLabel, heroAmount } from '../lib/theme'

// Barcode budget visualization — 90 vertical bars with deterministic heights
function BudgetBarcode({ spent, total }) {
  const bars = 90
  const pct = total > 0 ? Math.min(1, spent / total) : 0
  const filledBars = Math.round(pct * bars)
  const overBudget = spent > total

  // Deterministic pseudo-random heights so they don't change on re-render
  const heights = useMemo(() =>
    Array.from({ length: bars }, (_, i) => {
      const seed = Math.sin(i * 127.1 + 311.7) * 43758.5453
      return 55 + (seed - Math.floor(seed)) * 45
    }), [bars])

  return (
    <div style={{ display: 'flex', gap: 1, height: 40, alignItems: 'flex-end' }}>
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${h}%`,
            background: i < filledBars
              ? (overBudget ? T.error : T.deepTeal)
              : 'rgba(18,38,35,0.15)',
            borderRadius: 0.5,
            transition: 'background 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}

export default function Dashboard({ totalSpend, inventory, lowStock, monthTx, transactions, profile, setModal, setPage, mobile }) {
  const budget = profile.monthlyBudget || 0
  const remaining = Math.max(0, budget - totalSpend)

  // Initials for avatar
  const initials = (profile.name || 'PB').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  // Current month name
  const monthName = new Date().toLocaleString('en', { month: 'long' }).toUpperCase()

  // Format number without currency prefix (for hero display)
  const fmtNum = (n) => Number(n || 0).toFixed(2)

  // Shopping list count (low stock items)
  const shoppingCount = lowStock.length
  const shoppingEst = lowStock.reduce((sum, item) => sum + Number(item.price || 0), 0)
  const runningLowCount = lowStock.filter(i => i.status === 'low').length

  return (
    <div style={{ padding: '20px 16px', maxWidth: 800, margin: '0 auto' }}>

      {/* 1. Header row — avatar left, menu right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: T.teal, color: T.cream,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fontMono, fontSize: 12, fontWeight: T.medium,
          letterSpacing: '0.5px',
        }}>
          {initials}
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 3, cursor: 'pointer', padding: 4,
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 4, height: 4, borderRadius: '50%',
              background: T.deepTeal,
            }} />
          ))}
        </div>
      </div>

      {/* 2. Total Spent pill label */}
      <div style={{ marginBottom: 12 }}>
        <span style={{
          display: 'inline-block',
          background: T.teal,
          color: T.cream,
          fontFamily: T.fontMono,
          fontSize: 10,
          fontWeight: T.medium,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          padding: '4px 10px',
          borderRadius: T.radiusSm,
          lineHeight: 1.2,
        }}>
          {`TOTAL SPENT · ${monthName}`}
        </span>
      </div>

      {/* 3. Hero Amount — GHS prefix + large number */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: T.fontSans,
          fontSize: 14,
          fontWeight: T.regular,
          color: T.deepTeal,
          lineHeight: 1,
        }}>
          GHS
        </span>
        <span style={{
          ...heroAmount,
          fontSize: 72,
        }}>
          {fmtNum(totalSpend)}
        </span>
      </div>

      {/* 4. Stats Row — three columns with dividers */}
      <div style={{
        display: 'flex',
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        padding: '14px 0',
        marginBottom: 24,
      }}>
        {/* In Stock */}
        <div style={{ flex: 1 }}>
          <div style={{ ...monoLabel, marginBottom: 6 }}>IN STOCK</div>
          <div style={{ fontSize: 28, fontWeight: T.medium, color: T.deepTeal, lineHeight: 1 }}>{inventory.length}</div>
          <div style={{ fontSize: 12, color: T.textLight, marginTop: 4, fontFamily: T.fontSans }}>items tracked</div>
        </div>
        {/* Low Stock */}
        <div style={{ flex: 1, borderLeft: `1px solid ${T.border}`, paddingLeft: 16 }}>
          <div style={{ ...monoLabel, marginBottom: 6 }}>LOW STOCK</div>
          <div style={{ fontSize: 28, fontWeight: T.medium, color: T.deepTeal, lineHeight: 1 }}>{lowStock.length}</div>
          <div style={{ fontSize: 12, color: T.textLight, marginTop: 4, fontFamily: T.fontSans }}>needs restock</div>
        </div>
        {/* This Month */}
        <div style={{ flex: 1, borderLeft: `1px solid ${T.border}`, paddingLeft: 16 }}>
          <div style={{ ...monoLabel, marginBottom: 6 }}>THIS MONTH</div>
          <div style={{ fontSize: 28, fontWeight: T.medium, color: T.deepTeal, lineHeight: 1 }}>{monthTx.length}</div>
          <div style={{ fontSize: 12, color: T.textLight, marginTop: 4, fontFamily: T.fontSans }}>transactions</div>
        </div>
      </div>

      {/* 5. Budget Section — label row + barcode */}
      {budget > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ ...monoLabel }}>BUDGET LEFT</span>
            <span style={{
              fontFamily: T.fontSans,
              fontSize: 14,
              fontWeight: T.regular,
              color: T.deepTeal,
            }}>
              {fmtNum(remaining)} / {fmtNum(budget)}
            </span>
          </div>
          <BudgetBarcode spent={totalSpend} total={budget} />
        </div>
      )}

      {/* 6 & 7. Stacked CTA Cards — Quick Add on top, Shopping List behind */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        {/* Quick Add card — sits on top */}
        <button
          onClick={() => setModal('manual')}
          style={{
            display: 'block',
            width: '100%',
            background: T.teal,
            color: T.cream,
            border: 'none',
            borderRadius: T.radiusXl,
            padding: '20px 24px',
            cursor: 'pointer',
            fontFamily: T.fontSans,
            textAlign: 'left',
            position: 'relative',
            zIndex: 2,
            boxShadow: T.shadowMd,
          }}
        >
          {/* Top labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ ...monoLabel, color: T.textOnTealMuted }}>QUICK ADD</span>
            <span style={{ ...monoLabel, color: T.textOnTealMuted }}>RECEIPT &middot; ITEM</span>
          </div>
          {/* Large + icon centered */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '12px 0' }}>
            <Plus size={36} strokeWidth={1.5} color={T.cream} />
          </div>
        </button>

        {/* Shopping List card — partially behind Quick Add */}
        <button
          onClick={() => setPage('shopping')}
          style={{
            display: 'block',
            width: '100%',
            background: T.deepTeal,
            color: T.cream,
            border: 'none',
            borderRadius: T.radiusXl,
            padding: '20px 24px',
            paddingTop: 32,
            marginTop: -14,
            cursor: 'pointer',
            fontFamily: T.fontSans,
            textAlign: 'left',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Top labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ ...monoLabel, color: T.textOnTealMuted }}>SHOPPING LIST</span>
            <span style={{ ...monoLabel, color: T.textOnTealMuted }}>NEXT TRIP</span>
          </div>
          {/* Content row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: T.medium, color: T.cream, marginBottom: 4 }}>
                {shoppingCount} item{shoppingCount !== 1 ? 's' : ''} to buy
              </div>
              <div style={{ fontSize: 13, color: T.textOnTealMuted }}>
                Est. GHS {fmtNum(shoppingEst)} {runningLowCount > 0 ? `· ${runningLowCount} running low` : ''}
              </div>
            </div>
            <div style={{
              width: 36, height: 36,
              background: T.amber,
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ArrowRight size={18} color={T.deepTeal} />
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
