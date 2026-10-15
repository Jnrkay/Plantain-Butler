// M6 · Overflow menu (Figma 23:7824)
import { useRef } from 'react'
import { C, sans, mono } from '../lib/theme'
import { money, initials, monthlyBudget } from '../lib/derive'
import { exportAllData, importData } from '../lib/storage'
import { Avatar, Icon, Overlay, reset } from './ui'

export const exportBackup = () => {
  const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `plantain-butler-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Item({ icon, label, meta, onClick, danger, divider }) {
  return (
    <button
      className="pb-menu-item"
      onClick={onClick}
      style={{ ...reset, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', width: '100%', borderTop: divider ? `1px solid ${C.ink12}` : 'none' }}
    >
      <Icon name={`${icon}@18`} color={danger ? C.ember : C.ink} />
      <span style={{ ...sans(14, 400, { color: danger ? C.ember : C.ink }), flex: 1 }}>{label}</span>
      {meta !== undefined && <span style={mono(10, 400, { color: C.ink80 })}>{meta}</span>}
    </button>
  )
}

export default function OverflowMenu({ profile, openSheet, onClose }) {
  const fileRef = useRef(null)
  const budget = monthlyBudget(profile)

  const onImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        importData(JSON.parse(ev.target.result))
        window.location.reload()
      } catch (err) {
        alert(`That file isn't a Plantain Butler backup (${err.message}).`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <Overlay onClose={onClose}>
      <div
        role="menu"
        style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 52px)',
          right: 'max(20px, calc((100vw - 480px) / 2 + 20px))', width: 250,
          background: C.white, padding: '8px 0', display: 'flex', flexDirection: 'column', animation: 'pb-pop-in .15s ease',
        }}
      >
        <button onClick={() => openSheet('profile')} className="pb-menu-item"
          style={{ ...reset, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${C.ink12}` }}>
          <Avatar text={initials(profile?.name)} size={32} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={sans(14, 500, { color: C.ink })}>{String(profile?.name || '').trim().split(/\s+/)[0] || 'Your household'}</span>
            <span style={sans(11, 400, { color: C.ink80 })}>Profile &amp; settings</span>
          </div>
        </button>
        <Item icon="user" label="Household profile" onClick={() => openSheet('profile')} />
        <Item icon="wallet" label="Budgets" meta={budget ? money(budget, 0) : undefined} onClick={() => openSheet('budgets')} />
        <Item icon="store" label="My stores" meta={(profile?.stores || []).length || undefined} onClick={() => openSheet('stores')} />
        <Item icon="leaf" label="Dietary preferences" onClick={() => openSheet('dietary')} />
        <Item icon="down" label="Export backup" divider onClick={() => { exportBackup(); onClose() }} />
        <Item icon="up" label="Import backup" onClick={() => fileRef.current?.click()} />
        <Item icon="trash" label="Clear data…" danger divider onClick={() => openSheet('clear')} />
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={onImport} style={{ display: 'none' }} />
      </div>
    </Overlay>
  )
}
