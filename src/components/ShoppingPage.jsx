// A5 · Shopping list (Figma 23:6209)
import { useState } from 'react'
import { C, TX, sans, mono, TAB_CLEARANCE } from '../lib/theme'
import { sum, isLow } from '../lib/derive'
import { Header, TitleRow, AddButton, Money, Checkbox, Icon, reset } from './ui'

function ListItem({ item, low, onToggle, onOpen }) {
  const done = !!item.checked
  const qty = Number(item.qty) || 1
  const total = (Number(item.estPrice) || 0) * qty
  const tag = done ? 'ADDED' : low ? 'LOW STOCK' : 'USUAL'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 64, padding: '12px 16px', background: done ? C.rowFaded : C.row }}>
      <Checkbox checked={done} onClick={onToggle} label={`${item.name} in cart`} />
      <button onClick={onOpen} style={{ ...reset, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 16, height: '100%' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{
            ...sans(15, 500, { color: done ? C.ink45 : C.ink }), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            textDecoration: done ? 'line-through' : 'none',
          }}>{item.name}</span>
          <span style={{ ...TX.micro, color: done ? C.ink55 : low ? C.ember : C.ink80 }}>{tag} · ×{qty}</span>
        </div>
        <Money value={total} size={20} tracking={-0.4} color={done ? C.ink45 : C.ink} muted={done ? C.ink28 : C.ink55} />
      </button>
    </div>
  )
}

export default function ShoppingPage({ header, shoppingList, saveSL, genShoppingList, inventory, profile, openSheet }) {
  const [flash, setFlash] = useState('')
  const lowOf = (name) => isLow(inventory.find((i) => i.name.toLowerCase().trim() === String(name).toLowerCase().trim()))

  const sorted = [...shoppingList].sort((a, b) => Number(!!a.checked) - Number(!!b.checked))
  const inCart = shoppingList.filter((s) => s.checked).length
  const est = sum(shoppingList, (s) => (Number(s.estPrice) || 0) * (Number(s.qty) || 1))

  const storeCounts = {}
  shoppingList.forEach((s) => { if (s.store) storeCounts[s.store] = (storeCounts[s.store] || 0) + 1 })
  const store = Object.keys(storeCounts).sort((a, b) => storeCounts[b] - storeCounts[a])[0] || profile?.stores?.[0]

  const toggle = (id) => saveSL(shoppingList.map((s) => (s.id === id ? { ...s, checked: !s.checked } : s)))
  const generate = () => {
    const n = genShoppingList()
    setFlash(n ? `Added ${n} ${n === 1 ? 'item' : 'items'} from low stock` : 'Nothing is running low right now')
    setTimeout(() => setFlash(''), 2600)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Header {...header} />
      <TitleRow title="Shopping list">
        <AddButton label="Add to list" onClick={() => openSheet('shopItem')} />
      </TitleRow>

      {/* Auto-generate card 23:6236 */}
      <div style={{ padding: '0 20px 16px' }}>
        <button onClick={generate} style={{ ...reset, width: '100%', background: C.amber, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span style={TX.label}>AUTO-GENERATE</span>
            <span style={TX.label}>FROM STOCK</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }}>
            <span style={sans(18, 500, { lineHeight: '22px', letterSpacing: -0.36, color: C.ink, maxWidth: 230 })}>
              {flash || 'Build my list from low stock and my usual run'}
            </span>
            <span style={{ width: 44, height: 44, background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="arrow@18" color={C.amber} />
            </span>
          </div>
        </button>
      </div>

      {/* Estimate 23:6246 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '4px 20px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ ...TX.label, whiteSpace: 'nowrap' }}>{shoppingList.length} {shoppingList.length === 1 ? 'ITEM' : 'ITEMS'} · {inCart} IN CART</span>
          <span style={sans(12, 400, { color: C.ink80, whiteSpace: 'nowrap' })}>{store ? `Estimated at ${store}` : 'Estimated from last prices'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={mono(10, 400, { color: C.ink80, whiteSpace: 'nowrap' })}>EST. GHS</span>
          <Money value={est} size={32} tracking={-0.96} />
        </div>
      </div>

      {/* List 23:6253 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: `0 20px ${TAB_CLEARANCE}px` }}>
        {sorted.map((s) => (
          <ListItem key={s.id} item={s} low={lowOf(s.name)} onToggle={() => toggle(s.id)} onOpen={() => openSheet('shopItem', { itemId: s.id })} />
        ))}
        {shoppingList.length === 0 && (
          <div style={{ background: C.row, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={TX.rowName}>Your list is empty</span>
            <span style={TX.small}>Tap the card above to fill it from low stock, or + to add something.</span>
          </div>
        )}
        {inCart > 0 && (
          <button onClick={() => saveSL(shoppingList.filter((s) => !s.checked))}
            style={{ ...reset, alignSelf: 'flex-start', padding: '4px 0', ...sans(13, 500, { color: C.ink80, textDecoration: 'underline', textUnderlineOffset: 3 }) }}>
            Clear {inCart} ticked {inCart === 1 ? 'item' : 'items'}
          </button>
        )}
      </div>
    </div>
  )
}
