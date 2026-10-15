// Pure data helpers shared by the screens. No UI here.
import { today, monthKey } from './utils'

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export const lineTotal = (t) => (Number(t.price) || 0) * (Number(t.qty) || 1)
export const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + f(x), 0)

// "1,710.00"
export const money = (n, dp = 2) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const parseDate = (s) => {
  const [y, m, d] = String(s || today()).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export const daysInMonth = (mk) => {
  const [y, m] = mk.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// "TUE · 06 OCT"
export const dateGroupLabel = (s) => {
  const d = parseDate(s)
  return `${DAYS[d.getDay()]} · ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()].toUpperCase()}`
}
// "Tue, 06 Oct"
export const shortDate = (s) => {
  const d = parseDate(s)
  return `${DAYS[d.getDay()][0]}${DAYS[d.getDay()].slice(1).toLowerCase()}, ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`
}
// "06 Oct 2026"
export const longDate = (s) => {
  const d = parseDate(s)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
export const monthTitle = (mk) => {
  const [y, m] = mk.split('-').map(Number)
  return `${MONTHS_LONG[m - 1].toUpperCase()} ${y}`
}
export const monthShort = (mk) => {
  const [y, m] = mk.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
export const shiftMonth = (mk, delta) => {
  const [y, m] = mk.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const txInMonth = (transactions, mk) => transactions.filter((t) => monthKey(t.date) === mk)

// Months that have data, newest first, always including the current month
export const availableMonths = (transactions) => {
  const set = new Set([monthKey(today()), ...transactions.map((t) => monthKey(t.date))])
  return [...set].sort().reverse()
}

export const monthlyBudget = (profile) => Number(profile?.monthlyBudget) || 0

/* ---------- inventory ---------- */
// Stored status: 'high' (In stock) | 'medium' (Running low) | 'low' (Out)
export const STOCK = {
  high: { label: 'In stock', meter: 'OK', bars: 3 },
  medium: { label: 'Running low', meter: 'MED', bars: 2 },
  low: { label: 'Out', meter: 'OUT', bars: 0 },
}
export const stockOf = (item) => STOCK[item?.status] ? item.status : 'high'
export const isLow = (item) => item && (item.status === 'medium' || item.status === 'low')

export const categoryIcon = (category = '') => {
  const c = category.toLowerCase()
  if (/bever|drink|juice|water/.test(c)) return 'cup'
  if (/toilet|clean|soap|hygien/.test(c)) return 'drop'
  return 'box'
}

export const pad2 = (n) => String(Math.max(0, Math.round(Number(n) || 0))).padStart(2, '0')

/* ---------- price history ---------- */
const norm = (s) => String(s || '').toLowerCase().trim()

export const purchasesOf = (transactions, name) =>
  transactions
    .filter((t) => norm(t.item) === norm(name))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

// Items bought more than once, with first→last unit price change
export const priceChanges = (transactions) => {
  const byItem = {}
  transactions.forEach((t) => {
    const k = norm(t.item)
    if (!k) return
    ;(byItem[k] ||= []).push(t)
  })
  return Object.values(byItem)
    .filter((list) => list.length >= 2)
    .map((list) => {
      list.sort((a, b) => (a.date < b.date ? -1 : 1))
      const first = Number(list[0].price) || 0
      const last = Number(list[list.length - 1].price) || 0
      const pct = first ? ((last - first) / first) * 100 : 0
      const stores = [...new Set(list.map((t) => t.store).filter(Boolean))]
      return { name: list[0].item, purchases: list, first, last, pct, store: stores[0] || '' }
    })
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
}

// Last unit price per month for the trailing `n` months ending at `endMk`
export const monthlyPriceSeries = (purchases, endMk, n = 6) => {
  const months = Array.from({ length: n }, (_, i) => shiftMonth(endMk, i - (n - 1)))
  let carry = null
  const firstMk = purchases.length ? monthKey(purchases[0].date) : null
  return months.map((mk) => {
    const inMonth = purchases.filter((p) => monthKey(p.date) === mk)
    if (inMonth.length) carry = Number(inMonth[inMonth.length - 1].price) || 0
    else if (carry === null && firstMk && mk > firstMk) carry = Number(purchases[0].price) || 0
    return { mk, label: MONTHS[Number(mk.slice(5)) - 1].toUpperCase(), price: carry }
  })
}

export const usuallyLasts = (purchases) => {
  const dates = [...new Set(purchases.map((p) => p.date))].sort()
  if (dates.length < 2) return '—'
  const gaps = []
  for (let i = 1; i < dates.length; i++) gaps.push((parseDate(dates[i]) - parseDate(dates[i - 1])) / 86400000)
  const avg = sum(gaps) / gaps.length
  if (avg < 10) return `~${Math.max(1, Math.round(avg))} days`
  if (avg < 60) return `~${Math.round(avg / 7)} weeks`
  return `~${Math.round(avg / 30)} months`
}

export const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'PB'
  return (parts[0][0] + (parts[1]?.[0] || parts[0][1] || '')).toUpperCase()
}

export const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
