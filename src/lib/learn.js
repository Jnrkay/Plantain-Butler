// Butler's learning model.
//
// Every item has a product TYPE ("Water", "Paper towels") and optionally a BRAND
// ("Voltic", "Bounty"). Consumption is tracked per type, so buying any brand of
// water restocks "Water", and insights can be read per type or per brand.
//
// How fast a household uses a type is learned in two ways:
//   1. Purchases — over time, what you buy ≈ what you use. Units bought per day
//      across your purchase history gives a base rate.
//   2. Counts — whenever you correct a stock count (or confirm Butler's estimate),
//      the gap between what Butler predicted you'd use and what you actually used
//      nudges a per-type correction factor. These live in households.learning.
//
// From the rate, Butler estimates what's left today, when you'll run out, and
// when to flag something as running low.
import { today } from './utils'

/* ---------- product types ---------- */
const RULES = [
  // order matters: more specific first
  [/paper towel|kitchen (towel|roll)|bounty/, 'Paper towels'],
  [/toilet (roll|tissue|paper)|tissue roll/, 'Toilet roll'],
  [/serviette|napkin|facial tissue|tissues?\b/, 'Tissues'],
  [/\bwater\b|voltic|verna|bel.?aqua|cool pac|pure water/, 'Water'],
  [/\brice\b|basmati|jasmine|royal aroma|tilda|perfumed/, 'Rice'],
  [/milo|bournvita|richoco|chocolate drink|cocoa drink/, 'Chocolate drink'],
  [/evaporated|ideal milk|peak milk|cowbell|nido|\bmilk\b|powdered milk/, 'Milk'],
  [/tomato (paste|mix|puree)|tasty tom|pomo|gino tomato/, 'Tomato paste'],
  [/cooking oil|vegetable oil|sunflower oil|palm oil|frytol|\boil\b/, 'Cooking oil'],
  [/sugar|st louis/, 'Sugar'],
  [/\bsalt\b/, 'Salt'],
  [/spaghetti|pasta|macaroni|golden penny/, 'Pasta'],
  [/noodle|indomie/, 'Noodles'],
  [/\bgari\b/, 'Gari'],
  [/\beggs?\b/, 'Eggs'],
  [/bread|\bloaf\b/, 'Bread'],
  [/flour/, 'Flour'],
  [/margarine|blue band|butter/, 'Margarine'],
  [/sardine|mackerel|titus|tuna|geisha/, 'Tinned fish'],
  [/chicken|wings|drumstick/, 'Chicken'],
  [/\bbeef\b|goat|mutton/, 'Meat'],
  [/tilapia|fish|salmon|herring|kpanla/, 'Fish'],
  [/yog(h)?urt/, 'Yoghurt'],
  [/juice|ceres|kalypo|tampico/, 'Juice'],
  [/coke|coca.?cola|fanta|sprite|pepsi|malt|soda|soft drink/, 'Soft drinks'],
  [/\btea\b|lipton|ahmad tea/, 'Tea'],
  [/coffee|nescaf/, 'Coffee'],
  [/diaper|nappy|nappies|pampers|huggies|molfix/, 'Diapers'],
  [/toothpaste|pepsodent|close.?up|colgate|sensodyne/, 'Toothpaste'],
  [/dish(washing)?|washing.?up liquid|mama lemon|sunlight liquid/, 'Dishwashing liquid'],
  [/detergent|washing powder|omo|ariel|sunlight powder|klin/, 'Detergent'],
  [/bleach|parazone|jik/, 'Bleach'],
  [/soap|\blux\b|dettol bar/, 'Soap'],
  [/shower gel|body wash/, 'Shower gel'],
  [/plantain/, 'Plantain'],
  [/\byam\b/, 'Yam'],
  [/onion/, 'Onions'],
  [/tomato/, 'Tomatoes'],
  [/pepper/, 'Pepper'],
]
const BRANDS = ['Voltic', 'Verna', 'Bel-Aqua', 'Royal Aroma', 'Tilda', 'Gino', 'Frytol', 'Milo', 'Bournvita', 'Richoco', 'Ideal', 'Peak', 'Cowbell', 'Nido',
  'Golden Penny', 'Indomie', 'Bounty', 'Omo', 'Ariel', 'Sunlight', 'Key', 'Lux', 'Dettol', 'Pepsodent', 'Close-Up', 'Colgate', 'Sensodyne', 'Pampers', 'Huggies',
  'Molfix', 'Titus', 'Geisha', 'Ceres', 'Kalypo', 'Tampico', 'Coca-Cola', 'Fanta', 'Sprite', 'Pepsi', 'Lipton', 'Nescafé', 'Parazone', 'Jik', 'Blue Band',
  'Tasty Tom', 'Pomo', 'Mama Lemon', 'St Louis', 'Cool Pac', 'Klin']

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
export const sizeOf = (name) => (String(name || '').toLowerCase().match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|cl|l|ltr|litre|liter)\b/) || [])[0]?.replace(/\s+/g, '') || ''
// Does this purchase belong to an item we already track? Same name, or same brand + type + size.
export function findItem(inventory, x) {
  const name = norm(x.item ?? x.name)
  const exact = inventory.find((i) => norm(i.name) === name)
  if (exact) return exact
  const b = norm(x.brand), t = norm(x.productType)
  if (!b || !t) return null
  const size = sizeOf(x.item ?? x.name)
  return inventory.find((i) => norm(i.brand) === b && norm(i.productType) === t && sizeOf(i.name) === size) || null
}
export const typeKey = (t) => norm(t)

