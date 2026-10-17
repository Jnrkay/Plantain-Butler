// A4 · Insights (Figma 23:6044)
import { useMemo, useState } from 'react'
import { C, TX, sans, mono } from '../lib/theme'
import { today, monthKey } from '../lib/utils'
import {
  availableMonths, daysInMonth, monthShort, txInMonth, lineTotal, sum, money, monthlyBudget,
  priceChanges, monthlyPriceSeries,
} from '../lib/derive'
import { Header, Tag, Money, Icon, Segmented, reset } from './ui'
import { typeOf, brandOf, typeKey, everyLabel, daysLeftLabel } from '../lib/learn'

const CAT_COLORS = [
  { bg: C.amber, fg: C.ink },
  { bg: C.teal, fg: C.blush },
  { bg: C.ink, fg: C.cream },
  { bg: C.row, fg: C.ink },
]

/* ---------- Pace chart (23:6082) — same geometry as the Figma export ---------- */
function PaceChart({ tx, mk, budget, day }) {
  const W = 350, TOP = 8, BASE = 150
  const days = daysInMonth(mk)
  const x = (d) => ((d - 1) * W) / (days - 1)
  const cum = []
  let run = 0
  for (let d = 1; d <= days; d++) {
    run += sum(tx.filter((t) => Number(String(t.date).slice(8)) === d), lineTotal)
    cum.push(run)
  }
  const spent = cum[day - 1] || 0
  const paceToday = budget ? (budget * day) / days : 0
  const yMax = Math.max(spent, paceToday, 1) * 1.7714
  const y = (v) => BASE - (v / yMax) * (BASE - TOP)

  let step = `M0 ${BASE}`
  for (let d = 1; d <= day; d++) step += `H${x(d).toFixed(1)}V${y(cum[d - 1]).toFixed(1)}`
  const tx_ = x(day)
  const paceLineEnd = budget ? { x: x(days), y: y(budget) } : null
  const paceAtX = budget ? BASE - ((BASE - y(budget)) * tx_) / x(days) : null

  return (
    <svg viewBox={`0 0 ${W} 170`} width="100%" style={{ display: 'block', overflow: 'hidden' }} aria-label="Spend versus budget pace">
      <defs><clipPath id="pace-clip"><rect width={W} height="170" /></clipPath></defs>
      <g clipPath="url(#pace-clip)">
        {[150, 114.5, 79, 43.5, 8].map((gy) => <path key={gy} d={`M0 ${gy}H${W}`} stroke={C.ink} strokeOpacity="0.1" />)}
        {paceLineEnd && <path d={`M0 ${BASE}L${paceLineEnd.x} ${paceLineEnd.y}`} stroke={C.ink} strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="4 4" />}
        <path d={`${step}V${BASE}H0Z`} fill={C.ember} />
        <path d={step} stroke={C.ink} strokeWidth="2" fill="none" />
        <path d={`M${tx_} 8V150`} stroke={C.ink} strokeOpacity="0.3" strokeDasharray="2 3" />
        <rect x={tx_ - 4} y={y(spent) - 4} width="8" height="8" fill={C.ink} />
        {paceAtX !== null && (
          <>
            <path d={`M${tx_} ${y(spent)}V${paceAtX + 3}`} stroke={C.amber} strokeWidth="2" />
            <rect x={tx_ - 3} y={paceAtX - 3} width="6" height="6" fill={C.amber} />
          </>
        )}
        <path d={`M0 150H${W}`} stroke={C.ink} strokeOpacity="0.4" />
      </g>
    </svg>
  )
}

