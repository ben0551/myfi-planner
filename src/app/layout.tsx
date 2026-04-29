import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { Navbar } from '@/components/layout/Navbar'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'MyFiPlanner — Personal Finance & Portfolio Manager',
  description: 'Track your portfolio, net worth, and path to financial independence',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <Toaster position="bottom-right" richColors />
        </Providers>
      </body>
    </html>
  )
}
