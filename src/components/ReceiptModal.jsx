import { useState, useRef } from 'react'
import { Camera, X } from 'lucide-react'
import { CATEGORIES } from '../lib/constants'
import { today } from '../lib/utils'
import { inputStyle, inputSm, labelStyle, btnStyle, btnPrimary, iconBtn } from '../lib/styles'
import { ModalWrapper } from './shared'

export default function ReceiptModal({ onClose, addTransaction, mobile }) {
  const [step, setStep] = useState('upload')
  const [store, setStore] = useState('')
  const [date, setDate] = useState(today())
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const updateItem = (i, field, value) => {
    const next = [...items]
    next[i] = { ...next[i], [field]: value }
    setItems(next)
  }

  const removeItem = (i) => {
    setItems(items.filter((_, idx) => idx !== i))
  }

  const addMissing = () => {
    setItems([...items, { item: '', qty: 1, price: 0, category: 'Other' }])
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStep('scanning')
    setError('')

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const mediaType = file.type || 'image/jpeg'

      const res = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: `You are a receipt OCR assistant. Extract items from the receipt image and return ONLY valid JSON (no markdown, no code fences) with this structure:
{
  "store": "store name or empty string",
  "date": "YYYY-MM-DD or empty string",
  "items": [
    { "item": "item name", "qty": 1, "price": 0.00, "category": "Category" }
  ]
}
Valid categories: ${CATEGORIES.join(', ')}
Choose the best matching category for each item. If unsure, use "Other".`,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: 'Extract all items from this receipt.' }
            ]
          }]
        })
      })

      if (!res.ok) {
        const errBody = await res.text()
        throw new Error(`API error ${res.status}: ${errBody}`)
      }

      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const parsed = JSON.parse(text)

      setStore(parsed.store || '')
      setDate(parsed.date || today())
      setItems((parsed.items || []).map(it => ({
        item: it.item || '',
        qty: Number(it.qty) || 1,
        price: Number(it.price) || 0,
        category: CATEGORIES.includes(it.category) ? it.category : 'Other',
      })))
      setStep('review')
    } catch (err) {
      setError(err.message || 'Failed to scan receipt')
      setStep('upload')
    }
  }

  const handleRescan = () => {
    setStep('upload')
    setItems([])
    setStore('')
    setDate(today())
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleConfirm = () => {
    const validItems = items.filter(it => it.item.trim())
    if (validItems.length === 0) return
    addTransaction(validItems, store, date)
    onClose()
  }

  return (
    <ModalWrapper onClose={onClose} title="Scan Receipt" mobile={mobile}>
      {step === 'upload' && (
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: '2px dashed #2a2d3e',
              borderRadius: 12,
              padding: mobile ? '32px 16px' : '48px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <Camera size={32} color="#64748b" />
            <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Tap to upload receipt</p>
            <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Take a photo or select an image</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          {error && (
            <p style={{ color: '#ef4444', fontSize: 12, marginTop: 10 }}>{error}</p>
          )}
        </div>
      )}

      {step === 'scanning' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔍</div>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Scanning receipt...</p>
          <p style={{ color: '#64748b', fontSize: 12 }}>This may take a few seconds</p>
        </div>
      )}

      {step === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: mobile ? 'wrap' : 'nowrap' }}>
            <div style={{ flex: 1, minWidth: mobile ? '100%' : 0 }}>
              <label style={labelStyle}>Store</label>
              <input value={store} onChange={e => setStore(e.target.value)} style={inputStyle} placeholder="Store name" />
            </div>
            <div style={{ minWidth: mobile ? '100%' : 140 }}>
              <label style={labelStyle}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Items ({items.length})</label>
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
                  <button onClick={() => removeItem(i)} style={{ ...iconBtn, alignSelf: 'center' }}>
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addMissing} style={{ ...btnStyle, background: 'none', color: '#06b6d4', padding: '6px 0', fontSize: 12, marginTop: 6 }}>
              + Add missing
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <button onClick={handleRescan} style={{ ...btnStyle, background: '#1e2030', color: '#94a3b8' }}>Re-scan</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ ...btnStyle, background: '#1e2030', color: '#94a3b8' }}>Cancel</button>
              <button onClick={handleConfirm} style={btnPrimary}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </ModalWrapper>
  )
}