/* ---------- Price line (23:6140) ---------- */
function PriceLine({ series, up }) {
  const W = 318
  const pts = series.map((s, i) => ({ ...s, x: 8 + i * ((W - 16) / (series.length - 1)) })).filter((p) => p.price !== null)
  const vals = pts.map((p) => p.price)
  const min = Math.min(...vals), max = Math.max(...vals)
  const yOf = (v) => (max === min ? 48 : 65.1 - ((v - min) / (max - min)) * 45.7)
  return (
    <svg viewBox={`0 0 ${W} 96`} width="100%" style={{ display: 'block' }} aria-hidden>
      {[8, 48, 88].map((gy) => <path key={gy} d={`M0 ${gy}H${W}`} stroke={C.ink} strokeOpacity="0.1" />)}
      {pts.length > 1 && <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${yOf(p.price)}`).join('')} stroke={C.ink} strokeWidth="1.6" fill="none" />}
      {pts.map((p, i) => (
        <rect key={p.mk} x={p.x - 3.5} y={yOf(p.price) - 3.5} width="7" height="7" fill={i === pts.length - 1 && up ? C.ember : C.ink} />
      ))}
    </svg>
  )
}

function Sparkline({ prices, dir }) {
  const p = prices.slice(-4)
  const min = Math.min(...p), max = Math.max(...p)
  const d = p.map((v, i) => `${i ? 'L' : 'M'}${(i * 60) / Math.max(1, p.length - 1)} ${max === min ? 12 : 20 - ((v - min) / (max - min)) * 16}`).join('')
  const stroke = dir > 0 ? C.ember : C.ink
  return (
    <svg width="62" height="24" viewBox="0 0 62 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path d={d} stroke={stroke} strokeOpacity={dir === 0 ? 0.4 : 1} strokeWidth="1.6" />
    </svg>
  )
}

const pctLabel = (pct) => {
  if (Math.abs(pct) < 0.05) return '— 0.0%'
  return `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`
}

function SectionHead({ left, right, rightColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.ink15}`, paddingTop: 16 }}>
      <span style={TX.label}>{left}</span>
      <span style={{ ...TX.label, color: rightColor || C.ink80 }}>{right}</span>
    </div>
  )
}

