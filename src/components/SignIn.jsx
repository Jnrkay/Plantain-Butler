// Sign-in: email → 6-digit code (or tap the link in the email). Accounts are invite-only.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, TX, sans, mono } from '../lib/theme'
import { Tag, Field, TextInput, Button, reset } from './ui'

const friendly = (e) => {
  const m = String(e?.message || e || '')
  if (/signups not allowed|user not found|not allowed for otp/i.test(m)) return "That email hasn't been invited. Ask the household owner to invite you."
  if (/rate limit|too many|seconds/i.test(m)) return 'Too many attempts. Wait a minute, then try again.'
  if (/expired|invalid/i.test(m)) return 'That code is wrong or has expired. Check the latest email, or send a new code.'
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

  const verify = async () => {
    const token = code.replace(/\D/g, '')
    if (token.length < 6 || busy) return
    setBusy(true); setError('')
    const { error: e } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' })
    setBusy(false)
    if (e) setError(friendly(e))
    // On success the auth listener in the store takes over.
  }

  if (step === 1) {
    return (
      <Shell step={1} title="Sign in to your household">
        <p style={sans(14, 400, { lineHeight: '20px', color: C.ink70 })}>
          Plantain Butler is invite-only. Enter the email address you were invited with and we’ll send you a sign-in code.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); send() }} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <Field label="EMAIL">
            <TextInput type="email" inputMode="email" value={email} onChange={setEmail} placeholder="you@example.com" autoFocus={!email} />
          </Field>
          {error && <div style={{ background: C.ember, padding: 12 }}><span style={sans(13, 500, { color: C.white })}>{error}</span></div>}
          <div style={{ flex: 1 }} />
          <Button type="submit" disabled={!valid || busy}>{busy ? 'Sending…' : 'Email me a code'}</Button>
        </form>
      </Shell>
    )
  }

  return (
    <Shell step={2} title="Check your email">
      <p style={sans(14, 400, { lineHeight: '20px', color: C.ink70 })}>
        We sent a code to <span style={{ color: C.ink, fontWeight: 500 }}>{email.trim()}</span>. Enter it below, or tap the link in the email on this device.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); verify() }} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        <Field label="SIGN-IN CODE">
          <div className="pb-input" style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 16px', background: C.field, border: `1px solid ${C.ink18}` }}>
            <input
              value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
              inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" autoFocus aria-label="Sign-in code"
              style={{ ...mono(24, 500, { letterSpacing: 8, color: C.ink }), flex: 1, minWidth: 0, height: '100%' }}
            />
          </div>
        </Field>
        {error && <div style={{ background: C.ember, padding: 12 }}><span style={sans(13, 500, { color: C.white })}>{error}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <button type="button" onClick={() => { setStep(1); setError('') }} style={{ ...reset, ...sans(13, 500, { color: C.ink80, textDecoration: 'underline', textUnderlineOffset: 3 }) }}>
            Use a different email
          </button>
          <button type="button" disabled={cooldown > 0 || busy} onClick={send}
            style={{ ...reset, ...sans(13, 500, { color: cooldown ? C.ink45 : C.ink80, textDecoration: cooldown ? 'none' : 'underline', textUnderlineOffset: 3 }) }}>
            {cooldown ? `Resend in ${cooldown}s` : 'Send a new code'}
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <Button type="submit" icon="check@16" disabled={code.length < 6 || busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </Shell>
  )
}
