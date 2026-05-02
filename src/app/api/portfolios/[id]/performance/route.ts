import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getCachedAsxQuotes } from '@/lib/asx/cache'
import { computePortfolioPerformance } from '@/lib/calculations'
import { checkAlerts } from '@/lib/alerts/checker'
import { calcTermDeposit } from '@/lib/termDeposit'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
  })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })

  if (portfolio.portfolioType === 'TERM_DEPOSIT') {
    const { tdPrincipal, tdRate, tdStartDate, tdMaturityDate } = portfolio
    if (!tdPrincipal || !tdRate || !tdStartDate || !tdMaturityDate) {
      return Response.json({ currentMarketValue: 0, totalReturn: 0, totalReturnPct: 0, holdings: [] })
    }
    const td = calcTermDeposit(tdPrincipal, tdRate, tdStartDate, tdMaturityDate)
    return Response.json({
      currentMarketValue: td.currentValue,
      totalReturn: td.accruedInterest,
      totalReturnPct: tdPrincipal > 0 ? (td.accruedInterest / tdPrincipal) * 100 : 0,
      holdings: [],
    })
  }

  const transactions = await prisma.transaction.findMany({
    where: { portfolioId: id },
    orderBy: { date: 'asc' },
  })

  const tickers = [...new Set(transactions.map((t) => t.ticker.toUpperCase()))]
  const priceMap = await getCachedAsxQuotes(tickers)

  await checkAlerts()

  const performance = computePortfolioPerformance(
    portfolio.id,
    portfolio.name,
    portfolio.currency,
    transactions,
    priceMap
  )

  return Response.json(performance)
}