export default function AnalyticsPage({ header, transactions, profile, openSheet, model }) {
  const [view, setView] = useState('types')
  const [showAll, setShowAll] = useState(false)
  const [mk, setMk] = useState(monthKey(today()))
  const months = availableMonths(transactions)
  const tx = useMemo(() => txInMonth(transactions, mk), [transactions, mk])
  const budget = monthlyBudget(profile)
  const isCurrent = mk === monthKey(today())
  const days = daysInMonth(mk)
  const day = isCurrent ? Number(today().slice(8)) : days
  const spent = sum(tx, lineTotal)
  const paceToday = budget ? (budget * day) / days : 0
  const diff = paceToday - spent

  const byCat = useMemo(() => {
    const m = {}
    tx.forEach((t) => { const c = t.category || 'Other'; m[c] = (m[c] || 0) + lineTotal(t) })
    let list = Object.entries(m).sort((a, b) => b[1] - a[1])
    if (list.length > 4) list = [...list.slice(0, 3), ['Everything else', sum(list.slice(3), (e) => e[1])]]
    return list.map(([name, amount], i) => ({ name, amount, ...CAT_COLORS[i] }))
  }, [tx])

  // Spend by product type and by brand for the selected month
  const byType = useMemo(() => {
    const m = {}
    tx.forEach((t) => {
      const k = typeKey(typeOf(t))
      const e = (m[k] ||= { key: k, name: typeOf(t), amount: 0, brands: new Set() })
      e.amount += lineTotal(t); e.brands.add(brandOf(t) || 'Unbranded')
    })
    return Object.values(m).sort((a, b) => b.amount - a.amount)
  }, [tx])
  const byBrand = useMemo(() => {
    const m = {}
    tx.forEach((t) => {
      const b = brandOf(t)
      if (!b) return
      const e = (m[b.toLowerCase()] ||= { name: b, amount: 0, units: 0, types: {} })
      e.amount += lineTotal(t); e.units += Number(t.qty) || 1
      const k = typeKey(typeOf(t)); e.types[k] = (e.types[k] || 0) + lineTotal(t)
    })
    return Object.values(m).map((e) => ({ ...e, topType: Object.entries(e.types).sort((a, b) => b[1] - a[1])[0]?.[0] })).sort((a, b) => b.amount - a.amount)
  }, [tx])
  const runningOut = useMemo(() => Object.values(model || {})
    .filter((T) => T.learned && T.items.length && T.daysLeft !== null && T.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 4), [model])
  const productRows = (view === 'types' ? byType : byBrand)
  const shownRows = showAll ? productRows : productRows.slice(0, 6)

  const changes = useMemo(() => priceChanges(transactions), [transactions])
  const featured = changes[0]
  const series = featured ? monthlyPriceSeries(featured.purchases, monthKey(today())) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Header {...header} />

      {/* Title 23:6066 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
        <h1 style={TX.title}>Insights</h1>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: 12, border: `1px solid ${C.ink25}` }}>
          <span style={sans(13, 500, { color: C.ink })}>{monthShort(mk)}</span>
          <Icon name="chev@14" />
          <select aria-label="Month" value={mk} onChange={(e) => setMk(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer' }}>
            {months.map((m) => <option key={m} value={m}>{monthShort(m)}</option>)}
          </select>
        </div>
      </div>

      {/* Spend vs pace 23:6072 */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 8px' }}>
        <Tag>{isCurrent ? 'SPENT SO FAR' : 'SPENT'}</Tag>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={mono(12, 500, { color: C.ink80 })}>GHS</span>
            <Money value={spent} size={spent >= 10000 ? 40 : 52} tracking={-2.08} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, paddingBottom: 8, textAlign: 'right' }}>
            {budget ? (
              <>
                <span style={sans(13, 500, { color: diff < 0 ? C.ember : C.ink })}>{money(Math.abs(diff))} {diff < 0 ? 'over' : 'under'} pace</span>
                <span style={sans(11, 400, { color: C.ink80 })}>{isCurrent ? 'Pace today' : 'Budget'}: GHS {money(paceToday)}</span>
              </>
            ) : (
              <button onClick={() => openSheet('budgets')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'right' }}>
                <span style={sans(13, 500, { color: C.ink })}>No budget set</span><br />
                <span style={sans(11, 400, { color: C.ink80, textDecoration: 'underline' })}>Set one to see your pace</span>
              </button>
            )}
          </div>
        </div>
        <PaceChart tx={tx} mk={mk} budget={budget} day={day} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {['01', '08', '15', '22', String(days)].map((t) => <span key={t} style={TX.label}>{t}</span>)}
        </div>
        <div style={{ display: 'flex', gap: 16, paddingTop: 4, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, background: C.amber }} />
            <span style={sans(12, 400, { color: C.ink70 })}>Your spend</span>
          </div>
          {budget > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="2" viewBox="0 0 16 2" aria-hidden><path d="M0 1H16" stroke={C.ink} strokeDasharray="4 3" /></svg>
              <span style={sans(12, 400, { color: C.ink70 })}>Budget pace (GHS {money(budget, 0)})</span>
            </div>
          )}
        </div>
      </section>

      {/* By category 23:6110 */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px 0' }}>
        <SectionHead left="BY CATEGORY" right={`${byCat.length} ${byCat.length === 1 ? 'CATEGORY' : 'CATEGORIES'}`} />
        {byCat.length > 0 ? (
          <>
            <div style={{ display: 'flex', gap: 4, height: 40 }}>
              {byCat.map((c, i) => {
                const pct = (c.amount / spent) * 100
                return (
                  <div key={c.name} style={{ flex: `${c.amount} 1 0`, minWidth: 4, height: 40, background: c.bg, display: 'flex', alignItems: 'center', padding: pct >= 9 ? '0 12px' : 0, overflow: 'hidden' }}>
                    {pct >= 9 && <span style={mono(11, 500, { color: c.fg, whiteSpace: 'nowrap' })}>{Math.round(pct)}%</span>}
                  </div>
                )
              })}
            </div>
            {byCat.map((c) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 12, height: 12, background: c.bg, flexShrink: 0 }} />
                <span style={{ ...sans(14, 400, { color: C.ink }), flex: 1, minWidth: 0 }}>{c.name}</span>
                <Money value={c.amount} size={18} tracking={-0.36} />
              </div>
            ))}
          </>
        ) : (
          <span style={TX.small}>No spending logged for {monthShort(mk)}.</span>
        )}
      </section>

      {/* Butler's learning: what runs out soon */}
      {runningOut.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '24px 20px 0' }}>
          <SectionHead left="RUNNING OUT SOON" right="BUTLER ESTIMATE" />
          <div style={{ background: C.teal, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {runningOut.map((T) => (
              <button key={T.key} onClick={() => openSheet('type', { typeKey: T.key })} style={{ ...reset, display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                <span style={{ ...sans(14, 500, { color: C.blush }), flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{T.type}</span>
                <span style={mono(10, 500, { letterSpacing: 0.6, color: T.estimate < 0.5 ? C.amber : C.blush80, whiteSpace: 'nowrap' })}>
                  {T.estimate < 0.5 ? 'PROBABLY OUT' : `≈${Math.round(T.estimate)} LEFT · ${daysLeftLabel(T.daysLeft).replace('about ', '~').toUpperCase()}`}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* By product type / brand */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '24px 20px 0' }}>
        <SectionHead left="BY PRODUCT" right={monthShort(mk).toUpperCase()} />
        <Segmented value={view} onChange={(v) => { setView(v); setShowAll(false) }} height={40} fontSize={13}
          options={[{ value: 'types', label: 'Product types' }, { value: 'brands', label: 'Brands' }]} />
        {shownRows.length ? shownRows.map((r) => {
          const T = view === 'types' ? model?.[r.key] : model?.[r.topType]
          const sub = view === 'types'
            ? [T?.learned ? `Uses ${everyLabel(T.rate).replace('about ', '~')}` : 'Learning your usage', `${r.brands.size} brand${r.brands.size === 1 ? '' : 's'}`].join(' · ')
            : `${T?.type || 'Various'} · ×${r.units}`
          return (
            <button key={r.key || r.name} onClick={() => T && openSheet('type', { typeKey: T.key })}
              style={{ ...reset, background: C.row, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ ...sans(14, 500, { color: C.ink }), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                <span style={{ ...mono(9, 400, { letterSpacing: 0.36, color: C.ink80 }), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.toUpperCase()}</span>
              </div>
              <Money value={r.amount} size={18} tracking={-0.36} />
            </button>
          )
        }) : (
          <span style={TX.small}>{view === 'brands' ? 'No brands recorded yet — Butler picks them up from receipts and item names.' : `No spending logged for ${monthShort(mk)}.`}</span>
        )}
        {productRows.length > 6 && (
          <button onClick={() => setShowAll(!showAll)} style={{ ...reset, alignSelf: 'flex-start', ...sans(13, 500, { color: C.ink, textDecoration: 'underline', textUnderlineOffset: 3 }) }}>
            {showAll ? 'Show fewer' : `Show all ${productRows.length}`}
          </button>
        )}
      </section>

      {/* Price changes 23:6127 */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '24px 20px 112px' }}>
        <SectionHead left="PRICE CHANGES" right={`${changes.length} TRACKED`} rightColor={C.ember} />
        {featured ? (
          <>
            <div style={{ background: C.row, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span style={{ ...TX.rowName, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{featured.name}</span>
                  <span style={{ ...TX.label, whiteSpace: 'nowrap' }}>
                    {featured.purchases.length} PURCHASES{featured.store ? ` · ${featured.store.toUpperCase()}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <Money value={featured.last} size={24} tracking={-0.48} />
                  <div style={{ background: featured.pct > 0 ? C.ember : featured.pct < 0 ? C.teal : C.ink, padding: '4px 8px' }}>
                    <span style={mono(10, 500, { color: featured.pct < 0 ? C.blush : C.white, whiteSpace: 'nowrap' })}>{pctLabel(featured.pct)}</span>
                  </div>
                </div>
              </div>
              <PriceLine series={series} up={featured.pct > 0} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {series.map((s) => <span key={s.mk} style={TX.label}>{s.label}</span>)}
              </div>
            </div>
            {changes.slice(1, 6).map((c) => {
              const dir = Math.abs(c.pct) < 0.05 ? 0 : c.pct > 0 ? 1 : -1
              return (
                <div key={c.name} style={{ background: C.row, height: 64, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ ...sans(14, 500, { color: C.ink }), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                    <span style={mono(9, 400, { letterSpacing: 0.36, color: C.ink80 })}>GHS {money(c.first)} → {money(c.last)}</span>
                  </div>
                  <Sparkline prices={c.purchases.map((p) => Number(p.price) || 0)} dir={dir} />
                  <div style={{ width: 68, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <span style={mono(11, 500, { color: dir > 0 ? C.ember : dir < 0 ? C.ink : C.ink80, whiteSpace: 'nowrap' })}>{pctLabel(c.pct)}</span>
                  </div>
                </div>
              )
            })}
          </>
        ) : (
          <div style={{ background: C.row, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={TX.rowName}>No price history yet</span>
            <span style={TX.small}>Buy the same item twice and Butler tracks how its price moves.</span>
          </div>
        )}
      </section>
    </div>
  )
}
