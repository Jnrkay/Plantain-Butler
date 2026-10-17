// First-run setup. Not drawn in Figma — built from the same parts as the sheets
// (Tag, steps bar, Field/TextInput, Chip, Button) so it reads as part of the system.
// Goal: show what the app does, then leave the household with real data to explore.
import { useState } from 'react'
import { HOUSEHOLD_TYPES, DEFAULT_PROFILE } from '../lib/constants'
import { C, TX, sans, mono } from '../lib/theme'
import { uid } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { Tag, Field, TextInput, QtyStepper, Chip, Button, Icon, reset } from './ui'

// Things most Ghanaian homes keep in — one tap adds them to stock
const STAPLES = [
  ['Rice', 'Grains'], ['Water', 'Beverages'], ['Cooking oil', 'Cooking Essentials'], ['Sugar', 'Cooking Essentials'],
  ['Tomato paste', 'Cooking Essentials'], ['Salt', 'Cooking Essentials'], ['Milk', 'Dairy'], ['Chocolate drink', 'Beverages'],
  ['Bread', 'Grains'], ['Eggs', 'Proteins'], ['Gari', 'Grains'], ['Pasta', 'Grains'], ['Noodles', 'Grains'], ['Tinned fish', 'Proteins'],
  ['Toilet roll', 'Toiletries'], ['Paper towels', 'Cleaning'], ['Soap', 'Toiletries'], ['Detergent', 'Cleaning'],
  ['Toothpaste', 'Toiletries'], ['Dishwashing liquid', 'Cleaning'],
]

function Value({ icon, title, body }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 40, height: 40, background: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={icon} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={sans(15, 500, { color: C.ink })}>{title}</span>
        <span style={sans(13, 400, { color: C.ink80, lineHeight: '18px' })}>{body}</span>
      </div>
    </div>
  )
}

function Choice({ icon, title, sub, onClick, active }) {
  return (
    <button onClick={onClick} style={{ ...reset, display: 'flex', alignItems: 'center', gap: 12, padding: 16, width: '100%', background: active ? C.amber : C.row, border: active ? `1.5px solid ${C.ink}` : '1.5px solid transparent' }}>
      <Icon name={icon} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={sans(15, 500, { color: C.ink })}>{title}</span>
        <span style={sans(12, 400, { color: C.ink80 })}>{sub}</span>
      </div>
      {active && <Icon name="check@16" />}
    </button>
  )
}

