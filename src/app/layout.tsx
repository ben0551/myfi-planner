import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { Navbar } from '@/components/layout/Navbar'
import { Providers } from './providers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import './globals.css'

export const metadata: Metadata = {
  title: 'MyFiPlanner — Personal Finance & Portfolio Manager',
  description: 'Track your portfolio, net worth, and path to financial independence',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const hasHousehold = session?.user?.id
    ? !!(await prisma.householdMember.findFirst({
        where: { userId: session.user.id },
        select: { id: true },
      }))
    : false

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <Navbar hasHousehold={hasHousehold} />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <Toaster position="bottom-right" richColors />
        </Providers>
      </body>
    </html>
  )
}
