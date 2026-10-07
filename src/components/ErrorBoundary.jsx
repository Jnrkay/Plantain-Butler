import React from 'react'
import { T } from '../lib/theme'

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
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '60vh', padding: 32,
          background: T.surface, fontFamily: T.fontSans, textAlign: 'center',
        }}>
          <div style={{
            background: T.surfaceCard, border: `1px solid ${T.borderLight}`,
            borderRadius: T.radiusMd, padding: 32, maxWidth: 420, width: '100%',
            boxShadow: T.shadowMd,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🍌</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, color: T.text, fontWeight: T.semibold }}>Something went wrong</h2>
            <p style={{ color: T.textMuted, fontSize: 14, margin: '0 0 20px', fontFamily: T.fontSans }}>
              Plantain Butler hit a snag. Your data is safe in local storage.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              style={{
                background: T.amber, color: T.accentText, border: 'none',
                borderRadius: T.radiusMd, padding: '10px 24px', fontSize: 14,
                fontWeight: T.semibold, cursor: 'pointer', fontFamily: T.fontSans,
              }}
            >
              Reload App
            </button>
            <details style={{ marginTop: 20, color: T.textLight, fontSize: 12, maxWidth: 400, textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer' }}>Error details</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8, color: T.error, fontFamily: T.fontMono, fontSize: 11 }}>
                {this.state.error?.toString()}
              </pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
