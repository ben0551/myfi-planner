import { NextRequest } from 'next/server'
import { getCachedAsxQuotes } from '@/lib/asx/cache'
import { syncAnnouncements } from '@/lib/asx/cache'
import { getResearchData } from '@/lib/yahoo'
import { prisma } from '@/lib/prisma'
import type { ResearchSummary } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const upper = ticker.toUpperCase()

  const [priceMap, yahooData] = await Promise.all([
    getCachedAsxQuotes([upper]),
    getResearchData(upper),
    syncAnnouncements(upper),
  ])

  const quote = priceMap.get(upper)
  const announcements = await prisma.announcement.findMany({
    where: { ticker: upper },
    orderBy: { releasedAt: 'desc' },
    take: 20,
  })

  const result: ResearchSummary = {
    ticker: upper,
    companyName: yahooData.companyName ?? upper,
    currentPrice: quote?.price ?? yahooData.currentPrice ?? null,
    change: quote?.change ?? yahooData.change ?? null,
    changePct: quote?.changePct ?? yahooData.changePct ?? null,
    marketCap: yahooData.marketCap ?? null,
    peRatio: yahooData.peRatio ?? null,
    forwardPE: yahooData.forwardPE ?? null,
    eps: yahooData.eps ?? null,
    dividendYield: yahooData.dividendYield ?? null,
    beta: yahooData.beta ?? null,
    fiftyTwoWeekHigh: yahooData.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: yahooData.fiftyTwoWeekLow ?? null,
    recommendationMean: yahooData.recommendationMean ?? null,
    recommendationKey: yahooData.recommendationKey ?? null,
    analystCounts: yahooData.analystCounts ?? {
      strongBuy: 0,
      buy: 0,
      hold: 0,
      sell: 0,
      strongSell: 0,
    },
    announcements: announcements.map((a) => ({
      asxId: a.asxId,
      title: a.title,
      url: a.url,
      marketSensitive: a.marketSensitive,
      releasedAt: a.releasedAt,
      category: a.category,
    })),
  }

  return Response.json(result)
}
