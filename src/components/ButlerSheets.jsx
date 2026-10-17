// Butler's chat history and memory — built from the same parts as the other sheets.
import { useEffect, useState } from 'react'
import { C, TX, sans, mono } from '../lib/theme'
import { today } from '../lib/utils'
import { shortDate } from '../lib/derive'
import { Sheet, SheetHeader, Icon, Button, TextInput, Segmented, reset } from './ui'

const dayDiff = (iso) => Math.round((new Date(today()) - new Date(String(iso).slice(0, 10))) / 86400000)
const groupOf = (iso) => {
  const d = dayDiff(iso)
  if (d <= 0) return 'TODAY'
  if (d === 1) return 'YESTERDAY'
  if (d < 7) return 'THIS WEEK'
  if (d < 31) return 'THIS MONTH'
  return 'EARLIER'
}
const preview = (c) => {
  const last = [...(c.feed || [])].reverse().find((m) => m.kind === 'butler' || m.kind === 'user')
  return last ? String(last.text).replace(/\*\*/g, '').replace(/\s+/g, ' ').slice(0, 90) : ''
}

/* ================= Chat history ================= */
export function ChatHistorySheet({ onClose, butler, chatId, setChatId, setPage, openSheet, refreshChats }) {
  const [chats, setChats] = useState(null)
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [err, setErr] = useState('')

  const load = async () => {
    try { setChats(await butler.listChats()); setErr('') } catch { setErr('Couldn’t load your conversations. Check your connection.'); setChats([]) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const open = (id) => { setChatId(id); setPage('assistant'); onClose() }
  const remove = async (c) => {
    try {
      await butler.deleteChat(c.id)
      if (c.id === chatId) setChatId(null)
      setChats((list) => list.filter((x) => x.id !== c.id))
      refreshChats?.()
    } catch { setErr('Couldn’t delete that conversation. Try again.') }
    setConfirm(null)
  }

  if (confirm) {
    return (
      <Sheet onClose={() => setConfirm(null)} label="Delete conversation">
        <SheetHeader title="Delete conversation?" subtitle={confirm.title} onClose={() => setConfirm(null)} />
        <p style={sans(14, 400, { color: C.ink, lineHeight: '20px' })}>The conversation is deleted for good. Anything Butler remembered from it stays — manage that under What Butler remembers.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" onClick={() => setConfirm(null)} style={{ width: 112, flexShrink: 0 }}>Cancel</Button>
          <Button variant="ember" onClick={() => remove(confirm)} style={{ flex: 1 }}>Delete</Button>
        </div>
      </Sheet>
    )
  }

  const needle = q.trim().toLowerCase()
  const shown = (chats || []).filter((c) => !needle || c.title.toLowerCase().includes(needle) || (c.feed || []).some((m) => String(m.text || '').toLowerCase().includes(needle)))
  const groups = []
  shown.forEach((c) => {
    const g = groupOf(c.updated_at)
    if (!groups.length || groups[groups.length - 1].g !== g) groups.push({ g, items: [] })
    groups[groups.length - 1].items.push(c)
  })

  return (
    <Sheet onClose={onClose} label="Chat history">
      <SheetHeader title="Chat history" subtitle="Only you can see your conversations" onClose={onClose} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ink" icon="newchat@18" onClick={() => open(null)} style={{ flex: 1 }}>New chat</Button>
        <Button variant="outline" icon="memory@18" onClick={() => openSheet('memories')} style={{ flex: 1 }}>Memory</Button>
      </div>
      {(chats?.length || 0) > 4 && (
        <label style={{ height: 44, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', border: `1px solid ${C.ink22}` }}>
          <Icon name="search@18" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" aria-label="Search conversations"
            style={{ ...sans(14, 400, { color: C.ink }), flex: 1, minWidth: 0, height: '100%' }} />
        </label>
      )}
      {!chats && <span style={TX.small}>Loading…</span>}
      {err && <div style={{ background: C.blush, padding: 12 }}><span style={sans(13, 400, { color: C.ink })}>{err}</span></div>}
      {chats && !shown.length && !err && (
        <div style={{ background: C.row, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={TX.rowName}>{needle ? 'No conversations match' : 'No conversations yet'}</span>
          <span style={TX.small}>{needle ? 'Try another word.' : 'Ask Butler something and it’ll be saved here.'}</span>
        </div>
      )}
      {groups.map(({ g, items }) => (
        <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={TX.label}>{g}</span>
          {items.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'stretch', background: c.id === chatId ? C.amber : C.row }}>
              <button onClick={() => open(c.id)} style={{ ...reset, flex: 1, minWidth: 0, padding: '12px 0 12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ ...sans(14, 500, { color: C.ink }), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</span>
                <span style={{ ...sans(12, 400, { color: C.ink80 }), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview(c)}</span>
                <span style={mono(9, 400, { letterSpacing: 0.54, color: C.ink80 })}>
                  {c.id === chatId ? 'OPEN NOW · ' : ''}{shortDate(String(c.updated_at).slice(0, 10)).toUpperCase()} · {(c.feed || []).filter((m) => m.kind === 'user').length} MESSAGES
                </span>
              </button>
              <button aria-label={`Delete ${c.title}`} onClick={() => setConfirm(c)} style={{ ...reset, width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="trash@16" />
              </button>
            </div>
          ))}
        </div>
      ))}
    </Sheet>
  )
}

/* ================= What Butler remembers ================= */
export function MemorySheet({ onClose, butler }) {
  const [fact, setFact] = useState('')
  const [scope, setScope] = useState('household')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { butler.loadMemories() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const mine = butler.memories.filter((m) => m.scope === 'personal')
  const shared = butler.memories.filter((m) => m.scope !== 'personal')
  const add = async () => {
    setBusy(true); setErr('')
    try { await butler.addMemory(fact, scope); setFact('') } catch { setErr('Couldn’t save that. Check your connection.') }
    setBusy(false)
  }
  const remove = async (id) => { try { await butler.removeMemory(id) } catch { setErr('Couldn’t delete that. Try again.') } }

  const List = ({ label, items, empty }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={TX.label}>{label} · {items.length}</span>
      {items.length ? items.map((m) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.row, padding: '10px 8px 10px 16px' }}>
          <span style={{ ...sans(14, 400, { color: C.ink, lineHeight: '19px' }), flex: 1, minWidth: 0 }}>{m.fact}</span>
          {m.scope !== 'personal' && m.user_id && butler.userId && m.user_id !== butler.userId && <span style={mono(9, 400, { color: C.ink80, letterSpacing: 0.54, whiteSpace: 'nowrap' })}>FROM A MEMBER</span>}
          <button aria-label={`Forget ${m.fact}`} onClick={() => remove(m.id)} style={{ ...reset, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="x@16" /></button>
        </div>
      )) : <span style={TX.small}>{empty}</span>}
    </div>
  )

  return (
    <Sheet onClose={onClose} label="What Butler remembers">
      <SheetHeader title="What Butler remembers" subtitle="Learned from your conversations" onClose={onClose} />
      <p style={sans(13, 400, { color: C.ink80, lineHeight: '18px' })}>
        Butler saves lasting things you tell it — favourite brands, pack sizes, diet, when you shop — and uses them in every chat. <b style={{ fontWeight: 500 }}>Household</b> memories are shared with everyone in your household; <b style={{ fontWeight: 500 }}>Only you</b> stays private.
      </p>
      <List label="HOUSEHOLD" items={shared} empty="Nothing yet. Try telling Butler “we always buy Voltic in packs of 12”." />
      <List label="ONLY YOU" items={mine} empty="Nothing private yet." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${C.ink15}`, paddingTop: 16 }}>
        <span style={TX.label}>TEACH BUTLER SOMETHING</span>
        <TextInput value={fact} onChange={setFact} placeholder="e.g. We don’t eat pork" onKeyDown={(e) => { if (e.key === 'Enter' && fact.trim()) { e.preventDefault(); add() } }} />
        <Segmented value={scope} onChange={setScope} height={40} fontSize={13} options={[{ value: 'household', label: 'Household' }, { value: 'personal', label: 'Only you' }]} />
        <Button icon="memory@18" onClick={add} disabled={!fact.trim() || busy}>{busy ? 'Saving…' : 'Remember this'}</Button>
      </div>
      {err && <div style={{ background: C.blush, padding: 12 }}><span style={sans(13, 400, { color: C.ink })}>{err}</span></div>}
    </Sheet>
  )
}
