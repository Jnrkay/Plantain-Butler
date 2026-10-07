import { useState } from 'react'
import { X } from 'lucide-react'
import { T, monoLabel } from '../lib/theme'
import { inputStyle, btnStyle, iconBtn } from '../lib/styles'

export function TagInput({ tags, setTags, placeholder }) {
  const [input, setInput] = useState('')
  const addTag = () => {
    const v = input.trim()
    if (v && !tags.includes(v)) setTags([...tags, v])
    setInput('')
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: tags.length ? 8 : 0 }}>
        {tags.map(t => (
          <span key={t} style={{ background: T.teal, color: T.warm, borderRadius: 16, padding: '4px 10px 4px 12px', fontSize: 13, fontWeight: T.medium, display: 'flex', alignItems: 'center', gap: 6 }}>
            {t}
            <button onClick={() => setTags(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: T.warm, opacity: 0.6 }}>
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} placeholder={placeholder} style={inputStyle} />
        <button onClick={addTag} disabled={!input.trim()} style={{ ...btnStyle, padding: '10px 16px', opacity: input.trim() ? 1 : 0.4, flexShrink: 0 }}>Add</button>
      </div>
    </div>
  )
}

export function ModalWrapper({ onClose, title, children, mobile }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(18,38,35,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: mobile ? '20px 20px 0 0' : '20px', padding: mobile ? '20px 16px' : '24px', width: '100%', maxWidth: mobile ? '100%' : 620, maxHeight: mobile ? '90vh' : '85vh', overflow: 'auto', boxShadow: T.shadowLg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: T.semibold, color: T.text }}>{title}</h2>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Card({ title, children, span, style: extraStyle }) {
  return (
    <div style={{ background: T.surfaceCard, borderRadius: T.radiusLg, padding: 16, gridColumn: span ? `span ${span}` : undefined, border: `1px solid ${T.borderLight}`, ...extraStyle }}>
      {title && <h3 style={{ ...monoLabel, margin: '0 0 12px' }}>{title}</h3>}
      {children}
    </div>
  )
}

export function StatCard({ icon: Ic, label, value, sub, color, mobile }) {
  return (
    <div style={{ background: T.surfaceCard, borderRadius: T.radiusLg, padding: mobile ? 12 : 16, border: `1px solid ${T.borderLight}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ background: `${color}15`, borderRadius: 6, padding: mobile ? 5 : 8, flexShrink: 0, color }}><Ic size={mobile ? 14 : 18} /></div>
        <span style={{ ...monoLabel }}>{label}</span>
      </div>
      <div style={{ fontSize: mobile ? 18 : 22, fontWeight: T.semibold, color: T.text }}>{value}</div>
      <div style={{ fontSize: 10, color: T.textLight, marginTop: 2 }}>{sub}</div>
    </div>
  )
}

export function Empty({ text, message, msg, icon: Icon, children }) {
  const display = text || message || msg || children
  return (
    <div style={{ color: T.textLight, textAlign: 'center', padding: '32px 16px', fontSize: 13 }}>
      {Icon && <Icon size={32} style={{ marginBottom: 8, opacity: 0.5 }} />}
      <p style={{ margin: 0 }}>{display}</p>
    </div>
  )
}
