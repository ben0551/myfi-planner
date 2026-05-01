import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserTable } from './UserTable'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/')

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      apiKey: true,
      netWorthSnapshots: {
        orderBy: { date: 'desc' },
        take: 1,
        select: { totalAssets: true, totalLiabilities: true },
      },
    },
  })

  // Distinct ticker count per user via raw query
  const tickerCounts = await prisma.$queryRaw<{ userId: string; count: number }[]>`
    SELECT p."userId", COUNT(DISTINCT t.ticker)::int AS count
    FROM "Transaction" t
    JOIN "Portfolio" p ON t."portfolioId" = p.id
    GROUP BY p."userId"
  `.catch(() => [] as { userId: string; count: number }[])

  const tickerMap = new Map(tickerCounts.map((r) => [r.userId, r.count]))

  const enriched = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    apiKey: u.apiKey,
    tickers: tickerMap.get(u.id) ?? 0,
    totalAssets: u.netWorthSnapshots[0]?.totalAssets ?? null,
    totalLiabilities: u.netWorthSnapshots[0]?.totalLiabilities ?? null,
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage user accounts, roles, and access.
        </p>
      </div>
      <UserTable users={enriched} currentUserId={session.user.id} />
    </div>
  )
}
