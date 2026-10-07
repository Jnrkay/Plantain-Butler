import { useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { CATEGORIES } from '../lib/constants'
import { fmt } from '../lib/utils'
import { inputStyle, iconBtn } from '../lib/styles'
import { T, monoLabel } from '../lib/theme'
import { Empty } from './shared'

const MAX_VISIBLE = 50

export default function TransactionsPage({ transactions, saveTx, mobile }) {
  const [filter, setFilter] = useState({ search: '', category: '' })

  const filtered = transactions.filter(t => {
    if (filter.search && !(t.item || '').toLowerCase().includes(filter.search.toLowerCase()) && !(t.store || '').toLowerCase().includes(filter.search.toLowerCase())) return false
    if (filter.category && t.category !== filter.category) return false
    return true
  })

  const deleteTx = id => saveTx(transactions.filter(t => t.id !== id))

  const visible = filtered.slice(0, MAX_VISIBLE)

  return (
    <div style={{ padding: mobile ? '20px 16px' : '32px 40px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ ...monoLabel, marginBottom: 4 }}>Transactions</div>
      <h2 style={{
        margin: '0 0 20px',
        color: T.text,
        fontSize: 22,
        fontWeight: T.semibold,
        fontFamily: T.fontSans,
      }}>
        All Purchases
      </h2>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 180px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textLight, pointerEvents: 'none' }}
          />
          <input
            placeholder="Search items or stores..."
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
            style={{ ...inputStyle, paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={filter.category}
          onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}
          style={{
            ...inputStyle,
            flex: mobile ? '1 1 100%' : '0 0 140px',
            boxSizing: 'border-box',
          }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {filtered.length > MAX_VISIBLE && (
        <div style={{ color: T.textMuted, fontSize: 13, marginBottom: 12, fontFamily: T.fontSans }}>
          Showing {MAX_VISIBLE} of {filtered.length}
        </div>
      )}

      {filtered.length === 0 ? (
        <Empty>No transactions found.</Empty>
      ) : mobile ? (
        /* Mobile card layout */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(t => (
            <div
              key={t.id}
              style={{
                background: T.surfaceCard,
                border: `1px solid ${T.borderLight}`,
                borderRadius: T.radiusMd,
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: T.text, fontWeight: T.semibold, fontSize: 15, fontFamily: T.fontSans, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.item}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: T.textMuted, fontFamily: T.fontSans }}>
                  {t.category && (
                    <span style={{
                      background: T.teal + '15',
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 12,
                      color: T.teal,
                      fontFamily: T.fontSans,
                    }}>
                      {t.category}
                    </span>
                  )}
                  {t.store && <span>{t.store}</span>}
                  {t.date && <span style={{ color: T.textLight }}>{t.date}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: T.teal, fontWeight: T.semibold, fontSize: 15, fontFamily: T.fontMono }}>
                    {fmt(t.price)}
                  </div>
                  {t.qty > 1 && (
                    <div style={{ color: T.textLight, fontSize: 12, fontFamily: T.fontMono }}> x{t.qty}</div>
                  )}
                </div>
                <button
                  onClick={() => deleteTx(t.id)}
                  style={{ ...iconBtn, color: T.error, flexShrink: 0 }}
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Desktop table layout */
        <div style={{ border: `1px solid ${T.borderLight}`, borderRadius: T.radiusLg, overflow: 'hidden', boxShadow: T.shadowSm }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: T.fontSans }}>
            <colgroup>
              <col style={{ width: '2fr' }} />
              <col style={{ width: '.6fr' }} />
              <col style={{ width: '1fr' }} />
              <col style={{ width: '1.1fr' }} />
              <col style={{ width: '1fr' }} />
              <col style={{ width: '.9fr' }} />
              <col style={{ width: 40 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'rgba(18,38,35,0.04)' }}>
                {['Item', 'Qty', 'Price', 'Category', 'Store', 'Date', ''].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '10px 12px',
                      textAlign: i === 1 || i === 2 ? 'right' : 'left',
                      color: T.textLight,
                      fontSize: 10,
                      fontWeight: T.medium,
                      fontFamily: T.fontMono,
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      borderBottom: `1px solid ${T.borderLight}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(t => (
                <tr
                  key={t.id}
                  style={{ borderBottom: `1px solid ${T.borderLight}`, background: T.surfaceCard }}
                >
                  <td style={{ padding: '10px 12px', color: T.text, fontWeight: T.medium, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.item}
                  </td>
                  <td style={{ padding: '10px 12px', color: T.textMuted, fontSize: 14, textAlign: 'right', fontFamily: T.fontMono }}>
                    {t.qty || 1}
                  </td>
                  <td style={{ padding: '10px 12px', color: T.teal, fontWeight: T.semibold, fontSize: 14, textAlign: 'right', fontFamily: T.fontMono }}>
                    {fmt(t.price)}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>
                    {t.category && (
                      <span style={{
                        background: T.teal + '15',
                        borderRadius: 6,
                        padding: '2px 8px',
                        color: T.teal,
                        fontSize: 12,
                      }}>
                        {t.category}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: T.textMuted, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.store}
                  </td>
                  <td style={{ padding: '10px 12px', color: T.textLight, fontSize: 13 }}>
                    {t.date}
                  </td>
                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                    <button
                      onClick={() => deleteTx(t.id)}
                      style={{ ...iconBtn, color: T.error }}
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
