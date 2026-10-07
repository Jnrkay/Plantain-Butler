import { useState, useMemo } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { T, monoLabel } from '../lib/theme'
import { Empty } from './shared'

const CATEGORY_ICONS = {
  Beverages: '☕',
  Toiletries: '🧴',
  Proteins: '🥩',
  Grains: '🌾',
  Cleaning: '🧹',
  Produce: '🥬',
  Dairy: '🧀',
  Snacks: '🍪',
  'Cooking Essentials': '🍳',
  Other: '📦',
}

function formatDateGroup(dateStr) {
  if (!dateStr) return 'NO DATE'
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${days[d.getDay()]} · ${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]}`
}

function getMonthLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}

function getDaysInMonth(dateStr) {
  if (!dateStr) return 31
  const d = new Date(dateStr + 'T00:00:00')
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function getDayOfMonth(dateStr) {
  if (!dateStr) return 1
  return new Date(dateStr + 'T00:00:00').getDate()
}

/* Simple spending mini-chart */
function SpendingChart({ transactions }) {
  const daysInMonth = transactions.length > 0 ? getDaysInMonth(transactions[0].date) : 31
  const latestDay = transactions.length > 0
    ? Math.max(...transactions.map(t => getDayOfMonth(t.date)))
    : 1
  const progress = latestDay / daysInMonth

  const dateTicks = [1, 8, 15, 22, daysInMonth]

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'visible', marginBottom: 8 }}>
        {/* Dashed line background */}
        <div style={{
          position: 'absolute', top: 3, left: 0, right: 0, height: 2,
          backgroundImage: `repeating-linear-gradient(to right, ${T.borderLight} 0, ${T.borderLight} 4px, transparent 4px, transparent 8px)`,
        }} />
        {/* Amber filled bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: `${Math.min(progress * 100, 100)}%`,
          height: 8, borderRadius: 4,
          background: T.amber,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {dateTicks.map(d => (
          <span key={d} style={{
            ...monoLabel,
            fontSize: 9,
            color: T.textLight,
          }}>
            {String(d).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function TransactionsPage({ transactions, saveTx, setModal, mobile }) {
  const [activeCategory, setActiveCategory] = useState('All')

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts = {}
    transactions.forEach(t => {
      const cat = t.category || 'Other'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [transactions])

  const categoryChips = useMemo(() => {
    const chips = [{ label: 'All', count: transactions.length }]
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      chips.push({ label: cat, count })
    })
    return chips
  }, [categoryCounts, transactions.length])

  // Filter
  const filtered = activeCategory === 'All'
    ? transactions
    : transactions.filter(t => (t.category || 'Other') === activeCategory)

  // Group by date
  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach(t => {
      const date = t.date || 'unknown'
      if (!groups[date]) groups[date] = []
      groups[date].push(t)
    })
    // Sort by date descending
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  // Month summary
  const totalAmount = transactions.reduce((sum, t) => sum + Number(t.price || 0) * Number(t.qty || 1), 0)
  const uniqueStores = new Set(transactions.map(t => t.store).filter(Boolean)).size
  const currentMonth = transactions.length > 0 ? getMonthLabel(transactions[0].date) : 'THIS MONTH'

  return (
    <div style={{ padding: mobile ? '20px 16px' : '32px 40px', maxWidth: 600, margin: '0 auto' }}>

      {/* Header row: Avatar + menu */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: T.teal, color: T.cream,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fontSans, fontWeight: T.semibold, fontSize: 13,
          letterSpacing: '0.5px',
        }}>
          ED
        </div>
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: T.textLight, padding: 4,
        }}>
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Title row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24,
      }}>
        <h1 style={{
          margin: 0, fontFamily: T.fontSans, fontWeight: T.semibold,
          fontSize: 28, color: T.deepTeal,
        }}>
          Transactions
        </h1>
        <button
          onClick={() => setModal && setModal('add')}
          style={{
            width: 40, height: 40, borderRadius: 10,
            background: T.amber, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.accentText, fontSize: 24, fontWeight: T.light,
            lineHeight: 1,
          }}
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      </div>

      {/* Month summary */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 20,
      }}>
        <div>
          <div style={{
            display: 'inline-block',
            background: T.teal, color: T.cream,
            borderRadius: T.radiusPill, padding: '4px 10px',
            fontFamily: T.fontMono, fontSize: 10, fontWeight: T.medium,
            letterSpacing: '0.6px', textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            {currentMonth}
          </div>
          <div style={{
            fontFamily: T.fontSans, fontSize: 13,
            color: T.textLight,
          }}>
            {transactions.length} purchase{transactions.length !== 1 ? 's' : ''} &middot; {uniqueStores} store{uniqueStores !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            fontFamily: T.fontSans, fontSize: 13,
            color: T.textLight, marginRight: 4,
          }}>
            GHS
          </span>
          <span style={{
            fontFamily: T.fontSans, fontSize: 36,
            fontWeight: T.light, color: T.deepTeal,
            letterSpacing: '-1.5px', lineHeight: 1,
          }}>
            {totalAmount.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Spending mini-chart */}
      <SpendingChart transactions={transactions} />

      {/* Category chips */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 24,
        overflowX: 'auto', paddingBottom: 4,
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        {categoryChips.map(chip => {
          const isActive = activeCategory === chip.label
          return (
            <button
              key={chip.label}
              onClick={() => setActiveCategory(chip.label)}
              style={{
                background: 'none',
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusPill,
                cursor: 'pointer',
                padding: '6px 14px',
                fontFamily: T.fontSans, fontSize: 13,
                fontWeight: isActive ? T.semibold : T.regular,
                color: isActive ? T.deepTeal : T.textLight,
                whiteSpace: 'nowrap', flexShrink: 0,
                borderColor: isActive ? T.deepTeal : T.border,
              }}
            >
              {chip.label} {chip.count}
            </button>
          )
        })}
      </div>

      {/* Transaction groups */}
      {filtered.length === 0 ? (
        <Empty>No transactions found.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grouped.map(([date, items]) => {
            const groupTotal = items.reduce((sum, t) => sum + Number(t.price || 0) * Number(t.qty || 1), 0)
            return (
              <div key={date}>
                {/* Date group header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 10, padding: '0 2px',
                }}>
                  <span style={{ ...monoLabel, color: T.textLight }}>
                    {formatDateGroup(date)}
                  </span>
                  <span style={{
                    fontFamily: T.fontSans, fontSize: 13,
                    color: T.textLight,
                  }}>
                    GHS {groupTotal.toFixed(2)}
                  </span>
                </div>

                {/* Transaction cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(t => {
                    const icon = CATEGORY_ICONS[t.category] || CATEGORY_ICONS['Other']
                    return (
                      <div
                        key={t.id}
                        style={{
                          background: T.surfaceCard,
                          border: `1px solid ${T.borderLight}`,
                          borderRadius: T.radiusMd,
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        {/* Category icon circle */}
                        <div style={{
                          width: 40, height: 40, borderRadius: 20,
                          background: T.teal,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, flexShrink: 0,
                        }}>
                          {icon}
                        </div>

                        {/* Item details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: T.fontSans, fontWeight: T.semibold,
                            fontSize: 15, color: T.text,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            marginBottom: 2,
                          }}>
                            {t.item}
                          </div>
                          <div style={{
                            ...monoLabel,
                            fontSize: 10,
                            color: T.textLight,
                          }}>
                            {t.store ? t.store.toUpperCase() : ''}
                            {t.qty > 1 ? ` · ×${t.qty}` : ''}
                          </div>
                        </div>

                        {/* Price */}
                        <div style={{
                          fontFamily: T.fontSans, fontWeight: T.light,
                          fontSize: 18, color: T.deepTeal,
                          flexShrink: 0,
                        }}>
                          {(Number(t.price || 0) * Number(t.qty || 1)).toFixed(2)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
