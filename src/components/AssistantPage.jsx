// A6 · Butler (Figma 23:6307)
import { useEffect, useMemo, useRef, useState } from 'react'
import { C, TX, sans, mono } from '../lib/theme'
import { today, monthKey } from '../lib/utils'
import { lineTotal, sum, money, monthlyBudget, greeting, txInMonth } from '../lib/derive'
import { Header, Barcode, Icon, reset } from './ui'
import { callButler, textOf } from '../lib/ai'
import { chatTitle, CHAT_CACHE } from '../lib/butlerData'
import { systemPrompt, TOOLS, runTool } from '../lib/butler'
import { typeOf, typeKey, daysLeftLabel } from '../lib/learn'

const CHIPS = ['What can you do?', 'What’s running low?', 'This month vs last', 'How do I share with my family?']

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
    <div className="pb-msg" style={{ transformOrigin: 'left bottom', background: C.teal, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, width: 'min(300px, 100%)', flexShrink: 0 }}>
      {label && <span style={{ ...TX.label, color: C.blush80 }}>PLANTAIN BUTLER</span>}
      {children}
    </div>
  )
}

function UserBubble({ text }) {
  return (
    <div className="pb-msg" style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0, transformOrigin: 'right bottom' }}>
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

export default function AssistantPage(props) {
  const { header, transactions, inventory, profile, shoppingList, addToShoppingList, lowStock, account, model, markProgress, butler, chatId, setChatId, openSheet, refreshChats } = props
  // The open conversation: shown instantly from this phone's cache, then from the account
  const cached = (() => { try { const v = JSON.parse(localStorage.getItem(CHAT_CACHE)); return v && v.id === chatId ? v : null } catch { return null } })()
  const [feed, setFeedState] = useState(cached?.feed || []) // what's shown: user / butler / action / memory / error
  const [api, setApi] = useState(cached?.messages || [])    // what Butler sees, incl. tool calls
  const feedRef = useRef(feed)
  const setFeed = (f) => setFeedState((prev) => { const next = typeof f === 'function' ? f(prev) : f; feedRef.current = next; return next })
  const chatRef = useRef(chatId) // id of the conversation currently on screen
  const [loadingChat, setLoadingChat] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState('open') // open | added | dismissed
  const [listening, setListening] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const latest = useRef(props)
  latest.current = props
  const undos = useRef({})

  // Switching conversation (from History, or New chat)
  useEffect(() => {
    if (chatId === chatRef.current) return
    chatRef.current = chatId
    undos.current = {}
    if (!chatId) { setFeed([]); setApi([]); return }
    let live = true
    setLoadingChat(true)
    butler.loadChat(chatId).then((c) => {
      if (!live || chatRef.current !== chatId) return
      setFeed(c?.feed || []); setApi(c?.messages || [])
    }).catch(() => { if (live) setFeed([{ id: 'x', kind: 'error', text: 'Couldn’t open that conversation. Check your connection.' }]) })
      .finally(() => live && setLoadingChat(false))
    return () => { live = false }
  }, [chatId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [feed, loading, suggestion])

  const mk = monthKey(today())
  const monthTx = txInMonth(transactions, mk)
  const spent = sum(monthTx, lineTotal)
  const budget = monthlyBudget(profile)
  const firstName = String(account?.name || profile?.name || '').trim().split(/\s+/)[0]

  const cats = useMemo(() => {
    const m = {}
    monthTx.forEach((t) => { const c = t.category || 'Other'; m[c] = (m[c] || 0) + lineTotal(t) })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [monthTx])
  const [top1, top2] = cats

  const introText = `${greeting()}${firstName ? `, ${firstName}` : ''}. You've spent GHS ${money(spent)} this month${budget ? ` — ${((spent / budget) * 100).toFixed(1)}% of budget` : ''}.${top1 ? ` ${top1[0]} lead${top1[0].endsWith('s') ? '' : 's'}.` : ' Nothing logged yet.'} Ask me anything, or tell me what to add.`

  // Proactive nudge from the learning model: the most urgent type that isn't on the list yet
  const listTypes = new Set(shoppingList.filter((s) => !s.checked).map((s) => typeKey(typeOf({ name: s.name, productType: s.productType }))))
  const lowItem = (lowStock || []).filter((i) => !listTypes.has(typeKey(typeOf(i))))
    .sort((a, b) => (a._model?.daysLeft ?? 99) - (b._model?.daysLeft ?? 99))[0]
  const T = lowItem?._model
  const suggestionText = lowItem && (T?.learned
    ? (T.estimate < 0.5 ? `I think you’re out of ${T.type.toLowerCase()} by now.` : `${T.type} will likely run out in ${daysLeftLabel(T.daysLeft)} (≈${Math.round(T.estimate)} left).`) + ` Add ${lowItem.name} to your list?`
    : `${lowItem.name} is running low — want me to add it to your list?`)

  const push = (item) => setFeed((f) => [...f, { id: Math.random().toString(36).slice(2), ...item }])

  const snapshot = () => {
    const p = latest.current
    const strip = (list) => list.map((i) => Object.fromEntries(Object.entries(i).filter(([k]) => !k.startsWith('_'))))
    return { inventory: strip(p.inventory), transactions: p.transactions, shoppingList: p.shoppingList, profile: p.profile, learning: p.learning }
  }
  const undo = (undoId) => {
    const snap = undos.current[undoId]
    if (!snap) return
    const p = latest.current
    p.saveInv(snap.inventory); p.saveTx(snap.transactions); p.saveSL(snap.shoppingList); p.saveProfile(snap.profile); p.saveLearning?.(snap.learning)
    delete undos.current[undoId]
    setFeed((f) => f.map((x) => (x.undoId === undoId ? { ...x, undone: true } : x)))
    setApi((m) => [...m, { role: 'user', content: '(I tapped Undo — your last changes were reverted.)' }, { role: 'assistant', content: 'Okay, I’ve put things back as they were.' }])
  }

  // Keep history valid for the API: start on a plain user message, don't split tool call/result pairs
  const trimmed = (msgs) => {
    let start = Math.max(0, msgs.length - 24)
    while (start < msgs.length && !(msgs[start].role === 'user' && typeof msgs[start].content === 'string')) start++
    return msgs.slice(start)
  }

  const send = async (text) => {
    const trimmedText = text.trim()
    if (!trimmedText || loading) return
    markProgress?.('askedButler')
    push({ kind: 'user', text: trimmedText })
    setInput('')
    setLoading(true)
    let msgs = [...api, { role: 'user', content: trimmedText }]
    const undoId = Math.random().toString(36).slice(2)
    let changed = false
    try {
      for (let round = 0; round < 5; round++) {
        const p = latest.current
        const data = await callButler({
          max_tokens: 1200, tools: TOOLS,
          system: systemPrompt({
            profile: p.profile, transactions: p.transactions, inventory: p.inventory, shoppingList: p.shoppingList, model: p.model, name: p.account?.name,
            memories: p.butler?.memories, userId: p.butler?.userId, recentChats: p.recentChats,
          }),
          messages: trimmed(msgs),
        })
        const blocks = (data.content || []).filter((b) => b.type === 'text' || b.type === 'tool_use')
        msgs = [...msgs, { role: 'assistant', content: blocks.length ? blocks : [{ type: 'text', text: '…' }] }]
        const said = textOf(data)
        if (said) push({ kind: 'butler', text: said })
        const uses = blocks.filter((b) => b.type === 'tool_use')
        if (!uses.length) break
        const results = []
        for (const u of uses) {
          if (!changed && !['find_purchases', 'open_screen', 'remember', 'forget', 'recall_conversations'].includes(u.name)) { undos.current[undoId] = snapshot(); changed = true }
          let r
          try { r = await runTool(u.name, u.input || {}, () => ({ ...latest.current, chatId: chatRef.current })) } catch (e) { r = { result: `Failed: ${e.message}` } }
          if (r.mutated) await new Promise((res) => setTimeout(res, 80)) // let the app apply the change before the next step
          if (r.memory) push({ kind: 'memory', text: r.memory.fact, memoryId: r.memory.id, scope: r.memory.scope })
          else if (r.summary) push({ kind: 'action', text: r.summary, undoId: u.name === 'forget' ? null : undoId })
          results.push({ type: 'tool_result', tool_use_id: u.id, content: r.result || 'Done.' })
        }
        msgs = [...msgs, { role: 'user', content: results }]
        if (round === 4) push({ kind: 'butler', text: 'Done — tell me if you need anything else.' })
      }
    } catch (e) {
      push({ kind: 'error', text: e?.message || 'Something went wrong reaching Butler. Please try again.' })
      // Drop the unanswered tail so the next message starts clean
      while (msgs.length && msgs[msgs.length - 1].role === 'user') msgs = msgs.slice(0, -1)
    } finally {
      setApi(msgs)
      setLoading(false)
      // Save the conversation to the account (private to this person)
      try {
        const first = feedRef.current.find((x) => x.kind === 'user')
        const id = await butler.saveChat({ id: chatRef.current, title: chatTitle(first?.text || trimmedText), messages: msgs, feed: feedRef.current })
        if (id && id !== chatRef.current) { chatRef.current = id; setChatId(id) }
        refreshChats?.()
      } catch { /* saved locally; will retry with the next message */ }
    }
  }

  const forgetMemory = async (m) => {
    try { await butler.removeMemory(m.memoryId); setFeed((f) => f.map((x) => (x.id === m.id ? { ...x, forgotten: true } : x))) } catch { /* offline */ }
  }
  const newChat = () => { if (!loading) setChatId(null) }

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

      {/* Title 23:6329 + history / memory / new chat */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', ...sans(30, 400, { lineHeight: '34px', letterSpacing: -0.9 }), fontSize: 'clamp(22px, 7.2vw, 30px)' }}>
          <span style={{ color: C.ink55 }}>Ask your</span>
          <span style={{ color: C.ink, fontWeight: 500 }}>Butler</span>
        </div>
        {[['history@18', 'Chat history', () => openSheet('chats')], ['memory@18', 'What Butler remembers', () => openSheet('memories')], ['newchat@18', 'New chat', newChat]].map(([icon, label, fn]) => (
          <button key={label} aria-label={label} title={label} onClick={fn}
            style={{ ...reset, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.ink22}`, flexShrink: 0 }}>
            <Icon name={icon} />
          </button>
        ))}
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

        {feed.map((m) => {
          if (m.kind === 'user') return <UserBubble key={m.id} text={m.text} />
          if (m.kind === 'action') return (
            <div key={m.id} className="pb-msg" style={{ display: 'flex', alignItems: 'center', gap: 8, background: m.undone ? C.row : C.amber, padding: '10px 12px', width: 'min(300px, 100%)', flexShrink: 0 }}>
              <Icon name={m.undone ? 'refresh@16' : 'check@16'} />
              <span style={{ ...sans(13, 500, { color: C.ink, lineHeight: '18px', textDecoration: m.undone ? 'line-through' : 'none' }), flex: 1, minWidth: 0 }}>{m.text}</span>
              {!m.undone && undos.current[m.undoId] && feed.filter((x) => x.undoId === m.undoId).pop()?.id === m.id && (
                <button onClick={() => undo(m.undoId)} style={{ ...reset, ...sans(13, 500, { color: C.ink, textDecoration: 'underline', textUnderlineOffset: 3 }), flexShrink: 0 }}>Undo</button>
              )}
            </div>
          )
          if (m.kind === 'memory') return (
            <div key={m.id} className="pb-msg" style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${C.ink25}`, padding: '10px 12px', width: 'min(300px, 100%)', flexShrink: 0, opacity: m.forgotten ? 0.55 : 1 }}>
              <Icon name="memory@18" />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={mono(9, 400, { letterSpacing: 0.54, color: C.ink80 })}>{m.forgotten ? 'FORGOTTEN' : `REMEMBERED · ${m.scope === 'personal' ? 'ONLY YOU' : 'HOUSEHOLD'}`}</span>
                <span style={{ ...sans(13, 400, { color: C.ink, lineHeight: '18px', textDecoration: m.forgotten ? 'line-through' : 'none' }) }}>{m.text}</span>
              </div>
              {!m.forgotten && <button onClick={() => forgetMemory(m)} style={{ ...reset, ...sans(13, 500, { color: C.ink, textDecoration: 'underline', textUnderlineOffset: 3 }), flexShrink: 0 }}>Forget</button>}
            </div>
          )
          return <ButlerBubble key={m.id}><RichText text={m.text} color={m.kind === 'error' ? C.amber : C.blush} /></ButlerBubble>
        })}
        {loadingChat && <Typing />}
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
