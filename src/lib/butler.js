// Butler's brain: what it knows about the app, the household snapshot it sees,
// and the actions (tools) it can take on the household's data.
import { today, uid } from './utils'
import { CATEGORIES } from './constants'
import { money, lineTotal, sum, txInMonth, shiftMonth, monthlyBudget, stockOf, STOCK } from './derive'
import { typeOf, brandOf, typeKey, everyLabel, daysLeftLabel, ruleType, guessBrand } from './learn'
import { monthKey } from './utils'

export const APP_GUIDE = `HOW PLANTAIN BUTLER WORKS (use this to answer "how do I…" questions; name the exact buttons):
- Tabs (floating bar at the bottom): Home, Stock, Spend, Insights, List, Butler.
- Home: total spent this month, budget left, counts of items tracked / low stock / transactions. The big amber "QUICK ADD" card (+) opens: "Scan a receipt", "Add items manually", "Add to shopping list". A "Getting started" checklist shows for new households.
- Scan a receipt: Quick add → Scan a receipt → "Take photo" or "Choose from library". Butler reads every line (name, brand, product type, qty, price). Review, tap a row to fix it, then "Confirm". Stock and the shopping list update automatically.
- Add items manually: Quick add → Add items manually (or Stock → "Add items"). Enter name, qty, price, optional brand and type. "Add another item" for more.
- Stock tab: everything at home. Search, filter (sliders icon), category chips, "Low" chip. Tap an item to see Butler's estimate, change the count with − / +, set status (In stock / Running low / Out), see brands and prices, "Add to shopping list", "Edit item" (name, brand, product type, category, price) or "Delete".
- Spend tab: purchases by month with category chips. "Log a purchase" adds one. Tap a purchase to delete it (its quantity comes back off stock).
- Insights tab: spend vs budget pace chart, spend by category, "Running out soon" (Butler's estimates), "By product" (switch between Product types and Brands; tap one for usage, average price, cheapest brand), and price changes.
- List tab: shopping list with an estimated total. The amber "AUTO-GENERATE" card builds the list from low stock. Tick items as they go in the cart. "Add to list" adds anything. Buying an item (receipt or manual) ticks it off automatically — even a different brand of the same product type.
- Butler tab (this chat): ask anything about spending, stock, prices, or how to use the app. Butler can also make changes when asked (add to the list, log purchases, set counts, add stock, set the budget, open a screen). Every change shows an Undo button. The mic button dictates.
- Voice notes: tap the amber mic in the Butler chat, speak, then tap send (or × to cancel). Butler reads the transcript and replies. Up to 2 minutes.
- Attachments: the paperclip in the Butler chat sends photos (receipts, shelves, fridge, products), short videos, audio clips or PDFs. Butler looks at photos and video frames and reads what's said in audio/video. Send a receipt photo and Butler can log it for you.
- Chat history: the clock icon at the top of the Butler tab lists past conversations (private to each person) — tap one to reopen it, or the trash icon to delete it. The pen icon starts a new chat.
- Butler's memory: Butler remembers lasting things you tell it (diet, favourite or avoided brands, shopping habits, who's at home). The bookmark icon on the Butler tab (or "What Butler remembers" in History) shows everything it remembers; each memory is either "Household" (shared with everyone in the household) or "Only you". You can add or delete memories there, or just tell Butler "forget that".
- Menu (⋮ / avatar, top right): Household profile, Household & sharing, Budgets, My stores, Dietary preferences, Export backup, Import backup, Clear data…, Change password, Sign out. The menu also shows sync status.
- Household & sharing: "Create invite code" makes a 6-letter code (works once, 7 days). The other person needs an account, signs in, opens Menu → Household & sharing, enters the code and taps Join. Everyone in a household sees the same stock, spending and list. Owners can remove people; members can leave and go back to their own household.
- How Butler learns: every item has a product type (e.g. "Water") and a brand (e.g. "Voltic"). Usage is tracked per type, so buying any brand restocks that type. After a type has been bought on two different days, Butler estimates how fast the household uses it, counts stock down over time (shown with ≈), predicts when it runs out and flags it as running low. Correcting a count (− / +, "That's right", or the status buttons) teaches Butler — the estimate adjusts.
- Sync: data is saved to the account and works offline; changes upload when back online. Pull down from the top of any screen to sync now. A "new version" bar appears when the app updates — tap Refresh. Updates never erase data.
- Install on iPhone: open in Safari → Share → Add to Home Screen.
- Privacy: each household's data is only visible to its members.`

