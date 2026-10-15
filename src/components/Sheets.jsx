// Bottom sheets & dialogs — Figma "Menus & modals" (M1–M8)
import { useRef, useState } from 'react'
import { C, TX, sans, mono } from '../lib/theme'
import { CATEGORIES, HOUSEHOLD_TYPES, DEFAULT_PROFILE } from '../lib/constants'
import { today, uid } from '../lib/utils'
import {
  money, longDate, shortDate, pad2, stockOf, categoryIcon, purchasesOf, usuallyLasts, MONTHS, parseDate,
} from '../lib/derive'
import {
  Sheet, SheetHeader, Icon, Button, Field, TextInput, SelectInput, DateInput, QtyStepper, Segmented,
  Checkbox, Chip, Barcode, Overlay, reset,
} from './ui'
import { exportBackup } from './OverflowMenu'
import { callButler } from '../lib/ai'
import { supabase } from '../lib/supabase'

const ICON_BOX = { width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const catOptions = CATEGORIES.map((c) => ({ value: c, label: c }))
const num = (v) => (v === '' || v === null || v === undefined ? '' : String(v))

/* ================= M1 · Quick add (23:6661) ================= */
function QuickOption({ bg, iconBg, icon, iconColor, eyebrow, title, sub, fg, subColor, height, onClick }) {
  return (
    <button onClick={onClick} style={{ ...reset, display: 'flex', alignItems: 'center', gap: 16, height, padding: 16, background: bg, width: '100%' }}>
      <div style={{ ...ICON_BOX, background: iconBg }}><Icon name={icon} color={iconColor} /></div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {eyebrow && <span style={TX.label}>{eyebrow}</span>}
        <span style={sans(17, 500, { letterSpacing: -0.17, color: fg })}>{title}</span>
        <span style={sans(12, 400, { color: subColor })}>{sub}</span>
      </div>
      <Icon name="arrow@18" color={fg} />
    </button>
  )
}

function QuickAddSheet({ onClose, openSheet }) {
  return (
    <Sheet onClose={onClose} label="Quick add">
      <SheetHeader title="Quick add" subtitle="What are you logging?" onClose={onClose} />
      <QuickOption height={96} bg={C.amber} iconBg={C.ink12} icon="camera@20" iconColor={C.ink} eyebrow="FASTEST"
        title="Scan a receipt" sub="Butler reads every line item for you" fg={C.ink} subColor={C.ink80} onClick={() => openSheet('receipt')} />
      <QuickOption height={76} bg={C.teal} iconBg={C.blush12} icon="pencil@20" iconColor={C.blush}
        title="Add items manually" sub="Type in what you bought" fg={C.blush} subColor={C.blush80} onClick={() => openSheet('manual')} />
      <QuickOption height={76} bg={C.row} iconBg={C.ink} icon="cart@18" iconColor={C.cream}
        title="Add to shopping list" sub="For your next trip" fg={C.ink} subColor={C.ink80} onClick={() => openSheet('shopItem')} />
    </Sheet>
  )
}

/* ================= M2/M3 · Receipt (23:6862, 23:7059) ================= */
function Steps({ step }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {['01 UPLOAD', '02 REVIEW'].map((s, i) => (
        <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ height: 3, background: i <= step ? C.ink : C.ink15 }} />
          <span style={{ ...TX.label, color: i === step ? C.ink : C.ink80 }}>{s}</span>
        </div>
      ))}
    </div>
  )
}

const compressImage = (file, maxWidth = 1400) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    let { width, height } = img
    if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth }
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(img, 0, 0, width, height)
    resolve(canvas.toDataURL('image/jpeg', 0.82).split(',')[1])
    URL.revokeObjectURL(img.src)
  }
  img.onerror = () => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.readAsDataURL(file)
  }
  img.src = URL.createObjectURL(file)
})

