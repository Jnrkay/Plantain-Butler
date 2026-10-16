// Pull down from the top of a page to sync with the account.
import { useEffect, useRef, useState } from 'react'
import { C, mono } from '../lib/theme'

const READY = 55       // px the indicator must travel (after resistance) to trigger a sync
const MAX = 110

export default function PullToRefresh({ onRefresh, disabled }) {
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const start = useRef(null)
  const pullRef = useRef(0)
  const busyRef = useRef(false)

  useEffect(() => {
    if (disabled) return
    const set = (v) => { pullRef.current = v; setPull(v) }
    const onStart = (e) => {
      if (busyRef.current || window.scrollY > 0 || e.touches.length !== 1) { start.current = null; return }
      start.current = { y: e.touches[0].clientY, x: e.touches[0].clientX, active: false }
    }
    const onMove = (e) => {
      const s = start.current
      if (!s) return
      const dy = e.touches[0].clientY - s.y
      const dx = e.touches[0].clientX - s.x
      if (!s.active) {
        if (dy < 8 || Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) { if (dy < 0 || Math.abs(dx) > 8) start.current = null; return }
        s.active = true
      }
      if (e.cancelable) e.preventDefault()
      set(Math.min(MAX, (dy - 8) * 0.5))
    }
    const onEnd = async () => {
      const s = start.current
      start.current = null
      if (!s?.active) return
      if (pullRef.current >= READY) {
        busyRef.current = true; setBusy(true); set(48)
        const t0 = Date.now()
        try { await onRefresh() } catch { /* sync status shows any problem */ }
        await new Promise((r) => setTimeout(r, Math.max(0, 500 - (Date.now() - t0))))
        busyRef.current = false; setBusy(false)
      }
      set(0)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [disabled, onRefresh])

  if (!pull && !busy) return null
  const ready = pull >= READY
  const label = busy ? 'SYNCING…' : ready ? 'RELEASE TO SYNC' : 'PULL TO SYNC'
  return (
    <div aria-live="polite" style={{
      position: 'fixed', zIndex: 60, left: '50%', top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
      transform: `translate(-50%, ${Math.max(0, pull - 40)}px)`, opacity: Math.min(1, pull / 40),
      transition: start.current ? 'none' : 'transform .2s ease, opacity .2s ease',
      display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 14px',
      background: ready || busy ? C.ink : C.white, border: `1px solid ${C.ink15}`, borderRadius: 16,
      pointerEvents: 'none',
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
        style={{ transform: busy ? undefined : `rotate(${pull * 3}deg)`, animation: busy ? 'pb-spin .8s linear infinite' : 'none' }}>
        <path d="M12 7a5 5 0 1 1-1.46-3.54M12 2v3h-3" stroke={ready || busy ? C.amber : C.ink} strokeWidth="1.5" strokeLinecap="square" />
      </svg>
      <span style={mono(10, 500, { color: ready || busy ? C.cream : C.ink, letterSpacing: 0.6 })}>{label}</span>
    </div>
  )
}
