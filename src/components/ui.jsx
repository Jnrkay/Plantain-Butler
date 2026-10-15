// Shared building blocks for the Sea Glass & Ember design.
// Measurements map 1:1 to the Figma nodes named in the comments.
import { useEffect } from 'react'
import { C, F, TX, sans, mono } from '../lib/theme'
import { ICONS } from '../lib/icons'

export const reset = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'inherit' }
const center = { display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

/* ---------- Icon ---------- */
export function Icon({ name, color = C.ink, style }) {
  const svg = ICONS[name]
  if (!svg) return null
  const size = Number(name.split('@')[1])
  return (
    <span
      aria-hidden
      style={{ display: 'inline-flex', width: size, height: size, flexShrink: 0, color, ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/* ---------- Header: Avatar + menu button (23:5550) ---------- */
export function Avatar({ text, size = 36 }) {
  return (
    <div style={{ ...center, width: size, height: size, background: C.teal }}>
      <span style={mono(11, 500, { color: C.blush })}>{text}</span>
    </div>
  )
}

export function Header({ initials, onMenu, menuOpen }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px' }}>
      <Avatar text={initials} />
      <button
        aria-label="Menu"
        onClick={onMenu}
        style={{ ...reset, ...center, width: 36, height: 36, border: `1px solid ${menuOpen ? C.ink : 'transparent'}` }}
      >
        <Icon name="dots@22" />
      </button>
    </div>
  )
}

/* ---------- Title row (23:5746) ---------- */
export function TitleRow({ title, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', gap: 12 }}>
      <h1 style={{ ...TX.title, whiteSpace: 'nowrap' }}>{title}</h1>
      {children}
    </div>
  )
}

export function AddButton({ onClick, label = 'Add' }) {
  return (
    <button aria-label={label} onClick={onClick} style={{ ...reset, ...center, width: 48, height: 48, background: C.amber }}>
      <Icon name="plus@22" />
    </button>
  )
}

/* ---------- Tag (23:5562) ---------- */
export function Tag({ children, style }) {
  return (
    <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: C.teal, padding: '4px 8px', ...style }}>
      <span style={mono(10, 500, { color: C.blush, letterSpacing: 0.8, whiteSpace: 'nowrap' })}>{children}</span>
    </div>
  )
}

/* ---------- Money: last digit muted, as in every amount in the file ---------- */
export function Money({ value, size, tracking = 0, color = C.ink, muted = C.ink55, style }) {
  const s = typeof value === 'string' ? value : Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <span style={sans(size, 300, { letterSpacing: tracking, whiteSpace: 'nowrap', color, ...style })}>
      {s.slice(0, -1)}
      <span style={{ color: muted }}>{s.slice(-1)}</span>
    </span>
  )
}

/* ---------- Chips (23:5762) ---------- */
export function Chip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...reset, display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', flexShrink: 0,
        background: active ? C.ink : 'transparent',
        border: `1px solid ${active ? C.ink : C.ink22}`,
        // keep chip height identical whether bordered or filled
        margin: 0,
      }}
    >
      <span style={sans(13, 500, { color: active ? C.cream : C.ink, whiteSpace: 'nowrap' })}>{label}</span>
      {count !== undefined && <span style={mono(11, 400, { color: active ? C.chipCount : C.ink80 })}>{count}</span>}
    </button>
  )
}

export function ChipRow({ children }) {
  return (
    <div className="pb-noscroll" style={{ display: 'flex', gap: 8, padding: '0 20px 16px', overflowX: 'auto' }}>
      {children}
    </div>
  )
}

/* ---------- Thumb (23:5777) ---------- */
export function Thumb({ icon, dark, size = 44 }) {
  return (
    <div style={{ ...center, width: size, height: size, background: dark ? C.ink : C.teal }}>
      <Icon name={`${icon}@18`} color={dark ? C.amber : C.blush} />
    </div>
  )
}

