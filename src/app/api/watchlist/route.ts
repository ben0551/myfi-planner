import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCachedAsxQuotes } from '@/lib/asx/cache'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const items = await prisma.watchlistItem.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  if (items.length === 0) return Response.json([])

  const tickers = items.map((i) => i.ticker)
  const priceMap = await getCachedAsxQuotes(tickers)

  const result = items.map((item) => {
    const quote = priceMap.get(item.ticker)
    return {
      id: item.id,
      ticker: item.ticker,
      targetPrice: item.targetPrice,
      notes: item.notes,
      createdAt: item.createdAt,
      price: quote?.price ?? null,
      change: quote?.change ?? null,
      changePct: quote?.changePct ?? null,
      companyName: quote?.companyName ?? null,
    }
  })

  return Response.json(result)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { ticker, targetPrice, notes } = body

  if (!ticker || typeof ticker !== 'string') {
    return Response.json({ error: 'ticker is required' }, { status: 400 })
  }

  const item = await prisma.watchlistItem.upsert({
    where: { userId_ticker: { userId: session.user.id, ticker: ticker.toUpperCase() } },
    update: {
      targetPrice: targetPrice ?? null,
      notes: notes ?? null,
    },
    create: {
      userId: session.user.id,
      ticker: ticker.toUpperCase(),
      targetPrice: targetPrice ?? null,
      notes: notes ?? null,
    },
  })

  return Response.json(item, { status: 201 })
}
