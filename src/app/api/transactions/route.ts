import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const portfolioId = searchParams.get('portfolioId')
  const ticker = searchParams.get('ticker')
  const type = searchParams.get('type')

  const where: Record<string, unknown> = {
    portfolio: { userId: session.user.id },
  }
  if (portfolioId) where.portfolioId = portfolioId
  if (ticker) where.ticker = ticker.toUpperCase()
  if (type) where.type = type.toUpperCase()

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'desc' },
    include: { portfolio: { select: { name: true, currency: true } } },
  })
  return Response.json(transactions)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { portfolioId, type, ticker, date, quantity, price, fees = 0, amount, frankingPct = 0, frankingCredit = 0, notes } = body

  if (!portfolioId || !type || !ticker || !date) {
    return Response.json(
      { error: 'portfolioId, type, ticker, and date are required' },
      { status: 400 }
    )
  }

  // Verify portfolio belongs to this user
  const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } })
  if (!portfolio || portfolio.userId !== session.user.id) {
    return Response.json({ error: 'Portfolio not found' }, { status: 404 })
  }

  const transaction = await prisma.transaction.create({
    data: {
      portfolioId,
      type: type.toUpperCase(),
      ticker: ticker.toUpperCase(),
      date: new Date(date),
      quantity: quantity ?? 0,
      price: price ?? 0,
      fees,
      amount: amount ?? null,
      frankingPct: frankingPct ?? 0,
      frankingCredit: frankingCredit ?? 0,
      notes: notes ?? null,
    },
  })
  return Response.json(transaction, { status: 201 })
}
