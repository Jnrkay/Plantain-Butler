// Item detail, edit, and product-type insights. Item detail follows Figma M5 (23:7574);
// the learning and type blocks are built from the same parts.
import { useRef, useState } from 'react'
import { C, TX, sans, mono } from '../lib/theme'
import { CATEGORIES } from '../lib/constants'
import { money, shortDate, pad2, stockOf, categoryIcon, purchasesOf, MONTHS, parseDate, STOCK, daysLabel } from '../lib/derive'
import { typeKey, typeOf, brandOf, everyLabel, daysLeftLabel, KNOWN_TYPES } from '../lib/learn'
import { Sheet, SheetHeader, Icon, Button, Field, TextInput, SelectInput, Segmented, reset } from './ui'

const catOptions = CATEGORIES.map((c) => ({ value: c, label: c }))
const num = (v) => (v === '' || v === null || v === undefined ? '' : String(v))
const norm = (s) => String(s || '').toLowerCase().trim()

function ItemIcon({ category }) {
  const icon = categoryIcon(category)
  return (
    <div style={{ width: 52, height: 52, background: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon === 'cup' ? <Icon name="cup@24" /> : <Icon name={`${icon}@18`} style={{ transform: 'scale(1.333)' }} />}
    </div>
  )
}

function Rows({ rows }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map(([k, v, color], i) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: i < rows.length - 1 ? `1px solid ${C.ink10}` : 'none' }}>
          <span style={sans(14, 400, { color: C.ink80 })}>{k}</span>
          <span style={{ ...sans(14, 500, { color: color || C.ink }), textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

function BrandRows({ T, limit = 3 }) {
  const list = T.brandList.slice(0, limit)
  if (!list.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {list.map((b) => (
        <div key={b.brand} style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.field, padding: '10px 12px' }}>
          <span style={{ ...sans(14, 500, { color: C.ink }), flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.brand}</span>
          {T.cheapest?.brand === b.brand && <span style={{ ...mono(9, 500, { letterSpacing: 0.54, color: C.ink }), background: C.amber, padding: '3px 6px' }}>CHEAPEST</span>}
          <span style={mono(10, 400, { color: C.ink80, whiteSpace: 'nowrap' })}>×{b.units}</span>
          <span style={{ ...sans(14, 400, { color: C.ink }), width: 72, textAlign: 'right' }}>{b.avgPrice ? money(b.avgPrice) : '—'}</span>
        </div>
      ))}
    </div>
  )
}

/* ================= Item detail ================= */
export function ItemSheet({ onClose, itemId, inventory, saveInv, transactions, addToShoppingList, shoppingList, openSheet, recordCount }) {
  const item = inventory.find((i) => i.id === itemId)
  // The type's state when this sheet opened — counts made here are measured against it
  const base = useRef(item?._model ? {
    key: item._model.key, anchor: item._model.anchor, baseRate: item._model.baseRate,
    recorded: item._model.recorded, itemEst: { ...item._model.itemEst },
  } : null)
  if (!item) return null
  const T = item._model
  const status = stockOf(item)
  const est = Math.round(item._est ?? item.qty)
  const recorded = Number(item.qty) || 0
  const estimated = T?.learned && Math.abs((item._est ?? recorded) - recorded) >= 0.5
  const purchases = purchasesOf(transactions, item.name)
  const first = purchases[0], last = purchases[purchases.length - 1]
  const pct = first && last && Number(first.price) ? ((Number(last.price) - Number(first.price)) / Number(first.price)) * 100 : 0
  const trend = purchases.length < 2 ? '—'
    : Math.abs(pct) < 0.05 ? 'No change' : `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}% since ${MONTHS[parseDate(first.date).getMonth()]}`
  const onList = shoppingList.some((s) => !s.checked && norm(s.name) === norm(item.name))
  const typeName = typeOf(item)
  const brand = brandOf(item)

  const patch = (p) => saveInv(inventory.map((i) => (i.id === item.id ? { ...i, ...p } : i)))
  const count = (q, force) => recordCount(item.id, Math.max(0, q), base.current, force)
  const setStatus = (v) => {
    if (v === 'low') count(0)
    else if (v === 'high') count(Math.max(recorded, est, 1), 'high') // "I've got plenty" — Butler was too quick
    else patch({ status: 'medium' })
  }

  const rows = [
    ['Last price', item.lastPrice ? `GHS ${money(item.lastPrice)}` : '—'],
    ['Price trend', trend, pct > 0.05 ? C.ember : C.ink],
    ['Last bought', item.lastPurchased ? shortDate(item.lastPurchased) : '—'],
    ['Usually lasts', T?.cycle ? daysLabel(T.cycle) : '—'],
  ]
  const otherBrands = T && T.brandList.length > 1

  return (
    <Sheet onClose={onClose} label={item.name}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ItemIcon category={item.category} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ ...sans(20, 500, { letterSpacing: -0.4, color: C.ink }), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
          <span style={{ ...TX.label, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {typeName.toUpperCase()}{brand ? ` · ${brand.toUpperCase()}` : ''}{item.store ? ` · ${item.store.toUpperCase()}` : ''}
          </span>
        </div>
        <button aria-label="Close" onClick={onClose} style={{ ...reset, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.ink25}`, flexShrink: 0 }}>
          <Icon name="x@16" />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0', borderTop: `1px solid ${C.ink15}`, borderBottom: `1px solid ${C.ink15}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={TX.label}>{estimated ? 'BUTLER ESTIMATE' : 'IN STOCK'}</span>
            <span style={sans(64, 300, { lineHeight: '68px', letterSpacing: -3.2, color: C.ink })}>
              {estimated && <span style={{ color: C.ink55 }}>≈</span>}{pad2(est)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button aria-label="Decrease" onClick={() => count(est - 1)}
              style={{ ...reset, width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.ink30}` }}>
              <Icon name="minus@18" />
            </button>
            <button aria-label="Increase" onClick={() => count(est + 1)}
              style={{ ...reset, width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.ink }}>
              <Icon name="plus@18" color={C.amber} />
            </button>
          </div>
        </div>
        {T?.learned ? (
          <div style={{ background: C.teal, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={sans(13, 400, { color: C.blush, lineHeight: '18px' })}>
              Your household uses {everyLabel(T.rate).replace('about ', '~')} of {typeName.toLowerCase()}
              {T.items.length > 1 ? ' (all brands)' : ''}.{' '}
              {T.estimate < 0.5 ? 'You’ve probably run out.' : `Likely runs out in ${daysLeftLabel(T.daysLeft)}.`}
            </span>
            {estimated && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => count(est)} style={{ ...reset, padding: '6px 12px', background: C.amber, ...sans(13, 500, { color: C.ink }) }}>That’s right</button>
                <span style={sans(12, 400, { color: C.blush80 })}>or use − / + to fix the count — Butler learns from it</span>
              </div>
            )}
          </div>
        ) : (
          <span style={sans(12, 400, { color: C.ink80, lineHeight: '17px' })}>
            Butler is learning. After you’ve bought {typeName.toLowerCase()} on two different days, it estimates how fast you use it and counts down your stock for you.
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={TX.label}>STOCK STATUS</span>
        <Segmented value={status} onChange={setStatus}
          options={[{ value: 'high', label: STOCK.high.label }, { value: 'medium', label: STOCK.medium.label }, { value: 'low', label: STOCK.low.label }]} />
      </div>

      <Rows rows={rows} />

      {T && (T.brandList.length > 0) && (
        <button onClick={() => openSheet('type', { typeKey: T.key })} style={{ ...reset, background: C.row, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={TX.label}>ALL {typeName.toUpperCase()}{otherBrands ? ` · ${T.brandList.length} BRANDS` : ''}</span>
            <Icon name="arrow@18" />
          </div>
          {otherBrands ? <BrandRows T={T} /> : (
            <span style={sans(13, 400, { color: C.ink80 })}>Avg GHS {money(T.avgPrice)} each · {T.purchases.length} purchase{T.purchases.length === 1 ? '' : 's'}</span>
          )}
        </button>
      )}

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

/* ================= Edit item ================= */
export function EditItemSheet({ onClose, itemId, inventory, saveInv, transactions, saveTx, openSheet, model }) {
  const item = inventory.find((i) => i.id === itemId)
  const [d, setD] = useState({
    name: item?.name || '', category: item?.category || 'Other', lastPrice: num(item?.lastPrice),
    brand: item?.brand || item?._brand || '', productType: item?.productType || (item ? typeOf(item) : ''),
  })
  if (!item) return null
  const types = [...new Set([...Object.values(model || {}).map((t) => t.type), ...KNOWN_TYPES])].sort()
  const save = () => {
    if (!d.name.trim()) return
    const next = { name: d.name.trim(), category: d.category, lastPrice: Number(d.lastPrice) || 0, brand: d.brand.trim(), productType: d.productType.trim() }
    saveInv(inventory.map((i) => (i.id === item.id ? { ...i, ...next } : i)))
    // Past purchases of this item follow the new brand/type so insights stay together
    if (transactions.some((t) => norm(t.item) === norm(item.name))) {
      saveTx(transactions.map((t) => (norm(t.item) === norm(item.name) ? { ...t, brand: next.brand, productType: next.productType } : t)))
    }
    openSheet('item', { itemId: item.id })
  }
  return (
    <Sheet onClose={onClose} label="Edit item">
      <SheetHeader title="Edit item" subtitle={item.name} onClose={onClose} />
      <Field label="NAME"><TextInput value={d.name} onChange={(v) => setD({ ...d, name: v })} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="BRAND" style={{ flex: 1 }}><TextInput value={d.brand} onChange={(v) => setD({ ...d, brand: v })} placeholder="e.g. Voltic" /></Field>
        <Field label="PRODUCT TYPE" style={{ flex: 1 }}><TextInput value={d.productType} onChange={(v) => setD({ ...d, productType: v })} placeholder="e.g. Water" list="pb-types" /></Field>
      </div>
      <datalist id="pb-types">{types.map((t) => <option key={t} value={t} />)}</datalist>
      <span style={sans(12, 400, { color: C.ink80, lineHeight: '17px', marginTop: -8 })}>
        Items with the same product type are tracked together — buy any brand and Butler knows you’ve restocked.
      </span>
      <Field label="CATEGORY"><SelectInput value={d.category} onChange={(v) => setD({ ...d, category: v })} options={catOptions} /></Field>
      <Field label="LAST PRICE (GHS)"><TextInput type="number" inputMode="decimal" step="0.01" value={d.lastPrice} onChange={(v) => setD({ ...d, lastPrice: v })} placeholder="0.00" /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="outline" onClick={() => openSheet('item', { itemId: item.id })} style={{ width: 112, flexShrink: 0 }}>Cancel</Button>
        <Button icon="check@16" onClick={save} disabled={!d.name.trim()} style={{ flex: 1 }}>Save changes</Button>
      </div>
    </Sheet>
  )
}

/* ================= Product type insights ================= */
export function TypeSheet({ onClose, typeKey: key, model, openSheet, inventory, addToShoppingList, shoppingList }) {
  const T = model?.[key]
  if (!T) return null
  const items = inventory.filter((i) => typeKey(typeOf(i)) === key)
  const mk = new Date().toISOString().slice(0, 7)
  const monthSpend = T.purchases.filter((p) => String(p.date).startsWith(mk)).reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.qty) || 1), 0)
  const onList = shoppingList.some((s) => !s.checked && typeKey(typeOf({ name: s.name, productType: s.productType })) === key)
  const rows = [
    ['In stock', T.items.length ? `${T.learned && Math.abs(T.estimate - T.recorded) >= 0.5 ? '≈ ' : ''}${Math.round(T.estimate)}` : '—'],
    ['You use', T.learned ? everyLabel(T.rate) : 'Still learning'],
    ['Runs out in', T.learned ? (T.estimate < 0.5 ? 'Probably out' : daysLeftLabel(T.daysLeft)) : '—', T.status === 'low' ? C.ember : undefined],
    ['Average price', T.avgPrice ? `GHS ${money(T.avgPrice)}` : '—'],
    ['Spent this month', `GHS ${money(monthSpend)}`],
    ['Spent all time', `GHS ${money(T.spend)}`],
  ]
  const saving = T.cheapest && T.brandList[0] && T.brandList[0].brand !== T.cheapest.brand && T.brandList[0].avgPrice > T.cheapest.avgPrice
    ? (T.brandList[0].avgPrice - T.cheapest.avgPrice) / T.brandList[0].avgPrice : 0

  return (
    <Sheet onClose={onClose} label={T.type}>
      <SheetHeader title={T.type} subtitle={`${T.brandList.length || 0} brand${T.brandList.length === 1 ? '' : 's'} · ${T.purchases.length} purchase${T.purchases.length === 1 ? '' : 's'}`} onClose={onClose} />
      <Rows rows={rows} />
      {saving > 0.05 && (
        <div style={{ background: C.amber, padding: 12 }}>
          <span style={sans(13, 400, { color: C.ink, lineHeight: '18px' })}>
            <b style={{ fontWeight: 500 }}>{T.cheapest.brand}</b> works out {Math.round(saving * 100)}% cheaper per unit than {T.brandList[0].brand}, the one you buy most.
          </span>
        </div>
      )}
      {T.brandList.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={TX.label}>BY BRAND</span><span style={TX.label}>BOUGHT · AVG GHS</span>
          </div>
          <BrandRows T={T} limit={8} />
        </div>
      )}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={TX.label}>IN YOUR STOCK</span>
          {items.map((i) => (
            <button key={i.id} onClick={() => openSheet('item', { itemId: i.id })} style={{ ...reset, display: 'flex', alignItems: 'center', gap: 12, background: C.row, padding: '10px 12px', width: '100%' }}>
              <span style={{ ...sans(14, 500, { color: C.ink }), flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</span>
              <span style={mono(12, 400, { color: C.ink })}>{Math.round(i._est ?? i.qty)}</span>
              <Icon name="arrow@18" />
            </button>
          ))}
        </div>
      )}
      <span style={sans(12, 400, { color: C.ink80, lineHeight: '17px' })}>
        {T.learned
          ? `Learned from ${T.purchases.length} purchases${T.counts ? ` and ${T.counts} stock count${T.counts === 1 ? '' : 's'}` : ''}. Correct a count any time and Butler adjusts.`
          : `Butler starts estimating once you’ve bought ${T.type.toLowerCase()} on two different days.`}
      </span>
      <Button icon="cart@16" disabled={onList} onClick={() => { addToShoppingList([{ name: (items[0]?.name) || T.type, qty: 1 }]); onClose() }}>
        {onList ? 'Already on your list' : 'Add to shopping list'}
      </Button>
    </Sheet>
  )
}
