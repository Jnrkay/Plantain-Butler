import { useState } from 'react'
import { X } from 'lucide-react'
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
          <span key={t} style={{ background: '#06b6d4', color: '#0f1117', borderRadius: 16, padding: '4px 10px 4px 12px', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            {t}
            <button onClick={() => setTags(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#0f1117', opacity: 0.6 }}>
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} placeholder={placeholder} style={inputStyle} />
        <button onClick={addTag} disabled={!input.trim()} style={{ ...btnStyle, background: '#1e2030', color: '#94a3b8', padding: '10px 16px', opacity: input.trim() ? 1 : 0.4, flexShrink: 0 }}>Add</button>
      </div>
    </div>
  )
}

export function ModalWrapper({ onClose, title, children, mobile }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#161822', borderRadius: mobile ? '16px 16px 0 0' : '16px', padding: mobile ? '20px 16px' : '24px', width: '100%', maxWidth: mobile ? '100%' : 620, maxHeight: mobile ? '90vh' : '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{title}</h2>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Card({ title, children, span }) {
  return (
    <div style={{ background: '#161822', borderRadius: 12, padding: 16, gridColumn: span ? `span ${span}` : undefined }}>
      {title && <h3 style={{ margin: '0 0 12px', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{title}</h3>}
      {children}
    </div>
  )
}

export function StatCard({ icon: Ic, label, value, sub, color, mobile }) {
  return (
    <div style={{ background: '#161822', borderRadius: 12, padding: mobile ? 12 : 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ background: `${color}15`, borderRadius: 6, padding: mobile ? 5 : 8, flexShrink: 0, color }}><Ic size={mobile ? 14 : 18} /></div>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
      </div>
      <div style={{ fontSize: mobile ? 18 : 22, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{sub}</div>
    </div>
  )
}

export function Empty({ text, message, msg, icon: Icon, children }) {
  const display = text || message || msg || children
  return (
    <div style={{ color: '#64748b', textAlign: 'center', padding: '32px 16px', fontSize: 13 }}>
      {Icon && <Icon size={32} style={{ marginBottom: 8, opacity: 0.5 }} />}
      <p style={{ margin: 0 }}>{display}</p>
    </div>
  )
}
