// Household & sharing: who's in this household, invite codes, joining and leaving.
import { useEffect, useState } from 'react'
import { C, TX, sans, mono } from '../lib/theme'
import { supabase } from '../lib/supabase'
import { Sheet, SheetHeader, Icon, Button, Field, TextInput, reset } from './ui'

const errText = (e) => e?.message || 'Something went wrong. Try again.'

export default function HouseholdSheet({ onClose, account, profile, markProgress }) {
  const [members, setMembers] = useState(null)
  const [invite, setInvite] = useState(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState(account?.name || '')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [confirm, setConfirm] = useState(null) // 'join' | 'leave' | {remove}

  const load = async () => {
    const { data, error } = await supabase.rpc('list_members')
    if (error) setMsg(errText(error)); else setMembers(data || [])
  }
  useEffect(() => { load() }, [])

  const me = members?.find((m) => m.is_me)
  const isOwner = me?.role === 'owner'
  const householdName = String(profile?.name || '').trim().split(/\s+/)[0]

  const ensureName = async () => {
    const n = name.trim()
    if (n && n !== account?.name) await supabase.auth.updateUser({ data: { name: n } })
  }

  const makeInvite = async () => {
    setBusy('invite'); setMsg('')
    const { data, error } = await supabase.rpc('create_invite')
    setBusy('')
    if (error) return setMsg(errText(error))
    setInvite(data)
    markProgress?.('invited')
  }
  const inviteText = invite && `Join my household on Plantain Butler so we share stock, spending and the shopping list.\n\n1. Open https://plantain-butler.vercel.app and sign in\n2. Menu → Household & sharing → Join\n3. Enter code: ${invite.code}\n\n(The code works once and expires in 7 days.)`
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Plantain Butler invite', text: inviteText })
      else { await navigator.clipboard.writeText(inviteText); setMsg('Invite copied — paste it in a message.') }
    } catch { /* cancelled */ }
  }

  const join = async () => {
    setBusy('join'); setMsg('')
    await ensureName()
    const { data, error } = await supabase.rpc('join_household', { p_code: code })
    setBusy(''); setConfirm(null)
    if (error) return setMsg(errText(error))
    if (data?.status === 'ok') { onClose(); account.switchHousehold(); return }
    setMsg({
      invalid: 'That code didn’t work. Check it, or ask for a new one — codes work once and expire after 7 days.',
      already: 'You’re already in that household.',
      limit: 'Too many attempts today. Try again tomorrow.',
    }[data?.status] || 'Couldn’t join. Try again.')
  }
  const leave = async () => {
    setBusy('leave'); setMsg('')
    const { data, error } = await supabase.rpc('leave_household')
    setBusy(''); setConfirm(null)
    if (error) return setMsg(errText(error))
    if (data?.status === 'ok') { onClose(); account.switchHousehold(); return }
    setMsg('You own this household, so you can’t leave it. You can remove other people instead.')
  }
  const remove = async (m) => {
    setBusy(m.user_id); setMsg('')
    const { data, error } = await supabase.rpc('remove_member', { p_user: m.user_id })
    setBusy(''); setConfirm(null)
    if (error || data?.status !== 'ok') return setMsg(errText(error) || 'Couldn’t remove them.')
    load()
  }

  if (confirm) {
    const c = confirm === 'join'
      ? { title: 'Switch households?', body: 'You’ll see and edit their stock, spending and shopping list. Everything you’ve entered so far stays saved in your own household — leave any time to go back to it.', label: 'Join household', go: join, danger: false }
      : confirm === 'leave'
        ? { title: 'Leave this household?', body: 'You’ll stop seeing its stock, spending and list, and go back to your own household. You can rejoin with a new code.', label: 'Leave', go: leave, danger: true }
        : { title: `Remove ${confirm.name || confirm.email}?`, body: 'They’ll lose access to this household straight away. Nothing they added is deleted.', label: 'Remove', go: () => remove(confirm), danger: true }
    return (
      <Sheet onClose={() => setConfirm(null)} label={c.title}>
        <SheetHeader title={c.title} onClose={() => setConfirm(null)} />
        <p style={sans(14, 400, { color: C.ink, lineHeight: '20px' })}>{c.body}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" onClick={() => setConfirm(null)} style={{ width: 112, flexShrink: 0 }}>Cancel</Button>
          <Button variant={c.danger ? 'ember' : 'amber'} onClick={c.go} disabled={!!busy} style={{ flex: 1 }}>{busy ? 'Working…' : c.label}</Button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet onClose={onClose} label="Household & sharing">
      <SheetHeader title="Household & sharing" subtitle={householdName ? `${householdName}’s household` : 'Your household'} onClose={onClose} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={TX.label}>PEOPLE</span>
        {!members && <span style={TX.small}>Loading…</span>}
        {members?.map((m) => (
          <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.row, padding: '12px 12px 12px 16px' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ ...sans(14, 500, { color: C.ink }), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name || m.email}{m.is_me ? ' (you)' : ''}</span>
              {m.name && <span style={{ ...TX.small, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</span>}
            </div>
            <span style={{ ...mono(9, 500, { letterSpacing: 0.54, color: m.role === 'owner' ? C.ink : C.ink80 }), background: m.role === 'owner' ? C.amber : 'transparent', border: m.role === 'owner' ? 'none' : `1px solid ${C.ink25}`, padding: '3px 6px' }}>
              {m.role.toUpperCase()}
            </span>
            {isOwner && !m.is_me && (
              <button aria-label={`Remove ${m.email}`} onClick={() => setConfirm(m)} style={{ ...reset, display: 'flex', padding: 4 }}><Icon name="x@16" /></button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={TX.label}>INVITE SOMEONE</span>
        {invite ? (
          <div style={{ background: C.teal, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ ...TX.label, color: C.blush80 }}>INVITE CODE</span>
            <span style={mono(36, 500, { letterSpacing: 6, color: C.amber })}>{invite.code}</span>
            <span style={sans(12, 400, { color: C.blush80, lineHeight: '17px' })}>Works once, for 7 days. They sign in, open Menu → Household & sharing, and enter it. They need an account first — you add them in Supabase.</span>
            <button onClick={share} style={{ ...reset, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: C.amber }}>
              <Icon name="up@18" /><span style={sans(13, 500, { color: C.ink })}>Share invite</span>
            </button>
          </div>
        ) : (
          <>
            <span style={sans(13, 400, { color: C.ink80, lineHeight: '18px' })}>Share stock, spending and the shopping list with your partner or family. Everyone sees changes as they happen.</span>
            <Button variant="ink" icon="plus@18" onClick={makeInvite} disabled={busy === 'invite'}>{busy === 'invite' ? 'Creating…' : 'Create invite code'}</Button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={TX.label}>JOIN SOMEONE ELSE’S HOUSEHOLD</span>
        {!account?.name && (
          <Field label="YOUR NAME"><TextInput value={name} onChange={setName} placeholder="So they know it’s you" /></Field>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <TextInput value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="6-letter code" autoComplete="off" />
          </div>
          <Button variant="outline" height={44} onClick={() => setConfirm('join')} disabled={code.replace(/[^A-Za-z0-9]/g, '').length < 6}>Join</Button>
        </div>
      </div>

      {msg && <div style={{ background: C.blush, padding: 12 }}><span style={sans(13, 400, { color: C.ink, lineHeight: '18px' })}>{msg}</span></div>}

      {me && !isOwner && (
        <Button variant="danger" icon="signout@18" onClick={() => setConfirm('leave')}>Leave this household</Button>
      )}
    </Sheet>
  )
}
