// A2 · Inventory (Figma 23:5724) + M7 · Filter menu (23:8029)
import { useMemo, useState } from 'react'
import { C, TX, sans, mono, TAB_CLEARANCE } from '../lib/theme'
import { money, pad2, stockOf, categoryIcon, isLow } from '../lib/derive'
import { Header, TitleRow, AddButton, Chip, ChipRow, Thumb, StockMeter, Icon, Checkbox, Segmented, Overlay, reset } from './ui'

const SORTS = [
  { value: 'qty', label: 'Quantity — lowest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'price', label: 'Last price' },
  { value: 'recent', label: 'Recently bought' },
]
const STATUS_OPTS = [
  { value: 'any', label: 'Any' }, { value: 'high', label: 'OK' }, { value: 'medium', label: 'Low' }, { value: 'low', label: 'Out' },
]

export function ItemRow({ item, onClick }) {
  const status = stockOf(item)
  const med = status === 'medium'
  return (
    <button
      onClick={onClick}
      style={{ ...reset, display: 'flex', alignItems: 'center', gap: 12, height: 72, padding: '12px 16px 12px 12px', width: '100%', background: med ? C.amber : C.row }}
    >
      <Thumb icon={categoryIcon(item.category)} dark={med} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ ...TX.rowName, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
        <span style={{ ...TX.micro, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {(item.category || 'Other').toUpperCase()}{item.lastPrice ? ` · GHS ${money(item.lastPrice)}` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={mono(9, 400, { color: C.ink80 })}>QTY</span>
          <span style={sans(28, 300, { lineHeight: '30px', letterSpacing: -0.56, color: C.ink })}>{pad2(item.qty)}</span>
        </div>
        <StockMeter status={status} />
      </div>
    </button>
  )
}

function FilterPopover({ cats, counts, filter, setFilter, resultCount, onClose }) {
  const [draft, setDraft] = useState(filter)
  const toggleCat = (c) => {
    const next = new Set(draft.cats)
    next.has(c) ? next.delete(c) : next.add(c)
    setDraft({ ...draft, cats: next })
  }
  return (
    <Overlay onClose={onClose}>
      <div
        role="dialog" aria-label="Filter and sort"
        style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 188px)', right: 'max(20px, calc((100vw - 480px) / 2 + 20px))',
          width: 'min(310px, calc(100vw - 80px))', background: C.white, padding: 16, display: 'flex', flexDirection: 'column', gap: 16,
          maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto', animation: 'pb-pop-in .15s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={sans(17, 500, { letterSpacing: -0.17, color: C.ink })}>Filter &amp; sort</span>
          <button onClick={() => setDraft({ cats: new Set(), status: 'any', sort: 'qty' })} style={{ ...reset, ...sans(13, 500, { color: C.ink80 }) }}>Reset</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={TX.label}>CATEGORY</span>
          {cats.map((c) => {
            const on = draft.cats.has(c)
            return (
              <div key={c} onClick={() => toggleCat(c)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <Checkbox size={20} checked={on} label={c} onClick={(e) => { e.stopPropagation(); toggleCat(c) }} />
                <span style={{ ...sans(14, 400, { color: on ? C.ink : C.ink80 }), flex: 1 }}>{c}</span>
                <span style={mono(11, 400, { color: C.ink80 })}>{counts[c] || 0}</span>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={TX.label}>STOCK STATUS</span>
          <Segmented options={STATUS_OPTS} value={draft.status === 'lowish' ? 'medium' : draft.status} onChange={(v) => setDraft({ ...draft, status: v })}
            height={36} activeBg={C.ink} activeColor={C.cream} fontSize={13} boldInactive />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={TX.label}>SORT BY</span>
          {SORTS.map((s) => {
            const on = draft.sort === s.value
            return (
              <button key={s.value} onClick={() => setDraft({ ...draft, sort: s.value })} style={{ ...reset, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                <span style={{ width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${on ? C.ink : C.ink40}` }}>
                  {on && <span style={{ width: 8, height: 8, background: C.ink }} />}
                </span>
                <span style={sans(14, 400, { color: on ? C.ink : C.ink65 })}>{s.label}</span>
              </button>
            )
          })}
        </div>

        <button onClick={() => { setFilter(draft); onClose() }}
          style={{ ...reset, height: 48, background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={sans(15, 500, { color: C.cream })}>Show {resultCount(draft)} {resultCount(draft) === 1 ? 'item' : 'items'}</span>
        </button>
      </div>
    </Overlay>
  )
}

const applyFilter = (inventory, q, f) => {
  let list = inventory.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()))
  if (f.cats.size) list = list.filter((i) => f.cats.has(i.category || 'Other'))
  if (f.status === 'lowish') list = list.filter(isLow)
  else if (f.status !== 'any') list = list.filter((i) => stockOf(i) === f.status)
  const by = {
    qty: (a, b) => (Number(a.qty) || 0) - (Number(b.qty) || 0),
    name: (a, b) => a.name.localeCompare(b.name),
    price: (a, b) => (Number(b.lastPrice) || 0) - (Number(a.lastPrice) || 0),
    recent: (a, b) => String(b.lastPurchased || '').localeCompare(String(a.lastPurchased || '')),
  }[f.sort]
  return by ? [...list].sort(by) : list
}

export default function InventoryPage({ header, inventory, profile, openSheet }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState({ cats: new Set(), status: 'any', sort: 'qty' })
  const [showFilter, setShowFilter] = useState(false)

  const counts = useMemo(() => {
    const c = {}
    inventory.forEach((i) => { const k = i.category || 'Other'; c[k] = (c[k] || 0) + 1 })
    return c
  }, [inventory])
  const presentCats = Object.keys(counts).sort((a, b) => counts[b] - counts[a])
  const popoverCats = [...new Set([...presentCats, ...(profile?.topCategories || [])])]
  const lowCount = inventory.filter(isLow).length

  const list = applyFilter(inventory, q, filter)
  const isAll = !filter.cats.size && filter.status === 'any'
  const singleCat = filter.cats.size === 1 && filter.status === 'any' ? [...filter.cats][0] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Header {...header} />
      <TitleRow title="Inventory">
        <AddButton label="Add items" onClick={() => openSheet('manual')} />
      </TitleRow>

      {/* Search row 23:5751 */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 12px' }}>
        <label style={{ flex: 1, minWidth: 0, height: 48, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', border: `1px solid ${C.ink22}` }}>
          <Icon name="search@18" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search inventory" aria-label="Search inventory"
            style={{ ...sans(14, 400, { color: C.ink }), flex: 1, minWidth: 0, height: '100%' }} />
        </label>
        <button aria-label="Filter and sort" onClick={() => setShowFilter(true)}
          style={{ ...reset, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${showFilter || !isAll ? C.ink : C.ink22}` }}>
          <Icon name="sliders@18" />
        </button>
      </div>

      <ChipRow>
        <Chip label="All" count={inventory.length} active={isAll} onClick={() => setFilter({ ...filter, cats: new Set(), status: 'any' })} />
        {presentCats.map((c) => (
          <Chip key={c} label={c} count={counts[c]} active={singleCat === c} onClick={() => setFilter({ ...filter, cats: new Set([c]), status: 'any' })} />
        ))}
        <Chip label="Low" count={lowCount} active={filter.status === 'lowish' && !filter.cats.size} onClick={() => setFilter({ ...filter, cats: new Set(), status: 'lowish' })} />
      </ChipRow>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: `0 20px ${TAB_CLEARANCE}px` }}>
        {list.map((item) => <ItemRow key={item.id} item={item} onClick={() => openSheet('item', { itemId: item.id })} />)}
        {list.length === 0 && (
          <div style={{ background: C.row, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={TX.rowName}>{inventory.length ? 'No items match' : 'Nothing tracked yet'}</span>
            <span style={TX.small}>{inventory.length ? 'Try another search or reset the filters.' : 'Log a purchase or scan a receipt and your stock appears here.'}</span>
          </div>
        )}
      </div>

      {showFilter && (
        <FilterPopover
          cats={popoverCats} counts={counts} filter={filter} setFilter={setFilter}
          resultCount={(f) => applyFilter(inventory, q, f).length}
          onClose={() => setShowFilter(false)}
        />
      )}
    </div>
  )
}
