// Diagnostics for testers: live screen measurements as iOS reports them.
// Turn on from Menu → Display check, reproduce a glitch, screenshot, send.
import { useEffect, useState } from 'react'
import { C, mono } from '../lib/theme'

const probe = (prop) => {
  const el = document.createElement('div')
  el.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;padding-top:env(${prop},0px)`
  document.body.appendChild(el)
  const v = parseFloat(getComputedStyle(el).paddingTop) || 0
  el.remove()
  return v
}

export default function DisplayCheck({ onClose }) {
  const [m, setM] = useState({})
  useEffect(() => {
    let raf
    const read = () => {
      const vv = window.visualViewport
      const strip = document.querySelector('.pb-statusbar')?.getBoundingClientRect()
      const dlg = document.querySelector('[role="dialog"] > div:last-child')?.getBoundingClientRect()
      setM({
        mode: window.matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'home screen' : 'browser',
        ios: (navigator.userAgent.match(/OS (\d+)_(\d+)/) || []).slice(1).join('.') || '—',
        inner: `${window.innerWidth}×${window.innerHeight}`,
        vv: vv ? `${Math.round(vv.width)}×${Math.round(vv.height)} @${Math.round(vv.offsetTop)} (page ${Math.round(vv.pageTop)})` : '—',
        scrollY: Math.round(window.scrollY),
        safe: `${probe('safe-area-inset-top')} / ${probe('safe-area-inset-bottom')}`,
        strip: strip ? `${Math.round(strip.top)}→${Math.round(strip.bottom)}` : '—',
        sheet: dlg ? `${Math.round(dlg.top)}→${Math.round(dlg.bottom)}` : 'closed',
        flags: ['pb-locked', 'pb-dim', 'pb-keyboard'].filter((c) => document.documentElement.classList.contains(c)).join(' ') || '—',
        focus: document.activeElement?.tagName?.toLowerCase() || '—',
      })
      raf = requestAnimationFrame(read)
    }
    raf = requestAnimationFrame(read)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div style={{ position: 'fixed', zIndex: 2000, left: 12, top: '34%', background: 'rgba(18,38,35,.92)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3, pointerEvents: 'auto', maxWidth: 'calc(100vw - 24px)' }}>
      {Object.entries(m).map(([k, v]) => (
        <span key={k} style={mono(10, 400, { color: k === 'sheet' || k === 'vv' ? C.amber : C.cream, whiteSpace: 'nowrap' })}>{k.padEnd(7, ' ')} {String(v)}</span>
      ))}
      <button onClick={onClose} style={{ marginTop: 4, alignSelf: 'flex-start', background: C.amber, border: 'none', padding: '4px 8px', ...mono(10, 500, { color: C.ink }) }}>CLOSE</button>
    </div>
  )
}
