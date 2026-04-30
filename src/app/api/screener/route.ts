import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface ScreenerResult {
  ticker: string
  companyName: string | null
  price: number | null
  changePct: number | null
  dividendYield: number | null
  frankingPct: number | null
  peRatio: number | null
  sector: string | null
  industry: string | null
  marketCap: string | null
  onWatchlist: boolean
  watchlistId: string | null
  isHeld: boolean
  hasFundamentals: boolean  // true if yield or PE data is available
}

export interface ScreenerResponse {
  results: ScreenerResult[]
  sectors: string[]
  total: number            // count of results returned
  totalInDb: number        // total tickers in MarketIndexSnapshot
  fundAvailableCount: number  // tickers with at least yield or PE data
}

// Default cap when no filters applied — avoids loading all ~2000 tickers into the UI
const DEFAULT_LIMIT = 300

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const { searchParams } = new URL(req.url)

  const minYield = Number(searchParams.get('minYield') ?? 0) || 0
  const maxPE    = Number(searchParams.get('maxPE') ?? 0) || 0
  const sector   = searchParams.get('sector') ?? ''
  const onWatchlistOnly = searchParams.get('onWatchlist') === 'true'
  const holdingsOnly    = searchParams.get('holdings') === 'true'
  // fundOnly: only show tickers that have been synced with fundamentals
  const fundOnly = searchParams.get('fundOnly') !== 'false'  // default true

  const [watchlistItems, transactions] = await Promise.all([
    prisma.watchlistItem.findMany({ where: { userId }, select: { id: true, ticker: true } }),
    prisma.transaction.findMany({
      where: { portfolio: { userId } },
      select: { ticker: true, type: true, quantity: true },
    }),
  ])

  const watchlistMap = new Map(watchlistItems.map((w) => [w.ticker.toUpperCase(), w.id]))

  const holdingQty = new Map<string, number>()
  for (const tx of transactions) {
    const t = tx.ticker.toUpperCase()
    const qty = Number(tx.quantity)
    if (tx.type === 'BUY') holdingQty.set(t, (holdingQty.get(t) ?? 0) + qty)
    else if (tx.type === 'SELL') holdingQty.set(t, Math.max(0, (holdingQty.get(t) ?? 0) - qty))
  }
  const heldSet = new Set(
    [...holdingQty.entries()].filter(([, q]) => q > 0.00001).map(([t]) => t)
  )

  let tickerIn: string[] | undefined
  if (onWatchlistOnly && holdingsOnly) {
    tickerIn = [...watchlistMap.keys()].filter((t) => heldSet.has(t))
  } else if (onWatchlistOnly) {
    tickerIn = [...watchlistMap.keys()]
  } else if (holdingsOnly) {
    tickerIn = [...heldSet]
  }

  // Build Prisma where clause
  const conditions: Record<string, unknown>[] = []
  if (tickerIn !== undefined) conditions.push({ ticker: { in: tickerIn } })
  if (sector) conditions.push({ sector })
  if (minYield > 0) conditions.push({ dividendYield: { gte: minYield } })
  if (maxPE > 0) conditions.push({ peRatio: { gt: 0, lte: maxPE } })

  // When no portfolio/watchlist filter, require fundamentals by default
  // so we don't return thousands of name-only stubs
  const hasAnyFilter = tickerIn !== undefined || minYield > 0 || maxPE > 0 || sector
  if (fundOnly && !hasAnyFilter) {
    conditions.push({
      OR: [
        { dividendYield: { not: null } },
        { peRatio: { not: null } },
        { marketCap: { not: null } },
      ],
    })
  }

  const where = conditions.length > 0 ? { AND: conditions } : {}

  const [snapshots, allSectorRows, totalInDb, fundAvailableCount] = await Promise.all([
    prisma.marketIndexSnapshot.findMany({
      where,
      orderBy: [{ dividendYield: 'desc' }, { ticker: 'asc' }],
      take: hasAnyFilter ? undefined : DEFAULT_LIMIT,
    }),
    prisma.marketIndexSnapshot.findMany({
      where: { sector: { not: null } },
      select: { sector: true },
      distinct: ['sector'],
      orderBy: { sector: 'asc' },
    }),
    prisma.marketIndexSnapshot.count(),
    prisma.marketIndexSnapshot.count({
      where: { OR: [{ dividendYield: { not: null } }, { peRatio: { not: null } }, { marketCap: { not: null } }] },
    }),
  ])

  const snapshotTickers = snapshots.map((s) => s.ticker)
  const priceCache = await prisma.priceCache.findMany({
    where: { ticker: { in: snapshotTickers } },
    select: { ticker: true, price: true, changePct: true, companyName: true },
  })
  const priceMap = new Map(priceCache.map((p) => [p.ticker, p]))

  const results: ScreenerResult[] = snapshots.map((s) => {
    const pc = priceMap.get(s.ticker)
    const hasFundamentals = s.dividendYield != null || s.peRatio != null || s.marketCap != null
    return {
      ticker: s.ticker,
      companyName: s.companyName ?? pc?.companyName ?? null,
      price: pc ? Number(pc.price) : (s.price ?? null),
      changePct: pc?.changePct != null ? Number(pc.changePct) : (s.changePct ?? null),
      dividendYield: s.dividendYield ?? null,
      frankingPct: s.frankingPct ?? null,
      peRatio: s.peRatio ?? null,
      sector: s.sector ?? null,
      industry: s.industry ?? null,
      marketCap: s.marketCap ?? null,
      onWatchlist: watchlistMap.has(s.ticker),
      watchlistId: watchlistMap.get(s.ticker) ?? null,
      isHeld: heldSet.has(s.ticker),
      hasFundamentals,
    }
  })

  const sectors = allSectorRows.map((s) => s.sector!).filter(Boolean)

  return Response.json({
    results,
    sectors,
    total: results.length,
    totalInDb,
    fundAvailableCount,
  } satisfies ScreenerResponse)
}
