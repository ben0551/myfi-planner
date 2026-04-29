import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export interface MemberWealth {
  userId: string
  name: string | null
  email: string | null
  role: string
  sharesValue: number
  propertyGrossValue: number
  propertyDebt: number
  propertyEquity: number
  superBalance: number
  cashBalance: number
  totalAssets: number
  totalLiabilities: number
  netWorth: number
}

export interface HouseholdSummary {
  householdId: string
  householdName: string
  members: MemberWealth[]
  combined: {
    sharesValue: number
    propertyGrossValue: number
    propertyDebt: number
    propertyEquity: number
    superBalance: number
    cashBalance: number
    totalAssets: number
    totalLiabilities: number
    netWorth: number
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await prisma.householdMember.findFirst({
    where: { userId: session.user.id },
    include: {
      household: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { joinedAt: 'asc' },
          },
        },
      },
    },
  })

  if (!membership) return Response.json({ error: 'Not in a household' }, { status: 404 })

  const { household } = membership

  // Compute wealth for every member
  const memberWealth: MemberWealth[] = await Promise.all(
    household.members.map(async (m) => {
      const uid = m.userId

      const [portfolios, properties, superAccounts, cashAccounts] = await Promise.all([
        prisma.portfolio.findMany({ where: { userId: uid }, select: { id: true } }),
        prisma.property.findMany({ where: { userId: uid }, include: { mortgage: true } }),
        prisma.superAccount.findMany({ where: { userId: uid } }),
        prisma.cashAccount.findMany({ where: { userId: uid } }),
      ])

      // Use most recent portfolio snapshots
      const snapshots = await Promise.all(
        portfolios.map((p) => prisma.portfolioSnapshot.findFirst({ where: { portfolioId: p.id }, orderBy: { date: 'desc' } }))
      )

      const sharesValue = snapshots.reduce((s, snap) => s + (snap?.value ?? 0), 0)
      const propertyGrossValue = properties.reduce((s, p) => s + p.currentValue * (p.ownershipPct / 100), 0)
      const propertyDebt = properties.reduce((s, p) => s + (p.mortgage?.currentBalance ?? 0), 0)
      const propertyEquity = propertyGrossValue - propertyDebt
      const superBalance = superAccounts.reduce((s, a) => s + a.currentBalance, 0)
      const cashBalance = cashAccounts.reduce((s, a) => s + a.balance, 0)
      const totalAssets = sharesValue + propertyGrossValue + superBalance + cashBalance
      const totalLiabilities = propertyDebt
      const netWorth = totalAssets - totalLiabilities

      return {
        userId: uid,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        sharesValue,
        propertyGrossValue,
        propertyDebt,
        propertyEquity,
        superBalance,
        cashBalance,
        totalAssets,
        totalLiabilities,
        netWorth,
      }
    })
  )

  const sum = (key: keyof MemberWealth) =>
    memberWealth.reduce((s, m) => s + (m[key] as number), 0)

  const combined = {
    sharesValue: sum('sharesValue'),
    propertyGrossValue: sum('propertyGrossValue'),
    propertyDebt: sum('propertyDebt'),
    propertyEquity: sum('propertyEquity'),
    superBalance: sum('superBalance'),
    cashBalance: sum('cashBalance'),
    totalAssets: sum('totalAssets'),
    totalLiabilities: sum('totalLiabilities'),
    netWorth: sum('netWorth'),
  }

  const summary: HouseholdSummary = {
    householdId: household.id,
    householdName: household.name,
    members: memberWealth,
    combined,
  }

  return Response.json(summary)
}
