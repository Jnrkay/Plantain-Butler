import { useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { CATEGORIES } from '../lib/constants'
import { fmt } from '../lib/utils'
import { inputStyle, iconBtn } from '../lib/styles'
import { Empty } from './shared'

const colors = {
  bg: '#0f1117',
  surface: '#161822',
  surface2: '#1a1d2e',
  border: '#1e2030',
  text: '#e2e8f0',
  muted: '#94a3b8',
  dim: '#64748b',
  accent: '#06b6d4',
}

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
    <div>
      <h2 style={{ margin: '0 0 16px', color: colors.text, fontSize: 20, fontWeight: 700 }}>
        Transactions
      </h2>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 180px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: colors.dim, pointerEvents: 'none' }}
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
        <div style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>
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
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: colors.text, fontWeight: 600, fontSize: 15, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.item}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: colors.muted }}>
                  {t.category && (
                    <span style={{
                      background: colors.surface2,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 12,
                      color: colors.muted,
                    }}>
                      {t.category}
                    </span>
                  )}
                  {t.store && <span>{t.store}</span>}
                  {t.date && <span style={{ color: colors.dim }}>{t.date}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: colors.accent, fontWeight: 600, fontSize: 15 }}>
                    {fmt(t.price)}
                  </div>
                  {t.qty > 1 && (
                    <div style={{ color: colors.dim, fontSize: 12 }}>x{t.qty}</div>
                  )}
                </div>
                <button
                  onClick={() => deleteTx(t.id)}
                  style={{ ...iconBtn, color: colors.dim, flexShrink: 0 }}
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
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
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
              <tr style={{ background: colors.surface2 }}>
                {['Item', 'Qty', 'Price', 'Category', 'Store', 'Date', ''].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '10px 12px',
                      textAlign: i === 1 || i === 2 ? 'right' : 'left',
                      color: colors.muted,
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: `1px solid ${colors.border}`,
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
                  style={{ borderBottom: `1px solid ${colors.border}` }}
                >
                  <td style={{ padding: '10px 12px', color: colors.text, fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.item}
                  </td>
                  <td style={{ padding: '10px 12px', color: colors.muted, fontSize: 14, textAlign: 'right' }}>
                    {t.qty || 1}
                  </td>
                  <td style={{ padding: '10px 12px', color: colors.accent, fontWeight: 600, fontSize: 14, textAlign: 'right' }}>
                    {fmt(t.price)}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>
                    {t.category && (
                      <span style={{
                        background: colors.surface2,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 6,
                        padding: '2px 8px',
                        color: colors.muted,
                        fontSize: 12,
                      }}>
                        {t.category}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: colors.muted, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.store}
                  </td>
                  <td style={{ padding: '10px 12px', color: colors.dim, fontSize: 13 }}>
                    {t.date}
                  </td>
                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                    <button
                      onClick={() => deleteTx(t.id)}
                      style={{ ...iconBtn, color: colors.dim }}
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
