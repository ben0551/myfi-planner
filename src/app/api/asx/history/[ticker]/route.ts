import { NextRequest } from 'next/server'
import { getYfHistoryFromDate, getYfHistoryFull } from '@/lib/yahoo'
import { prisma } from '@/lib/prisma'

// BigInt can't be JSON-serialized; convert volume to number
function serializePrices(prices: { volume: bigint | null; [key: string]: unknown }[]) {
  return prices.map((p) => ({ ...p, volume: p.volume != null ? Number(p.volume) : null }))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const { searchParams } = request.nextUrl
  const count = parseInt(searchParams.get('count') ?? '200', 10)
  const upper = ticker.toUpperCase()

  // Find the most recently stored date for this ticker
  const latest = await prisma.historicalPrice.findFirst({
    where: { ticker: upper, source: 'ASX' },
    orderBy: { date: 'desc' },
    select: { date: true },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const needsIncremental = latest && latest.date < today
  const needsFullFetch = !latest

  if (needsFullFetch || needsIncremental) {
    try {
      const points = needsFullFetch
        ? await getYfHistoryFull(upper)
        : await getYfHistoryFromDate(upper, latest!.date)

      for (const point of points) {
        const date = new Date(point.date)
        await prisma.historicalPrice.upsert({
          where: {
            ticker_date_source: { ticker: upper, date, source: 'ASX' },
          },
          update: {
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume != null ? BigInt(Math.round(point.volume)) : null,
          },
          create: {
            ticker: upper,
            date,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume != null ? BigInt(Math.round(point.volume)) : null,
            source: 'ASX',
          },
        })
      }
    } catch (err) {
      console.error('[asx/history] fetch failed:', err)
    }
  }

  const rows = await prisma.historicalPrice.findMany({
    where: { ticker: upper, source: 'ASX' },
    orderBy: { date: 'desc' },
    take: count,
  })

  return Response.json(serializePrices(rows.reverse()))
}
