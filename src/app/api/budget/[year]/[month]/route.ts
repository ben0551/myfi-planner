import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { type BudgetGroup } from '@/lib/budget'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ year: string; month: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { year: y, month: m } = await params
  const year = parseInt(y)
  const month = parseInt(m)

  const [categories, budgets, actuals] = await Promise.all([
    prisma.budgetCategory.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.budget.findMany({
      where: { userId: session.user.id, year, month },
    }),
    prisma.budgetActual.findMany({
      where: { userId: session.user.id, year, month },
    }),
  ])

  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.amount]))
  const actualMap = new Map(actuals.map((a) => [a.categoryId, { amount: a.amount, notes: a.notes }]))

  const rows = categories.map((c) => ({
    categoryId: c.id,
    name: c.name,
    group: c.group as BudgetGroup,
    icon: c.icon,
    budgeted: budgetMap.get(c.id) ?? 0,
    actual: actualMap.get(c.id)?.amount ?? 0,
    notes: actualMap.get(c.id)?.notes ?? null,
  }))

  return NextResponse.json({ year, month, rows })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ year: string; month: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { year: y, month: m } = await params
  const year = parseInt(y)
  const month = parseInt(m)
  const userId = session.user.id

  const body = await req.json() as {
    budgets?: { categoryId: string; amount: number }[]
    actuals?: { categoryId: string; amount: number; notes?: string }[]
  }

  await prisma.$transaction([
    ...(body.budgets ?? []).map((b) =>
      prisma.budget.upsert({
        where: { categoryId_year_month: { categoryId: b.categoryId, year, month } },
        create: { userId, categoryId: b.categoryId, year, month, amount: b.amount },
        update: { amount: b.amount },
      }),
    ),
    ...(body.actuals ?? []).map((a) =>
      prisma.budgetActual.upsert({
        where: { categoryId_year_month: { categoryId: a.categoryId, year, month } },
        create: { userId, categoryId: a.categoryId, year, month, amount: a.amount, notes: a.notes ?? null },
        update: { amount: a.amount, notes: a.notes ?? null },
      }),
    ),
  ])

  return NextResponse.json({ ok: true })
}
