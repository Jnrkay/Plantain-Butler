import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// iOS Safari only applies :active (our press feedback) when a touch listener exists
document.addEventListener('touchstart', () => {}, { passive: true })

// The part of the screen you can actually see. When the iOS keyboard opens it shrinks and
// pans the screen; sheets and the status-bar strip follow it instead of sliding under the bar.
const vv = window.visualViewport
const syncViewport = () => {
  const r = document.documentElement.style
  r.setProperty('--vvh', `${vv ? vv.height : window.innerHeight}px`)
  document.documentElement.classList.toggle('pb-keyboard', !!vv && window.innerHeight - vv.height > 120)
}
// If iOS still scrolls the (pinned) page while a sheet is open, put it straight back
const keepPinned = () => {
  syncViewport()
  if (document.documentElement.classList.contains('pb-locked') && window.scrollY !== 0) window.scrollTo(0, 0)
}
vv?.addEventListener('resize', keepPinned)
vv?.addEventListener('scroll', keepPinned)
window.addEventListener('scroll', () => { if (document.documentElement.classList.contains('pb-locked') && window.scrollY !== 0) window.scrollTo(0, 0) }, { passive: true })
window.addEventListener('resize', syncViewport)
syncViewport()

// Once the keyboard has settled, keep the field you're typing in visible inside its sheet
document.addEventListener('focusin', (e) => {
  const el = e.target
  if (!(el instanceof HTMLElement) || !el.matches('input, textarea, select') || !el.closest('[role="dialog"]')) return
  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320)
})

// Show the soft fade under the status bar only once the page has scrolled
let ticking = false
window.addEventListener('scroll', () => {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => { document.documentElement.classList.toggle('pb-scrolled', window.scrollY > 4); ticking = false })
}, { passive: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
