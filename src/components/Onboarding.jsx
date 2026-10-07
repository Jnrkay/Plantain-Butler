import { useState } from 'react'
import { CATEGORIES, HOUSEHOLD_TYPES, DEFAULT_PROFILE } from '../lib/constants'
import { inputStyle, btnStyle, btnPrimary, chipStyle, labelStyle } from '../lib/styles'
import { TagInput } from './shared'

export default function Onboarding({ profile, saveProfile, mobile }) {
  const [step, setStep] = useState(0)
  const [p, setP] = useState({ ...DEFAULT_PROFILE })
  const showKids = p.householdType === 'Family with kids' || p.householdType === 'Extended family'
  const showAdults = p.householdType && p.householdType !== 'Single person'
  const total = (p.adults || 1) + (p.kids || 0)

  const steps = [
    { title: 'Tell us about your household', content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><label style={labelStyle}>Household type</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {HOUSEHOLD_TYPES.map(t => <button key={t} onClick={() => { const u = { ...p, householdType: t }; if (t === 'Single person') { u.adults = 1; u.kids = 0 } else if (t === 'Married couple') { u.adults = 2; u.kids = 0 } setP(u) }} style={{ ...chipStyle, background: p.householdType === t ? '#06b6d4' : '#1e2030', color: p.householdType === t ? '#0f1117' : '#e2e8f0' }}>{t}</button>)}
          </div>
        </div>
        {showAdults && <div><label style={labelStyle}>Adults</label><input type="number" min={1} value={p.adults || ''} onChange={e => setP({ ...p, adults: Math.max(1, +e.target.value) })} style={{ ...inputStyle, width: 100 }} /></div>}
        {showKids && <div><label style={labelStyle}>Children</label><input type="number" min={0} value={p.kids ?? ''} onChange={e => setP({ ...p, kids: Math.max(0, +e.target.value) })} style={{ ...inputStyle, width: 100 }} /></div>}
        {p.householdType && <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Total: {total} {total === 1 ? 'person' : 'people'}</p>}
      </div>
    )},
    { title: 'How often do you shop?', content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Daily', 'Every few days', 'Weekly', 'Bi-weekly', 'Monthly', 'Irregular / As needed'].map(f => <button key={f} onClick={() => setP({ ...p, shopFrequency: f, shopFreqCustom: f === 'Irregular / As needed' ? p.shopFreqCustom : '' })} style={{ ...chipStyle, background: p.shopFrequency === f ? '#06b6d4' : '#1e2030', color: p.shopFrequency === f ? '#0f1117' : '#e2e8f0' }}>{f}</button>)}
        </div>
        {p.shopFrequency === 'Irregular / As needed' && <div><label style={labelStyle}>Tell us more (optional)</label><input value={p.shopFreqCustom || ''} onChange={e => setP({ ...p, shopFreqCustom: e.target.value })} style={inputStyle} placeholder="e.g. I shop when things run out" /></div>}
      </div>
    )},
    { title: 'Monthly grocery budget? (GHS)', content: <input type="number" min={0} value={p.monthlyBudget || ''} onChange={e => setP({ ...p, monthlyBudget: +e.target.value })} style={inputStyle} placeholder="e.g. 2000" /> },
    { title: 'Stores you shop at', content: <div><TagInput tags={p.stores || []} setTags={s => setP({ ...p, stores: s })} placeholder="Type store name, press Enter" /><p style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>Type each store and press Enter</p></div> },
    { title: 'Dietary preferences?', content: <div><input value={p.dietaryPrefs || ''} onChange={e => setP({ ...p, dietaryPrefs: e.target.value })} style={inputStyle} placeholder="e.g. No pork, vegetarian" /><p style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>Helps the AI give relevant advice. Optional.</p></div> },
    { title: 'Top spending categories', content: <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{CATEGORIES.map(c => <button key={c} onClick={() => { const tc = p.topCategories?.includes(c) ? p.topCategories.filter(x => x !== c) : [...(p.topCategories || []), c]; setP({ ...p, topCategories: tc }) }} style={{ ...chipStyle, background: p.topCategories?.includes(c) ? '#06b6d4' : '#1e2030', color: p.topCategories?.includes(c) ? '#0f1117' : '#e2e8f0' }}>{c}</button>)}</div> },
  ]

  return (
    <div style={{ height: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 16 }}>
      <div style={{ background: '#161822', borderRadius: 16, padding: mobile ? '24px 20px' : '36px', maxWidth: 520, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40 }}>🍌</div>
          <h1 style={{ color: '#e2e8f0', margin: '8px 0 4px', fontSize: mobile ? 19 : 22 }}>Welcome to Plantain Butler</h1>
          <p style={{ color: '#64748b', fontSize: 13 }}>Step {step + 1} of {steps.length}</p>
          <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 10 }}>{steps.map((_, i) => <div key={i} style={{ width: 24, height: 4, borderRadius: 2, background: i <= step ? '#06b6d4' : '#1e2030' }} />)}</div>
        </div>
        <div style={{ minHeight: 120 }}>
          <h3 style={{ color: '#06b6d4', marginBottom: 12, fontSize: 15 }}>{steps[step].title}</h3>
          {steps[step].content}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{ ...btnStyle, opacity: step === 0 ? 0.3 : 1, background: '#1e2030', color: '#94a3b8' }}>Back</button>
          {step < steps.length - 1
            ? <button onClick={() => setStep(step + 1)} style={btnPrimary}>Next</button>
            : <button onClick={() => { const f = { ...p, onboarded: true }; if (p.householdType === 'Single person') { f.adults = 1; f.kids = 0 } saveProfile(f) }} style={btnPrimary}>Get Started</button>}
        </div>
      </div>
    </div>
  )
}