/* ---------- Checkbox (23:6255 / 23:6273) ---------- */
export function Checkbox({ checked, size = 24, onClick, label }) {
  return (
    <button
      role="checkbox"
      aria-checked={!!checked}
      aria-label={label}
      onClick={onClick}
      style={{
        ...reset, ...center, width: size, height: size,
        background: checked ? C.ink : 'transparent',
        border: checked ? 'none' : `1.5px solid ${size > 20 ? C.ink45 : C.ink40}`,
      }}
    >
      {checked && <Icon name={size > 20 ? 'check@14' : 'check@12'} color={C.amber} />}
    </button>
  )
}

/* ---------- Barcode (23:5587 / 23:6336) ---------- */
export function Barcode({ bars = 88, fraction = 0, on = C.ink, off = C.ink20, height = 36 }) {
  const filled = Math.round(Math.max(0, Math.min(1, fraction)) * bars)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', height, width: '100%', overflow: 'hidden' }}>
      {Array.from({ length: bars }, (_, i) => (
        <div key={i} style={{ width: 1, height, background: i < filled ? on : off, flexShrink: 0 }} />
      ))}
    </div>
  )
}

/* ---------- Stock meter (23:5787) ---------- */
export function StockMeter({ status }) {
  const cfg = {
    high: { bars: [C.ink75, C.ink75, C.ink75], label: 'OK', color: C.ink80 },
    medium: { bars: [C.ink, C.ink, C.ink15], label: 'MED', color: C.ink },
    low: { bars: [C.ember, C.ink15, C.ink15], label: 'OUT', color: C.ember },
  }[status] || null
  if (!cfg) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {cfg.bars.map((b, i) => <div key={i} style={{ width: 12, height: 4, background: b }} />)}
      <span style={mono(8, 400, { letterSpacing: 0.48, color: cfg.color })}>{cfg.label}</span>
    </div>
  )
}

/* ---------- Buttons (Button/Take photo, Button/Cancel …) ---------- */
export function Button({ variant = 'amber', icon, iconColor, children, onClick, height = 52, style, disabled, type = 'button' }) {
  const v = {
    amber: { background: C.amber, color: C.ink, border: 'none' },
    ink: { background: C.ink, color: C.cream, border: 'none' },
    outline: { background: 'transparent', color: C.ink, border: `1px solid ${C.ink30}` },
    ember: { background: C.ember, color: C.white, border: 'none' },
    danger: { background: 'transparent', color: C.ember, border: `1px solid ${C.ink30}` },
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...reset, ...center, gap: 8, height, padding: '0 16px', ...v,
        opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer', ...style,
      }}
    >
      {icon && <Icon name={icon} color={iconColor || (variant === 'ink' ? C.amber : variant === 'danger' ? C.ember : C.ink)} />}
      <span style={sans(15, 500, { color: v.color, whiteSpace: 'nowrap' })}>{children}</span>
    </button>
  )
}

/* ---------- Segmented control (23:7601) ---------- */
export function Segmented({ options, value, onChange, height = 44, activeBg = C.amber, activeColor = C.ink, fontSize = 14, boldInactive = false }) {
  return (
    <div style={{ display: 'flex', border: `1px solid ${C.ink20}`, width: '100%' }}>
      {options.map((o, i) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              ...reset, ...center, flex: 1, height, background: active ? activeBg : 'transparent',
              borderLeft: i ? `1px solid ${C.ink20}` : 'none',
            }}
          >
            <span style={sans(fontSize, active || boldInactive ? 500 : 400, { color: active ? activeColor : C.ink })}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Form fields (Field/STORE, Input) ---------- */
export function Field({ label, children, style }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, ...style }}>
      <span style={TX.label}>{label}</span>
      {children}
    </label>
  )
}

const inputBox = (focus) => ({
  position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  height: 44, padding: '0 12px', background: C.field,
  border: focus ? `1.5px solid ${C.ink90}` : `1px solid ${C.ink18}`,
  width: '100%',
})
const inputText = { ...sans(14, 400, { color: C.ink }), flex: 1, minWidth: 0, height: '100%', background: 'transparent' }

