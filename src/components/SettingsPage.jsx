import { useState } from 'react'
import { CATEGORIES, HOUSEHOLD_TYPES, DEFAULT_PROFILE } from '../lib/constants'
import { inputStyle, inputSm, labelStyle, btnStyle, btnPrimary, chipStyle } from '../lib/styles'
import { T, monoLabel } from '../lib/theme'
import { Card } from './shared'
import { TagInput } from './shared'
import { save, exportAllData, importData } from '../lib/storage'

export default function SettingsPage({ profile, saveProfile, budgets, saveBudgets, saveInv, saveTx, saveSL, mobile }) {
  const [p, setP] = useState({ ...profile })
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(null)
  const [showPasteImport, setShowPasteImport] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const showKids = p.householdType === 'Family with kids' || p.householdType === 'Extended family'
  const showAdults = p.householdType && p.householdType !== 'Single person'

  const handleSaveProfile = () => {
    saveProfile({ ...p, onboarded: true })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleExport = () => {
    const data = exportAllData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().split('T')[0]
    a.href = url
    a.download = `plantain-butler-backup-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        importData(data)
        window.location.reload()
      } catch (err) {
        alert('Invalid backup file: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  const handlePasteImport = () => {
    if (!pasteText.trim()) return
    try {
      const data = JSON.parse(pasteText.trim())
      importData(data)
      window.location.reload()
    } catch (err) {
      alert('Invalid data: ' + err.message)
    }
  }

  const clearConfirm = (key, action) => {
    if (confirming === key) {
      action()
      setConfirming(null)
    } else {
      setConfirming(key)
    }
  }

  const clearBtnS = {
    ...btnStyle,
    background: `${T.error}15`,
    color: T.error,
    border: `1px solid ${T.error}30`,
    padding: '8px 14px',
    fontSize: 12,
  }

  const dangerBtn = {
    ...clearBtnS,
    background: `${T.error}20`,
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: mobile ? '20px 16px' : '32px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ ...monoLabel, margin: 0 }}>SETTINGS</p>

      {/* Household Profile */}
      <Card title="Household Profile">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Household type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {HOUSEHOLD_TYPES.map(t => (
                <button key={t} onClick={() => {
                  const u = { ...p, householdType: t }
                  if (t === 'Single person') { u.adults = 1; u.kids = 0 }
                  else if (t === 'Married couple') { u.adults = 2; u.kids = 0 }
                  setP(u)
                }} style={{
                  ...chipStyle,
                  background: p.householdType === t ? T.amber : T.surfaceCard,
                  color: p.householdType === t ? T.accentText : T.textMuted,
                  border: p.householdType === t ? 'none' : `1px solid ${T.borderLight}`,
                }}>{t}</button>
              ))}
            </div>
          </div>

          {showAdults && (
            <div>
              <label style={labelStyle}>Adults</label>
              <input type="number" min={1} value={p.adults || ''} onChange={e => setP({ ...p, adults: Math.max(1, +e.target.value) })} style={{ ...inputStyle, width: 100 }} />
            </div>
          )}

          {showKids && (
            <div>
              <label style={labelStyle}>Children</label>
              <input type="number" min={0} value={p.kids ?? ''} onChange={e => setP({ ...p, kids: Math.max(0, +e.target.value) })} style={{ ...inputStyle, width: 100 }} />
            </div>
          )}

          <div>
            <label style={labelStyle}>Shopping frequency</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['Daily', 'Every few days', 'Weekly', 'Bi-weekly', 'Monthly', 'Irregular / As needed'].map(f => (
                <button key={f} onClick={() => setP({ ...p, shopFrequency: f, shopFreqCustom: f === 'Irregular / As needed' ? p.shopFreqCustom : '' })} style={{
                  ...chipStyle,
                  background: p.shopFrequency === f ? T.amber : T.surfaceCard,
                  color: p.shopFrequency === f ? T.accentText : T.textMuted,
                  border: p.shopFrequency === f ? 'none' : `1px solid ${T.borderLight}`,
                }}>{f}</button>
              ))}
            </div>
          </div>

          {p.shopFrequency === 'Irregular / As needed' && (
            <div>
              <label style={labelStyle}>Tell us more (optional)</label>
              <input value={p.shopFreqCustom || ''} onChange={e => setP({ ...p, shopFreqCustom: e.target.value })} style={inputStyle} placeholder="e.g. I shop when things run out" />
            </div>
          )}

          <div>
            <label style={labelStyle}>Monthly budget (GHS)</label>
            <input type="number" min={0} value={p.monthlyBudget || ''} onChange={e => setP({ ...p, monthlyBudget: +e.target.value })} style={{ ...inputStyle, width: 160 }} placeholder="e.g. 2000" />
          </div>

          <div>
            <label style={labelStyle}>Stores</label>
            <TagInput tags={p.stores || []} setTags={s => setP({ ...p, stores: s })} placeholder="Type store name, press Enter" />
          </div>

          <div>
            <label style={labelStyle}>Dietary preferences</label>
            <input value={p.dietaryPrefs || ''} onChange={e => setP({ ...p, dietaryPrefs: e.target.value })} style={inputStyle} placeholder="e.g. No pork, vegetarian" />
          </div>

          <div>
            <label style={labelStyle}>Top spending categories</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => {
                  const tc = p.topCategories?.includes(c)
                    ? p.topCategories.filter(x => x !== c)
                    : [...(p.topCategories || []), c]
                  setP({ ...p, topCategories: tc })
                }} style={{
                  ...chipStyle,
                  background: p.topCategories?.includes(c) ? T.amber : T.surfaceCard,
                  color: p.topCategories?.includes(c) ? T.accentText : T.textMuted,
                  border: p.topCategories?.includes(c) ? 'none' : `1px solid ${T.borderLight}`,
                }}>{c}</button>
              ))}
            </div>
          </div>

          <button onClick={handleSaveProfile} style={{ ...btnPrimary, alignSelf: 'flex-start' }}>
            {saved ? '✓ Saved!' : 'Save Profile'}
          </button>
        </div>
      </Card>

      {/* Category Budgets */}
      <Card title="Category Budgets">
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
          {CATEGORIES.map(c => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, color: T.textMuted, fontFamily: T.fontSans, minWidth: mobile ? 110 : 130, flexShrink: 0 }}>{c}</label>
              <input type="number" min={0} value={budgets[c] || ''} onChange={e => saveBudgets({ ...budgets, [c]: +e.target.value })} style={{ ...inputSm, width: '100%' }} placeholder="0" />
            </div>
          ))}
        </div>
      </Card>

      {/* Data Management */}
      <Card title="Data Management">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={handleExport} style={{ ...btnStyle, background: T.teal, color: T.warm, padding: '8px 14px', fontSize: 12, borderRadius: T.radiusMd }}>
              Export Backup
            </button>
            <label style={{ ...btnStyle, background: T.surfaceCard, color: T.text, border: `1px solid ${T.borderLight}`, padding: '8px 14px', fontSize: 12, borderRadius: T.radiusMd, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
              Import File
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
            <button onClick={() => setShowPasteImport(!showPasteImport)} style={{
              ...btnStyle,
              background: showPasteImport ? T.teal : T.surfaceCard,
              color: showPasteImport ? T.warm : T.text,
              border: showPasteImport ? 'none' : `1px solid ${T.borderLight}`,
              padding: '8px 14px',
              fontSize: 12,
              borderRadius: T.radiusMd,
            }}>
              Paste Import
            </button>
          </div>

          {showPasteImport && (
            <div style={{ background: T.surfaceCard, border: `1px solid ${T.borderLight}`, borderRadius: T.radiusMd, padding: 12, marginTop: 4 }}>
              <p style={{ fontSize: 11, color: T.textMuted, margin: '0 0 8px', fontFamily: T.fontSans }}>Paste your exported JSON data from the artifact below:</p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder='Paste JSON data here...'
                style={{ ...inputStyle, height: 100, fontSize: 11, fontFamily: T.fontMono, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={handlePasteImport} disabled={!pasteText.trim()} style={{ ...btnPrimary, padding: '6px 14px', fontSize: 12, opacity: pasteText.trim() ? 1 : 0.4 }}>
                  Import Data
                </button>
                <button onClick={() => { setShowPasteImport(false); setPasteText('') }} style={{ ...btnStyle, background: T.surfaceCard, color: T.textMuted, border: `1px solid ${T.borderLight}`, padding: '6px 14px', fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 12, marginTop: 4 }}>
            <p style={{ ...monoLabel, margin: '0 0 10px' }}>Clear data</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { key: 'inv', label: 'Inventory', action: () => saveInv([]) },
                { key: 'tx', label: 'Transactions', action: () => saveTx([]) },
                { key: 'sl', label: 'Shopping List', action: () => saveSL([]) },
              ].map(({ key, label, action }) => (
                confirming === key ? (
                  <span key={key} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12, color: T.textMuted, fontFamily: T.fontSans }}>
                    Clear {label}?
                    <button onClick={() => { action(); setConfirming(null) }} style={{ ...clearBtnS, padding: '4px 10px', color: T.warning }}>Yes</button>
                    <button onClick={() => setConfirming(null)} style={{ ...clearBtnS, padding: '4px 10px' }}>No</button>
                  </span>
                ) : (
                  <button key={key} onClick={() => setConfirming(key)} style={clearBtnS}>
                    Clear {label}
                  </button>
                )
              ))}

              {confirming === 'all' ? (
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12, color: T.error, fontFamily: T.fontSans }}>
                  Clear everything?
                  <button onClick={() => { saveInv([]); saveTx([]); saveSL([]); saveBudgets({}); saveProfile(DEFAULT_PROFILE); setConfirming(null) }} style={{ ...dangerBtn, padding: '4px 10px' }}>Yes</button>
                  <button onClick={() => setConfirming(null)} style={{ ...clearBtnS, padding: '4px 10px' }}>No</button>
                </span>
              ) : (
                <button onClick={() => setConfirming('all')} style={dangerBtn}>
                  Clear Everything
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
