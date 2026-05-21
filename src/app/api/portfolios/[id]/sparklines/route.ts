import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// Returns 30-day close prices for all tickers in a portfolio
// { [ticker]: number[] }
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })

  const rows = await prisma.transaction.findMany({
    where: { portfolioId: id },
    select: { ticker: true },
    distinct: ['ticker'],
  })
  const tickers = rows.map((r) => r.ticker.toUpperCase())
  if (tickers.length === 0) return Response.json({})

  // Fetch a bit more than 30 days to handle weekends + public holidays
  const since = new Date()
  since.setDate(since.getDate() - 38)

  const prices = await prisma.historicalPrice.findMany({
    where: { ticker: { in: tickers }, source: 'ASX', date: { gte: since } },
    orderBy: { date: 'asc' },
    select: { ticker: true, close: true },
  })

  const result: Record<string, number[]> = {}
  for (const p of prices) {
    if (!result[p.ticker]) result[p.ticker] = []
    result[p.ticker].push(Number(p.close))
  }

  return Response.json(result)
}
