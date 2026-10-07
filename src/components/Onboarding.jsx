import { useState } from 'react'
import { CATEGORIES, HOUSEHOLD_TYPES, DEFAULT_PROFILE } from '../lib/constants'
import { T, monoLabel } from '../lib/theme'
import { inputStyle, btnPrimary, chipStyle, labelStyle } from '../lib/styles'
import { TagInput } from './shared'

export default function Onboarding({ profile, saveProfile, mobile }) {
  const [step, setStep] = useState(0)
  const [p, setP] = useState({ ...DEFAULT_PROFILE })
  const showKids = p.householdType === 'Family with kids' || p.householdType === 'Extended family'
  const showAdults = p.householdType && p.householdType !== 'Single person'
  const total = (p.adults || 1) + (p.kids || 0)

  const activeChip = { ...chipStyle, background: T.amber, color: T.accentText }
  const inactiveChip = { ...chipStyle, background: T.surfaceCard, color: T.textMuted, border: `1px solid ${T.borderLight}` }

  const steps = [
    { title: 'Tell us about your household', content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><label style={labelStyle}>Household type</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {HOUSEHOLD_TYPES.map(t => <button key={t} onClick={() => { const u = { ...p, householdType: t }; if (t === 'Single person') { u.adults = 1; u.kids = 0 } else if (t === 'Married couple') { u.adults = 2; u.kids = 0 } setP(u) }} style={p.householdType === t ? activeChip : inactiveChip}>{t}</button>)}
          </div>
        </div>
        {showAdults && <div><label style={labelStyle}>Adults</label><input type="number" min={1} value={p.adults || ''} onChange={e => setP({ ...p, adults: Math.max(1, +e.target.value) })} style={{ ...inputStyle, width: 100 }} /></div>}
        {showKids && <div><label style={labelStyle}>Children</label><input type="number" min={0} value={p.kids ?? ''} onChange={e => setP({ ...p, kids: Math.max(0, +e.target.value) })} style={{ ...inputStyle, width: 100 }} /></div>}
        {p.householdType && <p style={{ color: T.textLight, fontSize: 12, margin: 0, fontFamily: T.fontSans }}>Total: {total} {total === 1 ? 'person' : 'people'}</p>}
      </div>
    )},
    { title: 'How often do you shop?', content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Daily', 'Every few days', 'Weekly', 'Bi-weekly', 'Monthly', 'Irregular / As needed'].map(f => <button key={f} onClick={() => setP({ ...p, shopFrequency: f, shopFreqCustom: f === 'Irregular / As needed' ? p.shopFreqCustom : '' })} style={p.shopFrequency === f ? activeChip : inactiveChip}>{f}</button>)}
        </div>
        {p.shopFrequency === 'Irregular / As needed' && <div><label style={labelStyle}>Tell us more (optional)</label><input value={p.shopFreqCustom || ''} onChange={e => setP({ ...p, shopFreqCustom: e.target.value })} style={inputStyle} placeholder="e.g. I shop when things run out" /></div>}
      </div>
    )},
    { title: 'Monthly grocery budget? (GHS)', content: <input type="number" min={0} value={p.monthlyBudget || ''} onChange={e => setP({ ...p, monthlyBudget: +e.target.value })} style={inputStyle} placeholder="e.g. 2000" /> },
    { title: 'Stores you shop at', content: <div><TagInput tags={p.stores || []} setTags={s => setP({ ...p, stores: s })} placeholder="Type store name, press Enter" /><p style={{ color: T.textLight, fontSize: 12, marginTop: 8, fontFamily: T.fontSans }}>Type each store and press Enter</p></div> },
    { title: 'Dietary preferences?', content: <div><input value={p.dietaryPrefs || ''} onChange={e => setP({ ...p, dietaryPrefs: e.target.value })} style={inputStyle} placeholder="e.g. No pork, vegetarian" /><p style={{ color: T.textLight, fontSize: 12, marginTop: 8, fontFamily: T.fontSans }}>Helps the AI give relevant advice. Optional.</p></div> },
    { title: 'Top spending categories', content: <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{CATEGORIES.map(c => <button key={c} onClick={() => { const tc = p.topCategories?.includes(c) ? p.topCategories.filter(x => x !== c) : [...(p.topCategories || []), c]; setP({ ...p, topCategories: tc }) }} style={p.topCategories?.includes(c) ? activeChip : inactiveChip}>{c}</button>)}</div> },
  ]

  return (
    <div style={{ height: '100vh', background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 16, fontFamily: T.fontSans }}>
      <div style={{ background: T.surfaceCard, borderRadius: T.radiusLg, padding: mobile ? '24px 20px' : '36px', maxWidth: 520, width: '100%', border: `1px solid ${T.borderLight}`, boxShadow: T.shadowMd }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40 }}>🍌</div>
          <h1 style={{ color: T.deepTeal, margin: '8px 0 4px', fontSize: mobile ? 19 : 22, fontFamily: T.fontSans, fontWeight: T.semibold }}>Welcome to Plantain Butler</h1>
          <p style={{ ...monoLabel, margin: '4px 0 0' }}>Step {step + 1} of {steps.length}</p>
          <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 10 }}>{steps.map((_, i) => <div key={i} style={{ width: 24, height: 4, borderRadius: 2, background: i <= step ? T.amber : T.borderLight }} />)}</div>
        </div>
        <div style={{ minHeight: 120 }}>
          <h3 style={{ color: T.teal, marginBottom: 12, fontSize: 15, fontFamily: T.fontSans, fontWeight: T.semibold }}>{steps[step].title}</h3>
          {steps[step].content}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{ border: `1px solid ${T.borderLight}`, borderRadius: T.radiusMd, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontWeight: T.semibold, fontFamily: T.fontSans, opacity: step === 0 ? 0.3 : 1, background: T.surfaceCard, color: T.textMuted }}>Back</button>
          {step < steps.length - 1
            ? <button onClick={() => setStep(step + 1)} style={btnPrimary}>Next</button>
            : <button onClick={() => { const f = { ...p, onboarded: true }; if (p.householdType === 'Single person') { f.adults = 1; f.kids = 0 } saveProfile(f) }} style={btnPrimary}>Get Started</button>}
        </div>
      </div>
    </div>
  )
}
