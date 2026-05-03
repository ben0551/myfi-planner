import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { CreateTransactionSchema, parseBody } from '@/lib/schemas'

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

  const result = await parseBody(request, CreateTransactionSchema)
  if (!result.ok) return result.response
  const data = result.data

  // Verify portfolio belongs to this user
  const portfolio = await prisma.portfolio.findUnique({ where: { id: data.portfolioId } })
  if (!portfolio || portfolio.userId !== session.user.id) {
    return Response.json({ error: 'Portfolio not found' }, { status: 404 })
  }

  const transaction = await prisma.transaction.create({
    data: {
      portfolioId: data.portfolioId,
      type: data.type,
      ticker: data.ticker,
      date: new Date(data.date),
      quantity: data.quantity,
      price: data.price,
      fees: data.fees,
      amount: data.amount ?? null,
      frankingPct: data.frankingPct,
      frankingCredit: data.frankingCredit,
      notes: data.notes ?? null,
    },
  })
  return Response.json(transaction, { status: 201 })
}
