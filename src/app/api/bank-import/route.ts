import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface ImportRow {
  categoryId: string
  year: number
  month: number
  amount: number  // absolute value — always positive, we sum debits
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const body = await request.json() as { rows: ImportRow[]; mode: 'replace' | 'add' }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return Response.json({ error: 'No rows provided' }, { status: 400 })
  }

  // Verify all categoryIds belong to this user
  const categoryIds = [...new Set(body.rows.map((r) => r.categoryId))]
  const ownedCategories = await prisma.budgetCategory.findMany({
    where: { id: { in: categoryIds }, userId },
    select: { id: true },
  })
  const ownedIds = new Set(ownedCategories.map((c) => c.id))
  const unauthorised = categoryIds.filter((id) => !ownedIds.has(id))
  if (unauthorised.length > 0) {
    return Response.json({ error: 'Invalid category IDs' }, { status: 403 })
  }

  // Aggregate: sum amounts by (categoryId, year, month)
  const aggregated = new Map<string, { categoryId: string; year: number; month: number; amount: number }>()
  for (const row of body.rows) {
    const key = `${row.categoryId}|${row.year}|${row.month}`
    const existing = aggregated.get(key)
    if (existing) {
      existing.amount += row.amount
    } else {
      aggregated.set(key, { ...row, amount: row.amount })
    }
  }

  const entries = [...aggregated.values()]

  if (body.mode === 'add') {
    // Fetch existing actuals to increment
    const existing = await prisma.budgetActual.findMany({
      where: {
        userId,
        OR: entries.map((e) => ({ categoryId: e.categoryId, year: e.year, month: e.month })),
      },
    })
    const existingMap = new Map(existing.map((a) => [`${a.categoryId}|${a.year}|${a.month}`, a.amount]))

    await prisma.$transaction(
      entries.map((e) => {
        const key = `${e.categoryId}|${e.year}|${e.month}`
        const prior = existingMap.get(key) ?? 0
        return prisma.budgetActual.upsert({
          where: { categoryId_year_month: { categoryId: e.categoryId, year: e.year, month: e.month } },
          update: { amount: prior + e.amount },
          create: { userId, categoryId: e.categoryId, year: e.year, month: e.month, amount: prior + e.amount },
        })
      })
    )
  } else {
    // Replace mode
    await prisma.$transaction(
      entries.map((e) =>
        prisma.budgetActual.upsert({
          where: { categoryId_year_month: { categoryId: e.categoryId, year: e.year, month: e.month } },
          update: { amount: e.amount },
          create: { userId, categoryId: e.categoryId, year: e.year, month: e.month, amount: e.amount },
        })
      )
    )
  }

  return Response.json({ imported: entries.length })
}