// A confident match from the built-in list, or '' if the name isn't recognised
export function ruleType(name) {
  const n = norm(name)
  for (const [re, t] of RULES) if (re.test(n)) return t
  return ''
}
// Best guess when neither the user nor Butler has set a type yet
export function guessType(name) {
  const r = ruleType(name)
  if (r) return r
  // Fall back to the name without sizes and pack counts ("Gari 2kg" → "Gari")
  const stripped = String(name || '').replace(/\b\d+(\.\d+)?\s*(g|kg|ml|cl|l|ltr|litre|liter|pcs|pc|pack|x|s)\b/gi, '').replace(/\s{2,}/g, ' ').trim()
  return stripped ? stripped.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Other'
}
export function guessBrand(name) {
  const n = norm(name)
  return BRANDS.find((b) => n.includes(b.toLowerCase())) || ''
}
export const typeOf = (x) => (x?.productType && String(x.productType).trim()) || guessType(x?.name ?? x?.item)
export const brandOf = (x) => (x?.brand && String(x.brand).trim()) || guessBrand(x?.name ?? x?.item)
export const KNOWN_TYPES = [...new Set(RULES.map(([, t]) => t))].sort()

/* ---------- dates ---------- */
const dayMs = 86400000
const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / dayMs)

/* ---------- per-type model ---------- */
// Base usage rate (units/day) from purchases. Needs purchases on 2+ different days.
// Uses up to the last 8 purchase days so it follows changes in habits.
function purchaseRate(purchases) {
  const byDay = {}
  purchases.forEach((p) => { byDay[p.date] = (byDay[p.date] || 0) + (Number(p.qty) || 1) })
  const days = Object.keys(byDay).sort().slice(-8)
  if (days.length < 2) return null
  const span = daysBetween(days[0], days[days.length - 1])
  if (span < 1) return null
  const unitsBeforeLast = days.slice(0, -1).reduce((s, d) => s + byDay[d], 0)
  return { rate: unitsBeforeLast / span, cycle: span / (days.length - 1), samples: days.length }
}