function LineEditor({ line, onChange, onRemove }) {
  return (
    <div style={{ background: C.field, border: `1.5px solid ${C.ink90}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="NAME"><TextInput value={line.item} onChange={(v) => onChange({ ...line, item: v })} placeholder="Item name" autoFocus={!line.item} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="QTY" style={{ width: 120, flexShrink: 0 }}><QtyStepper value={Number(line.qty) || 1} onChange={(v) => onChange({ ...line, qty: v })} /></Field>
        <Field label="PRICE (GHS)" style={{ flex: 1 }}><TextInput type="number" inputMode="decimal" step="0.01" value={num(line.price)} onChange={(v) => onChange({ ...line, price: v })} placeholder="0.00" /></Field>
      </div>
      <Field label="CATEGORY"><SelectInput value={line.category} onChange={(v) => onChange({ ...line, category: v })} options={catOptions} /></Field>
      <button onClick={onRemove} style={{ ...reset, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="trash@16" color={C.ember} />
        <span style={sans(13, 500, { color: C.ember })}>Remove line</span>
      </button>
    </div>
  )
}

function ReceiptSheet({ onClose, addTransaction, profile }) {
  const [step, setStep] = useState('upload') // upload | scanning | review
  const [store, setStore] = useState('')
  const [date, setDate] = useState(today())
  const [lines, setLines] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const cameraRef = useRef(null)
  const libraryRef = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStep('scanning')
    setError('')
    try {
      const data = await compressImage(file)
      const json = await callButler({
        max_tokens: 2048,
        system: `You are a receipt OCR assistant. Extract the purchase from the receipt image and return ONLY valid JSON (no markdown, no code fences):
{"store":"store name or empty string","date":"YYYY-MM-DD or empty string","items":[{"item":"item name","qty":1,"price":0.00,"category":"Category"}]}
"price" is the unit price. Valid categories: ${CATEGORIES.join(', ')}. If unsure, use "Other".`,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
          { type: 'text', text: 'Extract all items from this receipt.' },
        ] }],
      })
      const text = (json.content?.[0]?.text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
      const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
      setStore(parsed.store || profile?.stores?.[0] || '')
      setDate(/^\d{4}-\d{2}-\d{2}$/.test(parsed.date || '') ? parsed.date : today())
      setLines((parsed.items || []).map((it) => ({
        id: uid(), item: it.item || '', qty: Number(it.qty) || 1, price: Number(it.price) || 0,
        category: CATEGORIES.includes(it.category) ? it.category : 'Other',
      })))
      setStep('review')
    } catch (err) {
      setError(err.message?.includes('JSON') ? "Couldn't read that receipt. Try a flatter, brighter photo." : err.message || 'Scan failed')
      setStep('upload')
    }
  }

  const valid = lines.filter((l) => String(l.item).trim())
  const total = valid.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty) || 1), 0)
  const confirm = () => { if (!valid.length) return; addTransaction(valid, store, date); onClose() }
  const rescan = () => { setStep('upload'); setLines([]); setEditing(null); setError('') }

  const inputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
      <input ref={libraryRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </>
  )

  if (step !== 'review') {
    const scanning = step === 'scanning'
    return (
      <Sheet onClose={onClose} label="Scan receipt">
        <SheetHeader title="Scan receipt" onClose={onClose} />
        <Steps step={0} />
        <button onClick={() => !scanning && libraryRef.current?.click()}
          style={{ ...reset, background: C.field, border: `1px dashed ${C.ink30.replace('0.3', '0.35')}`, padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', position: 'relative', overflow: 'hidden' }}>
          <div style={{ width: 64, height: 64, background: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="camera@28" />
          </div>
          <span style={sans(17, 500, { letterSpacing: -0.17, color: C.ink })}>{scanning ? 'Reading your receipt…' : 'Snap or upload a receipt'}</span>
          {scanning ? (
            <div style={{ width: 240, position: 'relative', overflow: 'hidden' }}>
              <Barcode bars={60} fraction={1} on={C.ink30} height={14} />
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent, ${C.amber}, transparent)`, mixBlendMode: 'multiply', animation: 'pb-scan 1.2s linear infinite' }} />
            </div>
          ) : (
            <span style={{ ...sans(12, 400, { color: C.ink80 }), width: 240, textAlign: 'center' }}>Flat, well-lit, whole receipt in frame. JPG or PNG.</span>
          )}
        </button>
        {error ? (
          <div style={{ background: C.ember, padding: 12 }}><span style={sans(12, 500, { color: C.white })}>{error}</span></div>
        ) : (
          <div style={{ background: C.row, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={mono(10, 400, { letterSpacing: 0.8, color: C.ink })}>TIP</span>
            <span style={sans(12, 400, { color: C.ink70 })}>Long receipts? Scan in two parts — we’ll merge them.</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button variant="ink" icon="camera@16" disabled={scanning} onClick={() => cameraRef.current?.click()}>Take photo</Button>
          <Button variant="outline" icon="image@16" disabled={scanning} onClick={() => libraryRef.current?.click()}>Choose from library</Button>
        </div>
        {inputs}
      </Sheet>
    )
  }

  return (
    <Sheet onClose={onClose} gap={12} label="Review receipt">
      <SheetHeader title="Review receipt" onClose={onClose} />
      <Steps step={1} />
      <div style={{ background: C.teal, padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="check@16" color={C.amber} />
        <span style={sans(13, 400, { color: C.blush })}>
          {lines.length ? `${lines.length} ${lines.length === 1 ? 'item' : 'items'} found — tap any row to fix it` : 'No items found — add them below'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="STORE" style={{ flex: 1 }}>
          {profile?.stores?.length
            ? <SelectInput value={store} onChange={setStore} options={[...new Set([...(profile.stores || []), ...(store ? [store] : [])])]} placeholder="Choose" />
            : <TextInput value={store} onChange={setStore} placeholder="Store" />}
        </Field>
        <Field label="DATE" style={{ flex: 1 }}><DateInput value={date} onChange={setDate} display={longDate(date)} /></Field>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, padding: '0 12px' }}>
          <span style={{ ...TX.label, flex: 1 }}>ITEM</span>
          <span style={TX.label}>QTY</span>
          <span style={{ ...TX.label, width: 70, textAlign: 'right' }}>GHS</span>
        </div>
        {lines.map((l, i) => editing === l.id ? (
          <LineEditor key={l.id} line={l}
            onChange={(nl) => setLines(lines.map((x) => (x.id === l.id ? nl : x)))}
            onRemove={() => { setLines(lines.filter((x) => x.id !== l.id)); setEditing(null) }} />
        ) : (
          <button key={l.id} onClick={() => setEditing(l.id)} style={{ ...reset, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: C.row, width: '100%' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ ...sans(14, 500, { color: l.item ? C.ink : C.ember }), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.item || 'Unnamed item'}</span>
              <span style={TX.label}>{String(l.category || 'Other').toUpperCase()}</span>
            </div>
            <span style={{ ...mono(12, 400, { color: C.ink }), width: 28, textAlign: 'center' }}>×{Number(l.qty) || 1}</span>
            <span style={{ ...sans(17, 300, { color: C.ink }), width: 70, textAlign: 'right' }}>{money((Number(l.price) || 0) * (Number(l.qty) || 1))}</span>
          </button>
        ))}
      </div>
      <button onClick={() => { const id = uid(); setLines([...lines, { id, item: '', qty: 1, price: '', category: 'Other' }]); setEditing(id) }}
        style={{ ...reset, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', alignSelf: 'flex-start' }}>
        <Icon name="plus@14" />
        <span style={sans(13, 500, { color: C.ink })}>Add a missing item</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderTop: `1px solid ${C.ink15}`, paddingTop: 12 }}>
        <span style={TX.label}>RECEIPT TOTAL</span>
        <span style={sans(22, 300, { letterSpacing: -0.44, color: C.ink })}>GHS {money(total)}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="outline" icon="refresh@16" onClick={rescan} style={{ width: 120, flexShrink: 0 }}>Re-scan</Button>
        <Button icon="check@16" onClick={confirm} disabled={!valid.length} style={{ flex: 1 }}>
          Confirm {valid.length} {valid.length === 1 ? 'item' : 'items'}
        </Button>
      </div>
      {inputs}
    </Sheet>
  )
}

/* ================= M4 · Add items manually (23:7342) ================= */
function ManualAddSheet({ onClose, addTransaction, profile, inventory }) {
  const blank = () => ({ id: uid(), item: '', qty: 1, price: '', category: 'Other' })
  const [store, setStore] = useState(profile?.stores?.[0] || '')
  const [date, setDate] = useState(today())
  const [rows, setRows] = useState([blank()])
  const [active, setActive] = useState(rows[0].id)

  const update = (id, patch) => setRows(rows.map((r) => {
    if (r.id !== id) return r
    const next = { ...r, ...patch }
    // Prefill category & price from inventory when the name matches something we track
    if (patch.item !== undefined) {
      const known = inventory.find((i) => i.name.toLowerCase() === String(patch.item).toLowerCase().trim())
      if (known) { next.category = known.category || next.category; if (next.price === '') next.price = known.lastPrice ?? '' }
    }
    return next
  }))
  const valid = rows.filter((r) => String(r.item).trim())
  const total = valid.reduce((s, r) => s + (Number(r.price) || 0) * (Number(r.qty) || 1), 0)
  const save = () => { if (!valid.length) return; addTransaction(valid, store, date); onClose() }

  return (
    <Sheet onClose={onClose} label="Add items">
      <SheetHeader title="Add items" subtitle="Log a purchase without a receipt" onClose={onClose} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="STORE" style={{ flex: 1 }}>
          {profile?.stores?.length
            ? <SelectInput value={store} onChange={setStore} options={profile.stores} placeholder="Choose" />
            : <TextInput value={store} onChange={setStore} placeholder="Store" />}
        </Field>
        <Field label="DATE" style={{ flex: 1 }}><DateInput value={date} onChange={setDate} display={date === today() ? 'Today' : longDate(date)} /></Field>
      </div>

      <datalist id="pb-inv-names">{inventory.map((i) => <option key={i.id} value={i.name} />)}</datalist>
      {rows.map((r, i) => r.id === active ? (
        <div key={r.id} style={{ background: C.row, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ ...TX.label, color: C.ink }}>ITEM {pad2(i + 1)}</span>
            {rows.length > 1 && (
              <button aria-label="Remove item" onClick={() => { const rest = rows.filter((x) => x.id !== r.id); setRows(rest); setActive(rest[rest.length - 1].id) }} style={{ ...reset, display: 'flex' }}>
                <Icon name="trash@14" />
              </button>
            )}
          </div>
          <Field label="NAME"><TextInput value={r.item} onChange={(v) => update(r.id, { item: v })} placeholder="e.g. Golden Penny Spaghetti" list="pb-inv-names" autoFocus /></Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="QTY" style={{ width: 120, flexShrink: 0 }}><QtyStepper value={Number(r.qty) || 1} onChange={(v) => update(r.id, { qty: v })} /></Field>
            <Field label="PRICE (GHS)" style={{ flex: 1 }}>
              <TextInput type="number" inputMode="decimal" step="0.01" value={num(r.price)} onChange={(v) => update(r.id, { price: v })} placeholder="0.00" />
            </Field>
          </div>
          <Field label="CATEGORY"><SelectInput value={r.category} onChange={(v) => update(r.id, { category: v })} options={catOptions} /></Field>
        </div>
      ) : (
        <button key={r.id} onClick={() => setActive(r.id)} style={{ ...reset, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.row, width: '100%' }}>
          <span style={TX.label}>ITEM {pad2(i + 1)}</span>
          <span style={{ ...sans(14, 500, { color: r.item ? C.ink : C.ink55 }), flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {r.item || 'Untitled'} · ×{Number(r.qty) || 1}
          </span>
          <span style={sans(17, 300, { color: C.ink })}>{money((Number(r.price) || 0) * (Number(r.qty) || 1))}</span>
        </button>
      ))}

      <button onClick={() => { const b = blank(); setRows([...rows, b]); setActive(b.id) }}
        style={{ ...reset, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: `1px dashed ${C.ink30}`, flexShrink: 0 }}>
        <Icon name="plus@14" />
        <span style={sans(13, 500, { color: C.ink })}>Add another item</span>
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="outline" onClick={onClose} style={{ width: 112, flexShrink: 0 }}>Cancel</Button>
        <Button icon="check@16" onClick={save} disabled={!valid.length} style={{ flex: 1, minWidth: 0 }}>
          Save {valid.length} {valid.length === 1 ? 'item' : 'items'} · GHS {money(total)}
        </Button>
      </div>
    </Sheet>
  )
}

/* ================= M5 · Item detail (23:7574) ================= */
function ItemSheet({ onClose, itemId, inventory, saveInv, transactions, addToShoppingList, shoppingList, openSheet }) {
  const item = inventory.find((i) => i.id === itemId)
  if (!item) return null
  const status = stockOf(item)
  const purchases = purchasesOf(transactions, item.name)
  const first = purchases[0], last = purchases[purchases.length - 1]
  const pct = first && last && Number(first.price) ? ((Number(last.price) - Number(first.price)) / Number(first.price)) * 100 : 0
  const trend = purchases.length < 2 ? '—'
    : Math.abs(pct) < 0.05 ? 'No change' : `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}% since ${MONTHS[parseDate(first.date).getMonth()]}`
  const onList = shoppingList.some((s) => !s.checked && String(s.name).toLowerCase().trim() === item.name.toLowerCase().trim())

  const patch = (p) => saveInv(inventory.map((i) => (i.id === item.id ? { ...i, ...p } : i)))
  const setQty = (q) => {
    const qty = Math.max(0, q)
    patch({ qty, status: qty === 0 ? 'low' : status === 'low' ? 'medium' : status })
  }
  const icon = categoryIcon(item.category)

  const rows = [
    ['Last price', item.lastPrice ? `GHS ${money(item.lastPrice)}` : '—'],
    ['Price trend', trend, pct > 0.05 ? C.ember : C.ink],
    ['Last bought', item.lastPurchased ? shortDate(item.lastPurchased) : '—'],
    ['Usually lasts', usuallyLasts(purchases)],
  ]

  return (
    <Sheet onClose={onClose} label={item.name}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 52, height: 52, background: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon === 'cup' ? <Icon name="cup@24" /> : <Icon name={`${icon}@18`} style={{ transform: 'scale(1.333)' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ ...sans(20, 500, { letterSpacing: -0.4, color: C.ink }), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
          <span style={{ ...TX.label, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {(item.category || 'Other').toUpperCase()}{item.store ? ` · ${item.store.toUpperCase()}` : ''}
          </span>
        </div>
        <button aria-label="Close" onClick={onClose} style={{ ...reset, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.ink25}`, flexShrink: 0 }}>
          <Icon name="x@16" />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderTop: `1px solid ${C.ink15}`, borderBottom: `1px solid ${C.ink15}` }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={TX.label}>IN STOCK</span>
          <span style={sans(64, 300, { lineHeight: '68px', letterSpacing: -3.2, color: C.ink })}>{pad2(item.qty)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button aria-label="Decrease" onClick={() => setQty((Number(item.qty) || 0) - 1)}
            style={{ ...reset, width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.ink30}` }}>
            <Icon name="minus@18" />
          </button>
          <button aria-label="Increase" onClick={() => setQty((Number(item.qty) || 0) + 1)}
            style={{ ...reset, width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.ink }}>
            <Icon name="plus@18" color={C.amber} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={TX.label}>STOCK STATUS</span>
        <Segmented value={status} onChange={(v) => patch({ status: v })}
          options={[{ value: 'high', label: 'In stock' }, { value: 'medium', label: 'Running low' }, { value: 'low', label: 'Out' }]} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map(([k, v, color], i) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < rows.length - 1 ? `1px solid ${C.ink10}` : 'none' }}>
            <span style={sans(14, 400, { color: C.ink80 })}>{k}</span>
            <span style={sans(14, 500, { color: color || C.ink })}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button icon="cart@16" disabled={onList} onClick={() => { addToShoppingList([{ name: item.name, qty: 1 }]); onClose() }}>
          {onList ? 'Already on your list' : 'Add to shopping list'}
        </Button>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" icon="pencil@16" style={{ flex: 1 }} onClick={() => openSheet('editItem', { itemId: item.id })}>Edit item</Button>
          <Button variant="danger" icon="trash@16" style={{ flex: 1 }} onClick={() => { saveInv(inventory.filter((i) => i.id !== item.id)); onClose() }}>Delete</Button>
        </div>
      </div>
    </Sheet>
  )
}

function EditItemSheet({ onClose, itemId, inventory, saveInv, openSheet }) {
  const item = inventory.find((i) => i.id === itemId)
  const [d, setD] = useState({ name: item?.name || '', category: item?.category || 'Other', lastPrice: num(item?.lastPrice) })
  if (!item) return null
  const save = () => {
    if (!d.name.trim()) return
    saveInv(inventory.map((i) => (i.id === item.id ? { ...i, name: d.name.trim(), category: d.category, lastPrice: Number(d.lastPrice) || 0 } : i)))
    openSheet('item', { itemId: item.id })
  }
  return (
    <Sheet onClose={onClose} label="Edit item">
      <SheetHeader title="Edit item" subtitle={item.name} onClose={onClose} />
      <Field label="NAME"><TextInput value={d.name} onChange={(v) => setD({ ...d, name: v })} /></Field>
      <Field label="CATEGORY"><SelectInput value={d.category} onChange={(v) => setD({ ...d, category: v })} options={catOptions} /></Field>
      <Field label="LAST PRICE (GHS)"><TextInput type="number" inputMode="decimal" step="0.01" value={d.lastPrice} onChange={(v) => setD({ ...d, lastPrice: v })} placeholder="0.00" /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="outline" onClick={() => openSheet('item', { itemId: item.id })} style={{ width: 112, flexShrink: 0 }}>Cancel</Button>
        <Button icon="check@16" onClick={save} disabled={!d.name.trim()} style={{ flex: 1 }}>Save changes</Button>
      </div>
    </Sheet>
  )
}

/* ================= Shopping list item ================= */
function ShopItemSheet({ onClose, itemId, shoppingList, saveSL, addToShoppingList, inventory }) {
  const existing = shoppingList.find((s) => s.id === itemId)
  const [d, setD] = useState({ name: existing?.name || '', qty: Number(existing?.qty) || 1, estPrice: num(existing?.estPrice) })
  const setName = (v) => {
    const known = inventory.find((i) => i.name.toLowerCase() === v.toLowerCase().trim())
    setD({ ...d, name: v, estPrice: d.estPrice === '' && known?.lastPrice ? String(known.lastPrice) : d.estPrice })
  }
  const save = () => {
    if (!d.name.trim()) return
    if (existing) saveSL(shoppingList.map((s) => (s.id === existing.id ? { ...s, name: d.name.trim(), qty: d.qty, estPrice: Number(d.estPrice) || 0 } : s)))
    else addToShoppingList([{ name: d.name, qty: d.qty, estPrice: d.estPrice === '' ? undefined : Number(d.estPrice) }])
    onClose()
  }
  return (
    <Sheet onClose={onClose} label={existing ? 'Edit list item' : 'Add to list'}>
      <SheetHeader title={existing ? 'Edit list item' : 'Add to list'} subtitle="For your next trip" onClose={onClose} />
      <datalist id="pb-shop-names">{inventory.map((i) => <option key={i.id} value={i.name} />)}</datalist>
      <Field label="NAME"><TextInput value={d.name} onChange={setName} placeholder="e.g. Milo Sachets 800G" list="pb-shop-names" autoFocus={!existing} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="QTY" style={{ width: 120, flexShrink: 0 }}><QtyStepper value={d.qty} onChange={(v) => setD({ ...d, qty: v })} /></Field>
        <Field label="EST. PRICE (GHS)" style={{ flex: 1 }}>
          <TextInput type="number" inputMode="decimal" step="0.01" value={d.estPrice} onChange={(v) => setD({ ...d, estPrice: v })} placeholder="0.00" />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {existing
          ? <Button variant="danger" icon="trash@16" onClick={() => { saveSL(shoppingList.filter((s) => s.id !== existing.id)); onClose() }} style={{ width: 120, flexShrink: 0 }}>Remove</Button>
          : <Button variant="outline" onClick={onClose} style={{ width: 112, flexShrink: 0 }}>Cancel</Button>}
        <Button icon="check@16" onClick={save} disabled={!d.name.trim()} style={{ flex: 1 }}>{existing ? 'Save' : 'Add to list'}</Button>
      </div>
    </Sheet>
  )
}

/* ================= Settings sheets (from the overflow menu) ================= */
function ChipWrap({ children }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
}

function ProfileSheet({ onClose, profile, saveProfile }) {
  const [p, setP] = useState({ ...DEFAULT_PROFILE, ...profile })
  const multi = p.householdType && p.householdType !== 'Single person'
  return (
    <Sheet onClose={onClose} label="Household profile">
      <SheetHeader title="Household profile" subtitle="Butler uses this to tailor advice" onClose={onClose} />
      <Field label="YOUR NAME"><TextInput value={p.name || ''} onChange={(v) => setP({ ...p, name: v })} placeholder="e.g. Emmanuel Dankyi" /></Field>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={TX.label}>HOUSEHOLD</span>
        <ChipWrap>
          {HOUSEHOLD_TYPES.map((t) => (
            <Chip key={t} label={t} active={p.householdType === t} onClick={() => setP({ ...p, householdType: t, ...(t === 'Single person' ? { adults: 1, kids: 0 } : t === 'Married couple' ? { adults: 2, kids: 0 } : {}) })} />
          ))}
        </ChipWrap>
      </div>
      {multi && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Field label="ADULTS" style={{ flex: 1 }}><QtyStepper value={Number(p.adults) || 1} onChange={(v) => setP({ ...p, adults: v })} /></Field>
          <Field label="CHILDREN" style={{ flex: 1 }}><QtyStepper min={0} value={Number(p.kids) || 0} onChange={(v) => setP({ ...p, kids: v })} /></Field>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={TX.label}>SHOPPING FREQUENCY</span>
        <ChipWrap>
          {['Daily', 'Every few days', 'Weekly', 'Bi-weekly', 'Monthly', 'As needed'].map((f) => (
            <Chip key={f} label={f} active={p.shopFrequency === f} onClick={() => setP({ ...p, shopFrequency: f })} />
          ))}
        </ChipWrap>
      </div>
      <Button icon="check@16" onClick={() => { saveProfile({ ...p, onboarded: true }); onClose() }}>Save profile</Button>
    </Sheet>
  )
}

function BudgetsSheet({ onClose, profile, saveProfile, budgets, saveBudgets }) {
  const [monthly, setMonthly] = useState(num(profile?.monthlyBudget || ''))
  const [cats, setCats] = useState({ ...budgets })
  return (
    <Sheet onClose={onClose} label="Budgets">
      <SheetHeader title="Budgets" subtitle="Your monthly grocery limit" onClose={onClose} />
      <Field label="MONTHLY BUDGET (GHS)"><TextInput type="number" inputMode="decimal" value={monthly} onChange={setMonthly} placeholder="e.g. 2000" autoFocus /></Field>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={TX.label}>BY CATEGORY · OPTIONAL</span>
        {CATEGORIES.map((c) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.row, padding: '6px 6px 6px 16px' }}>
            <span style={{ ...sans(14, 500, { color: C.ink }), flex: 1 }}>{c}</span>
            <div style={{ width: 120 }}>
              <TextInput type="number" inputMode="decimal" value={num(cats[c] || '')} onChange={(v) => setCats({ ...cats, [c]: v === '' ? undefined : Number(v) })} placeholder="—" />
            </div>
          </div>
        ))}
      </div>
      <Button icon="check@16" onClick={() => { saveProfile({ ...profile, monthlyBudget: Number(monthly) || 0 }); saveBudgets(cats); onClose() }}>Save budgets</Button>
    </Sheet>
  )
}

function StoresSheet({ onClose, profile, saveProfile }) {
  const [stores, setStores] = useState(profile?.stores || [])
  const [input, setInput] = useState('')
  const add = () => { const v = input.trim(); if (v && !stores.includes(v)) setStores([...stores, v]); setInput('') }
  return (
    <Sheet onClose={onClose} label="My stores">
      <SheetHeader title="My stores" subtitle="Where you usually shop" onClose={onClose} />
      {stores.map((s) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.row, padding: '12px 12px 12px 16px' }}>
          <Icon name="store@18" />
          <span style={{ ...sans(15, 500, { color: C.ink }), flex: 1 }}>{s}</span>
          <button aria-label={`Remove ${s}`} onClick={() => setStores(stores.filter((x) => x !== s))} style={{ ...reset, display: 'flex', padding: 4 }}><Icon name="x@16" /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}><TextInput value={input} onChange={setInput} placeholder="Add a store" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} /></div>
        <Button variant="ink" height={44} onClick={add} disabled={!input.trim()}>Add</Button>
      </div>
      <Button icon="check@16" onClick={() => { saveProfile({ ...profile, stores }); onClose() }}>Save stores</Button>
    </Sheet>
  )
}

function DietarySheet({ onClose, profile, saveProfile }) {
  const [diet, setDiet] = useState(profile?.dietaryPrefs || '')
  const [top, setTop] = useState(profile?.topCategories || [])
  return (
    <Sheet onClose={onClose} label="Dietary preferences">
      <SheetHeader title="Dietary preferences" subtitle="Helps Butler suggest the right things" onClose={onClose} />
      <Field label="PREFERENCES"><TextInput value={diet} onChange={setDiet} placeholder="e.g. No pork, low sugar" /></Field>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={TX.label}>WHAT YOU BUY MOST</span>
        <ChipWrap>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} active={top.includes(c)} onClick={() => setTop(top.includes(c) ? top.filter((x) => x !== c) : [...top, c])} />
          ))}
        </ChipWrap>
      </div>
      <Button icon="check@16" onClick={() => { saveProfile({ ...profile, dietaryPrefs: diet, topCategories: top }); onClose() }}>Save preferences</Button>
    </Sheet>
  )
}

