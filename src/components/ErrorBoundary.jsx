import React from 'react'
import { C, TX, sans, mono } from '../lib/theme'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ minHeight: '100dvh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: C.white, padding: 20, maxWidth: 330, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={sans(22, 500, { letterSpacing: -0.44, color: C.ink })}>Something went wrong</span>
          <p style={sans(14, 400, { lineHeight: '20px', color: C.ink70 })}>Plantain Butler hit a snag. Your data is safe on this device.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ height: 48, background: C.amber, border: 'none', cursor: 'pointer', ...sans(15, 500, { color: C.ink }) }}
          >
            Reload
          </button>
          <details>
            <summary style={{ ...TX.label, cursor: 'pointer' }}>ERROR DETAILS</summary>
            <pre style={{ ...mono(11), whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8, color: C.ember }}>{this.state.error?.toString()}</pre>
          </details>
        </div>
      </div>
    )
  }
}
