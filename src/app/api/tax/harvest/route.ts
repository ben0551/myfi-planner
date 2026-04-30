import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeCGTReport, currentFY, getFYLabel } from '@/lib/tax'
import { buildHoldings } from '@/lib/calculations'
import { getCachedAsxQuotes } from '@/lib/asx/cache'

export interface HarvestPosition {
  ticker: string
  portfolioId: string
  portfolioName: string
  quantity: number
  avgCost: number
  costBasis: number
  currentPrice: number
  currentValue: number
  unrealisedLoss: number  // always negative
}

export interface HarvestResponse {
  fyLabel: string
  fyYear: number
  realisedGrossGain: number
  realisedNetAssessable: number   // after discount and already-realised losses
  positions: HarvestPosition[]
  totalHarvestableLoss: number    // absolute value; sum of all unrealised losses
  maxOffsetAvailable: number      // min(totalHarvestableLoss, realisedNetAssessable)
  estimatedTaxSaving: number      // maxOffsetAvailable × 47%
  currency: string
}

const MARGINAL_RATE = 0.47

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const { searchParams } = new URL(req.url)
  const fyYear = parseInt(searchParams.get('fy') ?? String(currentFY()), 10)

  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    include: {
      transactions: { orderBy: { date: 'asc' } },
    },
  })

  const currency = portfolios[0]?.currency ?? 'AUD'

  // Realised CGT across all portfolios for this FY
  let realisedGrossGain = 0
  let realisedNetAssessable = 0
  for (const p of portfolios) {
    const cgt = computeCGTReport(p.transactions, fyYear)
    realisedGrossGain += cgt.totalGrossGain
    realisedNetAssessable += cgt.netAssessableGain
  }

  // Collect all currently-held tickers across portfolios
  const allTickers = new Set<string>()
  for (const p of portfolios) {
    for (const tx of p.transactions) {
      if (tx.type === 'BUY' || tx.type === 'SELL') {
        allTickers.add(tx.ticker.toUpperCase())
      }
    }
  }
  const priceMap = await getCachedAsxQuotes([...allTickers])

  // Find harvestable positions (unrealised losses) across all portfolios
  const positions: HarvestPosition[] = []

  for (const p of portfolios) {
    const holdings = buildHoldings(p.transactions, priceMap)
    for (const h of holdings) {
      if (
        h.quantity > 0 &&
        h.currentPrice !== null &&
        h.currentValue !== null &&
        h.unrealisedGain !== null &&
        h.unrealisedGain < 0
      ) {
        positions.push({
          ticker: h.ticker,
          portfolioId: p.id,
          portfolioName: p.name,
          quantity: h.quantity,
          avgCost: h.avgCost,
          costBasis: h.totalCostBasis,
          currentPrice: h.currentPrice,
          currentValue: h.currentValue,
          unrealisedLoss: h.unrealisedGain, // negative
        })
      }
    }
  }

  // Sort by largest loss first
  positions.sort((a, b) => a.unrealisedLoss - b.unrealisedLoss)

  const totalHarvestableLoss = positions.reduce((s, p) => s + Math.abs(p.unrealisedLoss), 0)
  const maxOffsetAvailable = Math.min(totalHarvestableLoss, Math.max(0, realisedNetAssessable))
  const estimatedTaxSaving = maxOffsetAvailable * MARGINAL_RATE

  return Response.json({
    fyLabel: getFYLabel(fyYear),
    fyYear,
    realisedGrossGain,
    realisedNetAssessable,
    positions,
    totalHarvestableLoss,
    maxOffsetAvailable,
    estimatedTaxSaving,
    currency,
  } satisfies HarvestResponse)
}