function ClearSheet({ onClose, openSheet, inventory, transactions, shoppingList, saveInv, saveTx, saveSL, saveBudgets, saveProfile }) {
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
  const options = [
    { key: 'inv', label: 'Inventory', meta: plural(inventory.length, 'item'), title: 'Clear inventory?', body: `This removes all ${plural(inventory.length, 'tracked item')}. Your transactions, budgets and household profile stay as they are.`, cta: `Clear ${plural(inventory.length, 'item')}`, run: () => saveInv([]) },
    { key: 'tx', label: 'Transactions', meta: plural(transactions.length, 'purchase'), title: 'Clear transactions?', body: `This removes ${plural(transactions.length, 'logged purchase')} and the insights built from them. Inventory stays as it is.`, cta: `Clear ${plural(transactions.length, 'purchase')}`, run: () => saveTx([]) },
    { key: 'sl', label: 'Shopping list', meta: plural(shoppingList.length, 'item'), title: 'Clear shopping list?', body: `This empties your list of ${plural(shoppingList.length, 'item')}.`, cta: 'Clear list', run: () => saveSL([]) },
    { key: 'all', label: 'Everything', meta: 'Start over', title: 'Clear everything?', body: 'This removes inventory, transactions, your shopping list, budgets and profile. You’ll set Butler up again from scratch.', cta: 'Clear everything', run: () => { saveInv([]); saveTx([]); saveSL([]); saveBudgets({}); saveProfile(DEFAULT_PROFILE) } },
  ]
  return (
    <Sheet onClose={onClose} label="Clear data">
      <SheetHeader title="Clear data" subtitle="Choose what to remove" onClose={onClose} />
      {options.map((o) => (
        <button key={o.key} onClick={() => openSheet('confirm', { title: o.title, body: o.body, confirmLabel: o.cta, onConfirm: o.run, withBackup: true })}
          style={{ ...reset, display: 'flex', alignItems: 'center', gap: 12, background: C.row, padding: '16px', width: '100%' }}>
          <span style={{ ...sans(15, 500, { color: o.key === 'all' ? C.ember : C.ink }), flex: 1 }}>{o.label}</span>
          <span style={TX.label}>{o.meta}</span>
        </button>
      ))}
    </Sheet>
  )
}

