// Sea Glass & Ember — Plantain Butler Design System
// Extracted from Figma C3 design by Emmanuel Dankyi

export const T = {
  // Core palette
  cream:       '#eeefe0',
  deepTeal:    '#122623',
  teal:        '#005250',
  amber:       '#ffb200',
  warm:        '#f4ddd3',

  // Text on cream background
  text:        '#122623',
  textMuted:   'rgba(18,38,35,0.8)',
  textLight:   'rgba(18,38,35,0.55)',

  // Text on teal background
  textOnTeal:  '#f4ddd3',
  textOnTealMuted: 'rgba(244,221,211,0.7)',

  // Borders & dividers
  border:      'rgba(18,38,35,0.18)',
  borderLight: 'rgba(18,38,35,0.1)',

  // Surface colors
  surface:     '#eeefe0',  // page background
  surfaceCard: '#ffffff',  // elevated cards (white)
  surfaceTeal: '#005250',  // teal cards/sections
  surfaceDeep: '#122623',  // deep teal (tab bar, etc.)

  // Interactive
  accent:      '#ffb200',  // amber CTA
  accentHover: '#e6a000',
  accentText:  '#122623',  // text on amber

  // Status
  error:       '#d94f4f',
  success:     '#2e7d5b',
  warning:     '#e89b00',

  // Radii
  radiusSm:    8,
  radiusMd:    12,
  radiusLg:    16,
  radiusXl:    26,
  radiusPill:  32,

  // Typography
  fontSans:    "'Geist', system-ui, -apple-system, sans-serif",
  fontMono:    "'Geist Mono', 'SF Mono', monospace",

  // Font weights
  light:       300,
  regular:     400,
  medium:      500,
  semibold:    600,

  // Shadows
  shadowSm:    '0 1px 3px rgba(18,38,35,0.08)',
  shadowMd:    '0 4px 12px rgba(18,38,35,0.1)',
  shadowLg:    '0 8px 24px rgba(18,38,35,0.12)',
}

// Tab bar configuration
export const TAB_BAR = {
  bg:           T.surfaceDeep,
  activePill:   T.amber,
  activeText:   T.deepTeal,
  inactiveIcon: 'rgba(244,221,211,0.5)',
  height:       64,
  radius:       T.radiusPill,
}

// Monospaced uppercase label style (used throughout design)
export const monoLabel = {
  fontFamily: T.fontMono,
  fontSize: 10,
  fontWeight: T.medium,
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
  color: T.textLight,
}

// Hero amount style (dashboard total)
export const heroAmount = {
  fontFamily: T.fontSans,
  fontWeight: T.light,
  fontSize: 72,
  letterSpacing: '-3.6px',
  color: T.deepTeal,
  lineHeight: 1,
}
