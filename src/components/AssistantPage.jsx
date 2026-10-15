// A6 · Butler (Figma 23:6307)
import { useEffect, useMemo, useRef, useState } from 'react'
import { C, TX, sans, mono } from '../lib/theme'
import { today, monthKey } from '../lib/utils'
import { lineTotal, sum, money, monthlyBudget, greeting, isLow, txInMonth, shiftMonth, stockOf, STOCK } from '../lib/derive'
import { Header, Barcode, Icon, reset } from './ui'

const CHIPS = ['This month vs last', 'Optimise budget']
const STORE_KEY = 'pb-butler-chat'

// Minimal formatting for model replies: paragraphs, line breaks, **bold**
function RichText({ text, color }) {
  return String(text).split(/\n{2,}/).map((para, i) => (
    <p key={i} style={sans(14, 400, { lineHeight: '20px', color, marginTop: i ? 8 : 0 })}>
      {para.split('\n').map((line, j) => (
        <span key={j}>
          {j > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/g).map((seg, k) =>
            seg.startsWith('**') && seg.endsWith('**') ? <strong key={k} style={{ fontWeight: 500 }}>{seg.slice(2, -2)}</strong> : seg.replace(/^[-*]\s/, '· '))}
        </span>
      ))}
    </p>
  ))
}

function ButlerBubble({ children, label }) {
  return (
    <div style={{ background: C.teal, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, width: 'min(300px, 100%)', flexShrink: 0 }}>
      {label && <span style={{ ...TX.label, color: C.blush80 }}>PLANTAIN BUTLER</span>}
      {children}
    </div>
  )
}

function UserBubble({ text }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
      <div style={{ background: C.ink, padding: '12px 16px', maxWidth: 280 }}>
        <p style={sans(14, 400, { color: C.cream, lineHeight: '20px' })}>{text}</p>
      </div>
    </div>
  )
}

function Typing() {
  return (
    <ButlerBubble>
      <div style={{ display: 'flex', gap: 6, height: 20, alignItems: 'center' }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, background: C.blush, animation: `pb-blink 1.2s ${i * 0.16}s infinite` }} />)}
      </div>
    </ButlerBubble>
  )
}

