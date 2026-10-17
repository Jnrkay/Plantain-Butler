import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// iOS Safari only applies :active (our press feedback) when a touch listener exists
document.addEventListener('touchstart', () => {}, { passive: true })

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