function PasswordSheet({ onClose, account }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [state, setState] = useState({ busy: false, error: '', done: false })
  const ok = pw.length >= 8 && pw === pw2
  const save = async () => {
    if (!ok) return
    setState({ busy: true, error: '', done: false })
    const { error } = await supabase.auth.updateUser({ password: pw })
    setState({ busy: false, error: error ? (/reauth|recent/i.test(error.message) ? 'For security, sign out and back in, then change it straight away.' : error.message) : '', done: !error })
  }
  return (
    <Sheet onClose={onClose} label="Change password">
      <SheetHeader title="Change password" subtitle={account?.email ? `For ${account.email}` : 'Sign in with it on any device'} onClose={onClose} />
      {state.done ? (
        <>
          <div style={{ background: C.teal, padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="check@16" color={C.amber} />
            <span style={sans(13, 400, { color: C.blush })}>Password updated. Use it next time you sign in.</span>
          </div>
          <Button onClick={onClose}>Done</Button>
        </>
      ) : (
        <>
          <Field label="NEW PASSWORD"><TextInput type="password" autoComplete="new-password" value={pw} onChange={setPw} placeholder="At least 8 characters" autoFocus /></Field>
          <Field label="TYPE IT AGAIN"><TextInput type="password" autoComplete="new-password" value={pw2} onChange={setPw2} placeholder="Same password" /></Field>
          {pw2 && pw !== pw2 && <span style={sans(12, 500, { color: C.ember })}>The two passwords don’t match.</span>}
          {state.error && <div style={{ background: C.ember, padding: 12 }}><span style={sans(13, 500, { color: C.white })}>{state.error}</span></div>}
          <Button icon="check@16" disabled={!ok || state.busy} onClick={save}>{state.busy ? 'Saving…' : 'Save password'}</Button>
        </>
      )}
    </Sheet>
  )
}

/* ================= M8 · Confirm dialog (23:8269) ================= */
function ConfirmDialog({ onClose, title, body, confirmLabel, onConfirm, withBackup }) {
  const [backup, setBackup] = useState(false)
  return (
    <Overlay onClose={onClose}>
      <div role="alertdialog" aria-label={title}
        style={{
          position: 'absolute', left: '50%', top: 'min(calc(env(safe-area-inset-top, 0px) + 212px), 50%)', transform: 'translateX(-50%)', width: 'min(330px, calc(100vw - 60px))',
          background: C.white, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, animation: 'pb-fade-in .15s ease',
        }}>
        <div style={{ width: 44, height: 44, background: C.ember, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="alert@22" />
        </div>
        <span style={sans(22, 500, { letterSpacing: -0.44, color: C.ink })}>{title}</span>
        <p style={sans(14, 400, { lineHeight: '20px', color: C.ink70 })}>{body}</p>
        {withBackup && (
          <div onClick={() => setBackup(!backup)} style={{ background: C.row, padding: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <Checkbox size={20} checked={backup} label="Export a backup first" onClick={(e) => { e.stopPropagation(); setBackup(!backup) }} />
            <span style={sans(13, 400, { color: C.ink })}>Export a backup first</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" height={48} onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button variant="ember" height={48} onClick={() => { if (backup) exportBackup(); onConfirm?.(); onClose() }} style={{ flex: 1 }}>{confirmLabel}</Button>
        </div>
      </div>
    </Overlay>
  )
}

/* ================= Router ================= */
export default function Sheets({ sheet, onClose, ...rest }) {
  const props = { ...rest, ...sheet, onClose }
  switch (sheet.type) {
    case 'quickAdd': return <QuickAddSheet {...props} />
    case 'receipt': return <ReceiptSheet {...props} />
    case 'manual': return <ManualAddSheet {...props} />
    case 'item': return <ItemSheet key={sheet.itemId} {...props} />
    case 'editItem': return <EditItemSheet key={`e${sheet.itemId}`} {...props} />
    case 'shopItem': return <ShopItemSheet key={sheet.itemId || 'new'} {...props} />
    case 'profile': return <ProfileSheet {...props} />
    case 'budgets': return <BudgetsSheet {...props} />
    case 'stores': return <StoresSheet {...props} />
    case 'dietary': return <DietarySheet {...props} />
    case 'clear': return <ClearSheet {...props} />
    case 'confirm': return <ConfirmDialog {...props} />
    case 'password': return <PasswordSheet {...props} />
    case 'signOut': {
      const n = rest.account?.sync?.pending || 0
      return (
        <ConfirmDialog {...props} title="Sign out?" confirmLabel="Sign out" withBackup={n > 0}
          body={n ? `${n} change${n === 1 ? " hasn't" : "s haven't"} reached your account yet and will be lost if you sign out now. Connect to the internet first, or export a backup.`
            : 'Your data stays safe in your account. Sign back in with your email any time.'}
          onConfirm={() => rest.account?.signOut()} />
      )
    }
    default: return null
  }
}
