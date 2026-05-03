import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCachedAsxQuotes } from '@/lib/asx/cache'
import { computePortfolioPerformance } from '@/lib/calculations'
import { toCsv, csvResponse, safeFilename } from '@/lib/csv'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
    include: { transactions: { orderBy: { date: 'asc' } } },
  })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })

  const tickers = [...new Set(portfolio.transactions.map((t) => t.ticker.toUpperCase()))]
  const priceMap = await getCachedAsxQuotes(tickers)
  const perf = computePortfolioPerformance(
    portfolio.id, portfolio.name, portfolio.currency,
    portfolio.transactions, priceMap,
  )

  const csv = toCsv(
    ['Ticker', 'Quantity', 'Avg Cost', 'Cost Basis', 'Current Price', 'Current Value', 'Unrealised Gain', 'Unrealised %', 'Dividends Received'],
    perf.holdings.map((h) => [
      h.ticker,
      h.quantity,
      h.avgCost,
      h.totalCostBasis,
      h.currentPrice ?? '',
      h.currentValue ?? '',
      h.unrealisedGain ?? '',
      h.unrealisedGainPct?.toFixed(2) ?? '',
      h.dividendsReceived,
    ]),
  )

  return csvResponse(csv, `${safeFilename(portfolio.name)}_holdings.csv`)
}