// Snapshot of the household for the system prompt
export function householdContext({ profile, transactions, inventory, shoppingList, model, name }) {
  const mk = monthKey(today())
  const monthTx = txInMonth(transactions, mk)
  const spent = sum(monthTx, lineTotal)
  const prevSpent = sum(txInMonth(transactions, shiftMonth(mk, -1)), lineTotal)
  const budget = monthlyBudget(profile)
  const cats = {}
  monthTx.forEach((t) => { const c = t.category || 'Other'; cats[c] = (cats[c] || 0) + lineTotal(t) })
  const types = Object.values(model || {}).sort((a, b) => b.spend - a.spend).slice(0, 40).map((T) => {
    const parts = [`${T.type}:`]
    if (T.items.length) parts.push(`stock ${T.learned ? '≈' : ''}${Math.round(T.estimate)}${T.learned && Math.abs(T.estimate - T.recorded) >= 0.5 ? ` (recorded ${T.recorded})` : ''}, ${STOCK[T.status]?.label || ''}`)
    if (T.learned) parts.push(`uses ${everyLabel(T.rate)}, runs out in ${T.estimate < 0.5 ? 'now' : daysLeftLabel(T.daysLeft)}`)
    else parts.push('usage not learned yet')
    if (T.avgPrice) parts.push(`avg GHS ${money(T.avgPrice)}`)
    if (T.brandList.length) parts.push(`brands: ${T.brandList.slice(0, 4).map((b) => `${b.brand} ×${b.units} @${money(b.avgPrice)}`).join(', ')}`)
    return parts.join(' ')
  }).join('\n')
  const items = inventory.slice(0, 60).map((i) => `${i.name} [${typeOf(i)}${brandOf(i) ? `, ${brandOf(i)}` : ''}] qty ${Math.round(i._est ?? i.qty)} ${STOCK[stockOf(i)].label}${i.lastPrice ? `, last GHS ${money(i.lastPrice)}` : ''}`).join('\n')
  const recent = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 25)
    .map((t) => `${t.date} | ${t.item} | ${typeOf(t)} | GHS ${money(t.price)} x${t.qty} | ${t.store || '-'}`).join('\n')
  return `Today: ${today()}. Currency: Ghana cedis — write amounts as "GHS 12.50".
Talking to: ${name || 'the user'}. Household: ${profile?.householdType || 'household'} (${profile?.adults || 1} adults, ${profile?.kids || 0} kids). Monthly budget: ${budget ? `GHS ${money(budget)}` : 'not set'}. Shops: ${(profile?.stores || []).join(', ') || 'unknown'}. Diet: ${profile?.dietaryPrefs || 'none given'}.
This month: GHS ${money(spent)} over ${monthTx.length} purchases${budget ? ` (${Math.round((spent / budget) * 100)}% of budget)` : ''}. Last month: GHS ${money(prevSpent)}.
By category this month: ${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c} GHS ${money(v)}`).join(', ') || 'none'}.

