'use client'

import { useEffect, useRef, useState } from 'react'
import { useColorTheme } from './ColorThemeProvider'

export function ThemePicker() {
  const { theme, themeId, setThemeId, themes } = useColorTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      {/* Trigger — shows current theme swatch */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        title={`Theme: ${theme.name}`}
      >
        <span className="text-base">{theme.emoji}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg py-2 z-50">
          <p className="px-3 pb-2 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
            Colour Theme
          </p>

          {/* Finance group */}
          <p className="px-3 pt-1 pb-1 text-xs text-gray-400 dark:text-slate-600">Finance</p>
          {themes.filter((t) => ['indigo', 'gold', 'emerald'].includes(t.id)).map((t) => (
            <ThemeOption key={t.id} theme={t} active={t.id === themeId} onSelect={() => { setThemeId(t.id); setOpen(false) }} />
          ))}

          <div className="my-1.5 border-t border-gray-100 dark:border-slate-700" />

          {/* Animal group */}
          <p className="px-3 pt-1 pb-1 text-xs text-gray-400 dark:text-slate-600">Animal</p>
          {themes.filter((t) => ['orange', 'cyan', 'rose', 'violet', 'slate'].includes(t.id)).map((t) => (
            <ThemeOption key={t.id} theme={t} active={t.id === themeId} onSelect={() => { setThemeId(t.id); setOpen(false) }} />
          ))}
        </div>
      )}
    </div>
  )
}

function ThemeOption({
  theme,
  active,
  onSelect,
}: {
  theme: { id: string; name: string; description: string; emoji: string; swatch: string }
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white'
          : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
      }`}
    >
      {/* Colour swatch */}
      <span
        className="w-5 h-5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: theme.swatch,
          outline: active ? `2px solid ${theme.swatch}` : '2px solid transparent',
          outlineOffset: '2px',
        }}
      />
      <span className="flex-1 text-left">
        <span className="font-medium">{theme.emoji} {theme.name}</span>
        <span className="block text-xs text-gray-400 dark:text-slate-500">{theme.description}</span>
      </span>
      {active && (
        <svg className="w-4 h-4 text-gray-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}
