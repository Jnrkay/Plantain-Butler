import { useState } from 'react'
import { X } from 'lucide-react'
import { CATEGORIES } from '../lib/constants'
import { today } from '../lib/utils'
import { T } from '../lib/theme'
import { inputStyle, inputSm, labelStyle, btnStyle, btnPrimary, iconBtn } from '../lib/styles'
import { ModalWrapper } from './shared'

export default function ManualAddModal({ onClose, addTransaction, profile, mobile }) {
  const [items, setItems] = useState([{ item: '', qty: 1, price: 0, category: 'Other' }])
  const [store, setStore] = useState('')
  const [date, setDate] = useState(today())

  const updateItem = (i, field, value) => {
    const next = [...items]
    next[i] = { ...next[i], [field]: value }
    setItems(next)
  }

  const removeItem = (i) => {
    setItems(items.filter((_, idx) => idx !== i))
  }

  const addRow = () => {
    setItems([...items, { item: '', qty: 1, price: 0, category: 'Other' }])
  }

  const handleSubmit = () => {
    const validItems = items.filter(it => it.item.trim())
    if (validItems.length === 0) return
    addTransaction(validItems, store, date)
    onClose()
  }

  const storeHasOptions = profile?.stores?.length > 0

  return (
    <ModalWrapper onClose={onClose} title="Add Items" mobile={mobile}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: mobile ? 'wrap' : 'nowrap' }}>
          <div style={{ flex: 1, minWidth: mobile ? '100%' : 0 }}>
            <label style={labelStyle}>Store</label>
            {storeHasOptions ? (
              <select value={store} onChange={e => setStore(e.target.value)} style={inputStyle}>
                <option value="">Select store</option>
                {profile.stores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input value={store} onChange={e => setStore(e.target.value)} style={inputStyle} placeholder="Store name" />
            )}
          </div>
          <div style={{ minWidth: mobile ? '100%' : 140 }}>
            <label style={labelStyle}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Items</label>
          <div style={{ maxHeight: mobile ? 220 : 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: mobile ? '1fr 1fr' : '3fr 1fr 1fr 2fr auto',
                gap: 6,
                alignItems: 'end',
              }}>
                <div style={{ gridColumn: mobile ? '1 / -1' : undefined }}>
                  {i === 0 && <label style={{ ...labelStyle, fontSize: 10 }}>Item</label>}
                  <input value={it.item} onChange={e => updateItem(i, 'item', e.target.value)} style={inputSm} placeholder="Item name" />
                </div>
                <div>
                  {i === 0 && <label style={{ ...labelStyle, fontSize: 10 }}>Qty</label>}
                  <input type="number" min={1} value={it.qty} onChange={e => updateItem(i, 'qty', Math.max(1, +e.target.value))} style={inputSm} />
                </div>
                <div>
                  {i === 0 && <label style={{ ...labelStyle, fontSize: 10 }}>Price</label>}
                  <input type="number" min={0} step={0.01} value={it.price} onChange={e => updateItem(i, 'price', +e.target.value)} style={inputSm} />
                </div>
                <div>
                  {i === 0 && <label style={{ ...labelStyle, fontSize: 10 }}>Category</label>}
                  <select value={it.category} onChange={e => updateItem(i, 'category', e.target.value)} style={inputSm}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={() => removeItem(i)} disabled={items.length <= 1} style={{ ...iconBtn, color: items.length <= 1 ? T.textLight : T.error, opacity: items.length <= 1 ? 0.3 : 1, alignSelf: 'center' }}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addRow} style={{ ...btnStyle, background: 'none', boxShadow: 'none', color: T.teal, padding: '6px 0', fontSize: 12, marginTop: 6, fontFamily: T.fontSans }}>
            + Add row
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={btnStyle}>Cancel</button>
          <button onClick={handleSubmit} style={btnPrimary}>Add Items</button>
        </div>
      </div>
    </ModalWrapper>
  )
}