export function TextInput({ value, onChange, placeholder, type = 'text', inputMode, autoFocus, list, focus, onKeyDown, step, autoComplete, children }) {
  return (
    <div style={inputBox(focus)} className="pb-input">
      <input
        type={type} value={value} placeholder={placeholder} inputMode={inputMode} autoFocus={autoFocus} list={list} step={step}
        autoComplete={autoComplete} autoCapitalize={type === 'email' || type === 'password' ? 'off' : undefined}
        onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} style={inputText}
      />
      {children}
    </div>
  )
}

export function SelectInput({ value, onChange, options, placeholder }) {
  return (
    <div style={inputBox(false)}>
      <span style={{ ...sans(14, 400, { color: value ? C.ink : C.ink80 }), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value ? (options.find((o) => (o.value ?? o) === value)?.label ?? value) : placeholder}
      </span>
      <Icon name="chev@16" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer' }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const v = o.value ?? o
          return <option key={v} value={v}>{o.label ?? o}</option>
        })}
      </select>
    </div>
  )
}

export function DateInput({ value, onChange, display }) {
  return (
    <div style={inputBox(false)}>
      <span style={sans(14, 400, { color: C.ink })}>{display}</span>
      <Icon name="cal@16" />
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%' }} />
    </div>
  )
}

// Compact qty stepper (23:7378)
export function QtyStepper({ value, onChange, min = 1 }) {
  return (
    <div style={{ ...inputBox(false), padding: 0 }}>
      <button aria-label="Decrease" onClick={() => onChange(Math.max(min, value - 1))} style={{ ...reset, ...center, width: 40, height: 44 }}>
        <Icon name="minus@14" />
      </button>
      <span style={sans(15, 500, { color: C.ink })}>{value}</span>
      <button aria-label="Increase" onClick={() => onChange(value + 1)} style={{ ...reset, ...center, width: 40, height: 44, background: C.ink, marginRight: -1 }}>
        <Icon name="plus@14" color={C.amber} />
      </button>
    </div>
  )
}

/* ---------- Bottom sheet (23:6661) ---------- */
export function Sheet({ onClose, children, gap = 16, label }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={label} style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: C.scrim, animation: 'pb-fade-in .2s ease' }} />
      <div
        style={{
          position: 'relative', width: '100%', maxWidth: 480, maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto',
          background: C.sheet, borderRadius: '26px 26px 0 0',
          padding: '12px 20px calc(36px + env(safe-area-inset-bottom, 0px))',
          display: 'flex', flexDirection: 'column', gap,
          animation: 'pb-sheet-in .28s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, background: C.ink25 }} />
        </div>
        {children}
      </div>
    </div>
  )
}

export function CloseButton({ onClick }) {
  return (
    <button aria-label="Close" onClick={onClick} style={{ ...reset, ...center, width: 36, height: 36, border: `1px solid ${C.ink25}` }}>
      <Icon name="x@16" />
    </button>
  )
}

export function SheetHeader({ title, subtitle, onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <h2 style={TX.sheetTitle}>{title}</h2>
        {subtitle && <p style={sans(13, 400, { color: C.ink80 })}>{subtitle}</p>}
      </div>
      <CloseButton onClick={onClose} />
    </div>
  )
}

/* ---------- Popover shell (Menu 23:7824, Filter 23:8029, Dialog 23:8269) ---------- */
export function Overlay({ onClose, children, dim = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: dim ? C.scrim : 'transparent' }} />
      {children}
    </div>
  )
}

/* ---------- Two-column mono row (Date group 23:5971) ---------- */
export function LabelRow({ left, right, style, rightColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, ...style }}>
      <span style={TX.label}>{left}</span>
      {right !== undefined && <span style={{ ...TX.label, color: rightColor || C.ink80 }}>{right}</span>}
    </div>
  )
}

export const mono10 = TX.label
export { C, F, TX, sans, mono }
