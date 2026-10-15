// Shown once, when this device holds data from before sign-in and the account already has data.
import { useState } from 'react'
import { C, TX, sans } from '../lib/theme'
import { Tag, Button, Checkbox } from './ui'
import { exportBackup } from './OverflowMenu'

export default function LinkData({ local, onMerge, onDiscard }) {
  const [confirming, setConfirming] = useState(false)
  const [backup, setBackup] = useState(true)
  const rows = [
    ['Stock items', local.inventory.length],
    ['Purchases', local.transactions.length],
    ['Shopping list', local.shoppingList.length],
  ].filter(([, n]) => n > 0)

  return (
    <div style={{ minHeight: '100dvh', background: C.cream, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 24, padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
        <Tag>PLANTAIN BUTLER</Tag>
        <h1 style={TX.title}>This phone has data from before you signed in</h1>
        <p style={sans(14, 400, { lineHeight: '20px', color: C.ink70 })}>
          Your account already has data from another device. Add this phone’s data to your account, or discard it and use what’s in your account.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(([k, n]) => (
            <div key={k} style={{ background: C.row, padding: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={sans(15, 500, { color: C.ink })}>{k}</span>
              <span style={TX.label}>{n} ON THIS PHONE</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {confirming ? (
          <div style={{ background: C.white, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={sans(22, 500, { letterSpacing: -0.44, color: C.ink })}>Discard this phone’s data?</span>
            <div onClick={() => setBackup(!backup)} style={{ background: C.row, padding: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <Checkbox size={20} checked={backup} label="Export a backup first" onClick={(e) => { e.stopPropagation(); setBackup(!backup) }} />
              <span style={sans(13, 400, { color: C.ink })}>Export a backup first</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" height={48} onClick={() => setConfirming(false)} style={{ flex: 1 }}>Cancel</Button>
              <Button variant="ember" height={48} onClick={() => { if (backup) exportBackup(local); onDiscard() }} style={{ flex: 1 }}>Discard</Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button icon="check@16" onClick={onMerge}>Add it to my account</Button>
            <Button variant="outline" onClick={() => setConfirming(true)}>Discard it</Button>
          </div>
        )}
      </div>
    </div>
  )
}
