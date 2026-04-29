import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCachedAsxQuotes } from '@/lib/asx/cache'
import { getYfFundamentals, getYfProfile } from '@/lib/yahoo'

function fmtMarketCap(v: number | null): string | null {
  if (v == null) return null
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

/** GET — return latest cached snapshot for a ticker */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker } = await params
  const upper = ticker.toUpperCase()

  const snapshot = await prisma.marketIndexSnapshot.findUnique({ where: { ticker: upper } })
  if (!snapshot) return Response.json(null)

  return Response.json({
    ticker: snapshot.ticker,
    companyName: snapshot.companyName,
    price: snapshot.price,
    change: snapshot.change,
    changePct: snapshot.changePct,
    volume: snapshot.volume,
    marketCap: snapshot.marketCap,
    peRatio: snapshot.peRatio,
    eps: snapshot.eps,
    dividendYield: snapshot.dividendYield,
    dividendAmount: snapshot.dividendAmount,
    frankingPct: snapshot.frankingPct,
    high52Week: snapshot.high52Week,
    low52Week: snapshot.low52Week,
    sector: snapshot.sector,
    industry: snapshot.industry,
    fetchedAt: snapshot.fetchedAt,
  })
}

/**
 * POST — triggered when user clicks the MarketIndex link.
 * Fetches fresh data from Yahoo Finance and upserts to DB.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker } = await params
  const upper = ticker.toUpperCase()

  // Don't re-fetch within 5 minutes
  const existing = await prisma.marketIndexSnapshot.findUnique({ where: { ticker: upper } })
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  if (existing && existing.fetchedAt > fiveMinutesAgo) {
    return Response.json({ cached: true, fetchedAt: existing.fetchedAt })
  }

  // Fetch in background — respond immediately
  void (async () => {
    try {
      const [priceMap, fundamentals, profile] = await Promise.all([
        getCachedAsxQuotes([upper]),
        getYfFundamentals(upper),
        getYfProfile(upper),
      ])
      const quote = priceMap.get(upper)

      await prisma.marketIndexSnapshot.upsert({
        where: { ticker: upper },
        update: {
          fetchedAt: new Date(),
          companyName: quote?.companyName ?? undefined,
          price: quote?.price ?? undefined,
          change: quote?.change ?? undefined,
          changePct: quote?.changePct ?? undefined,
          high52Week: quote?.fiftyTwoWeekHigh ?? undefined,
          low52Week: quote?.fiftyTwoWeekLow ?? undefined,
          marketCap: fmtMarketCap(fundamentals?.marketCap ?? null),
          peRatio: fundamentals?.trailingPE ?? undefined,
          eps: fundamentals?.trailingEps ?? undefined,
          dividendYield: fundamentals?.dividendYield ?? undefined,
          sector: profile?.sector ?? undefined,
          industry: profile?.industry ?? undefined,
        },
        create: {
          ticker: upper,
          fetchedAt: new Date(),
          companyName: quote?.companyName ?? null,
          price: quote?.price ?? null,
          change: quote?.change ?? null,
          changePct: quote?.changePct ?? null,
          high52Week: quote?.fiftyTwoWeekHigh ?? null,
          low52Week: quote?.fiftyTwoWeekLow ?? null,
          marketCap: fmtMarketCap(fundamentals?.marketCap ?? null),
          peRatio: fundamentals?.trailingPE ?? null,
          eps: fundamentals?.trailingEps ?? null,
          dividendYield: fundamentals?.dividendYield ?? null,
          sector: profile?.sector ?? null,
          industry: profile?.industry ?? null,
        },
      })
      console.log(`[research] refreshed snapshot for ${upper}`)
    } catch (err) {
      console.error(`[research] snapshot refresh failed for ${upper}:`, err)
    }
  })()

  return Response.json({ ok: true })
}
