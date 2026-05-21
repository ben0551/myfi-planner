import { NextRequest } from 'next/server'
import { getYfHistoryFromDate, getYfHistoryFull } from '@/lib/yahoo'
import { prisma } from '@/lib/prisma'

// Benchmark price history with DB caching (source: 'BENCHMARK')
// Usage: GET /api/market/history?ticker=^AXJO
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const ticker = searchParams.get('ticker')
  if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 })

  const upper = ticker.toUpperCase()

  const latest = await prisma.historicalPrice.findFirst({
    where: { ticker: upper, source: 'BENCHMARK' },
    orderBy: { date: 'desc' },
    select: { date: true },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (!latest || latest.date < today) {
    try {
      const points = latest
        ? await getYfHistoryFromDate(upper, latest.date)
        : await getYfHistoryFull(upper)

      for (const point of points) {
        const date = new Date(point.date)
        await prisma.historicalPrice.upsert({
          where: { ticker_date_source: { ticker: upper, date, source: 'BENCHMARK' } },
          create: {
            ticker: upper, date, source: 'BENCHMARK',
            open: point.open, high: point.high, low: point.low, close: point.close,
            volume: point.volume != null ? BigInt(Math.round(point.volume)) : null,
          },
          update: { close: point.close },
        })
      }
    } catch (err) {
      console.error('[market/history] fetch failed for', upper, err)
    }
  }

  const rows = await prisma.historicalPrice.findMany({
    where: { ticker: upper, source: 'BENCHMARK' },
    orderBy: { date: 'asc' },
    select: { date: true, close: true },
  })

  return Response.json(rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    close: Number(r.close),
  })))
}
