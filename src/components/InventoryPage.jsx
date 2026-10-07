import { useState } from 'react';
import { Search, Plus, Edit3, Trash2, Check, X } from 'lucide-react';
import { CATEGORIES, STOCK_STATUS } from '../lib/constants';
import { uid, today, fmt } from '../lib/utils';
import { inputStyle, inputSm, labelStyle, btnStyle, btnPrimary, iconBtn } from '../lib/styles';
import { T, monoLabel } from '../lib/theme';
import { Empty } from './shared';

const defaultNewItem = { name: '', qty: 1, category: 'Other', status: 'high' };

function statusBadge(status) {
  const s = STOCK_STATUS[status];
  return {
    background: `${s.color}22`,
    border: `1px solid ${s.color}44`,
    color: s.color,
    padding: '2px 10px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: T.medium,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    fontFamily: T.fontSans,
  };
}

const statusLabels = { high: 'In Stock', medium: 'Running Low', low: 'Out of Stock' };
const statusCycle = { high: 'medium', medium: 'low', low: 'high' };

export default function InventoryPage({ inventory, saveInv, mobile }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ ...defaultNewItem });

  const filtered = inventory.filter(
    (i) => i.name.toLowerCase().includes(search.toLowerCase())
  );

  function addItem() {
    if (!newItem.name.trim()) return;
    const item = {
      ...newItem,
      id: uid(),
      lastPurchased: today(),
      lastPrice: 0,
      store: '',
    };
    saveInv([item, ...inventory]);
    setNewItem({ ...defaultNewItem });
    setAdding(false);
  }

  function cycleStatus(id) {
    saveInv(
      inventory.map((i) =>
        i.id === id ? { ...i, status: statusCycle[i.status] } : i
      )
    );
  }

  function deleteItem(id) {
    saveInv(inventory.filter((i) => i.id !== id));
  }

  function startEdit(item) {
    setEditing(item.id);
    setEditData({ ...item });
  }

  function saveEdit() {
    saveInv(inventory.map((i) => (i.id === editing ? { ...i, ...editData } : i)));
    setEditing(null);
    setEditData({});
  }

  function cancelEdit() {
    setEditing(null);
    setEditData({});
  }

  /* ---- shared form fields for add / edit ---- */
  function renderFormFields(data, setData, onSave, onCancel) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 140px' }}>
          <label style={labelStyle}>Name</label>
          <input
            style={inputStyle}
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="Item name"
          />
        </div>
        <div style={{ flex: '0 0 70px' }}>
          <label style={labelStyle}>Qty</label>
          <input
            style={{ ...inputStyle, ...inputSm }}
            type="number"
            min={0}
            value={data.qty}
            onChange={(e) => setData({ ...data, qty: Number(e.target.value) })}
          />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label style={labelStyle}>Category</label>
          <select
            style={inputStyle}
            value={data.category}
            onChange={(e) => setData({ ...data, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label style={labelStyle}>Status</label>
          <select
            style={inputStyle}
            value={data.status}
            onChange={(e) => setData({ ...data, status: e.target.value })}
          >
            <option value="high">In Stock</option>
            <option value="medium">Running Low</option>
            <option value="low">Out of Stock</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={{ ...iconBtn, color: T.success }} onClick={onSave}>
            <Check size={16} />
          </button>
          <button style={{ ...iconBtn, color: T.textLight }} onClick={onCancel}>
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  /* ---- MOBILE LAYOUT ---- */
  if (mobile) {
    return (
      <div style={{ padding: '20px 16px', maxWidth: 800, margin: '0 auto' }}>
        {/* Page title */}
        <h2 style={{ ...monoLabel, fontSize: 11, marginBottom: 20, marginTop: 0 }}>Inventory</h2>

        {/* Search + Add */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textLight }}
            />
            <input
              style={{ ...inputStyle, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
              placeholder="Search inventory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            style={{ ...btnStyle, ...btnPrimary, display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setAdding(!adding)}
          >
            <Plus size={16} /> Add
          </button>
        </div>

        {/* Add form */}
        {adding && (
          <div style={{
            background: T.surfaceCard,
            border: `1px solid ${T.borderLight}`,
            borderRadius: T.radiusMd,
            padding: 12,
            marginBottom: 12,
            boxShadow: T.shadowSm,
          }}>
            {renderFormFields(newItem, setNewItem, addItem, () => setAdding(false))}
          </div>
        )}

        {/* Cards */}
        {filtered.length === 0 ? (
          <Empty message="No items found" />
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              style={{
                background: T.surfaceCard,
                border: `1px solid ${T.borderLight}`,
                borderRadius: T.radiusMd,
                padding: 12,
                marginBottom: 8,
                boxShadow: T.shadowSm,
              }}
            >
              {editing === item.id ? (
                renderFormFields(editData, setEditData, saveEdit, cancelEdit)
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: T.text, fontWeight: T.semibold, fontSize: 14, marginBottom: 4, fontFamily: T.fontSans }}>
                      {item.name}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span
                        style={{
                          background: T.teal,
                          color: T.warm,
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontFamily: T.fontSans,
                          fontWeight: T.medium,
                        }}
                      >
                        {item.category}
                      </span>
                      <span style={{ color: T.textMuted, fontSize: 12, fontFamily: T.fontSans }}>Qty: {item.qty}</span>
                      {item.lastPrice > 0 && (
                        <span style={{ color: T.textLight, fontSize: 12, fontFamily: T.fontSans }}>{fmt(item.lastPrice)}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={statusBadge(item.status)} onClick={() => cycleStatus(item.id)}>
                      {statusLabels[item.status]}
                    </span>
                    <button style={iconBtn} onClick={() => startEdit(item)}>
                      <Edit3 size={14} />
                    </button>
                    <button style={{ ...iconBtn, color: T.error }} onClick={() => deleteItem(item.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    );
  }

  /* ---- DESKTOP LAYOUT ---- */
  const colTemplate = '2fr .7fr 1.2fr 1fr 1fr 80px';

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800, margin: '0 auto' }}>
      {/* Page title */}
      <h2 style={{ ...monoLabel, fontSize: 11, marginBottom: 20, marginTop: 0 }}>Inventory</h2>

      {/* Search + Add */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textLight }}
          />
          <input
            style={{ ...inputStyle, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
            placeholder="Search inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          style={{ ...btnStyle, ...btnPrimary, display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => setAdding(!adding)}
        >
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div style={{
          background: T.surfaceCard,
          border: `1px solid ${T.borderLight}`,
          borderRadius: T.radiusMd,
          padding: 12,
          marginBottom: 12,
          boxShadow: T.shadowSm,
        }}>
          {renderFormFields(newItem, setNewItem, addItem, () => setAdding(false))}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <Empty message="No items found" />
      ) : (
        <div style={{
          borderRadius: T.radiusMd,
          overflow: 'hidden',
          border: `1px solid ${T.borderLight}`,
          background: T.surfaceCard,
          boxShadow: T.shadowSm,
        }}>
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: colTemplate,
              background: T.surface,
              padding: '10px 14px',
              ...monoLabel,
              fontSize: 10,
              color: T.textLight,
            }}
          >
            <span>Item</span>
            <span>Qty</span>
            <span>Category</span>
            <span>Status</span>
            <span>Last Price</span>
            <span>Actions</span>
          </div>

          {/* Rows */}
          {filtered.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: colTemplate,
                padding: '10px 14px',
                alignItems: 'center',
                borderTop: `1px solid ${T.borderLight}`,
                background: T.surfaceCard,
                fontSize: 13,
                fontFamily: T.fontSans,
              }}
            >
              {editing === item.id ? (
                <>
                  <input
                    style={{ ...inputStyle, ...inputSm }}
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                  <input
                    style={{ ...inputStyle, ...inputSm, width: 50 }}
                    type="number"
                    min={0}
                    value={editData.qty}
                    onChange={(e) => setEditData({ ...editData, qty: Number(e.target.value) })}
                  />
                  <select
                    style={{ ...inputStyle, ...inputSm }}
                    value={editData.category}
                    onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    style={{ ...inputStyle, ...inputSm }}
                    value={editData.status}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                  >
                    <option value="high">In Stock</option>
                    <option value="medium">Running Low</option>
                    <option value="low">Out of Stock</option>
                  </select>
                  <span style={{ color: T.textLight, fontSize: 12 }}>
                    {item.lastPrice > 0 ? fmt(item.lastPrice) : '—'}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={{ ...iconBtn, color: T.success }} onClick={saveEdit}>
                      <Check size={14} />
                    </button>
                    <button style={{ ...iconBtn, color: T.textLight }} onClick={cancelEdit}>
                      <X size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span style={{ color: T.text, fontWeight: T.medium }}>{item.name}</span>
                  <span style={{ color: T.textMuted }}>{item.qty}</span>
                  <span>
                    <span
                      style={{
                        background: T.teal,
                        color: T.warm,
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: T.medium,
                      }}
                    >
                      {item.category}
                    </span>
                  </span>
                  <span>
                    <span style={statusBadge(item.status)} onClick={() => cycleStatus(item.id)}>
                      {statusLabels[item.status]}
                    </span>
                  </span>
                  <span style={{ color: T.textMuted }}>
                    {item.lastPrice > 0 ? fmt(item.lastPrice) : '—'}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={iconBtn} onClick={() => startEdit(item)}>
                      <Edit3 size={14} />
                    </button>
                    <button style={{ ...iconBtn, color: T.error }} onClick={() => deleteItem(item.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
