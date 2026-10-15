// M6 · Overflow menu (Figma 23:7824)
import { useRef } from 'react'
import { C, sans, mono } from '../lib/theme'
import { money, initials, monthlyBudget } from '../lib/derive'
import { exportAllData } from '../lib/storage'
import { Avatar, Icon, Overlay, reset } from './ui'

// Pass `data` to export something other than what's currently on screen (e.g. pre-sign-in data)
export const exportBackup = (data) => {
  const payload = data ? { ...data, _exportedAt: new Date().toISOString(), _version: 1 } : exportAllData()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
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

const syncLabel = (sync) => {
  if (!sync) return ''
  if (sync.state === 'offline') return sync.pending ? `Offline · ${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting` : 'Offline · saved on this phone'
  if (sync.state === 'error') return sync.pending ? `Couldn’t sync ${sync.pending} change${sync.pending === 1 ? '' : 's'} · retrying` : 'Sync paused · retrying'
  if (sync.state === 'syncing' || sync.pending) return 'Syncing…'
  return 'Synced'
}

export default function OverflowMenu({ profile, openSheet, onClose, account, saveProfile, saveTx, saveInv, saveBudgets, saveSL }) {
  const fileRef = useRef(null)
  const budget = monthlyBudget(profile)

  const onImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result)
        if (!d || typeof d !== 'object') throw new Error('empty file')
        // Saving through the store uploads the imported data to the account
        if (d.profile) saveProfile({ ...d.profile, onboarded: true })
        if (d.budgets) saveBudgets(d.budgets)
        if (Array.isArray(d.inventory)) saveInv(d.inventory)
        if (Array.isArray(d.transactions)) saveTx(d.transactions)
        if (Array.isArray(d.shoppingList)) saveSL(d.shoppingList)
        onClose()
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
            <span style={sans(11, 400, { color: account?.sync?.state === 'error' ? C.ember : C.ink80 })}>{account ? syncLabel(account.sync) : 'Profile & settings'}</span>
          </div>
        </button>
        <Item icon="user" label="Household profile" onClick={() => openSheet('profile')} />
        <Item icon="wallet" label="Budgets" meta={budget ? money(budget, 0) : undefined} onClick={() => openSheet('budgets')} />
        <Item icon="store" label="My stores" meta={(profile?.stores || []).length || undefined} onClick={() => openSheet('stores')} />
        <Item icon="leaf" label="Dietary preferences" onClick={() => openSheet('dietary')} />
        <Item icon="down" label="Export backup" divider onClick={() => { exportBackup(); onClose() }} />
        <Item icon="up" label="Import backup" onClick={() => fileRef.current?.click()} />
        <Item icon="trash" label="Clear data…" danger divider onClick={() => openSheet('clear')} />
        {account && <Item icon="user" label="Change password" divider onClick={() => openSheet('password')} />}
        {account && (
          <Item icon="signout" label="Sign out" meta={account.email ? account.email.split('@')[0] : undefined}
            onClick={() => openSheet('signOut')} />
        )}
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={onImport} style={{ display: 'none' }} />
      </div>
    </Overlay>
  )
}
