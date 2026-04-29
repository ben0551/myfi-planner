import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const months = Math.min(24, Math.max(3, parseInt(searchParams.get('months') ?? '12')))
  const userId = session.user.id

  // Build the last N (year, month) pairs
  const now = new Date()
  const periods: { year: number; month: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    periods.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }

  const [budgets, actuals] = await Promise.all([
    prisma.budget.findMany({
      where: {
        userId,
        OR: periods.map((p) => ({ year: p.year, month: p.month })),
      },
      include: { category: { select: { group: true } } },
    }),
    prisma.budgetActual.findMany({
      where: {
        userId,
        OR: periods.map((p) => ({ year: p.year, month: p.month })),
      },
      include: { category: { select: { group: true } } },
    }),
  ])

  // Aggregate per period
  const result = periods.map(({ year, month }) => {
    const pb = budgets.filter((b) => b.year === year && b.month === month)
    const pa = actuals.filter((a) => a.year === year && a.month === month)
    return {
      year,
      month,
      totalBudgeted: pb.reduce((s, b) => s + b.amount, 0),
      totalActual: pa.reduce((s, a) => s + a.amount, 0),
    }
  })

  return NextResponse.json(result)
}
