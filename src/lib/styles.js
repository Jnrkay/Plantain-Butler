import { T } from './theme'

export const inputStyle = {
  background: '#fff', border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
  padding: '10px 14px', color: T.text, fontSize: 13, outline: 'none',
  fontFamily: T.fontSans, width: '100%', boxSizing: 'border-box',
}

export const inputSm = { ...inputStyle, padding: '7px 10px', fontSize: 12 }

export const labelStyle = {
  display: 'block', fontSize: 11, color: T.textLight, marginBottom: 3, fontWeight: T.semibold,
  fontFamily: T.fontMono, letterSpacing: '0.4px', textTransform: 'uppercase',
}

export const btnStyle = {
  border: 'none', borderRadius: T.radiusSm, padding: '10px 20px', fontSize: 13,
  cursor: 'pointer', fontWeight: T.semibold, fontFamily: T.fontSans,
  background: T.surfaceCard, color: T.text, boxShadow: T.shadowSm,
}

export const btnPrimary = { ...btnStyle, background: T.accent, color: T.accentText }

export const chipStyle = {
  border: 'none', borderRadius: 20, padding: '8px 14px', fontSize: 13,
  cursor: 'pointer', fontFamily: T.fontSans, fontWeight: T.medium,
}

export const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
  display: 'flex', alignItems: 'center', flexShrink: 0, color: T.textMuted,
}

export const tooltipS = {
  background: T.surfaceDeep, border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
  color: T.warm, fontSize: 12,
}
