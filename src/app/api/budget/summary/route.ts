import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const months = Math.min(24, Math.max(3, parseInt(searchParams.get('months') ?? '12')))
  const userId = session.user.id

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
      include: { category: { select: { group: true, name: true } } },
    }),
    prisma.budgetActual.findMany({
      where: {
        userId,
        OR: periods.map((p) => ({ year: p.year, month: p.month })),
      },
      include: { category: { select: { group: true, name: true } } },
    }),
  ])

  const result = periods.map(({ year, month }) => {
    const pb = budgets.filter((b) => b.year === year && b.month === month)
    const pa = actuals.filter((a) => a.year === year && a.month === month)

    // Per-group actuals (expenses only — exclude INCOME group)
    const byGroup: Record<string, number> = {}
    for (const a of pa) {
      if (a.category.group === 'INCOME') continue
      const g = a.category.group
      byGroup[g] = (byGroup[g] ?? 0) + a.amount
    }

    return {
      year,
      month,
      totalBudgeted: pb.filter((b) => b.category.group !== 'INCOME').reduce((s, b) => s + b.amount, 0),
      totalActual: pa.filter((a) => a.category.group !== 'INCOME').reduce((s, a) => s + a.amount, 0),
      totalIncomeBudgeted: pb.filter((b) => b.category.group === 'INCOME').reduce((s, b) => s + b.amount, 0),
      totalIncomeActual: pa.filter((a) => a.category.group === 'INCOME').reduce((s, a) => s + a.amount, 0),
      byGroup,
    }
  })

  return NextResponse.json(result)
}
