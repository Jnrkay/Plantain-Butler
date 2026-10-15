// First-run setup. Not drawn in Figma — built from the same parts as the sheets
// (Tag, steps bar, Field/TextInput, Chip, Button) so it reads as part of the system.
import { useState } from 'react'
import { CATEGORIES, HOUSEHOLD_TYPES, DEFAULT_PROFILE } from '../lib/constants'
import { C, TX, sans } from '../lib/theme'
import { Tag, Field, TextInput, QtyStepper, Chip, Button, Icon, reset } from './ui'

const FREQ = ['Daily', 'Every few days', 'Weekly', 'Bi-weekly', 'Monthly', 'As needed']

export default function Onboarding({ profile, saveProfile }) {
  const [step, setStep] = useState(0)
  const [p, setP] = useState({ ...DEFAULT_PROFILE, ...profile, onboarded: false })
  const [store, setStore] = useState('')
  const multi = p.householdType && p.householdType !== 'Single person'
  const addStore = () => { const v = store.trim(); if (v && !(p.stores || []).includes(v)) setP({ ...p, stores: [...(p.stores || []), v] }); setStore('') }

  const steps = [
    {
      title: 'What should Butler call you?',
      body: <Field label="YOUR NAME"><TextInput value={p.name || ''} onChange={(v) => setP({ ...p, name: v })} placeholder="e.g. Emmanuel Dankyi" autoFocus /></Field>,
    },
    {
      title: 'Who’s in the household?',
      body: (
        <>
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
    },
    {
      title: 'How often do you shop?',
      body: <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{FREQ.map((f) => <Chip key={f} label={f} active={p.shopFrequency === f} onClick={() => setP({ ...p, shopFrequency: f })} />)}</div>,
    },
    {
      title: 'Monthly grocery budget',
      body: <Field label="GHS PER MONTH"><TextInput type="number" inputMode="decimal" value={p.monthlyBudget || ''} onChange={(v) => setP({ ...p, monthlyBudget: Number(v) || 0 })} placeholder="e.g. 2000" /></Field>,
    },
    {
      title: 'Where do you shop?',
      body: (
        <>
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
      title: 'What do you buy most?',
      body: (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((c) => {
              const on = (p.topCategories || []).includes(c)
              return <Chip key={c} label={c} active={on} onClick={() => setP({ ...p, topCategories: on ? p.topCategories.filter((x) => x !== c) : [...(p.topCategories || []), c] })} />
            })}
          </div>
          <Field label="DIETARY PREFERENCES · OPTIONAL"><TextInput value={p.dietaryPrefs || ''} onChange={(v) => setP({ ...p, dietaryPrefs: v })} placeholder="e.g. No pork" /></Field>
        </>
      ),
    },
  ]
  const last = step === steps.length - 1
  const finish = () => saveProfile({ ...p, name: (p.name || '').trim(), onboarded: true, ...(p.householdType === 'Single person' ? { adults: 1, kids: 0 } : {}) })

  return (
    <div style={{ minHeight: '100dvh', background: C.cream, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 24, padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tag>PLANTAIN BUTLER</Tag>
          <span style={TX.label}>{String(step + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {steps.map((_, i) => <div key={i} style={{ flex: 1, height: 3, background: i <= step ? C.ink : C.ink15 }} />)}
        </div>
        <h1 style={TX.title}>{steps[step].title}</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>{steps[step].body}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} style={{ width: 112, flexShrink: 0 }}>Back</Button>}
          <Button icon={last ? 'check@16' : undefined} onClick={() => (last ? finish() : setStep(step + 1))} style={{ flex: 1 }}>
            {last ? 'Get started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  )
}
