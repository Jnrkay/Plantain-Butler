// Sign-in: email + password (works everywhere, no email needed), or an emailed
// sign-in link as a fallback. Accounts are invite-only.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabaseConfig'
import { C, TX, sans, mono } from '../lib/theme'
import { Tag, Field, TextInput, Button, reset } from './ui'

const friendly = (e) => {
  const m = String(e?.message || e || '')
  if (/signups not allowed|user not found|not allowed for otp/i.test(m)) return "That email hasn't been invited. Ask the household owner to invite you."
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.'
  if (/email rate limit|over_email_send_rate_limit/i.test(m)) return 'Too many sign-in emails for now — Supabase only sends a few an hour. Sign in with your password, or try the link again in about an hour.'
  if (/security purposes|after \d+ seconds/i.test(m)) return 'Wait a minute before asking for another link.'
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a few minutes, then try again.'
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

// Google's standard "G" mark, as their sign-in branding guidelines ask for
const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden style={{ flexShrink: 0 }}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
)

export default function SignIn() {

  const [email, setEmail] = useState(() => { try { return localStorage.getItem('pb-last-email') || '' } catch { return '' } })
  const [step, setStep] = useState(1)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [googleOn, setGoogleOn] = useState(false)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  const signInWithPassword = async () => {
    if (!valid || !password || busy) return
    setBusy(true); setError('')
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (e) { setError(friendly(e)); return }
    try { localStorage.setItem('pb-last-email', email.trim()) } catch { /* ignore */ }
  }

  useEffect(() => {
    // Show the Google button only once Google is enabled in Supabase
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } })
      .then((r) => r.json()).then((st) => setGoogleOn(!!st?.external?.google)).catch(() => {})
  }, [])

  const google = async () => {
    setError('')
    const { error: e } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (e) setError(friendly(e))
  }

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
          {googleOn
            ? 'Plantain Butler is invite-only. Continue with the Google account you were invited with, or sign in with your email.'
            : 'Plantain Butler is invite-only. Sign in with the email you were invited with.'}
        </p>
        {googleOn && (
          <>
            <button onClick={google} style={{ ...reset, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: C.white, border: `1px solid ${C.ink30}` }}>
              <GoogleG />
              <span style={sans(15, 500, { color: C.ink })}>Continue with Google</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: C.ink15 }} />
              <span style={TX.label}>OR USE EMAIL</span>
              <div style={{ flex: 1, height: 1, background: C.ink15 }} />
            </div>
          </>
        )}
        <form onSubmit={(e) => { e.preventDefault(); password ? signInWithPassword() : send() }} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <Field label="EMAIL">
            <TextInput type="email" inputMode="email" autoComplete="username" value={email} onChange={setEmail} placeholder="you@example.com" autoFocus={!email} />
          </Field>
          <Field label="PASSWORD">
            <TextInput type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={setPassword} placeholder="Your password" autoFocus={!!email}>
              {password && (
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ ...reset, ...sans(12, 500, { color: C.ink80 }), padding: '4px 0 4px 8px' }}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              )}
            </TextInput>
          </Field>
          {error && <div style={{ background: C.ember, padding: 12 }}><span style={sans(13, 500, { color: C.white })}>{error}</span></div>}
          <div style={{ flex: 1 }} />
          <Button type="submit" icon={password ? 'check@16' : undefined} disabled={!valid || busy}>
            {busy ? (password ? 'Signing in…' : 'Sending…') : password ? 'Sign in' : 'Email me a sign-in link'}
          </Button>
          {password ? (
            <button type="button" disabled={!valid || busy || cooldown > 0} onClick={send}
              style={{ ...reset, alignSelf: 'center', ...sans(13, 500, { color: C.ink80, textDecoration: 'underline', textUnderlineOffset: 3 }) }}>
              Forgot it? Email me a sign-in link instead
            </button>
          ) : (
            <span style={{ ...sans(12, 400, { color: C.ink70 }), textAlign: 'center' }}>No password? Leave it blank and we’ll email you a link.</span>
          )}
          <button type="button" disabled={!valid} onClick={() => { setError(''); setCode(''); setStep(2) }}
            style={{ ...reset, alignSelf: 'center', ...sans(13, 500, { color: valid ? C.ink80 : C.ink45, textDecoration: 'underline', textUnderlineOffset: 3 }) }}>
            I already have a sign-in link or code
          </button>
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
