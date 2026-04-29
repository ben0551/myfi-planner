'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { COLOR_THEMES, DEFAULT_THEME_ID, type ColorTheme } from '@/lib/colorThemes'

const STORAGE_KEY = 'myfiplanner-color-theme'

interface ColorThemeContextValue {
  themeId: string
  theme: ColorTheme
  setThemeId: (id: string) => void
  themes: ColorTheme[]
}

const ColorThemeContext = createContext<ColorThemeContextValue | null>(null)

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState(DEFAULT_THEME_ID)

  // On mount, read from localStorage and apply
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID
    apply(saved)
    setThemeIdState(saved)
  }, [])

  function apply(id: string) {
    const el = document.documentElement
    if (id === DEFAULT_THEME_ID) {
      el.removeAttribute('data-theme')
    } else {
      el.setAttribute('data-theme', id)
    }
  }

  function setThemeId(id: string) {
    setThemeIdState(id)
    apply(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  const theme = COLOR_THEMES.find((t) => t.id === themeId) ?? COLOR_THEMES[0]

  return (
    <ColorThemeContext.Provider value={{ themeId, theme, setThemeId, themes: COLOR_THEMES }}>
      {children}
    </ColorThemeContext.Provider>
  )
}

export function useColorTheme() {
  const ctx = useContext(ColorThemeContext)
  if (!ctx) throw new Error('useColorTheme must be used inside ColorThemeProvider')
  return ctx
}
