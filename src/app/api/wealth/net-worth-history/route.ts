import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  // ── Fetch all raw historical sources ────────────────────────────────────────

  const [portfolios, superAccounts, properties, cashAccounts] = await Promise.all([
    prisma.portfolio.findMany({
      where: { userId },
      include: {
        snapshots: { orderBy: { date: 'asc' }, select: { date: true, value: true } },
      },
    }),
    prisma.superAccount.findMany({
      where: { userId },
      include: {
        balanceHistory: { orderBy: { date: 'asc' }, select: { date: true, balance: true } },
      },
    }),
    prisma.property.findMany({
      where: { userId },
      include: {
        valueHistory: { orderBy: { date: 'asc' }, select: { date: true, value: true } },
        mortgage: { select: { currentBalance: true } },
      },
    }),
    prisma.cashAccount.findMany({
      where: { userId },
      include: {
        balanceHistory: { orderBy: { date: 'asc' }, select: { date: true, balance: true } },
      },
    }),
  ])

  // ── Build per-source histories as { date: string, value: number }[] ─────────

  // Sum portfolio snapshots by date across all portfolios
  const portfolioByDate = new Map<string, number>()
  for (const p of portfolios) {
    for (const s of p.snapshots) {
      const d = toDateStr(s.date)
      portfolioByDate.set(d, (portfolioByDate.get(d) ?? 0) + s.value)
    }
  }
  const portfolioHistory = mapToSortedArray(portfolioByDate)

  // Sum super balances by date (most recent entry per account per date, then sum across accounts)
  const superByDate = new Map<string, number>()
  for (const a of superAccounts) {
    for (const h of a.balanceHistory) {
      const d = toDateStr(h.date)
      superByDate.set(d, (superByDate.get(d) ?? 0) + h.balance)
    }
    // Ensure current balance is represented at today even if no history entry today
    if (a.balanceHistory.length === 0) {
      // No history at all — use createdAt as start date with current balance
      const d = toDateStr(a.balanceUpdatedAt ?? new Date())
      superByDate.set(d, (superByDate.get(d) ?? 0) + a.currentBalance)
    }
  }
  const superHistory = mapToSortedArray(superByDate)

  // Sum property values by date (adjusted for ownership %)
  const propertyByDate = new Map<string, number>()
  let totalMortgageBalance = 0
  for (const p of properties) {
    const pct = p.ownershipPct / 100
    totalMortgageBalance += p.mortgage?.currentBalance ?? 0
    for (const h of p.valueHistory) {
      const d = toDateStr(h.date)
      propertyByDate.set(d, (propertyByDate.get(d) ?? 0) + h.value * pct)
    }
    if (p.valueHistory.length === 0) {
      // No history — use createdAt with current value
      const d = toDateStr(p.createdAt)
      propertyByDate.set(d, (propertyByDate.get(d) ?? 0) + p.currentValue * pct)
    }
  }
  const propertyHistory = mapToSortedArray(propertyByDate)

  // Sum cash balances by date
  const cashByDate = new Map<string, number>()
  for (const a of cashAccounts) {
    for (const h of a.balanceHistory) {
      const d = toDateStr(h.date)
      cashByDate.set(d, (cashByDate.get(d) ?? 0) + h.balance)
    }
    if (a.balanceHistory.length === 0) {
      const d = toDateStr(a.createdAt)
      cashByDate.set(d, (cashByDate.get(d) ?? 0) + a.balance)
    }
  }
  const cashHistory = mapToSortedArray(cashByDate)

  // ── Collect all unique dates, sorted ─────────────────────────────────────────

  const allDates = new Set<string>()
  for (const h of portfolioHistory) allDates.add(h.date)
  for (const h of superHistory) allDates.add(h.date)
  for (const h of propertyHistory) allDates.add(h.date)
  for (const h of cashHistory) allDates.add(h.date)

  const sortedDates = Array.from(allDates).sort()
  if (sortedDates.length === 0) return Response.json([])

  // ── Reconstruct net worth at each date using carry-forward ───────────────────
  // For each date, each component uses its last known value on or before that date.

  const result = sortedDates.map((date) => {
    const sharesValue = carryForward(portfolioHistory, date) ?? 0
    const superBalance = carryForward(superHistory, date) ?? 0
    const propertyValue = carryForward(propertyHistory, date) ?? 0
    const cashBalance = carryForward(cashHistory, date) ?? 0

    const totalAssets = sharesValue + propertyValue + superBalance + cashBalance
    const totalLiabilities = totalMortgageBalance  // constant — no historical mortgage data
    const netWorth = totalAssets - totalLiabilities

    return { date, netWorth, totalAssets, totalLiabilities, sharesValue, propertyValue, superBalance, cashBalance }
  })

  // ── Thin down daily data to keep the payload reasonable ─────────────────────
  // Keep all points within the last 90 days; weekly before that; monthly before 1 year.

  const today = new Date()
  const ninetyDaysAgo = toDateStr(new Date(today.getTime() - 90 * 86400000))
  const oneYearAgo = toDateStr(new Date(today.getTime() - 365 * 86400000))

  const thinned = result.filter((r, i) => {
    if (i === 0 || i === result.length - 1) return true  // always keep first & last
    if (r.date >= ninetyDaysAgo) return true              // daily for last 90 days
    if (r.date >= oneYearAgo) return isWeekly(r.date, result[i - 1].date)
    return isMonthly(r.date, result[i - 1].date)
  })

  return Response.json(thinned)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function mapToSortedArray(m: Map<string, number>): { date: string; value: number }[] {
  return Array.from(m.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }))
}

/** Returns the last known value in `history` on or before `targetDate`. */
function carryForward(history: { date: string; value: number }[], targetDate: string): number | null {
  let result: number | null = null
  for (const h of history) {
    if (h.date <= targetDate) result = h.value
    else break
  }
  return result
}

function isWeekly(date: string, prevDate: string): boolean {
  const diff = (new Date(date).getTime() - new Date(prevDate).getTime()) / 86400000
  return diff >= 7
}

function isMonthly(date: string, prevDate: string): boolean {
  const d = new Date(date)
  const p = new Date(prevDate)
  return d.getFullYear() !== p.getFullYear() || d.getMonth() !== p.getMonth()
}
