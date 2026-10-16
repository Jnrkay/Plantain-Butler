// A3 · Transactions (Figma 23:5886)
import { useMemo, useState } from 'react'
import { C, TX, sans, mono, TAB_CLEARANCE } from '../lib/theme'
import { today, monthKey } from '../lib/utils'
import { availableMonths, daysInMonth, dateGroupLabel, shortDate, monthTitle, txInMonth, lineTotal, sum, money, categoryIcon, withQty } from '../lib/derive'
import { Header, TitleRow, AddButton, Tag, Money, Chip, ChipRow, Thumb, LabelRow, reset } from './ui'

function DailySpend({ tx, mk }) {
  const days = daysInMonth(mk)
  const isCurrent = mk === monthKey(today())
  const todayDay = Number(today().slice(8))
  const perDay = Array(days).fill(0)
  tx.forEach((t) => { const d = Number(String(t.date).slice(8)) - 1; if (d >= 0 && d < days) perDay[d] += lineTotal(t) })
  const max = Math.max(...perDay, 0)
  const ticks = ['01', '08', '15', '22', String(days)]
  return (
    <>
      <div style={{ height: 48, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 2 }}>
        {perDay.map((v, i) => {
          const past = !isCurrent || i + 1 <= todayDay
          return (
            <div key={i} title={v ? `GHS ${money(v)}` : undefined} style={{
              width: 7, flexShrink: 0,
              height: v > 0 ? Math.max(3, (46 * v) / max) : 3,
              background: v > 0 ? C.amber : past ? C.ink30 : C.ink12,
            }} />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {ticks.map((t) => <span key={t} style={mono(9, 400, { color: C.ink80 })}>{t}</span>)}
      </div>
    </>
  )
}

export function TxnRow({ t, onClick }) {
  const sub = [(t.store || t.category || '').toUpperCase(), `×${Number(t.qty) || 1}`].filter(Boolean).join(' · ')
  return (
    <button onClick={onClick} style={{ ...reset, display: 'flex', alignItems: 'center', gap: 12, height: 68, padding: '12px 16px 12px 12px', width: '100%', background: C.row }}>
      <Thumb icon={categoryIcon(t.category)} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ ...TX.rowName, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.item}</span>
        <span style={{ ...TX.micro, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
      </div>
      <Money value={lineTotal(t)} size={20} tracking={-0.4} />
    </button>
  )
}

export default function TransactionsPage({ header, transactions, saveTx, inventory, saveInv, openSheet }) {
  const [mk, setMk] = useState(monthKey(today()))
  const [cat, setCat] = useState(null)
  const months = availableMonths(transactions)
  const monthTx = useMemo(() => txInMonth(transactions, mk), [transactions, mk])

  const total = sum(monthTx, lineTotal)
  const stores = new Set(monthTx.map((t) => t.store).filter(Boolean)).size
  const counts = {}
  monthTx.forEach((t) => { const c = t.category || 'Other'; counts[c] = (counts[c] || 0) + 1 })
  const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a])

  const shown = monthTx.filter((t) => !cat || (t.category || 'Other') === cat)
  const groups = []
  ;[...shown].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).forEach((t) => {
    const g = groups[groups.length - 1]
    if (g && g.date === t.date) g.items.push(t)
    else groups.push({ date: t.date, items: [t] })
  })

  // Deleting a purchase takes what it added back out of stock
  const confirmDelete = (t) => {
    const key = String(t.item).toLowerCase().trim()
    const inv = inventory.find((i) => i.name.toLowerCase().trim() === key)
    const n = Number(t.qty) || 1
    const takeOff = inv ? Math.min(n, Number(inv.qty) || 0) : 0
    openSheet('confirm', {
      title: 'Delete transaction?',
      body: `${t.item} · GHS ${money(lineTotal(t))} on ${shortDate(t.date)}. ${takeOff ? `This also takes ${takeOff} off your stock.` : 'Stock levels won’t change.'}`,
      confirmLabel: 'Delete',
      onConfirm: () => {
        saveTx(transactions.filter((x) => x.id !== t.id))
        if (takeOff) saveInv(inventory.map((i) => (i.id === inv.id ? withQty(i, (Number(i.qty) || 0) - takeOff) : i)))
      },
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Header {...header} />
      <TitleRow title="Transactions">
        <AddButton label="Log a purchase" onClick={() => openSheet('quickAdd')} />
      </TitleRow>

      {/* Month summary 23:5913 */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
              <Tag>{monthTitle(mk)}</Tag>
              {months.length > 1 && (
                <select aria-label="Month" value={mk} onChange={(e) => { setMk(e.target.value); setCat(null) }}
                  style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer' }}>
                  {months.map((m) => <option key={m} value={m}>{monthTitle(m)}</option>)}
                </select>
              )}
            </div>
            <span style={sans(12, 400, { color: C.ink80, whiteSpace: 'nowrap' })}>
              {monthTx.length} {monthTx.length === 1 ? 'purchase' : 'purchases'} · {stores} {stores === 1 ? 'store' : 'stores'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={mono(11, 400, { color: C.ink80 })}>GHS</span>
            <Money value={total} size={42} tracking={-1.68} />
          </div>
        </div>
        <DailySpend tx={monthTx} mk={mk} />
      </section>

      {cats.length > 0 && (
        <ChipRow>
          <Chip label="All" count={monthTx.length} active={!cat} onClick={() => setCat(null)} />
          {cats.map((c) => <Chip key={c} label={c} count={counts[c]} active={cat === c} onClick={() => setCat(c)} />)}
        </ChipRow>
      )}

      {/* Transaction list 23:5970 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: `0 20px ${TAB_CLEARANCE}px` }}>
        {groups.map((g) => (
          <div key={g.date} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <LabelRow left={dateGroupLabel(g.date)} right={`GHS ${money(sum(g.items, lineTotal))}`} style={{ padding: '0 4px 4px' }} />
            {g.items.map((t) => <TxnRow key={t.id} t={t} onClick={() => confirmDelete(t)} />)}
          </div>
        ))}
        {groups.length === 0 && (
          <div style={{ background: C.row, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={TX.rowName}>No purchases this month</span>
            <span style={TX.small}>Tap + to scan a receipt or add items by hand.</span>
          </div>
        )}
      </div>
    </div>
  )
}