export default function AssistantPage({ header, transactions, inventory, profile, shoppingList, addToShoppingList }) {
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(STORE_KEY)) || [] } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState('open') // open | added | dismissed
  const [listening, setListening] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-40))) } catch { /* ignore */ } }, [messages])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, loading, suggestion])

  const mk = monthKey(today())
  const monthTx = txInMonth(transactions, mk)
  const spent = sum(monthTx, lineTotal)
  const budget = monthlyBudget(profile)
  const firstName = String(profile?.name || '').trim().split(/\s+/)[0]

  const cats = useMemo(() => {
    const m = {}
    monthTx.forEach((t) => { const c = t.category || 'Other'; m[c] = (m[c] || 0) + lineTotal(t) })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [monthTx])
  const [top1, top2] = cats

  const introText = `${greeting()}${firstName ? `, ${firstName}` : ''}. You've spent GHS ${money(spent)} this month${budget ? ` — ${((spent / budget) * 100).toFixed(1)}% of budget` : ''}.${top1 ? ` ${top1[0]} lead${top1[0].endsWith('s') ? '' : 's'}.` : ' Nothing logged yet.'}`

  const onList = new Set(shoppingList.map((s) => String(s.name).toLowerCase().trim()))
  const lowItem = inventory.find((i) => isLow(i) && !onList.has(i.name.toLowerCase().trim()))
  const suggestionText = lowItem && (stockOf(lowItem) === 'low'
    ? `${lowItem.name} has run out — want me to add it to your list?`
    : `${inventory.some((i) => stockOf(i) === 'low') ? '' : 'Nothing critical yet. '}${lowItem.name} is down to medium — want me to add it to your list?`)

  const buildContext = () => {
    const prevMk = shiftMonth(mk, -1)
    const prevSpent = sum(txInMonth(transactions, prevMk), lineTotal)
    const inv = inventory.slice(0, 40).map((i) => `${i.name}: qty ${i.qty} (${STOCK[stockOf(i)].label})${i.lastPrice ? `, last GHS ${money(i.lastPrice)}` : ''}`).join('\n')
    const recent = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30)
      .map((t) => `${t.date} | ${t.item} | GHS ${money(t.price)} x${t.qty} | ${t.category} | ${t.store || '-'}`).join('\n')
    return `You are Plantain Butler, a warm, practical household finance assistant for a home in Ghana. Currency is Ghana cedis — write amounts as "GHS 12.50". Today is ${today()}.

Household: ${profile?.name || 'User'}; ${profile?.householdType || 'household'} (${profile?.adults || 1} adults, ${profile?.kids || 0} kids). Monthly budget: ${budget ? `GHS ${money(budget)}` : 'not set'}. Shops: ${(profile?.stores || []).join(', ') || 'unknown'}. Diet: ${profile?.dietaryPrefs || 'none given'}.

This month: GHS ${money(spent)} across ${monthTx.length} purchases. Last month: GHS ${money(prevSpent)}.
Category totals this month: ${cats.map(([c, v]) => `${c} GHS ${money(v)}`).join(', ') || 'none'}.

Inventory:
${inv || 'none'}

Shopping list: ${shoppingList.map((s) => `${s.name}${s.checked ? ' (in cart)' : ''}`).join(', ') || 'empty'}

Recent purchases:
${recent || 'none'}

Answer in 2–5 short sentences or a short list. No markdown headings.`
  }

  const send = async (text) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    const next = [...messages, { role: 'user', content: trimmed }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 1000, system: buildContext(), messages: next.slice(-20) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`)
      setMessages((m) => [...m, { role: 'assistant', content: data.content?.[0]?.text || 'Sorry, I could not work that out.' }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong reaching Butler. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const listen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { inputRef.current?.focus(); return }
    const rec = new SR()
    rec.lang = 'en-GB'
    rec.interimResults = false
    rec.onresult = (e) => setInput((v) => `${v ? `${v} ` : ''}${e.results[0][0].transcript}`)
    rec.onend = () => setListening(false)
    setListening(true)
    rec.start()
  }

  const share = top1 && top2 ? top1[1] / (top1[1] + top2[1]) : top1 ? 1 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - env(safe-area-inset-top, 0px))' }}>
      <Header {...header} />

      {/* Title 23:6329 */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 20px', ...sans(30, 400, { lineHeight: '34px', letterSpacing: -0.9 }) }}>
        <span style={{ color: C.ink55 }}>Ask your</span>
        <span style={{ color: C.ink, fontWeight: 500 }}>Butler</span>
      </div>

      {/* Conversation 23:6332 */}
      <div ref={scrollRef} className="pb-noscroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px 8px' }}>
        <ButlerBubble label>
          <p style={sans(14, 400, { lineHeight: '20px', color: C.blush })}>{introText}</p>
          {top1 && (
            <>
              <Barcode bars={80} fraction={share} on={C.amber} off={C.blush35} height={20} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={mono(9, 400, { letterSpacing: 0.54, color: C.amber })}>{top1[0].toUpperCase()} {Math.round(top1[1])}</span>
                {top2 && <span style={mono(9, 400, { letterSpacing: 0.54, color: C.blush80 })}>{top2[0].toUpperCase()} {Math.round(top2[1])}</span>}
              </div>
            </>
          )}
        </ButlerBubble>

        {lowItem && suggestion !== 'dismissed' && (
          <ButlerBubble>
            <p style={sans(14, 400, { lineHeight: '20px', color: C.blush })}>
              {suggestion === 'added' ? `Done — ${lowItem.name} is on your list.` : suggestionText}
            </p>
            {suggestion === 'open' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { addToShoppingList([{ name: lowItem.name, qty: 1 }]); setSuggestion('added') }}
                  style={{ ...reset, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: C.amber }}>
                  <Icon name="plus@14" />
                  <span style={sans(13, 500, { color: C.ink })}>Add to list</span>
                </button>
                <button onClick={() => setSuggestion('dismissed')} style={{ ...reset, padding: '8px 16px', border: `1px solid ${C.blush35}` }}>
                  <span style={sans(13, 500, { color: C.blush })}>Not now</span>
                </button>
              </div>
            )}
          </ButlerBubble>
        )}

        {messages.map((m, i) => m.role === 'user'
          ? <UserBubble key={i} text={m.content} />
          : <ButlerBubble key={i}><RichText text={m.content} color={C.blush} /></ButlerBubble>)}
        {loading && <Typing />}
      </div>

      {/* Composer 23:6432 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 20px 104px' }}>
        <div className="pb-noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {CHIPS.map((c) => (
            <button key={c} onClick={() => send(c)} style={{ ...reset, padding: '8px 12px', border: `1px solid ${C.ink22}`, flexShrink: 0 }}>
              <span style={sans(12, 400, { color: C.ink75, whiteSpace: 'nowrap' })}>{c}</span>
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(input) }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52, padding: '0 8px 0 16px', background: C.composer }}>
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything…" aria-label="Message Butler"
            style={{ ...sans(14, 400, { color: C.ink }), flex: 1, minWidth: 0, height: '100%' }} />
          <button type="button" aria-label="Dictate" onClick={listen} style={{ ...reset, display: 'flex', opacity: listening ? 0.5 : 1 }}>
            <Icon name="mic@18" />
          </button>
          <button type="submit" aria-label="Send" disabled={loading}
            style={{ ...reset, width: 40, height: 40, background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="send@16" color={C.amber} />
          </button>
        </form>
      </div>
    </div>
  )
}
