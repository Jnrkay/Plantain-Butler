import { useState } from 'react'
import { Search, SlidersHorizontal, Plus, X, MoreHorizontal } from 'lucide-react'
import { T, monoLabel } from '../lib/theme'
import { CATEGORIES } from '../lib/constants'
import { uid } from '../lib/utils'

const CATEGORY_ICONS = {
  Beverages: '☕', Toiletries: '🧴', Proteins: '🥩', Grains: '🌾',
  Cleaning: '🧹', Produce: '🥬', Dairy: '🧀', Snacks: '🍪',
  'Cooking Essentials': '🍳', Other: '📦',
}

const defaultNewItem = { name: '', qty: 1, category: 'Other', status: 'high', lastPrice: 0 }

const statusCycle = { high: 'medium', medium: 'low', low: 'high' }

function stockIndicator(status) {
  const colorMap = { high: T.success, medium: T.warning, low: T.error }
  const labelMap = { high: 'OK', medium: 'MED', low: 'LOW' }
  const fillCount = { high: 3, medium: 2, low: 1 }
  const color = colorMap[status]
  const filled = fillCount[status]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 14,
              height: 3,
              borderRadius: 1.5,
              background: i < filled ? color : `${T.deepTeal}18`,
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontFamily: T.fontMono,
          fontSize: 10,
          fontWeight: T.semibold,
          letterSpacing: '0.5px',
          color,
        }}
      >
        {labelMap[status]}
      </span>
    </div>
  )
}

