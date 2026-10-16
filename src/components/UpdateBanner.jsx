// Tells you when a newer version of the app has been deployed.
import { useEffect, useState } from 'react'
import { C, sans } from '../lib/theme'
import { reset } from './ui'

const scriptOf = (html) => (html.match(/\/assets\/index-[\w-]+\.js/) || [])[0] || null
const current = () => {
  const el = [...document.querySelectorAll('script[src]')].find((s) => /\/assets\/index-[\w-]+\.js/.test(s.getAttribute('src')))
  return el ? scriptOf(el.getAttribute('src')) : null
}

export default function UpdateBanner() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const mine = current()
    if (!mine) return // dev server — nothing to compare
    let stopped = false
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible' || navigator.onLine === false) return
      try {
        const res = await fetch('/index.html', { cache: 'no-store' })
        if (!res.ok) return
        const latest = scriptOf(await res.text())
        if (latest && latest !== mine) setReady(true)
      } catch { /* offline — try later */ }
    }
    const t = setInterval(check, 30 * 60 * 1000)
    document.addEventListener('visibilitychange', check)
    const first = setTimeout(check, 5000)
    return () => { stopped = true; clearInterval(t); clearTimeout(first); document.removeEventListener('visibilitychange', check) }
  }, [])

  if (!ready) return null
  return (
    <div role="status" style={{
      position: 'fixed', zIndex: 49, left: '50%', transform: 'translateX(-50%)',
      bottom: 'calc(max(20px, calc(env(safe-area-inset-bottom, 0px) - 6px)) + 68px)',
      width: 'calc(min(100vw, 480px) - 40px)', background: C.ink, borderRadius: 16,
      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 8px 8px 16px', animation: 'pb-fade-in .2s ease',
    }}>
      <span style={{ ...sans(13, 400, { color: C.cream }), flex: 1 }}>A new version is ready.</span>
      <button onClick={() => window.location.reload()}
        style={{ ...reset, ...sans(13, 500, { color: C.ink }), background: C.amber, borderRadius: 12, height: 32, padding: '0 14px' }}>
        Refresh
      </button>
      <button aria-label="Later" onClick={() => setReady(false)}
        style={{ ...reset, ...sans(13, 400, { color: C.cream }), opacity: 0.7, height: 32, padding: '0 8px' }}>
        Later
      </button>
    </div>
  )
}
