import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'
import { getYfHistoryFull, getYfHistoryFromDate, getYfQuote } from '@/lib/yahoo'

const BATCH_SIZE = 5   // concurrent Yahoo Finance requests

/**
 * POST /api/admin/sync-prices
 *
 * Finds every ticker across all portfolios and ensures:
 *   1. HistoricalPrice (source='ASX') is up to date (2-year full fetch on first run,
 *      incremental from latest date on subsequent runs)
 *   2. PriceCache (current quote) is refreshed for stale entries (>60 min old)
 *
 * Accepts optional JSON body: { tickers?: string[] } to sync a specific subset.
 * Returns a JSON summary of what was processed.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  // Determine ticker list
  let tickers: string[]
  try {
    const body = await request.json().catch(() => ({}))
    if (Array.isArray(body?.tickers) && body.tickers.length > 0) {
      tickers = (body.tickers as string[]).map((t: string) => t.toUpperCase())
    } else {
      // All tickers across all portfolios
      const rows = await prisma.transaction.findMany({
        distinct: ['ticker'],
        select: { ticker: true },
      })
      tickers = [...new Set(rows.map((r) => r.ticker.toUpperCase()))]
    }
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 })
  }

  if (tickers.length === 0) {
    return Response.json({ message: 'No tickers found', synced: 0, updated: 0, skipped: 0, errors: 0 })
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // Find latest HistoricalPrice date per ticker (ASX source)
  const latestByTicker = new Map<string, Date>()
  const latestRows = await prisma.$queryRaw<{ ticker: string; maxdate: Date }[]>`
    SELECT ticker, MAX(date) as maxDate
    FROM "HistoricalPrice"
    WHERE source = 'ASX' AND ticker = ANY(${tickers})
    GROUP BY ticker
  `.catch(() => [] as { ticker: string; maxdate: Date }[])

  for (const row of latestRows) {
    latestByTicker.set(row.ticker, new Date(row.maxdate))
  }

  // Price cache staleness check (>60 min)
  const priceCutoff = new Date(Date.now() - 60 * 60 * 1000)
  const stalePriceCache = new Set<string>()
  const cacheRows = await prisma.priceCache.findMany({
    where: { ticker: { in: tickers }, fetchedAt: { lt: priceCutoff } },
    select: { ticker: true },
  })
  for (const row of cacheRows) stalePriceCache.add(row.ticker)
  // Tickers not in cache at all are also stale
  const cachedTickers = new Set(
    (await prisma.priceCache.findMany({ where: { ticker: { in: tickers } }, select: { ticker: true } }))
      .map((r) => r.ticker)
  )
  for (const t of tickers) {
    if (!cachedTickers.has(t)) stalePriceCache.add(t)
  }

  let synced = 0   // full history fetched
  let updated = 0  // incremental history updated
  let skipped = 0  // already up to date
  let errors = 0
  const errorList: string[] = []

  // Process history in batches
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(
      batch.map(async (ticker) => {
        try {
          const latest = latestByTicker.get(ticker)

          let newPoints: { date: Date; open: number | null; high: number | null; low: number | null; close: number; volume: bigint | null }[] = []

          if (!latest) {
            // Full 2-year history
            const history = await getYfHistoryFull(ticker)
            newPoints = history.map((p) => ({
              date: new Date(p.date),
              open: p.open || null,
              high: p.high || null,
              low: p.low || null,
              close: p.close,
              volume: p.volume ? BigInt(Math.round(p.volume)) : null,
            }))
            if (newPoints.length > 0) synced++
            else skipped++
          } else {
            const latestDate = new Date(latest)
            latestDate.setUTCHours(0, 0, 0, 0)
            if (latestDate >= today) {
              skipped++
              return
            }
            const history = await getYfHistoryFromDate(ticker, latestDate)
            // Filter out dates we already have
            newPoints = history
              .filter((p) => new Date(p.date) > latestDate)
              .map((p) => ({
                date: new Date(p.date),
                open: p.open || null,
                high: p.high || null,
                low: p.low || null,
                close: p.close,
                volume: p.volume ? BigInt(Math.round(p.volume)) : null,
              }))
            if (newPoints.length > 0) updated++
            else skipped++
          }

          if (newPoints.length > 0) {
            await Promise.allSettled(
              newPoints.map((p) =>
                prisma.historicalPrice.upsert({
                  where: { ticker_date_source: { ticker, date: p.date, source: 'ASX' } },
                  update: { open: p.open, high: p.high, low: p.low, close: p.close, volume: p.volume },
                  create: { ticker, date: p.date, open: p.open, high: p.high, low: p.low, close: p.close, volume: p.volume, source: 'ASX' },
                })
              )
            )
          }

          // Refresh PriceCache if stale
          if (stalePriceCache.has(ticker)) {
            const quote = await getYfQuote(ticker)
            if (quote) {
              const now = new Date()
              await prisma.priceCache.upsert({
                where: { ticker },
                update: {
                  price: quote.price,
                  currency: 'AUD',
                  change: quote.change,
                  changePct: quote.changePct,
                  marketTime: now,
                  fetchedAt: now,
                  companyName: quote.companyName ?? undefined,
                  fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? undefined,
                  fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? undefined,
                },
                create: {
                  ticker,
                  price: quote.price,
                  currency: 'AUD',
                  change: quote.change,
                  changePct: quote.changePct,
                  marketTime: now,
                  fetchedAt: now,
                  source: 'ASX',
                  companyName: quote.companyName ?? null,
                  fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? null,
                  fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? null,
                },
              })
            }
          }
        } catch (err) {
          errors++
          errorList.push(`${ticker}: ${err instanceof Error ? err.message : String(err)}`)
          console.error(`[sync-prices] ${ticker}:`, err)
        }
      })
    )
  }

  return Response.json({
    tickers: tickers.length,
    synced,
    updated,
    skipped,
    errors,
    ...(errorList.length > 0 ? { errorDetails: errorList } : {}),
  })
}

/** GET — returns current sync status (ticker count, history coverage) */
export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const [tickerRows, historySummary, cacheCount] = await Promise.all([
    prisma.transaction.findMany({ distinct: ['ticker'], select: { ticker: true } }),
    prisma.$queryRaw<{ ticker: string; count: number; minDate: string; maxDate: string }[]>`
      SELECT ticker, COUNT(*) as count, MIN(date) as minDate, MAX(date) as maxDate
      FROM HistoricalPrice
      WHERE source = 'ASX'
      GROUP BY ticker
    `.catch(() => []),
    prisma.priceCache.count(),
  ])

  const tickers = [...new Set(tickerRows.map((r) => r.ticker.toUpperCase()))]
  const historyMap = new Map(historySummary.map((r) => [r.ticker, r]))

  return Response.json({
    totalPortfolioTickers: tickers.length,
    priceCacheEntries: cacheCount,
    coverage: tickers.map((t) => {
      const h = historyMap.get(t)
      return {
        ticker: t,
        historyPoints: h ? Number(h.count) : 0,
        from: h?.minDate ?? null,
        to: h?.maxDate ?? null,
      }
    }),
  })
}