export default function InventoryPage({ inventory, saveInv, mobile }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [editing, setEditing] = useState(null)
  const [editData, setEditData] = useState({})
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ ...defaultNewItem })

  /* ---- filtering ---- */
  const lowCount = inventory.filter((i) => i.status === 'low' || i.status === 'medium').length
  const categoryCounts = {}
  inventory.forEach((i) => {
    categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1
  })
  const activeCategories = Object.keys(categoryCounts)

  let filtered = inventory
  if (filter === 'Low') {
    filtered = filtered.filter((i) => i.status === 'low' || i.status === 'medium')
  } else if (filter !== 'All') {
    filtered = filtered.filter((i) => i.category === filter)
  }
  if (search) {
    filtered = filtered.filter((i) =>
      i.name.toLowerCase().includes(search.toLowerCase())
    )
  }

  /* ---- CRUD handlers ---- */
  function addItem() {
    if (!newItem.name.trim()) return
    const item = {
      ...newItem,
      id: uid(),
      lastPurchased: new Date().toISOString().split('T')[0],
      lastPrice: newItem.lastPrice || 0,
      store: '',
    }
    saveInv([item, ...inventory])
    setNewItem({ ...defaultNewItem })
    setAdding(false)
  }

  function cycleStatus(id) {
    saveInv(
      inventory.map((i) =>
        i.id === id ? { ...i, status: statusCycle[i.status] } : i
      )
    )
  }

  function deleteItem(id) {
    saveInv(inventory.filter((i) => i.id !== id))
  }

  function startEdit(item) {
    setEditing(item.id)
    setEditData({ ...item })
  }

  function saveEdit() {
    saveInv(inventory.map((i) => (i.id === editing ? { ...i, ...editData } : i)))
    setEditing(null)
    setEditData({})
  }

  function cancelEdit() {
    setEditing(null)
    setEditData({})
  }

  /* ---- filter chips data ---- */
  const chipItems = [
    { key: 'All', label: 'All', count: inventory.length },
    ...activeCategories.map((c) => ({ key: c, label: c, count: categoryCounts[c] })),
    { key: 'Low', label: 'Low', count: lowCount },
  ]

  /* ---- swipe-to-delete placeholder: long-press to delete ---- */
  function handleCardContext(e, id) {
    e.preventDefault()
    if (window.confirm('Delete this item?')) {
      deleteItem(id)
    }
  }

  /* ---- inline form for add/edit ---- */
  function renderForm(data, setData, onSave, onCancel) {
    const fieldLabel = {
      display: 'block',
      fontSize: 10,
      color: T.textLight,
      marginBottom: 3,
      fontWeight: T.semibold,
      fontFamily: T.fontMono,
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
    }
    const fieldInput = {
      background: T.cream,
      border: `1px solid ${T.border}`,
      borderRadius: T.radiusSm,
      padding: '9px 12px',
      color: T.text,
      fontSize: 13,
      outline: 'none',
      fontFamily: T.fontSans,
      width: '100%',
      boxSizing: 'border-box',
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={fieldLabel}>Name</label>
          <input
            style={fieldInput}
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="Item name"
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={fieldLabel}>Qty</label>
            <input
              style={fieldInput}
              type="number"
              min={0}
              value={data.qty}
              onChange={(e) => setData({ ...data, qty: Number(e.target.value) })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={fieldLabel}>Price</label>
            <input
              style={fieldInput}
              type="number"
              min={0}
              step={0.01}
              value={data.lastPrice || ''}
              onChange={(e) => setData({ ...data, lastPrice: Number(e.target.value) })}
              placeholder="0.00"
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={fieldLabel}>Category</label>
            <select
              style={fieldInput}
              value={data.category}
              onChange={(e) => setData({ ...data, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={fieldLabel}>Status</label>
            <select
              style={fieldInput}
              value={data.status}
              onChange={(e) => setData({ ...data, status: e.target.value })}
            >
              <option value="high">In Stock</option>
              <option value="medium">Running Low</option>
              <option value="low">Out of Stock</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            style={{
              background: 'none',
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              padding: '8px 20px',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: T.fontSans,
              fontWeight: T.medium,
              color: T.textMuted,
            }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            style={{
              background: T.accent,
              border: 'none',
              borderRadius: T.radiusSm,
              padding: '8px 20px',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: T.fontSans,
              fontWeight: T.semibold,
              color: T.accentText,
            }}
            onClick={onSave}
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  /* ---- render an inventory card ---- */
  function renderCard(item) {
    const isWarning = item.status === 'medium' || item.status === 'low'
    const icon = CATEGORY_ICONS[item.category] || '📦'
    const price = item.lastPrice > 0 ? `GHS ${Number(item.lastPrice).toFixed(2)}` : ''

    if (editing === item.id) {
      return (
        <div
          key={item.id}
          style={{
            background: T.surfaceCard,
            border: `1px solid ${T.borderLight}`,
            borderRadius: T.radiusMd,
            padding: 14,
            marginBottom: 8,
          }}
        >
          {renderForm(editData, setEditData, saveEdit, cancelEdit)}
        </div>
      )
    }

    return (
      <div
        key={item.id}
        onClick={() => startEdit(item)}
        style={{
          background: T.surfaceCard,
          border: `1px solid ${T.borderLight}`,
          borderRadius: T.radiusMd,
          padding: '14px 14px 14px 14px',
          marginBottom: 8,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderLeft: isWarning ? `3px solid ${item.status === 'low' ? T.error : T.warning}` : `1px solid ${T.borderLight}`,
          position: 'relative',
        }}
      >
        {/* Category circle icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: T.teal,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        {/* Name + category line */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: T.deepTeal,
              fontWeight: T.semibold,
              fontSize: 15,
              fontFamily: T.fontSans,
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.name}
          </div>
          <div
            style={{
              fontFamily: T.fontMono,
              fontSize: 10,
              fontWeight: T.medium,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              color: T.textLight,
              marginTop: 3,
            }}
          >
            {item.category.toUpperCase()}{price ? ` · ${price}` : ''}
          </div>
        </div>

        {/* Qty + stock indicator */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span
              style={{
                fontFamily: T.fontMono,
                fontSize: 9,
                fontWeight: T.medium,
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
                color: T.textLight,
              }}
            >
              QTY
            </span>
            <span
              style={{
                fontFamily: T.fontSans,
                fontSize: 28,
                fontWeight: T.light,
                color: T.deepTeal,
                lineHeight: 1,
              }}
            >
              {String(item.qty).padStart(2, '0')}
            </span>
          </div>
          <div onClick={(e) => { e.stopPropagation(); cycleStatus(item.id) }}>
            {stockIndicator(item.status)}
          </div>
        </div>
      </div>
    )
  }

  /* ---- MAIN RENDER ---- */
  return (
    <div style={{ padding: '16px 16px 24px', maxWidth: 480, margin: '0 auto' }}>
      {/* 1. Header row: Avatar + menu */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: T.teal,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: T.cream,
            fontFamily: T.fontSans,
            fontWeight: T.semibold,
            fontSize: 13,
            letterSpacing: '0.5px',
          }}
        >
          ED
        </div>
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: T.textMuted,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* 2. Title row: "Inventory" + amber "+" button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: T.fontSans,
            fontWeight: T.semibold,
            fontSize: 28,
            color: T.deepTeal,
            lineHeight: 1.1,
          }}
        >
          Inventory
        </h2>
        <button
          onClick={() => setAdding(!adding)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: T.accent,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: T.accentText,
          }}
        >
          {adding ? <X size={20} strokeWidth={2.5} /> : <Plus size={20} strokeWidth={2.5} />}
        </button>
      </div>

      {/* 3. Search bar + filter button */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 14,
          alignItems: 'stretch',
        }}
      >
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: T.textLight,
            }}
          />
          <input
            style={{
              background: T.surfaceCard,
              border: `1px solid ${T.borderLight}`,
              borderRadius: T.radiusMd,
              padding: '12px 14px 12px 38px',
              color: T.text,
              fontSize: 14,
              outline: 'none',
              fontFamily: T.fontSans,
              width: '100%',
              boxSizing: 'border-box',
              height: '100%',
            }}
            placeholder="Search inventory"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          style={{
            width: 44,
            height: 44,
            borderRadius: T.radiusMd,
            background: T.surfaceCard,
            border: `1px solid ${T.borderLight}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: T.textLight,
            flexShrink: 0,
          }}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* 4. Category filter chips */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 18,
          overflowX: 'auto',
          paddingBottom: 2,
          WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {chipItems.map((chip) => {
          const active = filter === chip.key
          return (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              style={{
                background: active ? `${T.deepTeal}0a` : 'none',
                border: `1px solid ${active ? T.deepTeal : T.border}`,
                borderRadius: T.radiusPill,
                padding: '6px 14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: T.fontSans,
                fontSize: 13,
                fontWeight: active ? T.semibold : T.regular,
                color: active ? T.deepTeal : T.textLight,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0,
              }}
            >
              {chip.label}
              <span
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 11,
                  color: active ? T.deepTeal : T.textLight,
                  fontWeight: T.regular,
                }}
              >
                {chip.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Add form */}
      {adding && (
        <div
          style={{
            background: T.surfaceCard,
            border: `1px solid ${T.borderLight}`,
            borderRadius: T.radiusMd,
            padding: 14,
            marginBottom: 12,
            boxShadow: T.shadowSm,
          }}
        >
          {renderForm(newItem, setNewItem, addItem, () => setAdding(false))}
        </div>
      )}

      {/* 5. Inventory item cards */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: T.textLight,
            fontFamily: T.fontSans,
            fontSize: 14,
          }}
        >
          No items found
        </div>
      ) : (
        filtered.map((item) => (
          <div key={item.id} onContextMenu={(e) => handleCardContext(e, item.id)}>
            {renderCard(item)}
          </div>
        ))
      )}
    </div>
  )
}