// Build the model for every type in the household
export function buildModel(inventory, transactions, learning = {}) {
  const now = today()
  const types = {}
  const get = (name) => {
    const k = typeKey(name)
    return (types[k] ||= { key: k, type: name, items: [], purchases: [], brands: {} })
  }
  transactions.forEach((t) => {
    const T = get(typeOf(t))
    T.purchases.push(t)
    const b = brandOf(t) || 'Unbranded'
    const B = (T.brands[b] ||= { brand: b, units: 0, spend: 0, purchases: 0, last: null, lastPrice: 0 })
    const q = Number(t.qty) || 1
    B.units += q; B.spend += (Number(t.price) || 0) * q; B.purchases += 1
    if (!B.last || t.date >= B.last) { B.last = t.date; B.lastPrice = Number(t.price) || 0 }
  })
  inventory.forEach((i) => get(typeOf(i)).items.push(i))

  Object.values(types).forEach((T) => {
    T.purchases.sort((a, b) => (a.date < b.date ? -1 : 1))
    const L = learning[T.key] || {}
    const base = purchaseRate(T.purchases)
    T.factor = Number(L.factor) || 1
    T.counts = Number(L.n) || 0
    T.baseRate = base?.rate ?? null
    T.cycle = base?.cycle ?? null
    T.rate = base ? base.rate * T.factor : null // units per day
    T.recorded = T.items.reduce((s, i) => s + (Number(i.qty) || 0), 0)
    T.full = Math.max(T.recorded, T.items.reduce((s, i) => s + (Number(i.fullQty) || 0), 0))
    const lastBuy = T.purchases.length ? T.purchases[T.purchases.length - 1].date : null
    T.lastBuy = lastBuy
    T.anchor = [lastBuy, L.countedAt].filter(Boolean).sort().pop() || null
    const since = T.anchor ? Math.max(0, daysBetween(T.anchor, now)) : 0
    T.estimate = T.rate && T.anchor ? Math.max(0, T.recorded - T.rate * since) : T.recorded
    T.daysLeft = T.rate ? T.estimate / T.rate : null
    T.learned = !!T.rate
    // Status from the estimate
    if (T.items.length) {
      if (T.estimate < 0.5) T.status = 'low'
      else if (T.rate && T.daysLeft <= Math.max(3, (T.cycle || 0) * 0.25)) T.status = 'medium'
      else if (T.full >= 2 && T.estimate <= Math.ceil(T.full / 3)) T.status = 'medium'
      else T.status = 'high'
    }
    const units = T.purchases.reduce((s, p) => s + (Number(p.qty) || 1), 0)
    const spend = T.purchases.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.qty) || 1), 0)
    T.avgPrice = units ? spend / units : 0
    T.spend = spend
    T.brandList = Object.values(T.brands).map((B) => ({ ...B, avgPrice: B.units ? B.spend / B.units : 0 })).sort((a, b) => b.units - a.units)
    const priced = T.brandList.filter((B) => B.avgPrice > 0)
    T.cheapest = priced.length > 1 ? priced.reduce((m, B) => (B.avgPrice < m.avgPrice ? B : m)) : null
    // Share the type's estimate across its items: older stock gets used up first
    let used = Math.max(0, T.recorded - T.estimate)
    const order = [...T.items].sort((a, b) => String(a.lastPurchased || '').localeCompare(String(b.lastPurchased || '')))
    T.itemEst = {}
    order.forEach((i) => {
      const q = Number(i.qty) || 0
      const take = Math.min(q, used)
      used -= take
      T.itemEst[i.id] = q - take
    })
  })
  return types
}

// Attach the model to items for the screens (fields starting with _ are never saved)
export function annotate(inventory, model) {
  return inventory.map((i) => {
    const T = model[typeKey(typeOf(i))]
    if (!T) return i
    const est = T.itemEst[i.id] ?? (Number(i.qty) || 0)
    return { ...i, _type: T.type, _brand: brandOf(i), _est: est, _auto: T.status, _model: T }
  })
}

/* ---------- learning updates ---------- */
// A count correction for a type: compare actual usage to predicted usage since the anchor.
// `base` is the type's state before this edit session (so repeated taps don't compound).
export function learnFromCount(learning, base, newTotal) {
  const L = { ...(learning || {}) }
  const prev = L[base.key] || {}
  let factor = Number(prev.factor) || 1
  const days = base.anchor ? daysBetween(base.anchor, today()) : 0
  if (base.baseRate && days >= 1) {
    const predicted = base.baseRate * factor * days
    const actual = Math.max(0, base.recorded - newTotal)
    if (predicted > 0) {
      const ratio = Math.min(4, Math.max(0.25, actual / predicted))
      const w = (Number(prev.n) || 0) < 3 ? 0.5 : 0.3
      factor = Math.min(5, Math.max(0.2, factor * (1 - w + w * ratio)))
    }
  }
  L[base.key] = { factor: Math.round(factor * 1000) / 1000, n: (Number(prev.n) || 0) + 1, countedAt: today() }
  return L
}

/* ---------- words ---------- */
export const everyLabel = (rate) => {
  if (!rate) return ''
  const days = 1 / rate
  if (days < 1) return `about ${Math.round(rate)} a day`
  if (days < 1.5) return 'about 1 a day'
  const every = (n, w) => (n === 1 ? `about 1 a ${w}` : `about 1 every ${n} ${w}s`)
  if (days < 14) return every(Math.round(days), 'day')
  if (days < 60) return every(Math.round(days / 7), 'week')
  return every(Math.round(days / 30), 'month')
}
export const daysLeftLabel = (d) => {
  if (d === null || d === undefined) return ''
  if (d < 1) return 'today'
  if (d < 2) return 'about a day'
  const n = (v, w) => `about ${v} ${w}${v === 1 ? '' : 's'}`
  if (d < 14) return n(Math.round(d), 'day')
  if (d < 60) return n(Math.round(d / 7), 'week')
  return n(Math.round(d / 30), 'month')
}
export const qtyLabel = (n) => {
  const v = Math.round((Number(n) || 0) * 10) / 10
  return v % 1 === 0 ? String(v) : v.toFixed(1)
}
