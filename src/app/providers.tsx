'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { ColorThemeProvider } from '@/components/ui/ColorThemeProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ColorThemeProvider>
        <SessionProvider>{children}</SessionProvider>
      </ColorThemeProvider>
    </ThemeProvider>
  )
}
