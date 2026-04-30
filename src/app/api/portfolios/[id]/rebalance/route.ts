import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildHoldings } from '@/lib/calculations'
import { getCachedAsxQuotes } from '@/lib/asx/cache'

export interface RebalanceTarget {
  ticker: string
  targetPct: number
}

export interface RebalanceHolding {
  ticker: string
  currentValue: number
  currentPct: number
  targetPct: number
}

export interface RebalanceResponse {
  holdings: RebalanceHolding[]
  totalValue: number
  targets: RebalanceTarget[]
  currency: string
}

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

  const transactions = await prisma.transaction.findMany({
    where: { portfolioId: id },
    orderBy: { date: 'asc' },
  })

  const tickers = [...new Set(transactions.map((t) => t.ticker.toUpperCase()))]
  const priceMap = await getCachedAsxQuotes(tickers)
  const holdings = buildHoldings(transactions, priceMap)

  const totalValue = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0)

  const savedTargets: RebalanceTarget[] = portfolio.rebalanceTargets
    ? (JSON.parse(portfolio.rebalanceTargets) as RebalanceTarget[])
    : []

  const targetMap = new Map(savedTargets.map((t) => [t.ticker, t.targetPct]))

  const rebalanceHoldings: RebalanceHolding[] = holdings.map((h) => ({
    ticker: h.ticker,
    currentValue: h.currentValue ?? 0,
    currentPct: totalValue > 0 ? ((h.currentValue ?? 0) / totalValue) * 100 : 0,
    targetPct: targetMap.get(h.ticker) ?? 0,
  }))

  // Sort: by current value descending
  rebalanceHoldings.sort((a, b) => b.currentValue - a.currentValue)

  return Response.json({
    holdings: rebalanceHoldings,
    totalValue,
    targets: savedTargets,
    currency: portfolio.currency,
  } satisfies RebalanceResponse)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const portfolio = await prisma.portfolio.findUnique({
    where: { id, userId: session.user.id },
  })
  if (!portfolio) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as { targets: RebalanceTarget[] }
  if (!Array.isArray(body.targets)) {
    return Response.json({ error: 'targets must be an array' }, { status: 400 })
  }

  const cleaned = body.targets
    .filter((t) => typeof t.ticker === 'string' && typeof t.targetPct === 'number' && t.targetPct >= 0)
    .map((t) => ({ ticker: t.ticker.toUpperCase(), targetPct: t.targetPct }))

  await prisma.portfolio.update({
    where: { id },
    data: { rebalanceTargets: JSON.stringify(cleaned) },
  })

  return Response.json({ ok: true })
}
