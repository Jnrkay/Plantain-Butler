// Sign-in: email → 6-digit code (or tap the link in the email). Accounts are invite-only.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, TX, sans, mono } from '../lib/theme'
import { Tag, Field, TextInput, Button, reset } from './ui'

const friendly = (e) => {
  const m = String(e?.message || e || '')
  if (/signups not allowed|user not found|not allowed for otp/i.test(m)) return "That email hasn't been invited. Ask the household owner to invite you."
  if (/rate limit|too many|seconds/i.test(m)) return 'Too many attempts. Wait a minute, then try again.'
  if (/expired|invalid|not found|otp/i.test(m)) return 'That link or code has expired or was already used. Send a new link and use the newest email.'
  if (/fetch|network/i.test(m)) return "Can't reach the server. Check your connection."
  return m || 'Something went wrong. Try again.'
}

function Shell({ step, title, children }) {
  return (
    <div style={{ minHeight: '100dvh', background: C.cream, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 24, padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tag>PLANTAIN BUTLER</Tag>
          <span style={TX.label}>SIGN IN · {step} / 02</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2].map((i) => <div key={i} style={{ flex: 1, height: 3, background: i <= step ? C.ink : C.ink15 }} />)}
        </div>
        <h1 style={TX.title}>{title}</h1>
        {children}
      </div>
    </div>
  )
}

export default function SignIn() {
  const [email, setEmail] = useState(() => { try { return localStorage.getItem('pb-last-email') || '' } catch { return '' } })
  const [step, setStep] = useState(1)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!cooldown) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const valid = /^\S+@\S+\.\S+$/.test(email.trim())

  const send = async () => {
    if (!valid || busy) return
    setBusy(true); setError('')
    const { error: e } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (e) { setError(friendly(e)); return }
    try { localStorage.setItem('pb-last-email', email.trim()) } catch { /* ignore */ }
    setStep(2); setCode(''); setCooldown(60)
  }

  // Accepts the 6-digit code, the sign-in link copied from the email, or the
  // address the link opened (…#access_token=…). Works even when the link would
  // otherwise open in a different browser than the installed app.
  const input = code.trim()
  const isLink = /^https?:\/\//i.test(input)
  const ready = isLink || input.replace(/\D/g, '').length >= 6

  const verify = async () => {
    if (!ready || busy) return
    setBusy(true); setError('')
    let e = null
    try {
      if (isLink) {
        const url = new URL(input)
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
        const q = url.searchParams
        if (hash.get('access_token') && hash.get('refresh_token')) {
          ;({ error: e } = await supabase.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') }))
        } else {
          const tokenHash = q.get('token_hash') || q.get('token')
          if (!tokenHash) throw new Error("That link doesn't look like a sign-in link. Copy the Sign in link from the newest email.")
          const linkType = q.get('type') || 'magiclink'
          ;({ error: e } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: linkType }))
          if (e && linkType === 'magiclink') ({ error: e } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' }))
        }
      } else {
        ;({ error: e } = await supabase.auth.verifyOtp({ email: email.trim(), token: input.replace(/\D/g, ''), type: 'email' }))
      }
    } catch (err) { e = err }
    setBusy(false)
    if (e) setError(friendly(e))
    // On success the auth listener in the store takes over.
  }

  const pasteFromClipboard = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) setCode(t.trim()) } catch { /* permission denied — user can paste manually */ }
  }

  if (step === 1) {
    return (
      <Shell step={1} title="Sign in to your household">
        <p style={sans(14, 400, { lineHeight: '20px', color: C.ink70 })}>
          Plantain Butler is invite-only. Enter the email address you were invited with and we’ll email you a sign-in link.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); send() }} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <Field label="EMAIL">
            <TextInput type="email" inputMode="email" value={email} onChange={setEmail} placeholder="you@example.com" autoFocus={!email} />
          </Field>
          {error && <div style={{ background: C.ember, padding: 12 }}><span style={sans(13, 500, { color: C.white })}>{error}</span></div>}
          <div style={{ flex: 1 }} />
          <Button type="submit" disabled={!valid || busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</Button>
        </form>
      </Shell>
    )
  }

  return (
    <Shell step={2} title="Check your email">
      <p style={sans(14, 400, { lineHeight: '20px', color: C.ink70 })}>
        We emailed a sign-in link to <span style={{ color: C.ink, fontWeight: 500 }}>{email.trim()}</span>.
      </p>
      <div style={{ background: C.row, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={TX.label}>ON THIS PHONE</span>
        <p style={sans(13, 400, { lineHeight: '19px', color: C.ink })}>
          In the email, <strong style={{ fontWeight: 500 }}>press and hold “Sign in”</strong>, choose <strong style={{ fontWeight: 500 }}>Copy Link</strong>, then paste it below. Tapping the link works too if you use the app in your browser.
        </p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); verify() }} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        <Field label="SIGN-IN LINK OR CODE">
          <div className="pb-input" style={{ height: 52, display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 0 14px', background: C.field, border: `1px solid ${C.ink18}` }}>
            <input
              value={code} onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code" autoCapitalize="off" autoCorrect="off" spellCheck={false}
              placeholder="Paste the link from the email" aria-label="Sign-in link or code"
              style={{ ...(isLink ? mono(12, 400, { color: C.ink }) : sans(15, 400, { color: C.ink, letterSpacing: input && !isLink ? 4 : 0 })), flex: 1, minWidth: 0, height: '100%', textOverflow: 'ellipsis' }}
            />
            {typeof navigator !== 'undefined' && navigator.clipboard?.readText && (
              <button type="button" onClick={pasteFromClipboard}
                style={{ ...reset, height: 40, padding: '0 14px', background: C.ink, flexShrink: 0 }}>
                <span style={sans(13, 500, { color: C.cream })}>Paste</span>
              </button>
            )}
          </div>
        </Field>
        {error && <div style={{ background: C.ember, padding: 12 }}><span style={sans(13, 500, { color: C.white })}>{error}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <button type="button" onClick={() => { setStep(1); setError('') }} style={{ ...reset, ...sans(13, 500, { color: C.ink80, textDecoration: 'underline', textUnderlineOffset: 3 }) }}>
            Use a different email
          </button>
          <button type="button" disabled={cooldown > 0 || busy} onClick={send}
            style={{ ...reset, ...sans(13, 500, { color: cooldown ? C.ink45 : C.ink80, textDecoration: cooldown ? 'none' : 'underline', textUnderlineOffset: 3 }) }}>
            {cooldown ? `Resend in ${cooldown}s` : 'Send a new link'}
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <Button type="submit" icon="check@16" disabled={!ready || busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </Shell>
  )
}