export default function Onboarding({ profile, saveProfile, saveInv, inventory = [], account, onDone }) {
  const [step, setStep] = useState(0)
  const [p, setP] = useState({ ...DEFAULT_PROFILE, ...profile, onboarded: false })
  const [store, setStore] = useState('')
  const [picked, setPicked] = useState({}) // name -> { qty, category }
  const [other, setOther] = useState('')
  const [next, setNext] = useState('receipt') // what to open after setup
  const [joining, setJoining] = useState(false)
  const [code, setCode] = useState('')
  const [joinMsg, setJoinMsg] = useState('')
  const multi = p.householdType && p.householdType !== 'Single person'
  const addStore = () => { const v = store.trim(); if (v && !(p.stores || []).includes(v)) setP({ ...p, stores: [...(p.stores || []), v] }); setStore('') }
  const toggle = (name, category) => setPicked((x) => { const n = { ...x }; if (n[name]) delete n[name]; else n[name] = { qty: 1, category }; return n })
  const addOther = () => { const v = other.trim(); if (v) setPicked((x) => ({ ...x, [v]: { qty: 1, category: 'Other' } })); setOther('') }
  const count = Object.keys(picked).length

  const join = async () => {
    setJoinMsg('')
    if (p.name?.trim()) await supabase.auth.updateUser({ data: { name: p.name.trim() } })
    const { data, error } = await supabase.rpc('join_household', { p_code: code })
    if (error) return setJoinMsg(error.message)
    if (data?.status === 'ok' || data?.status === 'already') return account?.switchHousehold()
    setJoinMsg(data?.status === 'limit' ? 'Too many attempts today. Try again tomorrow.' : 'That code didn’t work. Codes work once and expire after 7 days — ask for a new one.')
  }

  const finish = async () => {
    const name = (p.name || '').trim()
    if (name) supabase.auth.updateUser({ data: { name } }).catch(() => {})
    const have = new Set(inventory.map((i) => String(i.name).toLowerCase()))
    const items = Object.entries(picked).filter(([n]) => !have.has(n.toLowerCase())).map(([n, v]) => ({
      id: uid(), name: n, qty: v.qty, fullQty: v.qty, status: 'high', category: v.category,
      productType: STAPLES.some(([s]) => s === n) ? n : '',
    }))
    if (items.length) saveInv([...inventory, ...items])
    saveProfile({ ...p, name, onboarded: true, progress: { ...(p.progress || {}), ...(items.length ? { stock: true } : {}) }, ...(p.householdType === 'Single person' ? { adults: 1, kids: 0 } : {}) })
    onDone?.(next)
  }

  if (joining) {
    return (
      <Shell>
        <h1 style={TX.title}>Join a household</h1>
        <p style={sans(14, 400, { color: C.ink80, lineHeight: '20px' })}>Someone already uses Plantain Butler for your home? Ask them for an invite code (Menu → Household & sharing → Create invite code).</p>
        <Field label="YOUR NAME"><TextInput value={p.name || ''} onChange={(v) => setP({ ...p, name: v })} placeholder="So they know it’s you" /></Field>
        <Field label="INVITE CODE"><TextInput value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="6 letters" autoComplete="off" /></Field>
        {joinMsg && <div style={{ background: C.blush, padding: 12 }}><span style={sans(13, 400, { color: C.ink })}>{joinMsg}</span></div>}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" onClick={() => setJoining(false)} style={{ width: 112, flexShrink: 0 }}>Back</Button>
          <Button onClick={join} disabled={code.replace(/[^A-Za-z0-9]/g, '').length < 6} style={{ flex: 1 }}>Join household</Button>
        </div>
      </Shell>
    )
  }

  const steps = [
    {
      title: 'Your household, handled.',
      body: (
        <>
          <p style={sans(15, 400, { color: C.ink80, lineHeight: '21px' })}>Plantain Butler keeps track of what’s at home and what you spend — and learns your habits so you don’t have to.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            <Value icon="box@18" title="Know what’s at home" body="Butler learns how fast you use things, counts your stock down and warns you before you run out — whatever brand you buy." />
            <Value icon="receipt@18" title="See where the money goes" body="Snap a receipt and every line becomes spending by category, product and brand, with price changes tracked." />
            <Value icon="chat@18" title="Just ask Butler" body="“What’s running low?” “Add bread to my list.” Butler answers and makes the change for you." />
            <Value icon="user@18" title="Share with your household" body="Invite your partner or family so everyone sees the same stock and shopping list." />
          </div>
        </>
      ),
      cta: 'Set up my household',
      extra: <button onClick={() => setJoining(true)} style={{ ...reset, alignSelf: 'center', ...sans(14, 500, { color: C.ink, textDecoration: 'underline', textUnderlineOffset: 3 }) }}>I have an invite code</button>,
    },
    {
      title: 'Who’s at home?',
      body: (
        <>
          <Field label="YOUR NAME"><TextInput value={p.name || ''} onChange={(v) => setP({ ...p, name: v })} placeholder="e.g. Emmanuel Dankyi" /></Field>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {HOUSEHOLD_TYPES.map((t) => (
              <Chip key={t} label={t} active={p.householdType === t}
                onClick={() => setP({ ...p, householdType: t, ...(t === 'Single person' ? { adults: 1, kids: 0 } : t === 'Married couple' ? { adults: 2, kids: 0 } : {}) })} />
            ))}
          </div>
          {multi && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Field label="ADULTS" style={{ flex: 1 }}><QtyStepper value={Number(p.adults) || 1} onChange={(v) => setP({ ...p, adults: v })} /></Field>
              <Field label="CHILDREN" style={{ flex: 1 }}><QtyStepper min={0} value={Number(p.kids) || 0} onChange={(v) => setP({ ...p, kids: v })} /></Field>
            </div>
          )}
        </>
      ),
      ok: !!(p.name || '').trim(),
    },
    {
      title: 'Budget & shops',
      body: (
        <>
          <Field label="MONTHLY GROCERY BUDGET · GHS"><TextInput type="number" inputMode="decimal" value={p.monthlyBudget || ''} onChange={(v) => setP({ ...p, monthlyBudget: Number(v) || 0 })} placeholder="e.g. 2000" /></Field>
          <span style={sans(12, 400, { color: C.ink80, lineHeight: '17px', marginTop: -8 })}>Butler shows how your spending is pacing against it. You can change it any time.</span>
          <span style={TX.label}>WHERE DO YOU SHOP?</span>
          {(p.stores || []).map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.row, padding: '12px 12px 12px 16px' }}>
              <Icon name="store@18" />
              <span style={{ ...sans(15, 500, { color: C.ink }), flex: 1 }}>{s}</span>
              <button aria-label={`Remove ${s}`} onClick={() => setP({ ...p, stores: p.stores.filter((x) => x !== s) })} style={{ ...reset, display: 'flex', padding: 4 }}><Icon name="x@16" /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><TextInput value={store} onChange={setStore} placeholder="e.g. Adez Mart" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStore() } }} /></div>
            <Button variant="ink" height={44} onClick={addStore} disabled={!store.trim()}>Add</Button>
          </div>
        </>
      ),
    },
    {
      title: 'What’s in your kitchen?',
      body: (
        <>
          <p style={sans(14, 400, { color: C.ink80, lineHeight: '20px' })}>Tap what you have right now. It becomes your stock — Butler starts learning from here.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {STAPLES.map(([n, c]) => <Chip key={n} label={n} active={!!picked[n]} onClick={() => toggle(n, c)} />)}
            {Object.keys(picked).filter((n) => !STAPLES.some(([s]) => s === n)).map((n) => <Chip key={n} label={n} active onClick={() => toggle(n)} />)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><TextInput value={other} onChange={setOther} placeholder="Something else…" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOther() } }} /></div>
            <Button variant="ink" height={44} onClick={addOther} disabled={!other.trim()}>Add</Button>
          </div>
          {count > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={TX.label}>HOW MANY? · {count} ITEM{count === 1 ? '' : 'S'}</span>
              {Object.entries(picked).map(([n, v]) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.row, padding: '6px 6px 6px 16px' }}>
                  <span style={{ ...sans(14, 500, { color: C.ink }), flex: 1 }}>{n}</span>
                  <div style={{ width: 132 }}><QtyStepper value={v.qty} onChange={(q) => setPicked((x) => ({ ...x, [n]: { ...v, qty: q } }))} /></div>
                </div>
              ))}
            </div>
          )}
        </>
      ),
      cta: count ? `Add ${count} item${count === 1 ? '' : 's'}` : 'Skip for now',
    },
    {
      title: 'Log your last shop',
      body: (
        <>
          <p style={sans(14, 400, { color: C.ink80, lineHeight: '20px' })}>Add one recent shopping trip so your first insights have something to show. It takes a minute.</p>
          <Choice icon="camera@20" title="Scan a receipt" sub="Butler reads every item and price" active={next === 'receipt'} onClick={() => setNext('receipt')} />
          <Choice icon="pencil@20" title="Type in what I bought" sub="No receipt? Add items by hand" active={next === 'manual'} onClick={() => setNext('manual')} />
          <Choice icon="home@18" title="Not now" sub="Go straight to the app" active={next === null} onClick={() => setNext(null)} />
          <div style={{ background: C.teal, padding: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={mono(10, 500, { letterSpacing: 0.8, color: C.amber, paddingTop: 2 })}>TIP</span>
            <span style={sans(12, 400, { color: C.blush, lineHeight: '17px' })}>You can also just tell Butler: “I bought 2 bags of rice and a crate of eggs at Adez Mart.”</span>
          </div>
        </>
      ),
      cta: next === null ? 'Finish' : 'Finish & log it',
    },
  ]
  const last = step === steps.length - 1
  const s = steps[step]

  return (
    <Shell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tag>PLANTAIN BUTLER</Tag>
        {step > 0 && <span style={TX.label}>{String(step).padStart(2, '0')} / {String(steps.length - 1).padStart(2, '0')}</span>}
      </div>
      {step > 0 && (
        <div style={{ display: 'flex', gap: 4 }}>
          {steps.slice(1).map((_, i) => <div key={i} style={{ flex: 1, height: 3, background: i < step ? C.ink : C.ink15 }} />)}
        </div>
      )}
      <h1 style={step === 0 ? sans(40, 500, { lineHeight: '44px', letterSpacing: -1.6, color: C.ink }) : TX.title}>{s.title}</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>{s.body}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} style={{ width: 112, flexShrink: 0 }}>Back</Button>}
          <Button icon={last ? 'check@16' : undefined} disabled={s.ok === false} onClick={() => (last ? finish() : setStep(step + 1))} style={{ flex: 1 }}>
            {s.cta || 'Next'}
          </Button>
        </div>
        {s.extra}
      </div>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100dvh', background: C.cream, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 24, padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
        {children}
      </div>
    </div>
  )
}