PRODUCT TYPES (Butler's learned model):
${types || 'none yet'}

STOCK ITEMS:
${items || 'none'}

SHOPPING LIST: ${shoppingList.map((s) => `${s.name} ×${s.qty}${s.checked ? ' (in cart)' : ''}`).join(', ') || 'empty'}

RECENT PURCHASES:
${recent || 'none'}`
}

const memoryBlock = (memories = [], meId) => {
  if (!memories.length) return 'Nothing yet.'
  return memories.slice(-80).map((m) => `[${m.id}] (${m.scope === 'personal' ? 'only this person' : 'household'}${m.scope === 'household' && m.user_id && meId && m.user_id !== meId ? ', added by another member' : ''}) ${m.fact}`).join('\n')
}

export function systemPrompt(ctx) {
  return `You are Plantain Butler, a warm, practical household assistant inside the Plantain Butler app, for a home in Ghana. You help with spending, stock, shopping and using the app.

${APP_GUIDE}

HOUSEHOLD DATA:
${householdContext(ctx)}

WHAT YOU REMEMBER (from earlier conversations — use naturally, don't recite):
${memoryBlock(ctx.memories, ctx.userId)}

RECENT CONVERSATIONS: ${(ctx.recentChats || []).slice(0, 6).map((c) => `"${c.title}" (${String(c.updated_at).slice(0, 10)})`).join(', ') || 'none'}

HOW TO RESPOND:
- Be brief: 1–4 short sentences, or a short list. No markdown headings. Use **bold** sparingly.
- Use the tools whenever the user asks you to change something (add to list, log a purchase, update a count, add stock, set budget, open a screen). Don't claim you did something without calling the tool. After tools run, confirm in one short sentence — the app shows an Undo button.
- If a request is ambiguous (e.g. which item, what price), ask one quick question instead of guessing. Prices are optional when logging; use the last known price if the user doesn't give one.
- For "how do I…" questions, give the exact steps using the button names above. Offer to do it for them when a tool can.
- Base answers on the data above; if something isn't there, say so. Never invent purchases or prices.
- MEMORY: when the user tells you something lasting about their household or themselves — diet or allergies they mention, brands they like or avoid, pack sizes they buy, when/where they shop, who lives there, goals like "spend less on drinks", how they like answers — call remember right away, in one short third-person sentence (e.g. "Prefers Voltic water in packs of 12"). Use scope "household" for facts about the home that everyone shares; "personal" for things about just this person or anything they'd likely keep private. Don't remember one-off requests, things already in the data above, or anything already remembered. If a remembered fact changes, forget the old id and remember the new one. If asked to forget something, call forget.
- If the user refers to an earlier conversation ("what did we say about…"), use recall_conversations.
- ATTACHMENTS: you can see photos and still frames from videos; audio arrives as a transcript. Describe what matters for the household (items, brands, sizes, prices, what's running low). If a photo is a receipt, read every line (item, qty, unit price, store, date) and offer to log it — or log it straight away if they asked — with log_purchase. If it's a shelf, fridge or pantry, offer to update stock counts. Messages starting "(Voice note)" were spoken: transcription can mishear local words, so read generously and ask if unsure.`
}

/* ---------- tools ---------- */
const itemsArray = (props, required) => ({ type: 'array', items: { type: 'object', properties: props, required } })
export const TOOLS = [
  {
    name: 'add_to_shopping_list',
    description: 'Add items to the shopping list.',
    input_schema: { type: 'object', properties: { items: itemsArray({ name: { type: 'string' }, qty: { type: 'number' } }, ['name']) }, required: ['items'] },
  },
  {
    name: 'remove_from_shopping_list',
    description: 'Remove items from the shopping list by name.',
    input_schema: { type: 'object', properties: { names: { type: 'array', items: { type: 'string' } } }, required: ['names'] },
  },
  {
    name: 'log_purchase',
    description: 'Record a purchase (things the household bought). Adds to spending and restocks inventory.',
    input_schema: {
      type: 'object',
      properties: {
        store: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD, default today' },
        items: itemsArray({
          name: { type: 'string' }, qty: { type: 'number' }, unit_price: { type: 'number', description: 'GHS per unit; omit if unknown' },
          brand: { type: 'string' }, type: { type: 'string', description: 'generic product type e.g. Water' },
          category: { type: 'string', enum: CATEGORIES },
        }, ['name']),
      },
      required: ['items'],
    },
  },
  {
    name: 'set_stock_count',
    description: 'Set how many of an item are at home right now (a stock count). Also teaches Butler how fast the household uses it.',
    input_schema: { type: 'object', properties: { items: itemsArray({ name: { type: 'string' }, count: { type: 'number' } }, ['name', 'count']) }, required: ['items'] },
  },
  {
    name: 'add_stock_items',
    description: 'Add things the household already has at home (not a purchase, no spending).',
    input_schema: {
      type: 'object',
      properties: { items: itemsArray({ name: { type: 'string' }, qty: { type: 'number' }, brand: { type: 'string' }, type: { type: 'string' }, category: { type: 'string', enum: CATEGORIES } }, ['name']) },
      required: ['items'],
    },
  },
  {
    name: 'set_monthly_budget',
    description: 'Set the monthly grocery budget in GHS.',
    input_schema: { type: 'object', properties: { amount: { type: 'number' } }, required: ['amount'] },
  },
  {
    name: 'open_screen',
    description: 'Take the user to a screen in the app.',
    input_schema: { type: 'object', properties: { screen: { type: 'string', enum: ['home', 'stock', 'spend', 'insights', 'list', 'scan_receipt', 'add_items', 'household_sharing', 'budgets'] } }, required: ['screen'] },
  },
  {
    name: 'remember',
    description: 'Save a lasting fact or preference to Butler\'s memory so future conversations can use it.',
    input_schema: { type: 'object', properties: { fact: { type: 'string', description: 'one short third-person sentence' }, scope: { type: 'string', enum: ['household', 'personal'] } }, required: ['fact', 'scope'] },
  },
  {
    name: 'forget',
    description: 'Delete a memory by its id (shown in square brackets in WHAT YOU REMEMBER).',
    input_schema: { type: 'object', properties: { memory_id: { type: 'string' } }, required: ['memory_id'] },
  },
  {
    name: 'recall_conversations',
    description: 'Search this person\'s past Butler conversations for what was said before. Empty query returns recent messages.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'find_purchases',
    description: 'Search all past purchases by item name, brand, product type or store. Returns up to 40 matches (newest first). Use for questions the summary above can\'t answer.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
]

const norm = (s) => String(s || '').toLowerCase().trim()
const findInv = (inventory, name) => {
  const n = norm(name)
  return inventory.find((i) => norm(i.name) === n)
    || inventory.find((i) => norm(i.name).includes(n) || n.includes(norm(i.name)))
    || inventory.find((i) => norm(typeOf(i)) === n)
}

// Runs a tool against the app. `app()` returns the latest props each time (state changes between tools).
// Returns { result: string for the model, summary?: string for the user, mutated?: boolean }
export async function runTool(name, input, app) {
  const a = app()
  switch (name) {
    case 'add_to_shopping_list': {
      const items = (input.items || []).filter((x) => x?.name)
      a.addToShoppingList(items.map((x) => ({ name: x.name, qty: Number(x.qty) || 1 })))
      return { result: `Added ${items.length} item(s).`, summary: `Added ${items.map((x) => `${x.name}${Number(x.qty) > 1 ? ` ×${Number(x.qty)}` : ''}`).join(', ')} to your list`, mutated: true }
    }
    case 'remove_from_shopping_list': {
      const names = new Set((input.names || []).map(norm))
      const keep = a.shoppingList.filter((s) => !names.has(norm(s.name)))
      const removed = a.shoppingList.length - keep.length
      if (!removed) return { result: 'None of those were on the list.' }
      a.saveSL(keep)
      return { result: `Removed ${removed}.`, summary: `Removed ${removed} item${removed === 1 ? '' : 's'} from your list`, mutated: true }
    }
    case 'log_purchase': {
      const items = (input.items || []).filter((x) => x?.name).map((x) => {
        const known = findInv(a.inventory, x.name)
        return {
          item: known && norm(known.name) === norm(x.name) ? known.name : x.name,
          qty: Number(x.qty) || 1,
          price: x.unit_price !== undefined && x.unit_price !== null ? Number(x.unit_price) || 0 : Number(known?.lastPrice) || 0,
          brand: x.brand || '', productType: x.type || '',
          category: CATEGORIES.includes(x.category) ? x.category : known?.category || 'Other',
        }
      })
      if (!items.length) return { result: 'No items given.' }
      const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ? input.date : today()
      a.addTransaction(items, input.store || a.profile?.stores?.[0] || '', date)
      a.markProgress?.('logged')
      const total = items.reduce((s, x) => s + x.price * x.qty, 0)
      return { result: `Logged ${items.length} item(s), total GHS ${money(total)}.`, summary: `Logged ${items.map((x) => `${x.item} ×${x.qty}`).join(', ')} · GHS ${money(total)}`, mutated: true }
    }
    case 'set_stock_count': {
      const done = [], missing = []
      for (const x of input.items || []) {
        const cur = app().inventory
        const item = findInv(cur, x.name)
        if (!item) { missing.push(x.name); continue }
        const m = item._model
        const base = m ? { key: m.key, anchor: m.anchor, baseRate: m.baseRate, recorded: m.recorded, itemEst: { ...m.itemEst } } : null
        app().recordCount(item.id, Math.max(0, Number(x.count) || 0), base)
        done.push(`${item.name} → ${Number(x.count) || 0}`)
        await new Promise((r) => setTimeout(r, 60))
      }
      return {
        result: `${done.length ? `Updated: ${done.join('; ')}.` : ''}${missing.length ? ` Not in stock list: ${missing.join(', ')} (use add_stock_items).` : ''}`,
        summary: done.length ? `Updated stock: ${done.join(', ')}` : undefined, mutated: !!done.length,
      }
    }
    case 'add_stock_items': {
      const items = (input.items || []).filter((x) => x?.name)
      const inv = [...a.inventory]
      items.forEach((x) => {
        const hit = inv.find((i) => norm(i.name) === norm(x.name))
        const qty = Number(x.qty) || 1
        if (hit) inv[inv.indexOf(hit)] = { ...hit, qty, fullQty: Math.max(Number(hit.fullQty) || 0, qty), status: 'high' }
        else {
          inv.push({
            id: uid(), name: x.name, qty, fullQty: qty, status: 'high', category: CATEGORIES.includes(x.category) ? x.category : 'Other',
            brand: x.brand || guessBrand(x.name), productType: x.type || ruleType(x.name),
          })
        }
      })
      a.saveInv(inv)
      return { result: `Added ${items.length} item(s) to stock.`, summary: `Added to stock: ${items.map((x) => `${x.name} ×${Number(x.qty) || 1}`).join(', ')}`, mutated: true }
    }
    case 'set_monthly_budget': {
      const amount = Math.max(0, Number(input.amount) || 0)
      a.saveProfile({ ...a.profile, monthlyBudget: amount })
      return { result: `Budget set to GHS ${money(amount)}.`, summary: `Monthly budget set to GHS ${money(amount, 0)}`, mutated: true }
    }
    case 'open_screen': {
      const s = input.screen
      const pages = { home: 'dashboard', stock: 'inventory', spend: 'transactions', insights: 'analytics', list: 'shopping' }
      const sheets = { scan_receipt: 'receipt', add_items: 'manual', household_sharing: 'household', budgets: 'budgets' }
      if (pages[s]) a.setPage(pages[s])
      else if (sheets[s]) a.openSheet(sheets[s])
      else return { result: 'Unknown screen.' }
      return { result: `Opened ${s}.`, navigated: true }
    }
    case 'remember': {
      const m = await a.butler.addMemory(input.fact, input.scope, a.chatId)
      return { result: `Saved (id ${m.id}).`, memory: m }
    }
    case 'forget': {
      const m = (a.butler.memories || []).find((x) => x.id === input.memory_id)
      if (!m) return { result: 'No memory with that id.' }
      await a.butler.removeMemory(m.id)
      return { result: 'Forgotten.', summary: `Forgot: ${m.fact}` }
    }
    case 'recall_conversations': {
      const hits = await a.butler.searchChats(input.query)
      return { result: hits.length ? hits.map((h) => `${h.date} "${h.title}" — ${h.who}: ${h.text}`).join('\n') : 'Nothing found in past conversations.' }
    }
    case 'find_purchases': {
      const q = norm(input.query)
      const hits = a.transactions.filter((t) => [t.item, t.store, brandOf(t), typeOf(t), t.category].some((v) => norm(v).includes(q)))
        .sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 40)
      return { result: hits.length ? hits.map((t) => `${t.date} | ${t.item} | ${brandOf(t) || '-'} | ${typeOf(t)} | GHS ${money(t.price)} x${t.qty} | ${t.store || '-'}`).join('\n') : 'No matching purchases.' }
    }
    default:
      return { result: 'Unknown tool.' }
  }
}

export { typeKey }
