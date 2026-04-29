import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCachedAsxQuotes } from '@/lib/asx/cache'
import { computePortfolioPerformance } from '@/lib/calculations'
import { recordSnapshot } from '@/lib/snapshots'

// Called by an external scheduler (e.g. Docker cron, Traefik cron, or a simple curl job).
// Protect with CRON_SECRET env var so this endpoint can't be triggered by anyone.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const portfolios = await prisma.portfolio.findMany({
    include: {
      transactions: { orderBy: { date: 'asc' } },
    },
  })

  const results: { portfolioId: string; name: string; value: number | null; error?: string }[] = []

  for (const portfolio of portfolios) {
    if (portfolio.transactions.length === 0) {
      results.push({ portfolioId: portfolio.id, name: portfolio.name, value: null })
      continue
    }

    try {
      const tickers = [...new Set(portfolio.transactions.map((t) => t.ticker.toUpperCase()))]
      const priceMap = await getCachedAsxQuotes(tickers)
      const perf = computePortfolioPerformance(
        portfolio.id,
        portfolio.name,
        portfolio.currency,
        portfolio.transactions,
        priceMap
      )
      await recordSnapshot(portfolio.id, perf.currentMarketValue, perf.totalInvested)
      results.push({ portfolioId: portfolio.id, name: portfolio.name, value: perf.currentMarketValue })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[cron/snapshots] Failed for portfolio ${portfolio.id}:`, err)
      results.push({ portfolioId: portfolio.id, name: portfolio.name, value: null, error: msg })
    }
  }

  const snapped = results.filter((r) => r.value !== null).length
  console.log(`[cron/snapshots] Snapshotted ${snapped}/${portfolios.length} portfolios`)

  return Response.json({ snapped, total: portfolios.length, results })
}
