// A6 · Butler (Figma 23:6307)
import { useEffect, useMemo, useRef, useState } from 'react'
import { C, TX, sans, mono } from '../lib/theme'
import { today, monthKey } from '../lib/utils'
import { lineTotal, sum, money, monthlyBudget, greeting, txInMonth } from '../lib/derive'
import { Header, Barcode, Icon, reset } from './ui'
import { callButler, textOf } from '../lib/ai'
import { chatTitle, CHAT_CACHE } from '../lib/butlerData'
import { prepareFile, startRecorder, transcribe, voiceNotesAvailable, fmtDuration, kindOf, MAX_VOICE_SECONDS } from '../lib/media'
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

function FileThumb({ f, size = 64 }) {
  if (f.thumb) {
    return (
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, background: `center/cover url(${f.thumb})` }}>
        {f.kind === 'video' && (
          <span style={{ position: 'absolute', left: 4, bottom: 4, background: 'rgba(18,38,35,.8)', padding: '2px 4px', ...mono(9, 500, { color: C.cream }) }}>▶ {fmtDuration(f.duration)}</span>
        )}
      </div>
    )
  }
  return (
    <div style={{ height: size, minWidth: size, padding: '0 10px', flexShrink: 0, background: C.teal, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
      <span style={mono(9, 500, { color: C.amber, letterSpacing: 0.54 })}>{f.kind === 'audio' ? `AUDIO · ${fmtDuration(f.duration)}` : f.kind.toUpperCase()}</span>
      <span style={{ ...sans(11, 400, { color: C.blush }), maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
    </div>
  )
}

function UserBubble({ m }) {
  return (
    <div className="pb-msg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0, transformOrigin: 'right bottom' }}>
      {m.files?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 280 }}>
          {m.files.map((f, i) => <FileThumb key={i} f={f} />)}
        </div>
      )}
      {(m.text || m.voice) && (
        <div style={{ background: C.ink, padding: '12px 16px', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {m.voice && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, ...mono(9, 500, { color: C.amber, letterSpacing: 0.54 }) }}>
              <Icon name="mic@18" color={C.amber} /> VOICE NOTE · {fmtDuration(m.voice.duration)}
            </span>
          )}
          {m.text && <p style={sans(14, 400, { color: C.cream, lineHeight: '20px', fontStyle: m.voice ? 'italic' : 'normal' })}>{m.voice ? `“${m.text}”` : m.text}</p>}
        </div>
      )}
    </div>
  )
}

