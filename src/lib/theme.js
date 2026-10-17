// Design tokens — Figma "C3 · Sea Glass & Ember" (node 23:5536).
// Every value here is taken from the Figma file; screens should use these
// instead of hard-coding colours or type styles.

export const C = {
  cream: '#eeefe0',        // app ground
  ink: '#122623',          // teal-black ink / dark surfaces
  teal: '#005250',         // deep teal blocks
  amber: '#ffb200',        // accent
  ember: '#ff4802',        // alerts / price rises
  blush: '#f4ddd3',        // text on teal
  row: '#d1dedb',          // list rows / cards
  rowFaded: 'rgba(209,222,219,0.55)',
  sheet: '#e0eae8',        // bottom-sheet surface
  field: '#f0f5f4',        // input surface
  composer: '#cadad6',     // chat input
  white: '#ffffff',
  scrim: 'rgba(14,8,15,0.45)',

  ink90: 'rgba(18,38,35,0.9)',
  ink80: 'rgba(18,38,35,0.8)',
  ink75: 'rgba(18,38,35,0.75)',
  ink70: 'rgba(18,38,35,0.7)',
  ink65: 'rgba(18,38,35,0.65)',
  ink55: 'rgba(18,38,35,0.55)',
  ink45: 'rgba(18,38,35,0.45)',
  ink40: 'rgba(18,38,35,0.4)',
  ink30: 'rgba(18,38,35,0.3)',
  ink28: 'rgba(18,38,35,0.28)',
  ink25: 'rgba(18,38,35,0.25)',
  ink22: 'rgba(18,38,35,0.22)',
  ink20: 'rgba(18,38,35,0.2)',
  ink18: 'rgba(18,38,35,0.18)',
  ink15: 'rgba(18,38,35,0.15)',
  ink12: 'rgba(18,38,35,0.12)',
  ink10: 'rgba(18,38,35,0.1)',

  blush80: 'rgba(244,221,211,0.8)',
  blush35: 'rgba(244,221,211,0.35)',
  blush12: 'rgba(244,221,211,0.12)',
  chipCount: 'rgba(194,212,208,0.6)',
}

export const F = {
  sans: "'Geist', system-ui, -apple-system, sans-serif",
  mono: "'Geist Mono', ui-monospace, 'SF Mono', monospace",
}

// Type helpers. Figma's "Auto" line height for Geist / Geist Mono resolves to
// 1.3× the font size (e.g. 72px → 94px, 15px → 20px, 10px mono → 13px), while
// browsers use a tighter "normal". Matching it keeps every block the same height.
export const LH = 1.3
export const sans = (size, weight = 400, extra = {}) => ({
  fontFamily: F.sans, fontSize: size, fontWeight: weight, lineHeight: LH, ...extra,
})
export const mono = (size, weight = 400, extra = {}) => ({
  fontFamily: F.mono, fontSize: size, fontWeight: weight, lineHeight: LH, ...extra,
})

// Recurring text styles from the file
export const TX = {
  title: sans(30, 500, { lineHeight: '34px', letterSpacing: -0.9, color: C.ink }),
  sheetTitle: sans(24, 500, { letterSpacing: -0.48, color: C.ink }),
  label: mono(10, 400, { letterSpacing: 0.8, color: C.ink80, textTransform: 'uppercase' }),
  micro: mono(9, 400, { letterSpacing: 0.54, color: C.ink80, textTransform: 'uppercase' }),
  rowName: sans(15, 500, { color: C.ink }),
  body: sans(14, 400, { color: C.ink }),
  small: sans(12, 400, { color: C.ink80 }),
}

export const SCREEN_PAD = 20
export const TAB_CLEARANCE = 100 // list bottom padding so the floating tab bar never covers content
