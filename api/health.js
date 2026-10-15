// Setup check. Reports only whether configuration is present (true/false) and
// Supabase's public auth settings — never any key or secret value.
const pick = (...names) => names.find((n) => process.env[n])

export default async function handler(req, res) {
  const urlVar = pick('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL')
  const anonVar = pick('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY')
  const secretVar = pick('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')

  const out = {
    anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    supabase: { urlVar: urlVar || null, publicKeyVar: anonVar || null, secretKeyVar: secretVar || null },
    supabaseVarsPresent: Object.keys(process.env).filter((k) => /SUPABASE|POSTGRES/i.test(k)).sort(),
  }

  if (urlVar && anonVar) {
    try {
      const base = process.env[urlVar].replace(/\/$/, '')
      const r = await fetch(`${base}/auth/v1/settings`, { headers: { apikey: process.env[anonVar] } })
      const s = await r.json()
      out.auth = {
        reachable: r.ok,
        emailEnabled: s?.external?.email ?? null,
        signupsDisabled: s?.disable_signup ?? null,
        autoConfirm: s?.mailer_autoconfirm ?? null,
        otherProviders: Object.entries(s?.external || {}).filter(([k, v]) => v && k !== 'email').map(([k]) => k),
      }
      if (secretVar) {
        const u = await fetch(`${base}/auth/v1/admin/users?per_page=50`, {
          headers: { apikey: process.env[secretVar], Authorization: `Bearer ${process.env[secretVar]}` },
        })
        const j = await u.json().catch(() => ({}))
        out.auth.users = Array.isArray(j?.users) ? j.users.length : null
        out.auth.usersInvitedNotYetSignedIn = Array.isArray(j?.users) ? j.users.filter((x) => !x.last_sign_in_at).length : null
      }
    } catch (e) {
      out.auth = { reachable: false, error: String(e.message || e).slice(0, 120) }
    }
  }

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json(out)
}