// Recording bar: live level, timer, cancel / send
function Recorder({ level, seconds, onCancel, onSend }) {
  const bars = 28
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52, padding: '0 8px 0 12px', background: C.ink }}>
      <button type="button" aria-label="Cancel voice note" onClick={onCancel} style={{ ...reset, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="x@16" color={C.cream} />
      </button>
      <span className="pb-rec-dot" style={{ width: 8, height: 8, borderRadius: 4, background: C.ember, flexShrink: 0 }} />
      <span style={mono(12, 500, { color: C.cream, width: 36 })}>{fmtDuration(seconds)}</span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 2, height: 28, overflow: 'hidden' }}>
        {Array.from({ length: bars }, (_, i) => {
          const wave = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + seconds * 3))
          return <span key={i} style={{ width: 3, flexShrink: 0, height: `${Math.max(12, level * wave * 100)}%`, background: C.amber, opacity: 0.85, transition: 'height .08s linear' }} />
        })}
      </div>
      <button type="button" aria-label="Send voice note" onClick={onSend}
        style={{ ...reset, width: 40, height: 40, background: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="send@16" color={C.ink} />
      </button>
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
  const [files, setFiles] = useState([])           // attachments waiting to be sent
  const [rec, setRec] = useState(null)             // { recorder, seconds, level } while recording
  const [voiceOk, setVoiceOk] = useState(null)     // is transcription switched on?
  const fileRef = useRef(null)
  useEffect(() => { voiceNotesAvailable().then(setVoiceOk) }, [])
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
  const isUserTurn = (m) => m.role === 'user' && (typeof m.content === 'string' || !m.content.some((b) => b.type === 'tool_result'))
  const trimmed = (msgs) => {
    let start = Math.max(0, msgs.length - 24)
    while (start < msgs.length && !isUserTurn(msgs[start])) start++
    return msgs.slice(start)
  }
  // Photos/PDFs are only sent with the message they belong to; afterwards a short note stands in,
  // so later requests (and saved chats) stay small.
  const lighten = (msgs, keepLast = true) => {
    const lastUser = keepLast ? msgs.map(isUserTurn).lastIndexOf(true) : -1
    return msgs.map((m, i) => (i === lastUser || !Array.isArray(m.content) ? m : {
      ...m, content: m.content.map((b) => (b.type === 'image' ? { type: 'text', text: '[photo shared earlier]' } : b.type === 'document' ? { type: 'text', text: '[PDF shared earlier]' } : b)),
    }))
  }

  const send = async (text, extra = {}) => {
    const trimmedText = String(text || '').trim()
    const atts = extra.files || []
    if ((!trimmedText && !atts.length) || loading) return
    markProgress?.('askedButler')
    push({ kind: 'user', text: trimmedText, ...(extra.voice ? { voice: extra.voice } : {}), ...(atts.length ? { files: atts.map(({ kind, name, thumb, duration }) => ({ kind, name, thumb, duration })) } : {}) })
    setInput('')
    setFiles([])
    setLoading(true)
    const words = extra.voice ? `(Voice note) ${trimmedText}` : trimmedText || (atts.length ? 'What can you tell me from this?' : '')
    const content = atts.length ? [...atts.flatMap((f) => f.blocks), { type: 'text', text: words }] : words
    let msgs = [...api, { role: 'user', content }]
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
          messages: trimmed(lighten(msgs)),
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
      msgs = lighten(msgs, false)
      setApi(msgs)
      setLoading(false)
      // Save the conversation to the account (private to this person)
      try {
        const first = feedRef.current.find((x) => x.kind === 'user')
        const id = await butler.saveChat({ id: chatRef.current, title: chatTitle(first?.text || trimmedText || (atts[0] ? `${atts[0].kind[0].toUpperCase()}${atts[0].kind.slice(1)}: ${atts[0].name}` : '')), messages: msgs, feed: feedRef.current })
        if (id && id !== chatRef.current) { chatRef.current = id; setChatId(id) }
        refreshChats?.()
      } catch { /* saved locally; will retry with the next message */ }
    }
  }

  const forgetMemory = async (m) => {
    try { await butler.removeMemory(m.memoryId); setFeed((f) => f.map((x) => (x.id === m.id ? { ...x, forgotten: true } : x))) } catch { /* offline */ }
  }
  const newChat = () => { if (!loading) setChatId(null) }

  /* ----- attachments ----- */
  const pickFiles = (e) => {
    const list = [...(e.target.files || [])].slice(0, 6)
    e.target.value = ''
    list.forEach((file) => {
      const id = Math.random().toString(36).slice(2)
      setFiles((f) => [...f, { id, kind: kindOf(file) || 'file', name: file.name, status: 'working' }])
      prepareFile(file)
        .then((ready) => setFiles((f) => f.map((x) => (x.id === id ? { ...ready, id, status: 'ready' } : x))))
        .catch((err) => setFiles((f) => f.map((x) => (x.id === id ? { ...x, status: 'error', error: err.message } : x))))
    })
  }
  const working = files.some((f) => f.status === 'working')
  const ready = files.filter((f) => f.status === 'ready')
  const submit = () => {
    if (working || loading) return
    const bytes = ready.reduce((s, f) => s + f.blocks.reduce((t, b) => t + (b.source?.data?.length || 0), 0), 0)
    if (bytes > 3_400_000) { push({ kind: 'error', text: 'That’s too much to send in one go — try fewer photos or a shorter video.' }); return }
    send(input, { files: ready })
  }

  /* ----- voice notes ----- */
  const levelRef = useRef(0)
  const startVoice = async () => {
    if (rec || loading) return
    if (voiceOk === false) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SR) return listen()
      push({ kind: 'error', text: 'Voice notes aren’t switched on yet — a transcription key needs adding to the app’s settings. You can use the microphone on your keyboard to dictate meanwhile.' })
      return
    }
    try {
      const recorder = await startRecorder((l) => { levelRef.current = l })
      setRec({ recorder, seconds: 0, level: 0 })
    } catch {
      push({ kind: 'error', text: 'I couldn’t use the microphone. Allow microphone access for this app in Settings, then try again.' })
    }
  }
  useEffect(() => {
    if (!rec) return
    const t = setInterval(() => {
      const seconds = (Date.now() - rec.recorder.started) / 1000
      setRec((r) => (r ? { ...r, seconds, level: levelRef.current } : r))
      if (seconds >= MAX_VOICE_SECONDS) sendVoice()
    }, 100)
    return () => clearInterval(t)
  }, [rec?.recorder]) // eslint-disable-line react-hooks/exhaustive-deps
  const cancelVoice = () => { rec?.recorder.cancel(); setRec(null) }
  const [transcribing, setTranscribing] = useState(false)
  const sendVoice = async () => {
    const r = rec
    if (!r) return
    setRec(null)
    setTranscribing(true)
    try {
      const blob = await r.recorder.stop()
      const { text, duration } = await transcribe(blob)
      if (!text) push({ kind: 'error', text: 'I didn’t catch anything in that voice note — try again a little closer to the mic.' })
      else { setTranscribing(false); await send(text, { voice: { duration } }); return }
    } catch (e) {
      push({ kind: 'error', text: e?.message || 'Couldn’t transcribe that voice note. Try again.' })
    }
    setTranscribing(false)
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
          if (m.kind === 'user') return <UserBubble key={m.id} m={m} />
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
        {files.length > 0 && (
          <div className="pb-noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 4 }}>
            {files.map((f) => (
              <div key={f.id} className="pb-msg" style={{ position: 'relative', flexShrink: 0, outline: f.status === 'error' ? `2px solid ${C.ember}` : 'none' }} title={f.error || f.name}>
                <FileThumb f={f.status === 'ready' ? f : { ...f, thumb: null }} size={56} />
                {f.status === 'working' && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(18,38,35,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="pb-spinner" />
                  </div>
                )}
                <button aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))}
                  style={{ ...reset, position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={mono(11, 500, { color: C.cream, lineHeight: '11px' })}>×</span>
                </button>
              </div>
            ))}
          </div>
        )}
        {files.some((f) => f.status === 'error') && (
          <span style={sans(12, 400, { color: C.ember })}>{files.find((f) => f.status === 'error').error}</span>
        )}
        {rec ? (
          <Recorder level={rec.level} seconds={rec.seconds} onCancel={cancelVoice} onSend={sendVoice} />
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); submit() }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 8px 0 6px', background: C.composer }}>
            <button type="button" aria-label="Attach photo, video, audio or PDF" onClick={() => fileRef.current?.click()}
              style={{ ...reset, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="clip@18" />
            </button>
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={transcribing ? 'Transcribing your voice note…' : files.length ? 'Add a message (optional)…' : 'Ask anything…'} aria-label="Message Butler"
              style={{ ...sans(14, 400, { color: C.ink }), flex: 1, minWidth: 0, height: '100%' }} />
            {input.trim() || files.length ? (
              <button type="submit" aria-label="Send" disabled={loading || working}
                style={{ ...reset, width: 40, height: 40, background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {working ? <span className="pb-spinner" /> : <Icon name="send@16" color={C.amber} />}
              </button>
            ) : (
              <button type="button" aria-label="Record a voice note" onClick={startVoice} disabled={loading || transcribing}
                style={{ ...reset, width: 40, height: 40, background: transcribing ? C.ink : C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: listening ? 0.6 : 1 }}>
                {transcribing ? <span className="pb-spinner" /> : <Icon name="mic@18" />}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*,video/*,audio/*,application/pdf" multiple onChange={pickFiles} style={{ display: 'none' }} />
          </form>
        )}
      </div>
    </div>
  )
}
