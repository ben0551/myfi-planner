export interface ColorTheme {
  id: string
  name: string
  description: string
  emoji: string
  swatch: string   // hex of the accent-600 shade for display
  /** Full accent scale (50 → 950) */
  scale: Record<string, string>
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'indigo',
    name: 'Classic',
    description: 'Default indigo',
    emoji: '💜',
    swatch: '#4f46e5',
    scale: {
      '50':  '#eef2ff', '100': '#e0e7ff', '200': '#c7d2fe',
      '300': '#a5b4fc', '400': '#818cf8', '500': '#6366f1',
      '600': '#4f46e5', '700': '#4338ca', '800': '#3730a3',
      '900': '#312e81', '950': '#1e1b4b',
    },
  },
  {
    id: 'gold',
    name: 'Wall Street',
    description: 'Finance — amber gold',
    emoji: '💰',
    swatch: '#d97706',
    scale: {
      '50':  '#fffbeb', '100': '#fef3c7', '200': '#fde68a',
      '300': '#fcd34d', '400': '#fbbf24', '500': '#f59e0b',
      '600': '#d97706', '700': '#b45309', '800': '#92400e',
      '900': '#78350f', '950': '#451a03',
    },
  },
  {
    id: 'emerald',
    name: 'Bull Market',
    description: 'Finance — growth green',
    emoji: '📈',
    swatch: '#059669',
    scale: {
      '50':  '#ecfdf5', '100': '#d1fae5', '200': '#a7f3d0',
      '300': '#6ee7b7', '400': '#34d399', '500': '#10b981',
      '600': '#059669', '700': '#047857', '800': '#065f46',
      '900': '#064e3b', '950': '#022c22',
    },
  },
  {
    id: 'orange',
    name: 'Fox',
    description: 'Animal — rusty orange',
    emoji: '🦊',
    swatch: '#ea580c',
    scale: {
      '50':  '#fff7ed', '100': '#ffedd5', '200': '#fed7aa',
      '300': '#fdba74', '400': '#fb923c', '500': '#f97316',
      '600': '#ea580c', '700': '#c2410c', '800': '#9a3412',
      '900': '#7c2d12', '950': '#431407',
    },
  },
  {
    id: 'cyan',
    name: 'Dolphin',
    description: 'Animal — ocean blue',
    emoji: '🐬',
    swatch: '#0891b2',
    scale: {
      '50':  '#ecfeff', '100': '#cffafe', '200': '#a5f3fc',
      '300': '#67e8f9', '400': '#22d3ee', '500': '#06b6d4',
      '600': '#0891b2', '700': '#0e7490', '800': '#155e75',
      '900': '#164e63', '950': '#083344',
    },
  },
  {
    id: 'rose',
    name: 'Flamingo',
    description: 'Animal — hot pink',
    emoji: '🦩',
    swatch: '#e11d48',
    scale: {
      '50':  '#fff1f2', '100': '#ffe4e6', '200': '#fecdd3',
      '300': '#fda4af', '400': '#fb7185', '500': '#f43f5e',
      '600': '#e11d48', '700': '#be123c', '800': '#9f1239',
      '900': '#881337', '950': '#4c0519',
    },
  },
  {
    id: 'violet',
    name: 'Night Owl',
    description: 'Animal — deep purple',
    emoji: '🦉',
    swatch: '#7c3aed',
    scale: {
      '50':  '#f5f3ff', '100': '#ede9fe', '200': '#ddd6fe',
      '300': '#c4b5fd', '400': '#a78bfa', '500': '#8b5cf6',
      '600': '#7c3aed', '700': '#6d28d9', '800': '#5b21b6',
      '900': '#4c1d95', '950': '#2e1065',
    },
  },
  {
    id: 'slate',
    name: 'Wolf',
    description: 'Animal — monochrome',
    emoji: '🐺',
    swatch: '#475569',
    scale: {
      '50':  '#f8fafc', '100': '#f1f5f9', '200': '#e2e8f0',
      '300': '#cbd5e1', '400': '#94a3b8', '500': '#64748b',
      '600': '#475569', '700': '#334155', '800': '#1e293b',
      '900': '#0f172a', '950': '#020617',
    },
  },
]

export const DEFAULT_THEME_ID = 'indigo'
